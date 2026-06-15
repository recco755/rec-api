var circleQueryModel = require("../models/circleQueryModel");

module.exports = {
  getCircleQueryDetails: async (req, res) => {
    circleQueryModel.getCircleQueryDetails(req).then((results) => {
      res.json(results);
    });
  },

  saveCircleQueryDetails: async (req, res) => {
    circleQueryModel.saveCircleQueryDetails(req).then((results) => {
      res.json(results);
    });
  },

  pushCircleQueryToContacts: async (req, res) => {
    circleQueryModel.pushCircleQueryToContacts(req).then((results) => {
      res.json(results);
    });
  },

  getCircleQueryPushStatus: async (req, res) => {
    circleQueryModel.getCircleQueryPushStatus(req).then((results) => {
      res.json(results);
    });
  },

  cancelActiveCircleQuery: async (req, res) => {
    circleQueryModel.cancelActiveCircleQuery(req).then((results) => {
      res.json(results);
    });
  },

  getHomeCircleQueryOverlay: async (req, res) => {
    circleQueryModel
      .getHomeCircleQueryOverlayForRecipient(req)
      .then((results) => {
        res.json(results);
      });
  },

  dismissCircleQueryDelivery: async (req, res) => {
    circleQueryModel.dismissCircleQueryDelivery(req).then((results) => {
      res.json(results);
    });
  },

  likeCircleQueryDelivery: async (req, res) => {
    circleQueryModel.likeCircleQueryDelivery(req).then((results) => {
      res.json(results);
    });
  },

  getHomeCircleQueryInbox: async (req, res) => {
    circleQueryModel.getHomeCircleQueryInboxForRecipient(req).then((results) => {
      res.json(results);
    });
  },

  getHomeCircleQueryLikes: async (req, res) => {
    circleQueryModel.getHomeCircleQueryLikesForRecipient(req).then((results) => {
      res.json(results);
    });
  },
};
