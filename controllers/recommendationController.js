const sql = require("../connection");
var validation = require("../common/validation");
var serviceProviderModel = require("../models/serviceProviderModel");
var recommendationModel = require("../models/recommendationModel");

module.exports = {

  createRecommendation: async (req, res) => {

    console.log("create recommendation controller....")
    validation.validateRecommendation(req).then((validationResults) => {
      if (validationResults.length == 0) {
        recommendationModel.createRecommendation(req).then(async (results) => {
          console.log(results);
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

  findUser: async (req, res) => {
    recommendationModel.findUser(req).then(async (results) => {
      res.json(results);
    });
  },

  findService: async (req, res) => {
    recommendationModel.findService(req).then(async (results) => {
      res.json(results);
    });
  },

  // recommended by user
  listRecommended: async (req, res) => {
    recommendationModel.listRecommended(req).then(async (results) => {
      res.json(results);
    })
  },
  listHistroyRecommended: async (req, res) => {
    recommendationModel.listHistory(req).then(async (results) => {
      res.json(results);
    })
  },
  // view recommended service with status
  viewRecommended: async (req, res) => {
    recommendationModel.viewRecommended(req).then(async (results) => {
      res.json(results);
    })
  },

  // recommended to user
  listRecommendations: async (req, res) => {
    recommendationModel.listRecommendations(req).then(async (results) => {
      res.json(results);
    })
  },

  // view recommendation with service and status
  viewRecommendation: async (req, res) => {
    recommendationModel.viewRecommendation(req).then(async (results) => {
      res.json(results);
    })
  },


  acceptConnectionRequest: async (req, res) => {
    recommendationModel.acceptConnectionRequest(req).then(async (results) => {
      res.json(results);
    })
  },

  declineConnectionRequest: async (req, res) => {
    recommendationModel.declineConnectionRequest(req).then(async (results) => {
      res.json(results);
    })
  },

  listContacts: async (req, res) => {
    recommendationModel.listContacts(req).then(async (results) => {
      res.json(results);
    })
  },

  showWalletBalance: async (req, res) => {
    recommendationModel.showWalletBalance(req).then(async (results) => {
      res.json(results);
    })
  },

  acceptCounterOffer: async (req, res) => {
    recommendationModel.acceptCounterOffer(req).then(async (results) => {
      res.json(results);
    })
  },

  declineCounterOffer: async (req, res) => {
    recommendationModel.declineCounterOffer(req).then(async (results) => {
      res.json(results);
    })
  },

  rateService: async (req, res) => {
    recommendationModel.rateService(req).then(async (results) => {
      res.json(results);
    })
  },

  getContacts: async (req, res) => {
    recommendationModel.getContacts(req).then(async (results) => {
      res.json(results);
    })
  },

  listCommissions: async (req, res) => {
    recommendationModel.listCommissions(req).then(async (results) => {
      res.json(results);
    })
  },

  inviteUser: async (req, res) => {
    recommendationModel.inviteUser(req).then(async (results) => {
      res.json(results);
    })
  },

  deleteRecommendation: async (req, res) => {
    recommendationModel.deleteRecommendation(req).then(async (results) => {
      res.json(results);
    })
  },

  serviceDetailsByOwnerEmail: async (req, res) => {
    recommendationModel.serviceDetailsByOwnerEmail(req).then(async (results) => {
      res.json(results);
    });
  },
}