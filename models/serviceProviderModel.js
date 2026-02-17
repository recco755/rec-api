const sql = require("../connection");
var tableConfig = require("../config/table_name.json");
var md5 = require("md5");
var q = require("q");
var commonFunction = require("../models/commonfunction");
const mailNotification = require("../common/mailNotification");
const {getQueryResults, updateQuery} = require("../models/commonfunction");
const {query} = require("../connection");
const axios = require("axios");
const pushNotification = require("../common/sendPushNotification");
const {c} = require("locutus");

/** Build full URL for business_icon so rectangle images load (same as viewService / profile page). */
function toFullBusinessIconUrl(req, business_icon) {
  if (!business_icon || typeof business_icon !== "string") return "";
  if (business_icon.startsWith("http")) return business_icon;
  const sliced = business_icon.slice(business_icon.lastIndexOf("/"), business_icon.length);
  const host = req.hostname || (req.get && req.get("host") ? req.get("host").split(":")[0] : null) || req.host || "localhost";
  return `${req.protocol}://${host}:8888${sliced}`;
}

module.exports = {
  createOrEditService: async (req) => {
    const deferred = q.defer();
    const {
      user_id,
      business_name,
      service,
      availability,
      service_date,
      time,
      description,
      business_icon_url,
      business_type,
      business_license,
      address,
      commission_guideline,
      repeated_customer_commission,
      is_service_provider = 1,
    } = req.body;

    console.log(req.body);

    // Check if a service already exists for the user
    const existCheckQuery = `SELECT COUNT(*) as count FROM ${tableConfig.SERVICES} WHERE userId = ${user_id}`;
    const serviceExists = await commonFunction.getQueryResults(existCheckQuery);
    const date = new Date();

    if (serviceExists[0].count > 0) {
      // If service exists, update it
      const buildUpdateQuery = (fields) => {
        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(fields)) {
          if (value !== undefined && value !== null && value !== "") {
            updates.push(`${key} = ?`);
            values.push(value);
          }
        }

        if (updates.length === 0) {
          return null;
        }

        values.push(fields.userId);
        return {
          query: `UPDATE ${tableConfig.SERVICES} SET ${updates.join(", ")} WHERE userId = ?`,
          values: values,
        };
      };

      const fieldsToUpdate = {
        business_name,
        service,
        availability,
        service_date,
        time,
        description,
        business_icon: business_icon_url,
        business_type,
        business_license,
        address,
        updated_at: date,
        userId: user_id,
        commission_guideline,
        repeated_customer_commission,
      };

      const updateQueryData = buildUpdateQuery(fieldsToUpdate);
      if (!updateQueryData) {
        deferred.resolve({status: 0, message: "No fields to update"});
        return deferred.promise;
      }

      const {query, values} = updateQueryData;
      const updated = await commonFunction.updateQuery(query, values);

      if (updated.affectedRows > 0) {
        deferred.resolve({
          status: 1,
          message: "Service updated successfully",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "No matching record found or no changes made",
        });
      }
    } else {
      // If service does not exist, create a new service
      console.log("insert query.......... ");
      const insertServiceQuery = `INSERT INTO ${tableConfig.SERVICES} SET ?`;
      const insertData = {
        userId: user_id,
        business_name,
        service,
        availability,
        service_date,
        time,
        description,
        business_icon: business_icon_url,
        business_type,
        business_license,
        address,
        created_at: new Date(),
        updated_at: new Date(),
        commission_guideline,
        repeated_customer_commission,
      };

      const inserted = await commonFunction.insertQuery(insertServiceQuery, insertData);
      if (inserted.affectedRows > 0) {
        // Update user to reflect service provider status
        const query = `UPDATE ${tableConfig.USER} SET is_service_provider = ? WHERE id = ?`;
        await commonFunction.updateQuery(query, [is_service_provider, user_id]);

        deferred.resolve({
          status: 1,
          message: "Service added successfully",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "Something went wrong",
        });
      }
    }

    return deferred.promise;
  },

  viewService: async (req) => {
    const {user_id} = req.body;
    const deferred = q.defer();

    const getServiceQuery = `SELECT * 
                                 FROM ${tableConfig.SERVICES} WHERE userId = ${user_id}`;
    const service = await commonFunction.getQueryResults(getServiceQuery);
    const {business_icon} = service[0];
    const business_sliced_icon = business_icon.slice(business_icon.lastIndexOf("/"), business_icon.length);
    const business_icon_server = `${req.protocol}://${req.host}:8888${business_sliced_icon}`;
    console.log(business_icon_server);
    deferred.resolve({
      status: 1,
      data: [{...service[0], business_icon: business_icon_server}],
    });
    return deferred.promise;
  },

  listRecommendations: async (req) => {
    const {user_id} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `
    SELECT r.*, 
           s.business_icon,
           u2.profile_url as service_provider_profile, 
           u2.name as recommended, 
           u.profile_url as recommended_by_profile, 
           u.name as recommended_by, 
           u1.profile_url as recommended_to_profile, 
           u1.name as recommended_to 
    FROM ${tableConfig.RECOMMENDATIONS} as r
    LEFT JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
    LEFT JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
    LEFT JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
    LEFT JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
    WHERE r.service_provider_id = ${user_id} AND r.status = 'active'
    ORDER BY r.id DESC;
  `;
    //  AND r.recommended_at >= date_sub(now(), INTERVAL 48 hour)
    const service = await commonFunction.getQueryResults(getServiceQuery);
    const data = (service || []).map((row) => ({
      ...row,
      business_icon: toFullBusinessIconUrl(req, row.business_icon),
    }));
    deferred.resolve({
      status: 1,
      data,
    });
    return deferred.promise;
  },
  // service_rendered
  viewRecommendation: async (req) => {
    const {recommendation_id} = req.body;
    // console.log(recommendation_id);
    const deferred = q.defer();
    const getServiceQuery = `SELECT r.*, s.*,
            u2.name as recommended, u2.profile_url as recommended_profile,
            u.name as recommended_by, u.profile_url as recommended_by_profile,
            u1.name as recommended_to, u1.profile_url as recommended_to_profile,
            IFNULL(u1.mobile_number, '') as recommended_to_contact,
            IFNULL(u1.email, '') as recommended_to_email,
            IFNULL(r.rating, 0) as user_rating,
            IFNULL(r.feedback, '') as feedback
        FROM ${tableConfig.RECOMMENDATIONS} r
        LEFT JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
        LEFT JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
        LEFT JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
        LEFT JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
        WHERE r.id = ${recommendation_id}`;

    const service = await commonFunction.getQueryResults(getServiceQuery);
    const data = (service || []).map((row) => ({
      ...row,
      business_icon: toFullBusinessIconUrl(req, row.business_icon),
    }));

    deferred.resolve({
      status: 1,
      data,
    });
    // console.log(service);
    return deferred.promise;
  },

  acceptRecommendation: async (req) => {
    const {recommendation_id, status = "accepted"} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, accepted_at = ? WHERE id = ?`;
    const updateData = [status, new Date(), recommendation_id];
    const service = await commonFunction.updateQuery(query, updateData);

    console.log(service.affectedRows, "updated ...........");

    const selectQuery = `SELECT r.*, u.* FROM ${tableConfig.RECOMMENDATIONS} as r 
                             LEFT JOIN ${tableConfig.USER} as u ON u.id = r.consumer_id
                             WHERE r.id = ${recommendation_id}`;

    const recommendation = await getQueryResults(selectQuery);

    const insertQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    const insertData = {
      recommendation_id: recommendation_id,
      status: status,
    };
    const inserted = await commonFunction.insertQuery(insertQuery, insertData);

    console.log(inserted);

    const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                              u.platform as platform,
                                              u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                            LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                            LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                            WHERE r.id = ${recommendation_id}`);
    console.log(users);
    if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
      const {platform, provider_name, recommender_token} = users[0];
      const recommendationId = recommendation_id;

      let message;

      if (platform === "android") {
        message = {
          data: {
            title: "Recommendation accepted",
            body: `${provider_name} accepted your recommendation`,
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
            title: "Recommendation accepted",
            body: `${provider_name} accepted your recommendation`,
          },
          data: {
            title: "Recommendation accepted",
            body: `${provider_name} accepted your recommendation`,
            recommendation_id: `${recommendationId}`,
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
          },
          token: recommender_token,
        };
      }

      console.log("Prepared push notification message:", message);

      pushNotification.sendMessage(message);
    }

    const contactsQuery = `SELECT * FROM ${tableConfig.CONNECTIONS} WHERE user_id = '${recommendation[0].recommender_id}' AND friend_id = '${recommendation[0].service_provider_id}'`;
    const contacts = await commonFunction.getQueryResults(contactsQuery);

    if (contacts.length === 0) {
      const insertData = [
        [recommendation[0].recommender_id, recommendation[0].service_provider_id],
        [recommendation[0].service_provider_id, recommendation[0].recommender_id],
      ];
      const createQuery = `INSERT INTO ${tableConfig.CONNECTIONS} (user_id, friend_id) VALUES ? `;
      sql.query(createQuery, [insertData]);
    }

    // const alreadyConnected = `SELECT * FROM ${tableConfig.CONNECTIONS}
    //                             WHERE service_provider_id = ${recommendation.service_provider_id}
    //                             AND user_id = ${recommendation.recommender_id}`;
    // const connectionQuery = `INSERT INTO ${tableConfig.CONNECTIONS} SET = ?`
    // const insertData = {
    //     service_provider_id: recommendation.service_provider_id,
    //     user_id: recommendation[0].recommender_id
    // }

    // const insertStatusQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    // const statusData = {recommendation_id: recommendation_id,
    //                     meta_key: 'accepted_at'}
    // const insertedStatus = await commonFunction.insertQuery(insertStatusQuery, statusData);

    deferred.resolve({
      status: 1,
      message: "Recommendation accepted successfully",
      consumer_contact: recommendation[0].mobile_number,
    });

    return deferred.promise;
  },

  denyRecommendation: async (req) => {
    const deferred = q.defer();
    const {recommendation_id, status = "declined", remarks = ""} = req.body;

    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, declined_at = ? WHERE id = ?`;
    const updateData = [status, new Date(), remarks, recommendation_id];
    const service = await commonFunction.updateQuery(query, updateData);

    const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                                 u.platform as platform,
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                WHERE r.id = ${recommendation_id}`);

    if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
      const {platform, provider_name, recommender_token} = users[0];
      const recommendationId = recommendation_id;

      let message;

      if (platform === "android") {
        message = {
          data: {
            title: "Recommendation declined",
            body: `${provider_name} declined your recommendation`,
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
            title: "Recommendation declined",
            body: `${provider_name} declined your recommendation`,
          },
          data: {
            title: "Recommendation declined",
            body: `${provider_name} declined your recommendation`,
            recommendation_id: `${recommendationId}`,
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
          },
          token: recommender_token,
        };
      }

      console.log("Prepared push notification message:", message);

      pushNotification.sendMessage(message);
    }

    deferred.resolve({
      status: 1,
      message: "Recommendation denied successfully",
    });

    return deferred.promise;
  },

  sendConnectionRequest: async (req) => {
    const {service_provider_id, user_id} = req.body;

    const deferred = q.defer();
    const query = `INSERT INTO ${tableConfig.CONNECTIONS} SET ?`;
    const insertData = {
      service_provider_id: service_provider_id,
      user_id: user_id,
      status: "requested",
      created_at: new Date(),
      updated_at: new Date(),
    };
    const service = await commonFunction.insertQuery(query, insertData);

    deferred.resolve({
      status: 1,
      message: "request sent",
    });

    return deferred.promise;
  },

  listActiveRecommendations: async (req) => {
    const {user_id, status = "accepted"} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.*, u.profile_url as recommender_profile, u.name as recommender_name, 
                              u1.name as recommended_to_name, u1.profile_url as recommended_to_profile,
                              u2.profile_url as service_provider_profile, u2.name as service_provider_name
                              FROM ${tableConfig.RECOMMENDATIONS} as r 
                       INNER JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                       INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                       INNER JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                       INNER JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                       WHERE r.service_provider_id = ${user_id} AND
                       r.status IN('accepted', 'counter_offered', 'commission_payment_accepted', 'counter_offer_accepted', 'service_rendered', 'time_extended') 
                       order by id desc`;
    //    AND r.recommended_at >= date_sub(now(), INTERVAL 48 hour)
    const activeRecommendations = await getQueryResults(query);
    // console.log(activeRecommendations[0].created_at, activeRecommendations[0].date);
    // console.log(new Date(activeRecommendations[0].created_at),new Date(activeRecommendations[0].date));
    deferred.resolve({
      status: 1,
      data: activeRecommendations,
    });

    return deferred.promise;
  },

  viewActiveRecommendation: async (req) => {
    const {recommendation_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.*, s.*, u.profile_url as recommender_profile,u.name as recommended_by,
                       u1.profile_url as consumer_profile, u1.name as recommended_to, 
                       u2.profile_url as service_provider_profile, u2.name as recommended,
                        IFNULL(u3.mobile_number, '') as consumer_contact, IFNULL(u3.email, '') as consumer_email FROM ${tableConfig.RECOMMENDATIONS} as r 
                        INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                        INNER JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                        LEFT JOIN ${tableConfig.USER} as u3 ON u3.id = r.consumer_id 
                        INNER JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                        INNER JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                        WHERE r.id = ${recommendation_id}`;

    const activeRecommendations = await getQueryResults(query);
    const data = (activeRecommendations || []).map((row) => ({
      ...row,
      business_icon: toFullBusinessIconUrl(req, row.business_icon),
    }));

    deferred.resolve({
      status: 1,
      data,
    });

    return deferred.promise;
  },

  extendAcceptTimeLimit: async (req) => {
    const {
      recommendation_id,
      user_id,
      from_wallet,
      extend_hours,
      amount_paid,
      status = "time_extended",
      customer_id,
    } = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, extended_acceptance_time = ?, time_extended_at = ? WHERE id = ?`;
    const recommendationUpdateData = [status, extend_hours, new Date(), recommendation_id];

    if (from_wallet === "1") {
      const extended = await commonFunction.updateQuery(query, recommendationUpdateData);
      const updateQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance - ${Number(
        amount_paid
      ).toFixed(2)} WHERE id = ${user_id}`;
      const updateData = [amount_paid, user_id];
      const updated = await commonFunction.updateQuery(updateQuery, updateData);

      const insertQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;
      const insertData = {
        user_id: user_id,
        recommendation_id: recommendation_id,
        commission: amount_paid,
        commission_for: "time_extended",
      };

      const inserted = await commonFunction.insertQuery(insertQuery, insertData);

      if (extended.affectedRows > 0) {
        const userQuery = `SELECT * FROM ${tableConfig.USER} WHERE id = ${user_id}`;
        const user = await getQueryResults(userQuery);
        const notification = `Commission paid by ${user[0].name} for extending acceptance time`;
        const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;
        const insertNotificationData = {
          notification: notification,
          status: "unread",
          created_at: new Date(),
          updated_at: new Date(),
        };
        const createNotification = await commonFunction.insertQuery(notificationQuery, insertNotificationData);
      }

      const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                                u.platform as platform,
                                                u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                                LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                                LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                                WHERE r.id = ${recommendation_id}`);

      if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
        const {platform, provider_name, recommender_token} = users[0];
        const recommendationId = recommendation_id;
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
                "apns-priority": "10",
              },
            },
            token: recommender_token,
          };
        }

        console.log("Prepared push notification message:", message);

        pushNotification.sendMessage(message);
      }

      deferred.resolve({
        status: 1,
        message: "Extended successfully",
      });
    } else {
      const getTransactionStatusQuery = `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = '${customer_id}'`;
      const transactionStatus = await commonFunction.getQueryResults(getTransactionStatusQuery);
      // console.log();
      if (
        transactionStatus.length != 0 &&
        transactionStatus[0].status === "succeeded" &&
        transactionStatus[0].transaction_updated === "0"
      ) {
        let transaction_updated = 1;
        const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
        const updateData = [transaction_updated, customer_id];
        // update customer
        const updateCustomer = await commonFunction.insertQuery(updateCustomerQuery, updateData);
        const insertQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;
        const insertData = {
          user_id: user_id,
          recommendation_id: recommendation_id,
          commission: amount_paid,
          commission_for: "time_extended",
        };
        // update commission
        const inserted = await commonFunction.insertQuery(insertQuery, insertData);
        // update recommendation
        const extended = await commonFunction.updateQuery(query, recommendationUpdateData);

        if (extended.affectedRows > 0) {
          const userQuery = `SELECT * FROM ${tableConfig.USER} WHERE id = ${user_id}`;
          const user = await getQueryResults(userQuery);
          const notification = `Commission paid by ${user[0].name} for extending acceptance time`;
          const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;
          const insertNotificationData = {
            notification: notification,
            status: "unread",
            created_at: new Date(),
            updated_at: new Date(),
          };
          const createNotification = await commonFunction.insertQuery(notificationQuery, insertNotificationData);
        }

        const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                        u.platform as platform,
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                        WHERE r.id = ${recommendation_id}`);
        if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
          const {platform, provider_name, recommender_token} = users[0];
          const recommendationId = recommendation_id;
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
                  "apns-priority": "10",
                },
              },
              token: recommender_token,
            };
          }

          console.log("Sending push notification:", message);

          pushNotification
            .sendMessage(message)
            .then((response) => {
              console.log("Push notification sent successfully:", response);
            })
            .catch((error) => {
              console.error("Failed to send push notification:", error);
            });
        }

        deferred.resolve({
          status: 1,
          message: "Extended successfully",
        });
      } else if (
        transactionStatus.length > 0 &&
        transactionStatus[0].status === "succeeded" &&
        transactionStatus[0].transaction_updated === "1"
      ) {
        const users = getQueryResults(`SELECT u.registration_token as recommender_token, 
                                              u.platform as platform, 
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                        WHERE r.id = ${recommendation_id}`);

        if (
          users !== null &&
          users.length > 0 &&
          users[0].recommender_token !== null &&
          users[0].recommender_token !== ""
        ) {
          let message;
          if (users[0].platform === "android") {
            message = {
              data: {
                title: "Acceptance time extended",
                body: `${users[0].provider_name} extended acceptance time for your recommendation`,
                recommendation_id: `${recommendation_id}`,
              },
              android: {
                priority: "high",
              },
              token: users[0].recommender_token,
            };
          } else {
            message = {
              notification: {
                title: "Acceptance time extended",
                body: `${users[0].provider_name} extended acceptance time for your recommendation`,
              },
              data: {
                title: "Acceptance time extended",
                body: `${users[0].provider_name} extended acceptance time for your recommendation`,
                recommendation_id: `${recommendation_id}`,
              },
              android: {
                priority: "high",
              },
              apns: {
                headers: {
                  "apns-priority": "10",
                },
              },
              token: users[0].recommender_token,
            };
          }
          pushNotification.sendMessage(message);
        }

        deferred.resolve({
          status: 1,
          message: "Extended successfully",
        });
      } else if (transactionStatus[0].status === "created" && transactionStatus[0].transaction_updated === "0") {
        deferred.resolve({
          status: 0,
          message: "Transaction pending",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "something went wrong",
        });
      }
    }
    return deferred.promise;
  },

  listContacts: async (req) => {
    const {service_provider_id, status = "connected"} = req.body;
    const deferred = q.defer();
    const query = `SELECT c.*,u.id, u.name, u.email, u.mobile_number, u.profile_url
                       FROM ${tableConfig.CONNECTIONS} as c
                       LEFT JOIN ${tableConfig.USER} as u ON u.id = c.friend_id
                       WHERE c.user_id = ${service_provider_id}`;
    const contacts = await commonFunction.getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: contacts,
    });

    return deferred.promise;
  },

  viewUserContactDetails: async (req) => {
    const {user_id} = req.body;
  },

  savePaymentDetails: async (req) => {
    const {
      recommendation_id,
      amount_paid,
      reference_id,
      payment_status = "paid",
      status = "paid",
      paid_at = new Date(),
      from_wallet,
      service_provider_id,
      recommender_id,
      customer_id,
    } = req.body;

    const deferred = q.defer();
    // const res = await axios.post(
    //   "http://ec2-54-255-217-96.ap-southeast-1.compute.amazonaws.com/Recomman/wp-json/wc/v1/settings",
    //   {}
    // );
    // Fetch user's current wallet balance
    const getWalletBalanceQuery = `SELECT wallet_balance FROM ${tableConfig.USER} WHERE id = ${service_provider_id}`;
    const walletBalanceResult = await commonFunction.getQueryResults(getWalletBalanceQuery);

    if (
      !walletBalanceResult ||
      parseFloat(parseFloat(walletBalanceResult[0].wallet_balance).toFixed(2)) <
        parseFloat(parseFloat(amount_paid).toFixed(2))
    ) {
      deferred.resolve({
        status: 0,
        message: "Insufficient wallet balance",
      });
      return deferred.promise;
    }
    const adminCommission = (Number(amount_paid) * (Number(5) / 100)) // admin commission 5
      .toFixed(2);
    const recommenderCommission = (Number(amount_paid) - adminCommission).toFixed(2);

    try {
      // update recommendations table
      const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET amount_paid = ?, 
                                                                 status = ?,
                                                                 payment_status = ?,
                                                                 reference_id = ?,
                                                                 paid_at = ?,
                                                                 admin_commission = ?,
                                                                 amount_received_by_recommender = ? WHERE id = ? `;
      const recommendationUpdateData = [
        amount_paid,
        status,
        payment_status,
        reference_id,
        paid_at,
        adminCommission,
        recommenderCommission,
        recommendation_id,
      ];

      let serviceProviderQuery, recommenderQuery, updateServiceProviderWallet, updateUserWallet;

      // update commissions table
      const inserCommissionQuery = `INSERT INTO ${tableConfig.COMMISSIONS} SET ?`;
      const commissionData = {
        user_id: service_provider_id,
        recommendation_id: recommendation_id,
        commission: adminCommission,
        commission_for: "commission_paid",
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (from_wallet === "1") {
        const updated = await commonFunction.updateQuery(query, recommendationUpdateData);
        const insertCommission = await commonFunction.insertQuery(inserCommissionQuery, commissionData);

        serviceProviderQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance - ${Number(
          amount_paid
        ).toFixed(2)} WHERE id = ${service_provider_id}`;
        recommenderQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(
          amount_paid
        ).toFixed(2)} WHERE id = ${recommender_id}`;
        updateServiceProviderWallet = await commonFunction.getQueryResults(serviceProviderQuery);
        updateUserWallet = await commonFunction.getQueryResults(recommenderQuery);

        const userQuery = `SELECT u.name as service_provider_name, u1.registration_token as recommender_token, u1.platform as recommender_platform, u1.name as recommender_name FROM ${tableConfig.USER} u
                               LEFT JOIN ${tableConfig.USER} u1 ON u1.id = ${recommender_id}
                               WHERE u.id = ${service_provider_id}`;
        const user = await getQueryResults(userQuery);

        const notification = `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`;
        const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;
        const insertNotificationData = {
          notification: notification,
          status: "unread",
          created_at: new Date(),
          updated_at: new Date(),
        };
        await commonFunction.insertQuery(notificationQuery, insertNotificationData);
        console.log(user, "=====user from wallet pay===");
        if (user && user.length > 0 && user[0].recommender_token && user[0].recommender_token !== "") {
          const {recommender_platform, recommender_token} = user[0];
          if (recommender_platform && recommender_platform.toLowerCase() === "android") {
            message = {
              data: {
                title: "Payment Successful",
                body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
                recommendation_id: `${recommendation_id}`,
              },
              android: {
                priority: "high",
              },
              token: recommender_token,
            };
          } else {
            message = {
              notification: {
                title: "Payment Successful",
                body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
              },
              data: {
                title: "Payment Successful",
                body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
                recommendation_id: `${recommendation_id}`,
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
        deferred.resolve({
          status: 1,
          message: "Payment details updated successfully",
        });
      } else {
        const getTransactionStatusQuery = `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = '${customer_id}'`;
        const transactionStatus = await commonFunction.getQueryResults(getTransactionStatusQuery);

        if (transactionStatus[0].status === "succeeded" && transactionStatus[0].transaction_updated === "0") {
          // Update Recommendations table
          const updated = await commonFunction.updateQuery(query, recommendationUpdateData);
          // Update commissions table
          const insertCommission = await commonFunction.insertQuery(inserCommissionQuery, commissionData);

          let transaction_updated = 1;
          const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
          const updateData = [transaction_updated, customer_id];
          const updateCustomer = await commonFunction.insertQuery(updateCustomerQuery, updateData);

          recommenderQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${recommenderCommission} WHERE id = ${recommender_id}`;
          updateUserWallet = await commonFunction.getQueryResults(recommenderQuery);

          const userQuery = `SELECT u.name as service_provider_name, u.platform as service_platform, u.registration_token as service_provider_token, u1.registration_token as recommender_token, u1.platform as recommender_platform, u1.name as recommender_name FROM ${tableConfig.USER} u
                                LEFT JOIN ${tableConfig.USER} u1 ON u1.id = ${recommender_id}
                                WHERE u.id = ${service_provider_id}`;

          const user = await getQueryResults(userQuery);
          const notification = `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`;
          const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;
          const insertNotificationData = {
            notification: notification,
            status: "unread",
            created_at: new Date(),
            updated_at: new Date(),
          };
          await commonFunction.insertQuery(notificationQuery, insertNotificationData);

          console.log(user, "=====user from wallet pay===");
          if (user && user.length > 0 && user[0].recommender_token && user[0].recommender_token !== "") {
            const {recommender_platform, recommender_token} = user[0];
            if (recommender_platform && recommender_platform.toLowerCase() === "android") {
              message = {
                data: {
                  title: "Payment Successful",
                  body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
                  recommendation_id: `${recommendation_id}`,
                },
                android: {
                  priority: "high",
                },
                token: recommender_token,
              };
            } else {
              message = {
                notification: {
                  title: "Payment Successful",
                  body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
                },
                data: {
                  title: "Payment Successful",
                  body: `Commission paid by ${user[0].service_provider_name} to ${user[0].recommender_name}`,
                  recommendation_id: `${recommendation_id}`,
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
          deferred.resolve({
            status: 1,
            message: "Payment Successful",
          });
        } else if (transactionStatus[0].status === "succeeded" && transactionStatus[0].transaction_updated === "1") {
          deferred.resolve({
            status: 1,
            message: "Payment successful",
          });
        } else if (transactionStatus[0].status === "created" && transactionStatus[0].transaction_updated === "0") {
          deferred.resolve({
            status: 0,
            message: "Transaction pending",
          });
        } else {
          deferred.resolve({
            status: 0,
            message: "something went wrong",
          });
        }
      }
    } catch (err) {
      console.log(err);
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }

    return deferred.promise;
  },

  listCommissions: async (req) => {
    const {service_provider_id, payment_status = "paid"} = req.body;

    const deferred = q.defer();
    const query = `
      SELECT 
        u.name AS paid_to, 
        r.paid_at, 
        r.amount_paid,
        'commission' AS type
      FROM ${tableConfig.RECOMMENDATIONS} AS r
      INNER JOIN ${tableConfig.USER} AS u 
        ON u.id = r.recommender_id
      WHERE 
        r.service_provider_id = ${service_provider_id} 
        AND r.payment_status = '${payment_status}'
  
      UNION
  
      SELECT 
        u.name AS paid_to, 
       w.created_at AS paid_at, 
        w.withdraw_amount AS amount_paid,
        'credit' AS type
      FROM ${tableConfig.WITHDRAW} AS w
      INNER JOIN ${tableConfig.USER} AS u 
        ON u.id = w.user_id
      WHERE 
        w.type = 'credit'
  
      ORDER BY paid_at DESC;
    `;
    //  DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i:%s') AS paid_at,
    const commissions = await commonFunction.getQueryResults(query);
    console.log(commissions, "==");
    deferred.resolve({
      status: 1,
      data: commissions,
    });

    // console.log(commissions, "======commissions=====");
    return deferred.promise;
  },

  uploadBusinessIcon: async (req) => {
    const {service_provider_id} = req.body;
    const deferred = q.defer();
    const profile_url = `http://ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com:8888/${req.file.filename}`;
    if (!req.file.filename) {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    } else {
      const date = new Date();

      const updateBusinessIconQuery = `UPDATE ${tableConfig.SERVICES} SET business_icon = ?, updated_at = ? WHERE userId = ?`;
      const updateData = [profile_url, date, service_provider_id];
      try {
        const updated = await commonFunction.updateQuery(updateBusinessIconQuery, updateData);

        if (updated.affectedRows > 0) {
          deferred.resolve({
            status: 1,
            icon_url: profile_url,
            message: "Profile uploaded successfully",
          });
        } else {
          deferred.resolve({
            status: 0,
            message: "No records were updated. Please check the user ID or other details.",
          });
        }
      } catch (error) {
        deferred.resolve({
          status: 0,
          message: "An error occurred while updating the profile.",
        });
      }
    }

    return deferred.promise;
  },

  saveBusinessDetails: async (req) => {
    const {
      user_id,
      full_name,
      email,
      mobile_number,
      business_name,
      address,
      business_type,
      shop_license,
      is_service_provider = "1",
      commission_guideline,
      repeated_customer_commission,
    } = req.body;
    const deferred = q.defer();
    const createData = {
      userId: user_id,
      full_name: full_name,
      email: email,
      mobile_number: mobile_number,
      business_name: business_name,
      address: address,
      business_type: business_type,
      shop_license: shop_license,
      commission_guideline: commission_guideline,
      repeated_customer_commission: repeated_customer_commission,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const query = `INSERT INTO ${tableConfig.BUSINESS_DETAILS} SET ?`;
    const created = await commonFunction.insertQuery(query, createData);

    const updateQuery = `UPDATE ${tableConfig.USER} SET is_service_provider = ? WHERE id = ?`;
    const updateData = [is_service_provider, user_id];

    const updated = await commonFunction.updateQuery(updateQuery, updateData);

    if (created.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        message: "Business details updated successfully",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong! please try again",
      });
    }

    return deferred.promise;
  },

  counterApprove: async (req) => {
    const {recommendation_id, counter_offer_rate, status = "counter_offered", remarks} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET counter_offer_rate = ?, status = ?, counter_offered_at = ?, remarks = ? WHERE id = ? `;
    const updateData = [counter_offer_rate, status, new Date(), remarks, recommendation_id];
    const updated = await commonFunction.updateQuery(query, updateData);

    // const insertStatusQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    // const statusData = {recommendation_id: recommendation_id,
    //                     meta_key: 'counter_offered_at'}
    // const insertedStatus = await commonFunction.insertQuery(insertStatusQuery, statusData);

    const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                                    u.platform as platform,
                                                    u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                       LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                       LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                       WHERE r.id = ${recommendation_id}`);

    if (updated.affectedRows > 0) {
      if (
        users !== null &&
        users.length > 0 &&
        users[0].recommender_token !== null &&
        users[0].recommender_token !== ""
      ) {
        let message;
        if (users[0].platform === "android") {
          message = {
            data: {
              title: "Recommendation counter-offered",
              body: `${users[0].provider_name} counter-offered your recommendation`,
              recommendation_id: `${recommendation_id}`,
            },
            android: {
              priority: "high",
            },
            token: users[0].recommender_token,
          };
        } else {
          message = {
            notification: {
              title: "Recommendation counter-offered",
              body: `${users[0].provider_name} counter-offered your recommendation`,
            },
            data: {
              title: "Recommendation counter-offered",
              body: `${users[0].provider_name} counter-offered your recommendation`,
              recommendation_id: `${recommendation_id}`,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
            token: users[0].recommender_token,
          };
        }

        pushNotification.sendMessage(message);
      }
      deferred.resolve({
        status: 1,
        message: "Counter offer request sent successfully",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }
    return deferred.promise;
  },

  showRecommendationHistory: async (req) => {
    const {service_provider_id, payment_status = "paid"} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.*, u.profile_url as recommender_profile, u.name as recommender_name, 
                              u1.name as recommended_to_name, u1.profile_url as recommended_to_profile,
                              u2.name as service_provider_profile, u2.name as service_provider_name,
                              date_sub(now(), INTERVAL 48 hour) as expiredAt
                              FROM ${tableConfig.RECOMMENDATIONS} as r 
                       INNER JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                       INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                       INNER JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                       INNER JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                       WHERE r.service_provider_id = ${service_provider_id} 
                       AND ( r.status IN('commission_payment_declined', 'declined', 'paid', 'service_denied')
                       OR r.recommended_at <= date_sub(now(), INTERVAL 48 hour))
                       `;
    console.log(query);
    const activeRecommendations = await getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: activeRecommendations,
    });

    return deferred.promise;
  },

  updateWalletBalance: async (req) => {
    const {
      user_id,
      amount,
      customer_id,
      // recharged,
      // recommender_id
    } = req.body;
    const deferred = q.defer();
    console.log(req.body, ".............. data body ");
    try {
      let query, recommenderQuery;

      const getTransactionStatusQuery = `SELECT * FROM ${tableConfig.CUSTOMER} WHERE customer_id = '${customer_id}'`;
      const transactionStatus = await commonFunction.getQueryResults(getTransactionStatusQuery);

      console.log(transactionStatus, "********* transaction status *********");

      if (transactionStatus[0].status === "succeeded" && transactionStatus[0].transaction_updated === "0") {
        query = `UPDATE ${tableConfig.USER} SET wallet_balance = wallet_balance + ${Number(amount).toFixed(
          2
        )} WHERE id = ${user_id}`;
        const updatedUser = await updateQuery(query);
        let transaction_updated = 1;
        const updateCustomerQuery = `UPDATE ${tableConfig.CUSTOMER} SET transaction_updated = ? WHERE customer_id = ?`;
        const updateData = [transaction_updated, customer_id];
        const updateCustomer = await commonFunction.insertQuery(updateCustomerQuery, updateData);
        console.log(updateCustomer, ".................. update customer .......................");
        deferred.resolve({
          status: 1,
          data: updatedUser.wallet_balance,
          message: "Recharged successfully",
        });
      } else if (transactionStatus[0].status === "succeeded" && transactionStatus[0].transaction_updated === "1") {
        deferred.resolve({
          status: 1,
          message: "Recharged successfully",
        });
      } else if (transactionStatus[0].status === "created") {
        deferred.resolve({
          status: 0,
          message: "Transaction pending",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "Something went wrong",
        });
      }
    } catch (err) {
      console.log(err);
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }
    return deferred.promise;
  },

  updateRecommendationStatus: async (req) => {
    const {recommendation_id, status} = req.body;
    const deferred = q.defer();
    let query = `INSERT ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    let meta_key = `${status}-at`;
    const meta_value = new Date();
    const insertData = {
      recommendation_id: recommendation_id,
      meta_key: meta_key,
      // meta_value: meta_value
    };
    const updatedUser = await commonFunction.insertQuery(query, insertData);

    deferred.resolve({
      status: 1,
      data: updatedUser,
    });

    return deferred.promise;
  },

  updateStatusTerms: async (req) => {
    const {name, code, description} = req.body;

    const deferred = q.defer();

    const query = `INSERT INTO ${tableConfig.RECOMMENDATION_STATUS_TERMS} SET ?`;
    const insertData = {
      name: name,
      code: code,
      description: description,
    };
    const updated = await commonFunction.insertQuery(query, insertData);

    deferred.resolve({
      status: 1,
      message: "Updated successfully",
    });

    return deferred.promise;
  },

  listTerms: async (req) => {
    const deferred = q.defer();

    const query = `SELECT name, code, description FROM ${tableConfig.RECOMMENDATION_STATUS_TERMS}`;

    const terms = await commonFunction.getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: terms,
    });

    return deferred.promise;
  },

  serviceRendered: async (req) => {
    const {recommendation_id, status = "service_rendered"} = req.body;
    const deferred = q.defer();

    const recommendationQuery = `SELECT consumer_id, service_provider_id FROM ${tableConfig.RECOMMENDATIONS} WHERE id = ${recommendation_id}`;
    const users = await getQueryResults(recommendationQuery);

    const contactsQuery = `SELECT r.recommender_id, r.consumer_id, r.service_provider_id FROM ${tableConfig.RECOMMENDATIONS} r
                               INNER JOIN ${tableConfig.CONNECTIONS} c ON c.user_id = r.service_provider_id AND c.friend_id = r.consumer_id 
                               WHERE r.id = ${recommendation_id}`;

    const contacts = await commonFunction.getQueryResults(contactsQuery);

    if (contacts.length === 0) {
      const insertData = [
        [users[0].consumer_id, users[0].service_provider_id],
        [users[0].service_provider_id, users[0].consumer_id],
      ];
      const createQuery = `INSERT INTO ${tableConfig.CONNECTIONS} (user_id, friend_id) VALUES ? `;
      sql.query(createQuery, [insertData]);
    }

    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET  status = ?, service_rendered_at = ? WHERE id = ? `;
    const updateData = [status, new Date(), recommendation_id];
    const updated = await commonFunction.updateQuery(query, updateData);

    const insertQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    const insertData = {
      recommendation_id: recommendation_id,
      status: status,
    };
    const inserted = await commonFunction.insertQuery(insertQuery, insertData);

    const user = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                        u.platform as platform, 
                                        u2.name as consumer_name,
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                        LEFT JOIN ${tableConfig.USER} u2 ON u2.id = r.consumer_id
                                        WHERE r.id = ${recommendation_id}`);
    console.log(user);

    if (updated.affectedRows > 0) {
      if (user !== null && user.length > 0 && user[0].recommender_token !== null && user[0].recommender_token !== "") {
        let message;
        if (users[0].platform === "android") {
          message = {
            data: {
              title: "Service rendered",
              body: `${user[0].provider_name} rendered the service to ${user[0].consumer_name}`,
              recommendation_id: `${recommendation_id}`,
            },
            android: {
              priority: "high",
            },
            token: user[0].recommender_token,
          };
        } else {
          message = {
            notification: {
              title: "Service rendered",
              body: `${user[0].provider_name} rendered the service to ${user[0].consumer_name}`,
            },
            data: {
              title: "Service rendered",
              body: `${user[0].provider_name} rendered the service to ${user[0].consumer_name}`,
              recommendation_id: `${recommendation_id}`,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
            token: user[0].recommender_token,
          };
        }

        pushNotification.sendMessage(message);
      }
      deferred.resolve({
        status: 1,
        message: "The service is rendered",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }
    return deferred.promise;
  },

  serviceDenied: async (req) => {
    const {recommendation_id, status = "service_denied"} = req.body;
    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET  status = ?, service_denied_at = ? WHERE id = ? `;
    const updateData = [status, new Date(), recommendation_id];
    const updated = await commonFunction.updateQuery(query, updateData);

    // const insertStatusQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONs_META} SET ?`;
    // const statusData = {recommendation_id: recommendation_id,
    //                     meta_key: 'service_declined_at'}
    // const insertedStatus = await commonFunction.insertQuery(insertStatusQuery, statusData);
    const user = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                            u.platform as platform, 
                                            u2.name as consumer_name,
                                            u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                            LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                            LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                            LEFT JOIN ${tableConfig.USER} u2 ON u2.id = r.consumer_id
                                            WHERE r.id = ${recommendation_id}`);

    if (updated.affectedRows > 0) {
      if (user !== null && user.length > 0 && user[0].recommender_token !== null && user[0].recommender_token !== "") {
        let message;
        if (user[0].platform === "android") {
          message = {
            data: {
              title: "Service denied",
              body: `${user[0].provider_name} denied the service to ${user[0].consumer_name}`,
              recommendation_id: `${recommendation_id}`,
            },
            android: {
              priority: "high",
            },
            token: user[0].recommender_token,
          };
        } else {
          message = {
            notification: {
              title: "Service denied",
              body: `${user[0].provider_name} denied the service to ${user[0].consumer_name}`,
            },
            data: {
              title: "Service denied",
              body: `${user[0].provider_name} denied the service to ${user[0].consumer_name}`,
              recommendation_id: `${recommendation_id}`,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
            token: user[0].recommender_token,
          };
        }

        pushNotification.sendMessage(message);
      }
      deferred.resolve({
        status: 1,
        message: "The service is denied",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }
    return deferred.promise;
  },

  recommendationsHistory: async (req) => {
    const {service_provider_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.*, u.profile_url as recommender_profile, u.name as recommender_name, 
                              u1.name as recommended_to_name, u1.profile_url as recommended_to_profile,
                              u2.profile_url as service_provider_profile, u2.name as service_provider_name,
                              date_add(recommended_at, INTERVAL 48 hour) as expiredAt,
                              date_sub(now(), INTERVAL 48 hour) as expiryCheck
                              FROM ${tableConfig.RECOMMENDATIONS} as r 
                       INNER JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                       INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                       INNER JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                       INNER JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                       WHERE r.service_provider_id = ${service_provider_id} 
                       AND r.status IN('declined', 'counter_offer_declined', 'service_denied', 'commission_payment_declined', 'paid', 'expired')
                       order by updated_at desc`;
    //    AND (r.status IN('declined', 'counter_offer_declined', 'service_denied', 'commission_payment_declined', 'paid')
    //    OR r.recommended_at <= date_sub(now(), INTERVAL 48 hour) )
    const activeRecommendations = await getQueryResults(query);
    deferred.resolve({
      status: 1,
      data: activeRecommendations,
    });
    return deferred.promise;
  },

  shareServiceDetailToContacts: async (req) => {
    const {service_provider_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.*, u.profile_url as recommender_profile, u.name as recommender_name, 
                              u1.name as recommended_to_name, u1.profile_url as recommended_to_profile,
                              u2.profile_url as service_provider_profile, u2.name as service_provider_name 
                              FROM ${tableConfig.RECOMMENDATIONS} as r 
                       INNER JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                       INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                       INNER JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                       INNER JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                       WHERE r.service_provider_id = ${service_provider_id} AND r.status IN('declined', 'counter_offer_declined', 'service_denied', 'paid')`;

    const activeRecommendations = await getQueryResults(query);
    deferred.resolve({
      status: 1,
      data: activeRecommendations,
    });

    return deferred.promise;
  },

  viewRecommenderDetail: async (req) => {
    const {recommender_id, recommendation_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT name, email, mobile_number, profile_url FROM ${tableConfig.USER}
                       WHERE id = ${recommender_id}`;

    const created = await commonFunction.getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: created,
    });

    return deferred.promise;
  },

  acceptCommissionPayment: async (req) => {
    const {recommendation_id, status = "commission_payment_accepted"} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, commission_payment_accepted_at = ? WHERE id = ?`;
    const updateData = [status, new Date(), recommendation_id];
    const activeRecommendations = await commonFunction.updateQuery(query, updateData);

    const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                        u.platform as platform,
                                        u2.name as consumer_name,
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                        LEFT JOIN ${tableConfig.USER} u2 ON u2.id = r.consumer_id
                                        WHERE r.id = ${recommendation_id}`);

    if (
      users !== null &&
      users.length > 0 &&
      users[0].recommender_token !== null &&
      users[0].recommender_token !== ""
    ) {
      let message;

      if (users[0].platform === "android") {
        message = {
          data: {
            title: "Commission payment accepted",
            body: `${users[0].provider_name} accepted commission payment for your recommendation`,
            recommendation_id: `${recommendation_id}`,
          },
          android: {
            priority: "high",
          },
          token: users[0].recommender_token,
        };
      } else {
        message = {
          notification: {
            title: "Commission payment accepted",
            body: `${users[0].provider_name} accepted commission payment for your recommendation`,
          },
          data: {
            title: "Commission payment accepted",
            body: `${users[0].provider_name} accepted commission payment for your recommendation`,
            recommendation_id: `${recommendation_id}`,
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
          },
          token: users[0].recommender_token,
        };
      }
      pushNotification.sendMessage(message);
    }

    deferred.resolve({
      status: 1,
      message: "Commission payment accepted",
    });

    return deferred.promise;
  },

  declineCommissionPayment: async (req) => {
    const {recommendation_id, status = "commission_payment_declined", remarks} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, commission_payment_declined_at = ?, decline_commission_remarks = ? WHERE id = ?`;
    const updateData = [status, new Date(), remarks, recommendation_id];
    const activeRecommendations = await commonFunction.updateQuery(query, updateData);

    const users = await getQueryResults(`SELECT u.registration_token as recommender_token, 
                                        u.platform as platform,
                                        u2.name as consumer_name,
                                        u1.name as provider_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.recommender_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.service_provider_id
                                        LEFT JOIN ${tableConfig.USER} u2 ON u2.id = r.consumer_id
                                        WHERE r.id = ${recommendation_id}`);

    if (
      users !== null &&
      users.length > 0 &&
      users[0].recommender_token !== null &&
      users[0].recommender_token !== ""
    ) {
      let message;
      if (users[0].platform === "android") {
        message = {
          notification: {
            title: "Commission payment declined",
            body: `${users[0].provider_name} declined commission payment for your recommendation`,
          },
          data: {
            title: "Commission payment declined",
            body: `${users[0].provider_name} declined commission payment for your recommendation`,
            recommendation_id: `${recommendation_id}`,
          },
          android: {
            priority: "high",
          },
          token: users[0].recommender_token,
        };
      } else {
        message = {
          notification: {
            title: "Commission payment declined",
            body: `${users[0].provider_name} declined commission payment for your recommendation`,
          },
          data: {
            title: "Commission payment declined",
            body: `${users[0].provider_name} declined commission payment for your recommendation`,
            recommendation_id: `${recommendation_id}`,
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
          },
          token: users[0].recommender_token,
        };
      }

      pushNotification.sendMessage(message);
    }

    deferred.resolve({
      status: 1,
      message: "Commission payment declined",
    });

    return deferred.promise;
  },
};
