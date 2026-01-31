const sql = require("../connection");
var tableConfig = require("../config/table_name.json");
var md5 = require("md5");
var q = require("q");
var commonFunction = require("../models/commonfunction");
const mailNotification = require("../common/mailNotification");
const multer = require("multer");
const {getQueryResults} = require("../models/commonfunction");

module.exports = {
  listContacts: async (req) => {
    const {user_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT c.friend_id, u.name, u.email FROM ${tableConfig.CONNECTIONS} c WHERE user_id = ${user_id} 
                        INNER JOIN ${tableConfig.USER} as u on u.id = c.friend_id`;

    const contacts = await commonFunction.getQueryResults(query);
    deferred.resolve({
      status: 1,
      data: contacts,
    });

    return deferred.promise;
  },
};
