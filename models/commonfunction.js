const sql = require("../connection");
var q = require("q");
var tableConfig = require("../config/table_name.json");
const env = require("../env");
const crypto = require('crypto');
module.exports = {

  getQueryResults: async (query) => {
    var deferred = q.defer();
    var result = [];
    sql.query(query, function (err, results) {
      if (err) {
        console.log(err);
        deferred.resolve(result);
      } else {
        deferred.resolve(results);
      }
    });
    return deferred.promise;
  },

  insertQuery: async (query, data) => {
    var deferred = q.defer();
    var result = [];
    sql.query(query, data, function (err, results) {
      if (err) {
        console.log(err);
        deferred.resolve(result);
      } else {
        deferred.resolve(results);
      }
    });
    return deferred.promise;
  },

  updateQuery: async (query, data) => {
    var deferred = q.defer();
    var result = [];
    sql.query(query, data, function (err, results) {
      if (err) {
        console.log(err);
        deferred.resolve(result);
      } else {
        deferred.resolve(results);
      }
    });
    return deferred.promise;
  },
  // Get withdrawal requests Generate Unique Payment id 
  generateUniquePaymentId: async () =>{
    let payment_id;
    let isUnique = false;

    while (!isUnique) {
        payment_id = `pi_${crypto.randomBytes(10).toString('hex')}`;

        const checkQuery = `SELECT COUNT(*) AS count FROM ${tableConfig.WITHDRAW} WHERE payment_id = ?`;

        try {
            const [result] = await new Promise((resolve, reject) => {
                sql.query(checkQuery, [payment_id], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            if (result.count === 0) {
                isUnique = true; // Exit loop if payment_id is unique
            }
        } catch (error) {
            console.error("Database error while checking payment_id:", error);
            throw new Error("Database error while generating unique payment ID");
        }
    }

    return payment_id;
},

};
