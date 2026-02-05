const sql = require("../connection");
var validation = require("../common/validation");
var serviceProviderModel = require("../models/serviceProviderModel");

//Exports
module.exports = {
  // signup 
  createOrEditService: async (req, res) => {
    validation.validateService(req).then((validationResults) => {
      if (validationResults.length == 0) {
        serviceProviderModel.createOrEditService(req).then(async (results) => {
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

  viewService: async (req, res) => {
        serviceProviderModel.viewService(req).then(async (results) => {
            res.json(results);
        })
  },

  listRecommendations: async (req, res) => {
        serviceProviderModel.listRecommendations(req).then(async (results) => {
            res.json(results);
        })
  },

  viewRecommendation: async (req, res) => {
    serviceProviderModel.viewRecommendation(req).then(async (results) => {
        res.json(results);
    })
  },

  acceptRecommendation: async (req, res) => {
    serviceProviderModel.acceptRecommendation(req).then(async (results) => {
        res.json(results);
    })
  },

  denyRecommendation: async (req, res) => {
    serviceProviderModel.denyRecommendation(req).then(async (results) => {
        res.json(results);
    })
  },

  listActiveRecommendations: async (req, res) => {

    serviceProviderModel.listActiveRecommendations(req).then(async (results) => {
      res.json(results);
    });

  },

  viewActiveRecommendation: async (req, res) => {

    serviceProviderModel.viewActiveRecommendation(req).then(async (results) => {
      res.json(results);
    });

  },

  sendConnectionRequest: async (req, res) => {
    serviceProviderModel.sendConnectionRequest(req).then(async (results) => {
      res.json(results);
    })

  },

  extendAcceptTimeLimit: async (req, res) => {
    serviceProviderModel.extendAcceptTimeLimit(req).then(async (results) => {
      res.json(results);
    })
  },

  listContacts: async (req, res) => {
    serviceProviderModel.listContacts(req).then(async (results) => {
      res.json(results);
    })
  },

  listCommissions: async (req, res) => {
    serviceProviderModel.listCommissions(req).then(async (results) => {
      res.json(results);
    })
  },

  uploadBusinessIcon: async (req, res) => {
    serviceProviderModel.uploadBusinessIcon(req).then(async (results) => {
      res.json(results);
    })
  },

  counterApprove: async (req, res) => {
    serviceProviderModel.counterApprove(req).then(async (results) => {
      res.json(results);
    })
  },

  savePaymentDetails: async (req, res) => {
    serviceProviderModel.savePaymentDetails(req).then(async (results) => {
      res.json(results);
    })
  },

  saveBusinessDetails: async (req, res) => {
    serviceProviderModel.saveBusinessDetails(req).then(async (results) => {
      res.json(results);
    })
  },

  updateWalletBalance: async (req, res) => {
    serviceProviderModel.updateWalletBalance(req).then(async (results) => {
      res.json(results);
    })
  },
  
  updateRecommendationStatus: async(req, res) => {
    serviceProviderModel.updateRecommendationStatus(req).then(async (results) => {
      res.json(results);
    })
  },
  updateStatusTerms: async(req, res) => {
    serviceProviderModel.updateStatusTerms(req).then(async (results) => {
      res.json(results);
    })
  },

  listStatusTerms: async(req, res) => {
    serviceProviderModel.listTerms(req).then(async (results) => {
      res.json(results);
    })
  },

  serviceRendered: async(req, res) => {
    serviceProviderModel.serviceRendered(req).then(async (results) => {
      res.json(results);
    })
  },

  serviceDenied: async(req, res) => {
    serviceProviderModel.serviceDenied(req).then(async (results) => {
      res.json(results);
    })
  },

  recommendationsHistory: async(req, res) => {
    serviceProviderModel.recommendationsHistory(req).then(async (results) => {
      res.json(results);
    })
  },

  viewRecommenderDetail: async(req, res) => {
    serviceProviderModel.viewRecommenderDetail(req).then(async (results) => {
      res.json(results);
    })
  },

  acceptCommissionPayment: async(req, res) => {
    serviceProviderModel.acceptCommissionPayment(req).then(async (results) => {
      res.json(results);
    })
  },

  declineCommissionPayment: async(req, res) => {
    serviceProviderModel.declineCommissionPayment(req).then(async (results) => {
      res.json(results);
    })
  },
}