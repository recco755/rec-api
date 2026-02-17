const sql = require("../connection");
var tableConfig = require("../config/table_name.json");
var md5 = require("md5");
var q = require("q");
var commonFunction = require("../models/commonfunction");
const mailNotification = require("../common/mailNotification");
const {getQueryResults} = require("../models/commonfunction");
const pushNotification = require("../common/sendPushNotification");

module.exports = {
  createRecommendation: async (req) => {
    console.log("create recommendation..........");

    const deferred = q.defer();
    const {
      provider_id,
      recommender_id,
      service_id,
      consumer_id,
      consumers,
      experienced,
      rating,
      feedback,
      expected_commission,
      review,
    } = req.body;
    // console.log(consumers);
    const consumerIds = JSON.parse(consumers);

    for (consumer of consumerIds) {
      const alreadyRecommended = `SELECT COUNT(*) as count FROM ${tableConfig.RECOMMENDATIONS} 
                                        WHERE service_id = ${service_id} 
                                        AND consumer_id = ${consumer.consumer_id}
                                        AND recommender_id = ${recommender_id} 
                                        AND status IN ('accepted', 'counter_offered', 'counter_offer_accepted', 'service_rendered', 'active', 'time_extended', 'commission_payment_accepted')`;

      const recommended = await commonFunction.getQueryResults(alreadyRecommended);

      // if (
      //   recommended !== null &&
      //   recommended.length !== 0 &&
      //   recommended[0] !== null &&
      //   recommended[0].count > 0
      // ) {
      // deferred.resolve({
      //     status: 0,
      //     message: "Recommendation already sent"
      //  });
      // deferred.resolve({
      //   status: 1,
      //   message: "Already recommended",
      // });
      // console.log("already recommended ............");
      // } else {
      const insertRecommendationQuery = `INSERT INTO ${tableConfig.RECOMMENDATIONS} SET ?`;
      const insertData = {
        service_provider_id: provider_id,
        service_id: service_id,
        recommender_id: recommender_id,
        consumer_id: consumer.consumer_id,
        experienced: experienced,
        rating: rating,
        feedback: feedback,
        expected_commission: expected_commission,
        recommended_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const inserted = await commonFunction.insertQuery(insertRecommendationQuery, insertData);

      const getUser = `SELECT u1.name as recommender_name,
                                            u.name as consumer_name, 
                                            u.registration_token as consumer_token,
                                            u2.registration_token as provider_token,
                                            u2.platform as platform
                                     FROM ${tableConfig.USER} u
                                     LEFT JOIN ${tableConfig.USER} u1 ON u1.id = ${recommender_id}
                                     LEFT JOIN ${tableConfig.USER} u2 ON u2.id = ${provider_id}
                                     WHERE u.id = ${consumer.consumer_id}`;

      const contactsQuery = `SELECT * FROM ${tableConfig.CONNECTIONS} WHERE user_id = ${recommender_id} AND friend_id = ${consumer.consumer_id}`;
      const contacts = await commonFunction.getQueryResults(contactsQuery);

      if (contacts.length === 0) {
        // if (contacts.length > 5) {
        //     deferred.resolve({
        //         status: 1,
        //         message: "Only the first 5 contacts will be processed"
        //     });
        // }
        const insertData = [
          [recommender_id, consumer.consumer_id],
          [consumer.consumer_id, recommender_id],
        ];

        const createQuery = `INSERT INTO ${tableConfig.CONNECTIONS} (user_id, friend_id) VALUES ? `;
        sql.query(createQuery, [insertData]);
      }

      const users = await commonFunction.getQueryResults(getUser);
      // Push notification
      //console.log(inserted);
      if (users && users.length > 0 && users[0].provider_token && users[0].provider_token !== "") {
        const {platform, recommender_name, provider_token, consumer_token, consumer_name} = users[0];
        const recommendationId = inserted.insertId;
        if (consumer_token !== "" && consumer_token !== null) {
          const baseMessage = {
            data: {
              title: "Recommendation",
              body: `Recommendation has successfully been made by ${recommender_name} to ${consumer_name} `,
            },
            token: consumer_token,
          };

          if (platform === "android") {
            baseMessage.android = {
              priority: "high",
            };
            baseMessage.apns = {
              headers: {
                "apns-priority": "10",
              },
            };
          } else {
            baseMessage.notification = {
              title: "Recommendation",
              body: `Recommendation has successfully been made by ${recommender_name} to ${consumer_name} `,
            };
            baseMessage.apns = {
              headers: {
                "apns-priority": "10",
              },
            };
          }

          pushNotification.sendMessage(baseMessage);
        }
        const baseMessage = {
          data: {
            title: "New Recommendation",
            body: `${recommender_name} sent you a recommendation`,
            recommendation_id: `${recommendationId}`,
          },
          token: provider_token,
        };

        if (platform === "android") {
          baseMessage.android = {
            priority: "high",
          };
          baseMessage.apns = {
            headers: {
              "apns-priority": "10",
            },
          };
        } else {
          baseMessage.notification = {
            title: "New Recommendation",
            body: `${recommender_name} sent you a recommendation`,
          };
          baseMessage.apns = {
            headers: {
              "apns-priority": "10",
            },
          };
        }

        // Send push notification
        pushNotification.sendMessage(baseMessage);
      }

      const notification = `Recommendation has successfully been made by ${users[0].recommender_name} to ${users[0].consumer_name} `;
      const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;

      const insertNotificationData = {
        notification: notification,
        status: "unread",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const createNotification = await commonFunction.insertQuery(notificationQuery, insertNotificationData);

      // Rating the service
      const alreadyRatedQuery = `SELECT * FROM ${tableConfig.RATING} WHERE service_id = ${service_id} AND
                                                                                            user_id = ${recommender_id}`;
      const alreadyRated = await getQueryResults(alreadyRatedQuery);
      if (alreadyRated.length === 0) {
        const insertStatusQuery = `INSERT INTO ${tableConfig.RATING} SET ?`;
        const statusData = {
          user_id: recommender_id,
          service_id: service_id,
          rating: rating ? rating : 0,
          comments: feedback ? feedback : "",
        };
        const insertedStatus = await commonFunction.insertQuery(insertStatusQuery, statusData);
      } else {
        const updateRatingQuery = `UPDATE ${tableConfig.RATING} SET rating = ?, comments = ? WHERE user_id = ? AND service_id = ?`;
        const updateData = [rating, feedback, recommender_id, service_id];
        const updateRating = await commonFunction.updateQuery(updateRatingQuery, updateData);
      }
      const selectQuery = `SELECT COUNT(*) as count, SUM(rating) as rating  FROM ${tableConfig.RATING} WHERE service_id = ${service_id}`;
      const service_rating = await commonFunction.getQueryResults(selectQuery);
      const average_rating = (service_rating[0].rating / service_rating[0].count).toFixed(1);
      const result = sql.query(
        `UPDATE ${tableConfig.SERVICES} SET rating = ${average_rating} WHERE id = ${service_id}`
      );

      if (inserted.affectedRows > 0) {
        deferred.resolve({
          status: 1,
          message: "Recommendation sent successfully",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "Something went wrong",
        });
      }
      // }
    }

    return deferred.promise;
  },

  listUsers: async (req) => {
    const deferred = q.defer();
    const getServiceQuery = `SELECT id, name, profile_url, mobile_number, email FROM ${tableConfig.USER}`;
    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });

    return deferred.promise;
  },

  // listServices: async(req) => {

  //     const deferred = q.defer();
  //     const getServiceQuery = `SELECT * FROM ${tableConfig.SERVICES}`;

  //     const service = await commonFunction.getQueryResults(getServiceQuery);

  //     deferred.resolve({
  //         status: 1,
  //         data: service
  //     })

  //     return deferred.promise;

  // },

  findUser: async (req) => {
    const {user_id, filter, email, is_service_provider = 1, page_no = 0, limit = 10} = req.body;
    const deferred = q.defer();

    let offset = page_no * limit;

    if (filter === 1 || filter === "1") {
      const getServiceQuery = `SELECT u.id, 
                                            u.profile_url,
                                            u.name, 
                                            u.email, 
                                            u.mobile_number, 
                                            u.is_service_provider 
                                      FROM ${tableConfig.USER} as u
                                       WHERE u.id != ${user_id} 
                                             AND u.is_service_provider = ${is_service_provider}
                                             AND u.status = 1 
                                             AND (u.email like '%${email}%' OR u.name like '%${email}%') 
                                       GROUP BY u.id 
                                       ORDER BY id DESC
                                       LIMIT ${limit} OFFSET ${offset}`;

      const service = await commonFunction.getQueryResults(getServiceQuery);

      const countQuery = `SELECT COUNT(*) as count 
                          FROM ${tableConfig.USER} 
                          WHERE id != ${user_id} 
                            AND is_service_provider = ${is_service_provider} 
                            AND status = 1  -- Added status check
                            AND (email like '%${email}%' OR name like '%${email}%')`;

      const count = await commonFunction.getQueryResults(countQuery);
      const data = {users: service, count: count[0].count};

      deferred.resolve({
        status: 1,
        data: data,
      });
    } else {
      const getServiceQuery = `SELECT id, profile_url, name, email, mobile_number, is_service_provider
                                       FROM ${tableConfig.USER} 
                                       WHERE id != ${user_id} 
                                             AND is_service_provider = ${is_service_provider} 
                                             AND status = 1
                                       ORDER BY id DESC
                                       LIMIT ${limit} OFFSET ${offset}`;

      const service = await commonFunction.getQueryResults(getServiceQuery);

      const countQuery = `SELECT COUNT(*) as count 
                          FROM ${tableConfig.USER} 
                          WHERE id != ${user_id} 
                            AND is_service_provider = ${is_service_provider} 
                            AND status = 1`;

      const count = await commonFunction.getQueryResults(countQuery);
      const data = {users: service, count: count[0].count};

      deferred.resolve({
        status: 1,
        data: data,
      });
    }

    return deferred.promise;
  },

  findService: async (req) => {
    const {user_id, recommender_id} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `SELECT u.id, u.is_service_provider, u.name, u.profile_url, u.mobile_number, u.email, s.*, IFNULL( r.rating, 0) as recommender_rating FROM ${tableConfig.USER} as u
                                 INNER JOIN ${tableConfig.SERVICES} as s ON s.userId = u.id 
                                 LEFT JOIN ${tableConfig.RATING} as r ON r.service_id = s.id AND user_id = ${recommender_id}
                                 WHERE u.id = ${user_id}`;

    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });

    return deferred.promise;
  },

  listRecommended: async (req) => {
    const {user_id, status = "deleted"} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `
    SELECT r.*, 
           u1.profile_url as recommended_to_profile, u1.name as recommended_to, 
           u2.profile_url as service_provider_profile, u2.name as recommended, 
           u.profile_url as recommender_profile, u.name as recommender 
    FROM ${tableConfig.RECOMMENDATIONS} as r
    LEFT JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
    LEFT JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
    LEFT JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
    LEFT JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
    WHERE r.recommender_id = ${user_id} 
      AND r.status NOT IN ( 'expired', 'paid', 'counter_offer_declined', 'commission_payment_declined', 'deleted', 'declined')
    ORDER BY r.id DESC;
  `;
    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });

    return deferred.promise;
  },

  listHistory: async (req) => {
    const {user_id} = req.body; // "type" will determine if it's for consumer or recommender

    const getServiceQuery = `
      SELECT r.*, 
             u1.profile_url AS recommended_to_profile, 
             u1.name AS recommended_to, 
             u2.profile_url AS service_provider_profile, 
             u2.name AS recommended, 
             u.profile_url AS recommender_profile, 
             u.name AS recommender 
      FROM ${tableConfig.RECOMMENDATIONS} AS r
      LEFT JOIN ${tableConfig.SERVICES} AS s ON s.id = r.service_id
      LEFT JOIN ${tableConfig.USER} AS u1 ON u1.id = r.consumer_id
      LEFT JOIN ${tableConfig.USER} AS u2 ON u2.id = r.service_provider_id
      LEFT JOIN ${tableConfig.USER} AS u ON u.id = r.recommender_id
      WHERE (r.consumer_id = ${user_id} OR r.recommender_id = ${user_id})
        AND r.status IN ('service_rendered', 'service_denied', 'expired', 'paid', 'counter_offer_declined', 'commission_payment_declined', 'declined')
      ORDER BY r.created_at DESC
    `;

    try {
      const service = await commonFunction.getQueryResults(getServiceQuery);

      return {
        status: 1,
        data: service,
      };
    } catch (error) {
      console.error("Error fetching recommendation history:", error);
      return {
        status: 0,
        message: "Failed to retrieve recommendation history.",
      };
    }
  },

  viewRecommended: async (req) => {
    const {recommendation_id} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `
    SELECT 
        r.*, s.*, u3.profile_url AS service_provider_profile, 
        u3.name AS service_provider_name, 
        u1.profile_url AS recommended_to_profile, u1.name AS recommended_to, 
        IFNULL(u1.mobile_number, '') AS recommended_to_contact, 
        IFNULL(u1.email, '') AS recommended_to_email, 
        u2.profile_url AS recommended_by_profile, u2.name AS recommended_by, 
        IFNULL(r.rating, 0) AS user_rating,
        IFNULL(s.commission_guideline, null) AS commission_guideline,
        IFNULL(s.repeated_customer_commission, null) AS repeated_customer_commission
    FROM recommendations AS r 
    LEFT JOIN services AS s ON s.id = r.service_id 
    LEFT JOIN user AS u1 ON u1.id = r.consumer_id 
    LEFT JOIN user AS u2 ON u2.id = r.recommender_id 
    LEFT JOIN user AS u3 ON u3.id = r.service_provider_id 
    WHERE r.id = ${recommendation_id}
`;

    const service = await commonFunction.getQueryResults(getServiceQuery);
    // console.log(service);
    deferred.resolve({
      status: 1,
      data: service,
    });
    return deferred.promise;
  },

  listRecommendations: async (req) => {
    const {user_id, status = "deleted"} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `SELECT r.*, u1.profile_url as recomended_to_profile,
                                 u1.name as recommended_to, u2.profile_url as service_provider_profile,
                                 u2.name as recommended, u.profile_url as recommender_profile, u.name as recommender 
                                 FROM ${tableConfig.RECOMMENDATIONS} as r
                                 LEFT JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                                 LEFT JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                                 LEFT JOIN ${tableConfig.USER} as u2 ON u2.id = r.service_provider_id
                                 LEFT JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                                 WHERE r.consumer_id = ${user_id} AND r.status NOT IN ('service_rendered', 'expired', 'paid', 'counter_offer_declined', 'commission_payment_declined', 'deleted', 'declined')
                                 order by id desc`;

    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });

    return deferred.promise;
  },

  viewRecommendation: async (req) => {
    const {recommendation_id} = req.body;
    const deferred = q.defer();
    const getServiceQuery = `SELECT r.*, 
                                        s.business_name, s.service, s.availability, s.service_date,
                                        s.time, s.description, s.business_icon, s.rating, s.business_type, s.business_license, 
                                        s.address, s.userId,
                                        u1.profile_url as consumer_profile, u1.name as consumer, 
                                        u2.profile_url as recommender_by_profile, u2.name as recommender_by,
                                        u3.profile_url as recommended_profile, u3.name as recommended, 
                                        IFNULL(r.rating, 0) as user_rating,
                                        IFNULL(s.commission_guideline, null) AS commission_guideline,
                                        IFNULL(s.repeated_customer_commission, null) AS repeated_customer_commission
                                 FROM ${tableConfig.RECOMMENDATIONS} as r
                                 LEFT JOIN ${tableConfig.SERVICES} as s ON s.id = r.service_id
                                 LEFT JOIN ${tableConfig.USER} as u1 ON u1.id = r.consumer_id
                                 LEFT JOIN ${tableConfig.USER} as u2 ON u2.id = r.recommender_id
                                 LEFT JOIN ${tableConfig.USER} as u3 ON u3.id = r.service_provider_id
                                 LEFT JOIN ${tableConfig.RATING} as ra ON ra.user_id = r.consumer_id AND ra.service_id = r.service_id 
                                 WHERE r.id = ${recommendation_id}`;

    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });
    return deferred.promise;
  },

  acceptConnectionRequest: async (req) => {
    const {service_provider_id, user_id, status = "connected"} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.CONNECTIONS} SET status = ? WHERE  service_provider_id = ? AND user_id = ?`;
    const updateData = [status, service_provider_id, user_id];
    const service = await commonFunction.updateQuery(query, updateData);

    deferred.resolve({
      status: 1,
      message: "Connected successfully",
    });

    return deferred.promise;
  },

  declineConnectionRequest: async (req) => {
    const {service_provider_id, user_id, status = "declined"} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.CONNECTIONS} SET status = ? WHERE  service_provider_id = ? AND user_id = ?`;
    const updateData = [status, service_provider_id, user_id];
    const service = await commonFunction.updateQuery(query, updateData);

    deferred.resolve({
      status: 1,
      message: "Request declined",
    });

    return deferred.promise;
  },

  listContacts: async (req) => {
    const {user_id, status = "connected"} = req.body;
    const deferred = q.defer();

    // const query = `SELECT *, u.name, u.email, u.mobile_number FROM ${tableConfig.CONNECTIONS} as c
    //                LEFT JOIN ${tableConfig.USER} as u ON u.id = c.user_id
    //                WHERE user_id = ${user_id} and status = '${status}'`;
    // const contacts = await getQueryResults(query);

    const getServiceQuery = `SELECT u.id, u.profile_url, u.name, u.mobile_number, u.email FROM ${tableConfig.USER} u
                                    INNER JOIN ${tableConfig.CONNECTIONS} c ON c.user_id = ${user_id}
                                    WHERE u.id = c.friend_id ORDER BY id DESC`;

    const service = await commonFunction.getQueryResults(getServiceQuery);

    deferred.resolve({
      status: 1,
      data: service,
    });

    return deferred.promise;
  },

  showWalletBalance: async (req) => {
    const {user_id, status = "paid"} = req.body;
    const deferred = q.defer();
    const query = `SELECT SUM(expected_commission) as wallet_balance FROM ${tableConfig.RECOMMENDATIONS} as c
                       WHERE recommender_id = ${user_id} and status = '${status}'`;
    const balance = await getQueryResults(query);
    let wallet_balance = balance[0].wallet_balance || 0;
    if (wallet_balance < 0) {
      wallet_balance = 0;
    }
    wallet_balance = {wallet_balance: wallet_balance};
    deferred.resolve({
      status: 1,
      data: wallet_balance,
    });

    return deferred.promise;
  },

  showCommissionHistory: async (req) => {
    const {user_id} = req.body;
    const deferred = q.defer();
    const query = `SELECT SUM(expected_commission) FROM ${tableConfig.RECOMMENDATIONS} as c
                       WHERE user_id = ${user_id} and status = '${status}'`;
    const contacts = await getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: contacts,
    });

    return deferred.promise;
  },

  showCommissionHistory: async (req) => {
    const {user_id} = req.body;
    const deferred = q.defer();
    const query = `SELECT SUM(expected_commission) FROM ${tableConfig.RECOMMENDATIONS} as c
                       WHERE user_id = ${user_id} and status = '${status}'`;
    const contacts = await getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: contacts,
    });

    return deferred.promise;
  },

  listCommissions: async (req) => {
    const {user_id, payment_status = "paid"} = req.body;

    const deferred = q.defer();
    const query = `SELECT r.paid_at, r.amount_paid,  IFNULL( r.amount_received_by_recommender, '') as amount_received_by_recommender  FROM ${tableConfig.RECOMMENDATIONS} as r
                       INNER JOIN ${tableConfig.USER} as u ON u.id = r.recommender_id
                       WHERE r.recommender_id = ${user_id} AND payment_status = '${payment_status}' ORDER BY r.paid_at desc `;

    const commissions = await commonFunction.getQueryResults(query);
    // console.log(commissions);
    deferred.resolve({
      status: 1,
      data: commissions,
    });
    return deferred.promise;
  },

  acceptCounterOffer: async (req) => {
    const {recommendation_id, status = "counter_offer_accepted"} = req.body;
    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, counter_offer_accepted_at = ? WHERE id = ?`;
    const updateData = [status, new Date(), recommendation_id];
    const updated = await commonFunction.updateQuery(query, updateData);
    // console.log(updated, "=====updated=====");
    const users = await getQueryResults(`SELECT u.registration_token as provider_token, 
                                                u.platform as platform,
                                                u1.name as recommender_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.service_provider_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.recommender_id
                                        WHERE r.id = ${recommendation_id}`);
    // console.dir(users, {depth: "*", color: true});
    if (updated.affectedRows > 0) {
      if (users && users.length > 0 && users[0].provider_token && users[0].provider_token !== "") {
        const {platform, recommender_name, provider_token} = users[0];
        const recommendationId = recommendation_id;

        let message;
        if (platform === "android") {
          message = {
            data: {
              title: "Counter-Offer accepted",
              body: `${recommender_name} accepted your counter-offer`,
              recommendation_id: `${recommendationId}`,
            },
            android: {
              priority: "high",
            },
            apns: {
              headers: {
                "apns-priority": "5",
              },
            },
            token: provider_token,
          };
        } else {
          message = {
            notification: {
              title: "Counter-Offer accepted",
              body: `${recommender_name} accepted your counter-offer`,
            },
            data: {
              title: "Counter-Offer accepted",
              body: `${recommender_name} accepted your counter-offer`,
              recommendation_id: `${recommendationId}`,
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
            },
            token: provider_token,
          };
        }

        console.log("Message to send:", message);

        pushNotification.sendMessage(message);
      }
      deferred.resolve({
        status: 1,
        message: "Counter offer accepted",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }

    return deferred.promise;
  },

  declineCounterOffer: async (req) => {
    const {recommendation_id, status = "counter_offer_declined"} = req.body;
    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, counter_offer_declined_at = ? WHERE id = ?`;
    const updateData = [status, new Date(), recommendation_id];
    const updated = await commonFunction.updateQuery(query, updateData);

    const users = await getQueryResults(`SELECT u.registration_token as provider_token, 
                                                u1.name as recommender_name FROM ${tableConfig.RECOMMENDATIONS} r 
                                        LEFT JOIN ${tableConfig.USER} u ON u.id = r.service_provider_id
                                        LEFT JOIN ${tableConfig.USER} u1 ON u1.id = r.recommender_id
                                        WHERE r.id = ${recommendation_id}`);

    if (users && users.length > 0 && users[0].recommender_token && users[0].recommender_token !== "") {
      const {platform, recommender_name, provider_token} = users[0];
      const recommendationId = inserted.insertId;

      let message;

      if (platform === "android") {
        message = {
          data: {
            title: "Counter-Offer declined",
            body: `${recommender_name} declined your counter-offer`,
            recommendation_id: `${recommendationId}`,
          },
          android: {
            priority: "high",
          },
          apns: {
            headers: {
              "apns-priority": "5",
            },
          },
          token: provider_token,
        };
      } else {
        message = {
          notification: {
            title: "Counter-Offer declined",
            body: `${recommender_name} declined your counter-offer`,
          },
          data: {
            title: "Counter-Offer declined",
            body: `${recommender_name} declined your counter-offer`,
            recommendation_id: `${recommendationId}`,
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
          },
          token: provider_token,
        };
      }

      console.log("Prepared message:", message);

      pushNotification.sendMessage(message);
    }

    if (updated.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        message: "Counter offer declined",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong",
      });
    }

    return deferred.promise;
  },

  rateService: async (req, res) => {
    const {service_id, user_id, rating, comments} = req.body;

    const deferred = q.defer();

    const alreadyRatedQuery = `SELECT * FROM ${tableConfig.RATING} WHERE service_id = ${service_id} AND
                                                                              user_id = ${user_id}`;
    const alreadyRated = await getQueryResults(alreadyRatedQuery);
    if (alreadyRated.length === 0) {
      const insertStatusQuery = `INSERT INTO ${tableConfig.RATING} SET ?`;
      const statusData = {
        user_id: user_id,
        service_id: service_id,
        rating: rating ? rating : 0,
        comments: comments ? comments : "",
      };
      const insertedStatus = await commonFunction.insertQuery(insertStatusQuery, statusData);
    } else {
      const updateRatingQuery = `UPDATE ${tableConfig.RATING} SET rating = ?, comments = ? WHERE user_id = ? AND service_id = ?`;
      const updateData = [rating, comments, user_id, service_id];
      const updateRating = await commonFunction.updateQuery(updateRatingQuery, updateData);
    }

    const selectQuery = `SELECT COUNT(*) as count, SUM(rating) as rating  FROM ${tableConfig.RATING} WHERE service_id = ${service_id}`;
    const service_rating = await commonFunction.getQueryResults(selectQuery);
    const average_rating = (service_rating[0].rating / service_rating[0].count).toFixed(1);
    const result = sql.query(`UPDATE ${tableConfig.SERVICES} SET rating = ${average_rating} WHERE id = ${service_id}`);
    // console.log(result);
    // if(result.affectedRows > 0) {
    deferred.resolve({
      status: 1,
      message: "Rating added",
    });
    // } else {
    //     deferred.resolve({
    //         status: 0,
    //         message: "Something went wrong"
    //     });
    // }

    return deferred.promise;
  },

  inviteUser: async (req) => {
    const {user_id, contact_number, email} = req.body;

    const deferred = q.defer();
    const query = `INSERT INTO ${tableConfig.INVITATIONS} SET ?`;
    const createData = {
      user_id: user_id,
      contact_number: contact_number,
      email: email,
      status: "invited",
    };
    const created = await commonFunction.insertQuery(query, createData);
    if (created.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        message: "invitation sent",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "something went wrong",
      });
    }
    return deferred.promise;
  },

  getContacts: async (req) => {
    //console.log("getContacts");
    //console.log(req.body);
    const {mobileNumbers} = req.body;

    const deferred = q.defer();
    const appUsersQuery = `
      SELECT id, name, mobile_number, profile_url, email, is_service_provider
      FROM ${tableConfig.USER}
      WHERE status = 1
    `;
    const appUsers = await commonFunction.getQueryResults(appUsersQuery);
    const sanitizedMobileNumbers = mobileNumbers.map((num) => num.replace(/\s+/g, "").trim());

    const users = sanitizedMobileNumbers
      .map((mobileNumber) => {
        const user = appUsers.find((appUser) => appUser.mobile_number === mobileNumber);

        if (user) {
          return {
            mobile_number: mobileNumber,
            user_id: user.id,
            profile_url: user.profile_url,
            user_exists: 1,
            is_service_provider: user.is_service_provider,
          };
        } else {
          return {
            mobile_number: mobileNumber,
            user_id: 0,
            profile_url: "",
            user_exists: 0,
            is_service_provider: 0,
          };
        }
      })
      .filter((contact) => contact.user_exists === 1);

    deferred.resolve({
      status: 1,
      message: users,
    });

    return deferred.promise;
  },

  deleteRecommendation: async (req) => {
    const {recommendation_id, status = "deleted"} = req.body;

    const deferred = q.defer();
    const updateQuery = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ? WHERE id = ?`;
    const updateData = [status, recommendation_id];
    const deleted = await commonFunction.insertQuery(updateQuery, updateData);

    if (deleted.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        message: "deleted successfully",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "something went wrong",
      });
    }

    return deferred.promise;
  },
};
