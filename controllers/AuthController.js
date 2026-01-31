const sql = require("../connection");
var validation = require("../common/validation");
var authModels = require("../models/authModels");
const jwt = require("jsonwebtoken");
const { showWalletBalance } = require("../models/authModels");
//Exports
module.exports = {
  // signup
  signup: async (req, res) => {
    validation.validateSignup(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.signup(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  verifyOTP: async (req, res) => {
    validation.validateOTP(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.verifyOTP(req).then(async (results) => {
          res.json(results);
          console.log(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  // User login
  login: async (req, res) => {
    validation.validateUserLogin(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.login(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  logout: async (req, res) => {
    validation.validateUserLogout(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.logout(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },
  delete_account: async (req, res) => {
    validation.validateUserDelete(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.delete(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  resendOTP: async (req, res) => {
    validation.validateResendOTP(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.resendOTP(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  viewProfile: async (req, res) => {
    authModels.viewProfile(req).then(async (results) => {
      res.json(results);
    });
  },

  editProfile: async (req, res) => {
    authModels.editProfile(req).then(async (results) => {
      res.json(results);
    });
  },

  saveProfile: async (req, res) => {
    authModels.saveProfile(req).then(async (results) => {
      res.json(results);
    });
  },

  removeProfile: async (req, res) => {
    authModels.removeProfile(req).then(async (results) => {
      res.json(results);
    });
  },

  changeMailId: async (req, res) => {
    authModels.changeRegisteredMailId(req).then(async (results) => {
      res.json(results);
    });
  },

  checkUserExistence: async (req, res) => {
    validation.validateUserExistence(req).then((validationResults) => {
      if (validationResults.length == 0) {
        authModels.checkUserExistence(req).then(async (results) => {
          res.json(results);
        });
      } else {
        res.json({
          status: 0,
          message: validationResults[0].msg,
        });
      }
    });
  },

  showWalletBalance: async (req, res) => {
    authModels.showWalletBalance(req).then(async (results) => {
      res.json(results);
    });
  },
  withdrawRequestView: async (req, res) => {
    authModels.withdrawRequestView(req).then(async (results) => {
      res.json(results);
    });
  },
  requestWithdraw: async (req, res) => {
    authModels.requestWithdraw(req).then(async (results) => {
      res.json(results);
    });
  },
  requestWithdrawList: async (req, res) => {
    authModels.requestWithdrawList(req).then(async (results) => {
      res.json(results);
    });
  },
  changePassword: async (req, res) => {
    authModels.changePassword(req).then(async (results) => {
      res.json(results);
    });
  },

  forgotPassword: async (req, res) => {
    authModels.forgotPassword(req).then(async (results) => {
      res.json(results);
    });
  },

  // logout: async (req, res) => {
  //   validation.validateUserLogin(req).then((validationResults) => {
  //     if (validationResults.length == 0) {
  //       authModels.logout(req).then(async (results) => {
  //         if (results.userdetails) {
  //           const token = await generateAccessToken(
  //             results.userdetails.user_name
  //           );
  //           results.userdetails.token = token;
  //         }
  //         res.json(results);
  //       });
  //     } else {
  //       res.json({
  //         status: 0,
  //         message: validationResults[0].msg,
  //       });
  //     }
  //   });
  // },

  postComments: async (req, res) => {
    authModels.postComments(req).then(async (results) => {
      res.json(results);
    });
  },

  saveContactDetails: async (req, res) => {
    authModels.saveContactDetail(req).then(async (results) => {
      res.json(results);
    });
  },

  viewContactDetails: async (req, res) => {
    authModels.viewContactDetails(req).then(async (results) => {
      res.json(results);
    });
  },

  updateRegistrationToken: async (req, res) => {
    authModels.updateRegistrationToken(req).then(async (results) => {
      res.json(results);
    });
  },
};

getQueryResults = (query) =>
  new Promise((resolve, reject) =>
    sql.query(query, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    })
  );

generateAccessToken = (username) => {
  return jwt.sign({ username: username }, process.env.TOKEN_SECRET, {
    expiresIn: 21600,
  });
};
