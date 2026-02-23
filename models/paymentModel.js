const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const sql = require("../connection");
var tableConfig = require("../config/table_name.json");
var md5 = require("md5");
var q = require("q");
const commonfunction = require("../models/commonfunction");
var commonFunction = require("../models/commonfunction");
const pushNotification = require("../common/sendPushNotification");
const multer = require("multer");
const {getQueryResults} = require("../models/commonfunction");
const generator = require("generate-password");
const {messaging} = require("firebase-admin");
const axios = require("axios");
module.exports = {
  checkout: async (req) => {
    const {amount, payment_for, user_id, recommendation_id} = req.body;

    const deferred = q.defer();

    try {
      // Card/Stripe has a minimum amount (e.g. 50 cents). For commission under that, ask user to pay with Wallet.
      const amountCents = Number(amount);
      if (payment_for === "1" && !Number.isNaN(amountCents) && amountCents > 0 && amountCents < 50) {
        deferred.resolve({
          status: 0,
          message: "Card payment requires a minimum of $0.50. For $0.10 please use Wallet.",
        });
        return deferred.promise;
      }

      // Create or retrieve the Stripe Customer object associated with your user.
      const customer = await stripe.customers.create(); // This example just creates a new Customer every time
      // Create an ephemeral key for the Customer; this allows the app to display saved payment methods and save new ones
      const ephemeralKey = await stripe.ephemeralKeys.create(
        {customer: customer.id},
        {apiVersion: "2025-01-27.acacia"}
      );
      //   console.log("Body", req.body);
      //   console.log("ephemeralKey", ephemeralKey);

      // Create a PaymentIntent with the payment amount, currency, and customer
      const paymentIntent = await stripe.paymentIntents.create({
        amount: payment_for === "0" ? (Number(amount) + Number(amount) * 0.04).toString() : amount,
        currency: "SGD",
        customer: customer.id,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      //   console.log("paymentIntent", paymentIntent);
      // Insert customer into the database
      const customerQuery = `INSERT INTO ${tableConfig.CUSTOMER} SET ?`;
      const insertData = {
        customer_id: customer.id,
        user_id: user_id,
        payment_for: payment_for,
        recommendation_id: recommendation_id,
        amount: amount,
        payment_intent_id: paymentIntent.id,
        status: "created",
      };

      const createCustomer = await commonFunction.insertQuery(customerQuery, insertData);

      // Prepare update query based on the 'payment_for' value
      let updateData = [createCustomer.insertId];
      let userUpdateQuery = "";

      if (payment_for === "0") {
        // Update user table for customer_id
        userUpdateQuery = `UPDATE ${tableConfig.USER} SET customer_id = ? WHERE id = ?`;
        updateData.push(user_id);
      } else if (payment_for === "1") {
        // Update recommendation table for customer_id
        userUpdateQuery = `UPDATE ${tableConfig.RECOMMENDATIONS} SET customer_id = ? WHERE id = ?`;
        updateData.push(recommendation_id);
      } else {
        // Handle default case or other scenarios
        userUpdateQuery = `UPDATE ${tableConfig.RECOMMENDATIONS} SET customer_id = ? WHERE id = ?`;
        updateData.push(recommendation_id);
      }

      // Execute the update query
      await commonFunction.insertQuery(userUpdateQuery, updateData);

      // Prepare the response data
      const data = {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        paymentIntent: paymentIntent.client_secret,
        customer: customer.id,
        ephemeralKey: ephemeralKey.secret,
        paymentIntentId: paymentIntent.id,
      };

      //   console.log(data);

      // Resolve the promise with the response data
      deferred.resolve({
        status: 1,
        data: data,
      });
    } catch (err) {
      console.error(err);

      // Resolve the promise with the error message
      deferred.resolve({
        status: 0,
        message: err.message || "An error occurred during checkout.",
      });
    }

    return deferred.promise;
  },
  paymentStatus: async (req, res) => {
    const {paymentIntentId} = req.body;
    const deferred = q.defer();

    if (!paymentIntentId) {
      deferred.resolve({
        status: 0,
        message: "Payment intent ID is required.",
      });
      return deferred.promise;
    }

    try {
      // Retrieve PaymentIntent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      // Check the status
      const status = paymentIntent.status;
      console.log(paymentIntent);

      // If the payment is successful
      if (status === "succeeded") {
        await updateCustomerForPaymentStatus(paymentIntent);
        deferred.resolve({
          status: 1,
          message: `Payment was successful!`,
          paymentIntent: paymentIntent,
        });
      } else {
        let message = `Payment failed or needs action. Current status: ${paymentIntent.status}`;

        if (paymentIntent.status === "requires_payment_method") {
          message = "Payment failed. Please provide a valid payment method.";
        } else if (paymentIntent.status === "requires_action") {
          message = "Payment requires additional authentication. Please complete the necessary steps.";
        } else if (paymentIntent.status === "succeeded") {
          message = "Payment succeeded.";
        } else if (paymentIntent.status === "canceled") {
          message = "Payment was canceled.";
        } else if (paymentIntent.status === "processing") {
          message = "Payment is being processed.";
        }
        // If the payment failed or requires further actions
        deferred.resolve({
          status: 0,
          message: message,
          paymentIntent: paymentIntent,
        });
      }
    } catch (error) {
      console.error(error);
      deferred.resolve({
        status: 0,
        message: error.message || "An error occurred during payment status check.",
      });
    }

    return deferred.promise;
  },
};
async function updateCustomer(event) {
  console.log("update customer ..................................");
  console.log(event);

  try {
    console.log(event.status);

    // Update customer ........................
    const query = `UPDATE ${tableConfig.CUSTOMER} SET status = ? WHERE customer_id = ?`;
    const updateData = [event.status, event.customer];

    const updated = await commonfunction.insertQuery(query, updateData);

    if (event.status === "succeeded") {
      console.log("con suceeded .....................");

      // Get customer ...........................
      const customer = await getQueryResults(
        `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = '${event.customer}'`
      );
      console.log(customer, "customer 0 .....................................");

      console.log(updated, "updated ..................");
      console.log(updated.affectedRows, "affectedRows ..................");
      // if customer updated with success status ............
      if (updated.affectedRows > 0) {
        console.log(updated.affectedRows, "affectedRows ..................");

        if (
          customer[0].payment_for === "1" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          console.log(customer, "customer .............................");

          // const updateRecommendationQuery = `Update ${tableConfig.RECOMMENDATIONS} SET status = ?, payment_status = ? WHERE `

          //   const res = await axios.post(
          //     "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
          //     {}
          //   );

          const amount_paid = Number(customer[0].amount) / 100;

          const adminCommission = (Number(amount_paid) * (Number(5) / 100)) // admin commission 5
            .toFixed(2);
          const recommenderCommission = (Number(amount_paid) - adminCommission).toFixed(2);

          const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET amount_paid = ?, 
                                                                        status = ?,
                                                                        payment_status = ?,
                                                                        paid_at = ?,
                                                                        admin_commission = ?,
                                                                        amount_received_by_recommender = ? WHERE id = ? `;
          const recommendationUpdateData = [
            amount_paid,
            "paid",
            "paid",
            new Date(),
            adminCommission,
            recommenderCommission,
            customer[0].recommendation_id,
          ];
          // update recommendations table
          const updated = await commonfunction.updateQuery(query, recommendationUpdateData);

          // update commissions table
          const inserCommissionQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;

          const commissionData = {
            user_id: customer[0].user_id,
            recommendation_id: customer[0].recommendation_id,
            commission: adminCommission,
            commission_for: "commission_paid",
            created_at: new Date(),
            updated_at: new Date(),
          };
          // insert commission
          const insertCommission = await commonfunction.insertQuery(inserCommissionQuery, commissionData);

          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];

          // update customer table
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);

          const recommendation = await getQueryResults(`SELECT * FROM ${tableConfig.RECOMMENDATIONS}
               WHERE id = ${customer[0].recommendation_id}`);

          const walletUpdateQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${recommenderCommission} 
              WHERE id = ${recommendation[0].recommender_id}`;
          // update wallet balance
          const updateUserWallet = await commonfunction.getQueryResults(walletUpdateQuery);

          const users = await getQueryResults(`SELECT u.name as service_provider_name,
                                        u.registration_token as provider_token,
                                        u1.name as recommender_name, 
                                        u1.registration_token as recommender_token,
                                        u1.platform as platform
                                        FROM ${tableConfig.USER} u
                                LEFT JOIN ${tableConfig.USER} u1 ON u1.id = '${recommendation[0].recommender_id}'
                                WHERE u.id = '${recommendation[0].service_provider_id}'`);
          // console.log(users, "====the user details=====");
          if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
            const {platform, service_provider_name, recommender_token} = users[0];
            const recommendationId = customer[0]?.recommendation_id;

            let message;

            if (platform === "android") {
              message = {
                data: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                android: {
                  priority: "high",
                },
                token: recommender_token,
              };
            } else {
              message = {
                notification: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                },
                data: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                apns: {
                  headers: {
                    "apns-priority": "5",
                  },
                },
                token: recommender_token,
              };
            }

            pushNotification.sendMessage(message);
          }

          console.log("updated recommendation successfully");
        }
        if (
          customer[0].payment_for === "0" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          const amount = Number(customer[0].amount) / 100;

          const query = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(amount).toFixed(2)} 
                                WHERE id = '${customer[0].user_id}'`;
          const updatedUser = await sql.query(query);
          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);
          const payment_id = await commonFunction.generateUniquePaymentId();
          const withdrawinsertQuery = `INSERT INTO ${tableConfig.WITHDRAW} SET ?`;
          const data = {
            user_id: customer[0].user_id,
            withdraw_amount: `${Number(amount).toFixed(2)}`,
            account_holder_name: null,
            account_number: null,
            bank_name: null,
            created_at: new Date(),
            status: "success",
            payment_id: payment_id,
            type: "credit",
          };

          try {
            const insertrequest = await commonFunction.insertQuery(withdrawinsertQuery, data);
            console.log(insertrequest);
          } catch (e) {
            console.log(e);
          }
          console.log(updateCustomer, ".................. update customer .......................");
        }

        if (
          customer[0].payment_for === "2" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          const amount_paid = Number(customer[0].amount) / 100;

          const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?,
                                                                         extended_acceptance_time = ?,
                                                                         time_extended_at = ? WHERE id = ?`;

          const res = await axios.post(
            "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
            {}
          );

          const extend_hours = (amount_paid / Number(res.data.commission)).toFixed(2);

          const recommendationUpdateData = ["time_extended", extend_hours, new Date(), customer[0].recommendation_id];

          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);
          const insertQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;
          const insertData = {
            user_id: customer[0].user_id,
            recommendation_id: customer[0].recommendation_id,
            commission: amount_paid,
            commission_for: "time_extended",
          };

          const inserted = await commonfunction.insertQuery(insertQuery, insertData);
          const extended = await commonfunction.updateQuery(query, recommendationUpdateData);
          const recommendation = await getQueryResults(`SELECT * FROM ${tableConfig.RECOMMENDATIONS}
                                                              WHERE id = '${customer[0].recommendation_id}'`);

          const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                                      u.platform as platform,
                                                      u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                                      LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                                      LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                                      WHERE r.id = '${customer[0].recommendation_id}'`);

          if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
            const {platform, provider_name, recommender_token} = users[0];
            const recommendationId = customer[0]?.recommendation_id;

            let message;

            if (platform === "android") {
              message = {
                data: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                android: {
                  priority: "high",
                },
                token: recommender_token,
              };
            } else {
              message = {
                notification: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                },
                data: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                apns: {
                  headers: {
                    "apns-priority": "5",
                  },
                },
                token: recommender_token,
              };
            }

            pushNotification.sendMessage(message);
          }
        }
      }
      console.log("updated customer successfully");
    }
  } catch (err) {
    console.log(err);
  }
}
async function updateCustomerForPaymentStatus(event) {
  console.log("update customer ..................................");
  console.log(event);

  try {
    console.log(event.status);

    // Update customer ........................
    const query = `UPDATE ${tableConfig.CUSTOMER} SET status = ? WHERE customer_id = ?`;
    const updateData = [event.status, event.customer];

    const updated = await commonfunction.insertQuery(query, updateData);

    if (event.status === "succeeded") {
      console.log("con suceeded .....................");

      // Get customer ...........................
      const customer = await getQueryResults(
        `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = '${event.customer}'`
      );
      console.log(customer, "customer 0 .....................................");

      console.log(updated, "updated ..................");
      console.log(updated.affectedRows, "affectedRows ..................");
      // if customer updated with success status ............
      if (updated.affectedRows > 0) {
        console.log(updated.affectedRows, "affectedRows ..................");

        if (
          customer[0].payment_for === "1" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          console.log(customer, "customer .............................");

          // const updateRecommendationQuery = `Update ${tableConfig.RECOMMENDATIONS} SET status = ?, payment_status = ? WHERE `

          //   const res = await axios.post(
          //     "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
          //     {}
          //   );

          const amount_paid = Number(customer[0].amount) / 100;

          const adminCommission = (Number(amount_paid) * (Number(5) / 100)) // admin commission 5
            .toFixed(2);
          const recommenderCommission = (Number(amount_paid) - adminCommission).toFixed(2);

          const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET amount_paid = ?, 
                                                                        status = ?,
                                                                        payment_status = ?,
                                                                        paid_at = ?,
                                                                        admin_commission = ?,
                                                                        amount_received_by_recommender = ? WHERE id = ? `;
          const recommendationUpdateData = [
            amount_paid,
            "paid",
            "paid",
            new Date(),
            adminCommission,
            recommenderCommission,
            customer[0].recommendation_id,
          ];
          // update recommendations table
          const updated = await commonfunction.updateQuery(query, recommendationUpdateData);

          // update commissions table
          const inserCommissionQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;

          const commissionData = {
            user_id: customer[0].user_id,
            recommendation_id: customer[0].recommendation_id,
            commission: adminCommission,
            commission_for: "commission_paid",
            created_at: new Date(),
            updated_at: new Date(),
          };
          // insert commission
          const insertCommission = await commonfunction.insertQuery(inserCommissionQuery, commissionData);

          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];

          // update customer table
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);

          const recommendation = await getQueryResults(`SELECT * FROM ${tableConfig.RECOMMENDATIONS}
               WHERE id = ${customer[0].recommendation_id}`);

          const walletUpdateQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${recommenderCommission} 
              WHERE id = ${recommendation[0].recommender_id}`;
          // update wallet balance
          const updateUserWallet = await commonfunction.getQueryResults(walletUpdateQuery);

          const users = await getQueryResults(`SELECT u.name as service_provider_name,
                                        u.registration_token as provider_token,
                                        u1.name as recommender_name, 
                                        u1.registration_token as recommender_token,
                                        u1.platform as platform
                                        FROM ${tableConfig.USER} u
                                LEFT JOIN ${tableConfig.USER} u1 ON u1.id = '${recommendation[0].recommender_id}'
                                WHERE u.id = '${recommendation[0].service_provider_id}'`);
          // console.log(users, "====the user details=====");
          if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
            const {platform, service_provider_name, recommender_token} = users[0];
            const recommendationId = customer[0]?.recommendation_id;

            let message;

            if (platform === "android") {
              message = {
                data: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                android: {
                  priority: "high",
                },
                token: recommender_token,
              };
            } else {
              message = {
                notification: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                },
                data: {
                  title: "Commission credited",
                  body: `${service_provider_name} sent you a commission for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                apns: {
                  headers: {
                    "apns-priority": "5",
                  },
                },
                token: recommender_token,
              };
            }

            pushNotification.sendMessage(message);
          }

          console.log("updated recommendation successfully");
        }
        if (
          customer[0].payment_for === "0" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          const amount = Number(customer[0].amount) / 100;

          const query = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(amount).toFixed(2)} 
                                WHERE id = '${customer[0].user_id}'`;
          const updatedUser = await sql.query(query);
          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);
          const payment_id = await commonFunction.generateUniquePaymentId();
          const withdrawinsertQuery = `INSERT INTO ${tableConfig.WITHDRAW} SET ?`;
          const data = {
            user_id: customer[0].user_id,
            withdraw_amount: `${Number(amount).toFixed(2)}`,
            account_holder_name: null,
            account_number: null,
            bank_name: null,
            created_at: new Date(),
            status: "success",
            payment_id: payment_id,
            type: "credit",
          };

          try {
            const insertrequest = await commonFunction.insertQuery(withdrawinsertQuery, data);
            console.log(insertrequest);
          } catch (e) {
            console.log(e);
          }
          console.log(updateCustomer, ".................. update customer .......................");
        }

        if (
          customer[0].payment_for === "2" &&
          customer[0].status === "succeeded" &&
          customer[0].transaction_updated === "0"
        ) {
          const amount_paid = Number(customer[0].amount) / 100;

          const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?,
                                                                         extended_acceptance_time = ?,
                                                                         time_extended_at = ? WHERE id = ?`;

          const res = await axios.post(
            "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
            {}
          );

          const extend_hours = (amount_paid / Number(res.data.commission)).toFixed(2);

          const recommendationUpdateData = ["time_extended", extend_hours, new Date(), customer[0].recommendation_id];

          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);
          const insertQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;
          const insertData = {
            user_id: customer[0].user_id,
            recommendation_id: customer[0].recommendation_id,
            commission: amount_paid,
            commission_for: "time_extended",
          };

          const inserted = await commonfunction.insertQuery(insertQuery, insertData);
          const extended = await commonfunction.updateQuery(query, recommendationUpdateData);
          const recommendation = await getQueryResults(`SELECT * FROM ${tableConfig.RECOMMENDATIONS}
                                                              WHERE id = '${customer[0].recommendation_id}'`);

          const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                                      u.platform as platform,
                                                      u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                                      LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                                      LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                                      WHERE r.id = '${customer[0].recommendation_id}'`);

          if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
            const {platform, provider_name, recommender_token} = users[0];
            const recommendationId = customer[0]?.recommendation_id;

            let message;

            if (platform === "android") {
              message = {
                data: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                android: {
                  priority: "high",
                },
                token: recommender_token,
              };
            } else {
              message = {
                notification: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                },
                data: {
                  title: "Acceptance time extended",
                  body: `${provider_name} extended acceptance time for your recommendation`,
                  recommendation_id: `${recommendationId}`,
                },
                apns: {
                  headers: {
                    "apns-priority": "5",
                  },
                },
                token: recommender_token,
              };
            }

            pushNotification.sendMessage(message);
          }
        }
      }
      console.log("updated customer successfully");
    }
  } catch (err) {
    console.log(err);
  }
}
