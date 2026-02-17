const paymentController = require("../controllers/paymentController");
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
module.exports = (app) => {
  const auth = require("../controllers/AuthController");
  const serviceProviderController = require("../controllers/ServiceProviderController");
  const recommendationController = require("../controllers/recommendationController");
  const wallet = require("../controllers/walletController");
  const multer = require("multer");

  const MIME_TIYE_MAP = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      console.log("destination");
      // const isValid = MIME_TIYE_MAP[file.mimetype];
      // let error = new Error('Invalid mime type');
      // if(isValid){
      //  let error = null;
      // }
      cb(null, "public/profiles");
    },
    filename: (req, file, cb) => {
      const name = file.originalname.split(" ").join("-").toLowerCase();
      const file_name = name.split(".").slice(0, -1);
      const ext = MIME_TIYE_MAP[file.mimetype];
      cb(null, file_name + "-" + Date.now() + "." + ext);
    },
  });

  const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "public/businessIcons");
    },
    filename: (req, file, cb) => {
      const name = file.originalname.split(" ").join("-").toLowerCase();
      const file_name = name.split(".").slice(0, -1);
      const ext = MIME_TIYE_MAP[file.mimetype];
      cb(null, file_name + "-" + Date.now() + "." + ext);
    },
  });

  // login
  app.post("/api/v1/login", auth.login);
  app.post("/api/v1/logout", auth.logout);
  app.post("/api/v1/delete_account", auth.delete_account);
  app.post("/api/v1/signup", auth.signup);
  app.post("/api/v1/verify_otp", auth.verifyOTP);
  app.post("/api/v1/resend_otp", auth.resendOTP);
  app.post("/api/v1/changeMailId", auth.changeMailId);
  app.post("/api/v1/view_profile", auth.viewProfile);
  app.post("/api/v1/edit_profile", auth.editProfile);
  app.post("/api/v1/show_wallet_balance", auth.showWalletBalance);
  app.post("/api/v1/post_comments", auth.postComments);
  app.post("/api/v1/change_password", auth.changePassword);
  app.post("/api/v1/forgot_password", auth.forgotPassword);
  app.post(
    "/api/v1/save_profile",
    multer({ storage: storage }).single("profile"),
    auth.saveProfile
  );
  app.post("/api/v1/remove_profile", auth.removeProfile);
  app.post("/api/v1/checkout", paymentController.checkout);
  app.post("/api/v1/payment-status", paymentController.paymentStatus);
  app.post(
    "/api/v1/webhook",
    bodyParser.raw({ type: "application/json" }),
    paymentController.webHook
  );
  app.post("/api/v1/save_contact_details", auth.saveContactDetails);
  app.post("/api/v1/view_contact_details", auth.viewContactDetails);
  app.post("/api/v1/update_registration_token", auth.updateRegistrationToken);
  app.post("/api/v1/check_user_status", auth.checkUserExistence);

  // Service Provider
  app.post(
    "/api/v1/service_provider/edit_service",
    serviceProviderController.createOrEditService
  );
  app.post(
    "/api/v1/service_provider/view_service",
    serviceProviderController.viewService
  );
  app.post(
    "/api/v1/service_provider/list_recommendations",
    serviceProviderController.listRecommendations
  );
  app.post(
    "/api/v1/service_provider/view_recommendation",
    serviceProviderController.viewRecommendation
  );
  app.post(
    "/api/v1/service_provider/list_active_recommendations",
    serviceProviderController.listActiveRecommendations
  );
  app.post(
    "/api/v1/service_provider/view_active_recommendation",
    serviceProviderController.viewActiveRecommendation
  );
  app.post(
    "/api/v1/service_provider/accept_recommendation",
    serviceProviderController.acceptRecommendation
  );
  app.post(
    "/api/v1/service_provider/deny_recommendation",
    serviceProviderController.denyRecommendation
  );
  app.post(
    "/api/v1/service_provider/send_connection_request",
    serviceProviderController.sendConnectionRequest
  );
  app.post(
    "/api/v1/service_provider/extend_accept_time_limit",
    serviceProviderController.extendAcceptTimeLimit
  );
  app.post(
    "/api/v1/service_provider/list_contacts",
    serviceProviderController.listContacts
  );
  app.post(
    "/api/v1/service_provider/list_commissions",
    serviceProviderController.listCommissions
  );
  app.post(
    "/api/v1/service_provider/counter_approve",
    serviceProviderController.counterApprove
  );
  app.post(
    "/api/v1/service_provider/save_payment_details",
    serviceProviderController.savePaymentDetails
  );
  app.post(
    "/api/v1/service_provider/save_business_details",
    serviceProviderController.saveBusinessDetails
  );
  app.post(
    "/api/v1/service_provider/update_wallet_balance",
    serviceProviderController.updateWalletBalance
  );
  app.post(
    "/api/v1/service_provider/update_status_terms",
    serviceProviderController.updateStatusTerms
  );
  app.post(
    "/api/v1/service_provider/list_terms",
    serviceProviderController.listStatusTerms
  );
  app.post(
    "/api/v1/service_provider/service_denied",
    serviceProviderController.serviceDenied
  );
  app.post(
    "/api/v1/service_provider/service_rendered",
    serviceProviderController.serviceRendered
  );
  app.post(
    "/api/v1/service_provider/recommendation_history",
    serviceProviderController.recommendationsHistory
  );
  // app.post("/api/v1/service_provider/recommendation_history", serviceProviderController.recommendationsHistory);
  app.post(
    "/api/v1/service_provider/view_recommender_detail",
    serviceProviderController.viewRecommenderDetail
  );
  app.post(
    "/api/v1/service_provider/accept_commission_payment",
    serviceProviderController.acceptCommissionPayment
  );
  app.post(
    "/api/v1/service_provider/decline_commission_payment",
    serviceProviderController.declineCommissionPayment
  );
  app.post(
    "/api/v1/service_provider/upload_business_icon",
    multer({ storage: fileStorage }).single("business_icon"),
    serviceProviderController.uploadBusinessIcon
  );

  // User or Recommendations
  app.post(
    "/api/v1/recommendations/create_recommendation",
    recommendationController.createRecommendation
  );
  app.post(
    "/api/v1/recommendations/list_recommendations",
    recommendationController.listRecommendations
  );
  app.post(
    "/api/v1/recommendations/list_recommended",
    recommendationController.listRecommended
  );
  app.post(
    "/api/v1/recommendations/list_histroy",
    recommendationController.listHistroyRecommended
  );
  app.post(
    "/api/v1/recommendations/view_recommendation",
    recommendationController.viewRecommendation
  );
  app.post(
    "/api/v1/recommendations/view_recommended",
    recommendationController.viewRecommended
  );
  app.post(
    "/api/v1/recommendations/find_user",
    recommendationController.findUser
  );
  app.post(
    "/api/v1/recommendations/find_service",
    recommendationController.findService
  );
  app.post(
    "/api/v1/recommendations/list_contacts",
    recommendationController.listContacts
  );
  app.post(
    "/api/v1/recommendations/accept_connection_request",
    recommendationController.acceptConnectionRequest
  );
  app.post(
    "/api/v1/recommendations/decline_connection_request",
    recommendationController.declineConnectionRequest
  );
  app.post(
    "/api/v1/recommendations/show_wallet_balance",
    recommendationController.showWalletBalance
  );
  app.post(
    "/api/v1/recommendations/accept_counter_offer",
    recommendationController.acceptCounterOffer
  );
  app.post(
    "/api/v1/recommendations/decline_counter_offer",
    recommendationController.declineCounterOffer
  );
  app.post(
    "/api/v1/recommendations/rate_service",
    recommendationController.rateService
  );
  app.post(
    "/api/v1/recommendations/get_contacts",
    recommendationController.getContacts
  );
  app.post(
    "/api/v1/recommendations/list_commissions",
    recommendationController.listCommissions
  );
  app.post(
    "/api/v1/recommendations/invite_user",
    recommendationController.inviteUser
  );
  app.post(
    "/api/v1/recommendations/delete_recommendation",
    recommendationController.deleteRecommendation
  );
  app.post(
    "/api/v1/recommendations/service_details_by_owner_email",
    recommendationController.serviceDetailsByOwnerEmail
  );

  /* request withdraw */

  app.post("/api/v1/request_withdraw", auth.requestWithdraw);
  app.post("/api/v1/request_withdraw_list", auth.requestWithdrawList);
  app.post("/api/v1/view_withdraw_request", auth.withdrawRequestView);

  //Wallet APIs
  app.get("/api/v1/wallet/create_wallet", wallet.createWallet);
  app.post(`/api/v1/wallet/add_wallet_money`, wallet.addWalletBalance);
  app.post("/api/v1/wallet/withdraw_amount", wallet.withDrawAmount);
  app.get("/api/v1/wallet/user/get_balance", wallet.user_wallet_balance);
  app.get(
    "/api/v1/wallet/service_provider/get_balance",
    wallet.service_wallet_balance
  );
  app.post("/api/v1/token", (req, res) => {
    // refresh the damn token
    const postData = req.body;
    // if refresh token exists
    //console.log(postData);
    jwt.verify(
      postData.refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) {
          // Wrong Refesh Token
          return res.status(406).json({ message: "Unauthorized" });
        } else {
          console.log(decoded);
          // Correct token we send a new access token
          const accessToken = jwt.sign(
            {
              username: decoded.user_id,
              email: decoded.user_name,
            },
            process.env.TOKEN_KEY,
            {
              expiresIn: "2d",
            }
          );

          const refreshToken = jwt.sign(
            {
              username: decoded.user_id,
              email: decoded.user_name,
            },
            process.env.REFRESH_TOKEN_SECRET,
            {
              expiresIn: "30d",
            }
          );

          return res.json({ token: accessToken, refreshToken: refreshToken });
        }
      }
    );
  });
};
