const sql = require("../connection");
var validation = require("../common/validation");
var authModels = require("../models/authModels");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const {showWalletBalance} = require("../models/authModels");
const paymentModel = require("../models/paymentModel");
var tableConfig = require("../config/table_name.json");
const commonfunction = require("../models/commonfunction");
const {getQueryResults} = require("../models/commonfunction");
const axios = require("axios");
const pushNotification = require("../common/sendPushNotification");
const {c} = require("locutus");

// const endpointSecret = "whsec_0aec6f85aa14cf3d8179f3ea07f7e5b887664775dd835fe67fb7f13751b3735a";
const endpointSecret = "whsec_1aZi5AtR9JyYDzoM4WBTRdCkjoDyMHnD";
//Exports
module.exports = {
  // signup
  checkout: async (req, res) => {
    paymentModel.checkout(req).then(async (results) => {
      res.json(results);
    });
  },
  paymentStatus: async (req, res) => {
    paymentModel.paymentStatus(req).then(async (results) => {
      res.json(results);
    });
  },
  webHook: async (req, res) => {
    console.log("Webhook called...");

    const sig = req.headers["stripe-signature"];
    let event;
    console.log("endpointSecret", endpointSecret);
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log("Event constructed successfully");
    } catch (err) {
      console.error("Error verifying webhook signature:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("Event Type:", event.type);
    console.log("Event Data:", event.data.object);

    try {
      switch (event.type) {
        case "charge.failed":
        case "charge.pending":
        case "charge.refunded":
        case "charge.succeeded":
          await updateCustomer(event.data.object, true);
          break;

        case "customer.created":
          console.log("Customer created:", event.data.object);
          break;

        default:
          console.warn(`Unhandled event type: ${event.type}`);
      }
    } catch (processingError) {
      console.error(`Error processing event ${event.type}:`, processingError);
      return res.status(500).send("Internal Server Error");
    }

    res.json({received: true});
  },
};

/** Type-safe: run wallet/commission update when transaction not yet applied (0, "0", or null). */
function isTransactionNotYetUpdated(val) {
  return val == null || val === 0 || val === "0";
}

async function updateCustomer(event, wb = false) {
  console.log("update customer ..................................", wb ? "From Webhook" : "NOT From Webhook");
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
          isTransactionNotYetUpdated(customer[0].transaction_updated)
        ) {
          console.log(customer, "customer .............................");

          // const updateRecommendationQuery = `Update ${tableConfig.RECOMMENDATIONS} SET status = ?, payment_status = ? WHERE `

          const res = await axios.post(
            "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
            {}
          );

          const amount_paid = Number(customer[0].amount) / 100;

          const adminCommission = (Number(amount_paid) * (9 / 100)).toFixed(2);
          const adminCommission2 = Number(amount_paid) * (9 / 100);
          // const adminCommission = (Number(amount_paid) * (Number(res.data.percentage) / 100)).toFixed(2);
          const recommenderCommission = (Number(amount_paid) - adminCommission2).toFixed(2);

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
          console.log(recommendationUpdateData, "recommendationUpdateData");
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
          isTransactionNotYetUpdated(customer[0].transaction_updated)
        ) {
          const amount = Number(customer[0].amount) / 100;

          const query = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(amount).toFixed(2)} 
                              WHERE id = '${customer[0].user_id}'`;
          const updatedUser = await sql.query(query);
          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, event.customer];
          const updateCustomer = await commonfunction.insertQuery(updateCustomerQuery, updateData);
          console.log(updateCustomer, ".................. update customer .......................");
        }

        if (
          customer[0].payment_for === "2" &&
          customer[0].status === "succeeded" &&
          isTransactionNotYetUpdated(customer[0].transaction_updated)
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

async function updatePaymentInfo(event) {
  let query, recommenderQuery;

  const getTransactionStatusQuery = `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = ${event.customer}`;
  const transactionStatus = await commonfunction.getQueryResults(getTransactionStatusQuery);
  if (transactionStatus[0].status === "succeeded") {
    query = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(amount).toFixed(
      2
    )} WHERE id = ${user_id}`;
    const updatedUser = await updateQuery(query);
  }
}
