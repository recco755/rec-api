const sql = require("../connection");
var validation = require("../common/validation");
var authModels = require("../models/authModels");
var userModels = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { showWalletBalance } = require("../models/authModels");
//Exports
module.exports = {

    listContacts: async(req, res) => {
        userModels.listContacts(req).then(async (results) => {
          res.json(results);
        })
    }

}