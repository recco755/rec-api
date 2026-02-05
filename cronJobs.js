const express = require("express");
const moment = require("moment");
const router = express.Router();
const CronJob = require("cron").CronJob;
const commonFunction = require("./models/commonfunction");
var tableConfig = require("./config/table_name.json");

const job = new CronJob("* * * * *", async () => {
  try {
    console.log("running ................");

    const recommendations =
      await commonFunction.getQueryResults(`SELECT r.*, date_add(r.recommended_at,  INTERVAL 48 hour) as expiredAt 
                                                          FROM ${tableConfig.RECOMMENDATIONS} r
                                                          WHERE (r.status = 'active' OR r.status = 'time_extended')
                                                          `);

    // AND r.recommended_at <= date_sub(now(), INTERVAL 48 hour)))
    // OR (r.status = 'time_extended' AND r.)
    let a = 1;
    for (let recommendation of recommendations) {
      console.log(recommendation, a);
      if (recommendation.status === "active") {
        // const expiredAt = moment("2025-07-08T13:54:45+01:00").add(5, "minute").toDate();
        const expiredAt = new Date(recommendation.expiredAt);
        const currentDate = new Date();
        if (currentDate.getTime() > expiredAt.getTime()) {
          const updateRecommendationQuery = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, expired_at = ? WHERE id = ?`;
          const updateData = ["expired", new Date(), recommendation.id];
          const updated = await commonFunction.insertQuery(updateRecommendationQuery, updateData);
        }
      } else {
        console.log("time extended ................");
        const expiredAt = new Date(recommendation.expiredAt);
        // console.log(expiredAt, recommendation.extended_acceptance_time);
        expiredAt.setTime(expiredAt.getTime() + parseFloat(recommendation.extended_acceptance_time) * 1000 * 60 * 60);
        const currentDate = new Date();
        // console.log(expiredAt);
        if (currentDate.getTime() > expiredAt.getTime()) {
          const updateRecommendationQuery = `UPDATE ${tableConfig.RECOMMENDATIONS} SET status = ?, expired_at = ? WHERE id = ?`;
          const updateData = ["expired", new Date(), recommendation.id];
          const updated = await commonFunction.insertQuery(updateRecommendationQuery, updateData);
        }
      }
      a++;
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
  // console.log(query);
});

job.start();

module.exports = router;
