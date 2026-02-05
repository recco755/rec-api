var q = require("q");
module.exports = {
  validateSignup: (req) => {
    var deferred = q.defer();
    req.checkBody("name", "Please enter name").notEmpty();
    req.checkBody("email", "Please enter Email").notEmpty();
    // req.checkBody("password", "Please enter password").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateOTP: (req) => {
    var deferred = q.defer();
    req.checkBody("otp", "Please enter OTP").notEmpty();
    req.checkBody("user_id", "Please enter user_id").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  //validating email, password for login and email id for forgot password
  validateUserLogin: (req) => {
    var deferred = q.defer();
    // req.checkBody("password", "Please enter password").notEmpty();
    req.checkBody("user_name", "Please enter user name").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  //validating email, password for login and email id for forgot password
  validateUserExistence: (req) => {
    var deferred = q.defer();
    // req.checkBody("password", "Please enter password").notEmpty();
    req.checkBody("user_id", "Please enter user id").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateUserLogout: (req) => {
    var deferred = q.defer();
    // req.checkBody("password", "Please enter password").notEmpty();
    req.checkBody("user_id", "Please enter user_id").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateUserDelete: (req) => {
    var deferred = q.defer();
    // req.checkBody("password", "Please enter password").notEmpty();
    req.checkBody("user_id", "Please enter user_id").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateResendOTP: (req) => {
    var deferred = q.defer();
    req.checkBody("user_id", "Please enter user_id").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateService: (req) => {
    var deferred = q.defer();
    req.checkBody("business_name", "Please enter business_name").notEmpty();
    req.checkBody("service", "Please enter service").notEmpty();
    req.checkBody("availability", "Please enter availability").notEmpty();
    // req.checkBody("time", "Please enter time").notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },

  validateRecommendation: (req) => {
    var deferred = q.defer();
    req.checkBody("service_id", "Please enter service_id").notEmpty();
    req.checkBody("consumers", "Please enter consumers ").notEmpty();
    req.checkBody("recommender_id", "Please enter recommender_id").notEmpty();
    req.checkBody("experienced", "Please enter experienced").notEmpty();
    // req.checkBody("rating", "Please enter rating").notEmpty();
    // req.checkBody("feedback", "Please enter feedback").notEmpty();
    req
      .checkBody("expected_commission", "Please enter expected_commission")
      .notEmpty();
    if (!req.validationErrors()) {
      deferred.resolve([]);
    } else {
      deferred.resolve(req.validationErrors());
    }
    return deferred.promise;
  },
};
