const conn = require("../connection");
var tableConfig = require("../config/table_name.json");
var md5 = require("md5");
var q = require("q");
var commonFunction = require("../models/commonfunction");
const mailNotification = require("../common/mailNotification");
const multer = require("multer");
const {getQueryResults, insertQuery} = require("../models/commonfunction");
const generator = require("generate-password");
const jwt = require("jsonwebtoken");

module.exports = {
  signup: async (req) => {
    var deferred = q.defer();
    const {
      name,
      email,
      password,
      mobile_number,
      is_term_conditions,
      user_type,
      google_id,
      fb_id,
      apple_id,
      profile_url,
      registration_token,
      platform,
    } = req.body;

    var user_query = "SELECT * FROM " + tableConfig.USER + " WHERE email='" + email + "' AND status != 100;";

    var user_mobile =
      "SELECT * FROM " + tableConfig.USER + " WHERE mobile_number='" + mobile_number + "' AND status != 100;";
    var del_user_query = "SELECT * FROM " + tableConfig.USER + " WHERE email='" + email + "' AND status = 100;";

    // var del_user_mobile =
    //   "SELECT * FROM " + tableConfig.USER + " WHERE mobile_number='" + mobile_number + "' AND status = 100;";
    var user_result = await commonFunction.getQueryResults(user_query);
    var del_user_result = await commonFunction.getQueryResults(del_user_query);

    var user_result_mobile = await commonFunction.getQueryResults(user_mobile);

    console.log(user_result, "=====user===");
    if (del_user_result.length != 0) {
      deferred.resolve({
        status: 1,
        message: "Account With Email Id Exist, Account Deleted! Reach Out To Customer Care",
      });
    } else if (user_result.length != 0) {
      deferred.resolve({
        status: 1,
        message: "Email ID Already Exists",
      });
    } else if (user_result_mobile.length != 0) {
      deferred.resolve({
        status: 1,
        message: "Mobile Number Already Exists",
      });
    } else {
      let hashedPassword = "";
      let is_verified = 1;
      if (user_type === "0" && password !== null) {
        hashedPassword = md5(password);
        is_verified = 0;
      }

      var data = {
        name: name,
        email: email,
        mobile_number: mobile_number ? mobile_number : "",
        password: password ? hashedPassword : "",
        user_type: user_type,
        is_term_conditions: is_term_conditions ? is_term_conditions : 0,
        google_id: google_id ? google_id : 0,
        fb_id: fb_id ? fb_id : 0,
        apple_id: apple_id ? apple_id : 0,
        profile_url: profile_url ? profile_url : "",
        is_verified: is_verified,
        platform: platform,
        registration_token: registration_token,
        status: 0,
      };

      let insert_query = "INSERT INTO " + tableConfig.USER + " SET ?";
      var result = await commonFunction.insertQuery(insert_query, data);
      if (result && result.affectedRows === 1 && result.insertId != "") {
        if (user_type === "0") {
          const random = Math.floor(100000 + Math.random() * 900000);

          var otp_data = {
            user_id: result.insertId,
            otp: random,
            status: 0,
          };
          let otp_insert_query = "INSERT INTO " + tableConfig.OTP + " SET ?";

          var otp_result = await commonFunction.insertQuery(otp_insert_query, otp_data);
          const subject = "Reccomman - Email Verification";

          const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd;">
              <h2 style="color: #333;">Email Verification</h2>
              <p>Hello ${name || "User"},</p>
              <p>Thank you for registering with us! Please verify your email address to complete the signup process.</p>
              <p><strong>Your Verification Code:</strong> <span style="color: #04AFA3; font-weight: bold;">${random}</span></p>
              <p>Please enter this code in the app to verify your email address.</p>
              <p>If you did not create an account with us, please ignore this email or contact support.</p>
              <hr>
              <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply to this email.</p>
            </div>
          `;

          await mailNotification.sendMail(email, subject, htmlContent);
        }

        const getUserQuery = `SELECT id, name, email, mobile_number FROM ${tableConfig.USER} WHERE id = ${result.insertId}`;
        const userDetails = await commonFunction.getQueryResults(getUserQuery);

        const notification = `New user ${name} (${email}) has just registered`;
        const notificationQuery = `INSERT INTO ${tableConfig.NOTIFICATIONS} SET ?`;
        const insertData = {
          notification: notification,
          status: "unread",
          created_at: new Date(),
          updated_at: new Date(),
        };
        const createNotification = await commonFunction.insertQuery(notificationQuery, insertData);

        deferred.resolve({
          status: 1,
          message: "User Successfully Registered",
          userDetails: userDetails,
          emailExists: email === "" ? 0 : 1,
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "Failed in Query",
        });
      }
    }
    return deferred.promise;
  },

  updateRegistrationToken: async (req) => {
    const {user_id, registration_token, platform} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.USER} SET registration_token = ?, platform = ? WHERE id = ${user_id}`;
    const updateData = [registration_token, platform, user_id];
    const token = await insertQuery(query, updateData);

    deferred.resolve({
      status: 1,
      message: "Token updated successfully",
    });

    return deferred.promise;
  },

  verifyOTP: async (req) => {
    var deferred = q.defer();
    let userq, userresult;
    var query =
      "SELECT * FROM " +
      tableConfig.OTP +
      " WHERE user_id='" +
      req.body.user_id +
      "' and otp= '" +
      req.body.otp +
      "' and status = 0 ;";
    let result = await commonFunction.getQueryResults(query);
    console.log(result);
    if (result.length != 0) {
      var data = {
        status: 1,
      };
      var condtion_data = {
        id: result[0].id,
      };

      let query = "UPDATE " + tableConfig.OTP + " SET ? WHERE ?";
      var result1 = await commonFunction.insertQuery(query, [data, condtion_data]);
      var user_data = {
        is_verified: 1,
        status: 1,
      };
      var user_condtion_data = {
        id: req.body.user_id,
      };
      userq =
        "SELECT id, email, name, mobile_number, is_service_provider, is_verified, status, profile_url FROM " +
        tableConfig.USER +
        " WHERE id ='" +
        result[0].user_id +
        "'";
      userresult = await commonFunction.getQueryResults(userq);
      let user_query = "UPDATE " + tableConfig.USER + " SET ? WHERE ?";
      var updateresult = await commonFunction.insertQuery(user_query, [user_data, user_condtion_data]);
      var email = userresult[0].email;
      var user_id = userresult[0].id;
      const jwttoken = jwt.sign(
        {
          user_id: user_id,
          email,
        },
        process.env.TOKEN_KEY,
        {
          expiresIn: "2h",
        }
      );
      const refreshtoken = jwt.sign(
        {
          user_id: user_id,
          email,
        },
        process.env.TOKEN_KEY,
        {
          expiresIn: "2h",
        }
      );
      const updatetokenuery = `UPDATE ${tableConfig.USER} SET token = ? WHERE id = ?`;

      const updateData = [jwttoken, user_id];
      const updatetoken = await insertQuery(updatetokenuery, updateData);

      // save user token
      //userresult[0].token = jwttoken;
      deferred.resolve({
        status: 1,
        message: "OTP is Verified",
        token: jwttoken,
        refreshToken: refreshtoken,
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Invalid OTP",
      });
    }

    return deferred.promise;
  },

  login: async (req) => {
    const {user_name, password, user_type, google_id, fb_id, apple_id, registration_token, platform} = req.body;

    var deferred = q.defer();
    var username = user_name;
    var hashedPassword = md5(password);
    let query, result;

    if (user_type === "1") {
      query =
        "SELECT id, email, name, mobile_number, is_verified, is_service_provider, profile_url, status FROM " +
        tableConfig.USER +
        " WHERE email='" +
        username +
        "' and google_id ='" +
        google_id +
        "' AND status = 1";
    } else if (user_type === "2") {
      query =
        "SELECT id, email, name, mobile_number, is_service_provider, is_verified, profile_url, status FROM " +
        tableConfig.USER +
        " WHERE fb_id ='" +
        fb_id +
        "' AND status = 1";
    } else if (user_type === "3") {
      query =
        "SELECT id, email, name, mobile_number, is_service_provider, is_verified, profile_url, status FROM " +
        tableConfig.USER +
        " WHERE email='" +
        username +
        "' and apple_id ='" +
        apple_id +
        "' AND status = 1";
    } else {
      query =
        "SELECT id, email, name, mobile_number, is_service_provider, is_verified, profile_url, status FROM " +
        tableConfig.USER +
        " WHERE email='" +
        username +
        "' and password ='" +
        hashedPassword +
        "' AND status = 1";
    }

    result = await commonFunction.getQueryResults(query);

    console.log(result, "user result");

    const updateQuery = `UPDATE ${tableConfig.USER} SET registration_token = ?, platform = ? WHERE email = ?`;
    const updateData = [registration_token, platform, user_name];
    const token = await insertQuery(updateQuery, updateData);

    if (result.length === 0) {
      deferred.resolve({
        status: 0,
        message: "Invalid username or password",
      });
    } else {
      if (result[0].is_verified !== 1) {
        deferred.resolve({
          status: 0,
          message: "Your account is not verified yet, please verify and try to login",
          user_id: result[0].id,
          userdetails: result[0],
        });
      } else {
        const jwttoken = jwt.sign(
          {
            user_id: result[0].id,
            user_name,
          },
          process.env.TOKEN_KEY,
          {
            expiresIn: "2d",
          }
        );
        const refreshtoken = jwt.sign(
          {
            user_id: result[0].id,
            user_name,
          },
          process.env.REFRESH_TOKEN_SECRET,
          {
            expiresIn: "30d",
          }
        );

        const query = `UPDATE ${tableConfig.USER} SET registration_token = ?, platform = ? WHERE id = ?`;
        const updateData = [jwttoken, platform, result[0].id];
        const updatetoken = await insertQuery(query, updateData);

        result[0].token = jwttoken;
        deferred.resolve({
          status: 1,
          message: "Logged in successfully",
          user_id: result[0].id,
          userdetails: result,
          refreshToken: refreshtoken,
        });
      }
    }

    return deferred.promise;
  },

  resendOTP: async (req) => {
    var deferred = q.defer();
    var query = "DELETE FROM " + tableConfig.OTP + " WHERE user_id='" + req.body.user_id + "' and status = 0 ;";
    var result = await commonFunction.getQueryResults(query);

    var fetch_query = "SELECT * from " + tableConfig.USER + " where id = '" + req.body.user_id + "'and status = 1;";
    var user_result = await commonFunction.getQueryResults(fetch_query);

    const random = Math.floor(100000 + Math.random() * 900000);
    const subject = "Reccomman - Resend One Time Password (OTP)";

    const resendOtpHtmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd;">
        <h2 style="color: #333;">Resend OTP Request</h2>
        <p>Hello ${user_result[0].name || "User"},</p>
        <p>As requested, we are sending your one-time password (OTP) again.</p>
        <p><strong>Your One-Time Password (OTP):</strong> <span style="color: #04AFA3; font-weight: bold;">${random}</span></p>
        <p>Please use this password to complete your verification. The OTP will expire in 15 minutes.</p>
        <p>If you did not request an OTP, please contact support immediately.</p>
        <hr>
        <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `;

    var otp_data = {
      user_id: req.body.user_id,
      otp: random,
      status: 0,
    };
    let otp_insert_query = "INSERT INTO " + tableConfig.OTP + " SET ?";
    var otp_result = await commonFunction.insertQuery(otp_insert_query, otp_data);

    await mailNotification.sendMail(user_result[0].email, subject, resendOtpHtmlContent);

    deferred.resolve({
      status: 1,
      message: "OTP Resended Successfully",
    });

    return deferred.promise;
  },

  forgotPassword: async (req) => {
    const {email} = req.body;
    const deferred = q.defer();

    const password = generator.generate({
      length: 10,
      numbers: true,
    });
    const hashedPassword = md5(password);
    let updateQuery = `UPDATE ${tableConfig.USER} SET password = ? WHERE email = ? AND status = 1`;
    let updateData = [hashedPassword, email];

    var updated = await commonFunction.insertQuery(updateQuery, updateData);

    var fetch_query = "SELECT * from " + tableConfig.USER + " WHERE email = '" + email + "' AND status = 1";
    var user_result = await commonFunction.getQueryResults(fetch_query);

    if (user_result.length === 0) {
      deferred.resolve({
        status: 0,
        message: "Account not found",
      });
    } else {
      const subject = "Reccomman - One Time Password";

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd;">
          <h2 style="color: #333;">Forgot Password Request</h2>
          <p>Hello ${user_result[0].name || "User"},</p>
          <p>You recently requested a one-time password for your account.</p>
          <p><strong>Your One-Time Password (OTP):</strong> <span style="color: #04AFA3; font-weight: bold;">${password}</span></p>
          <p>Please use this password to reset your account. If you did not make this request, please contact support immediately.</p>
          <hr>
          <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply to this email.</p>
        </div>
      `;
      await mailNotification.sendMail(email, subject, htmlContent);

      deferred.resolve({
        status: 1,
        message: "Your new password sent to your registered email",
      });
    }

    return deferred.promise;
  },

  resetPassword: async (req) => {
    const {email} = req.body;
    const deferred = q.defer();
    const subject = "Reccomman - Password reset link";
    const template = ``;

    // await mailNotification.sendMail(email, subject, template);

    deferred.resolve({
      status: 1,
      data: userDetails,
    });

    return deferred.promise;
  },

  viewProfile: async (req) => {
    const {user_id, is_service_provider} = req.body;
    const deferred = q.defer();
    let query;
    if (is_service_provider === "0") {
      query = `SELECT id, name, email, mobile_number, profile_url FROM ${tableConfig.USER} WHERE id = ${user_id}`;
    } else {
      query = `SELECT u.id, u.name, u.email, u.mobile_number, u.profile_url, 
                      s.business_name, s.service, s.availability, s.service_date, s.time, s.description,
                      s.business_icon, s.business_type, s.business_license, s.address, s.rating FROM ${tableConfig.USER} u
               INNER JOIN ${tableConfig.SERVICES} s ON s.userId = ${user_id} WHERE u.id = ${user_id}`;
    }

    const userDetails = await commonFunction.getQueryResults(query);

    deferred.resolve({
      status: 1,
      data: userDetails,
    });

    return deferred.promise;
  },

  editProfile: async (req) => {
    const {user_id, name, email, mobile_number} = req.body;

    const deferred = q.defer();
    const updateQuery = `UPDATE ${tableConfig.USER} SET name = ?, email = ?, mobile_number = ? WHERE id = ?`;
    const updateData = [name, email, mobile_number, user_id];
    const userDetails = await commonFunction.updateQuery(updateQuery, updateData);

    deferred.resolve({
      status: 1,
      message: "Profile updated successfuly",
    });

    return deferred.promise;
  },

  checkUserExistence: async (req) => {
    const {user_id} = req.body;

    const deferred = q.defer();

    const user = await getQueryResults(`SELECT * FROM ${tableConfig.USER} WHERE id = ${user_id}`);

    if (user !== null && user.length === 0) {
      deferred.resolve({
        status: 0,
        message: "User Not Found",
      });
    } else {
      deferred.resolve({
        status: 1,
        message: "Users Exists",
      });
    }

    return deferred.promise;
  },

  saveProfile: async (req) => {
    console.log(req.method);
    const {user_id} = req.body;
    const deferred = q.defer();
    const updateQuery = `UPDATE ${tableConfig.USER} SET profile_url = ? WHERE id = ?`;
    const profile_url = `${req.protocol}://${req.hostname}:8888/${req.file.filename}`; //`http://ec2-54-251-142-179.ap-southeast-1.compute.amazonaws.com:8888/${req.file.filename}`;
    const updateData = [profile_url, user_id];
    const updated = await commonFunction.updateQuery(updateQuery, updateData);
    if (updated.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        profileData: profile_url,
        message: "Profile uploaded successfully",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong. please try again",
      });
    }
    return deferred.promise;
  },

  removeProfile: async (req) => {
    const { user_id } = req.body;
    const deferred = q.defer();
    const updateQuery = `UPDATE ${tableConfig.USER} SET profile_url = '' WHERE id = ?`;
    const updateData = [user_id];
    const updated = await commonFunction.updateQuery(updateQuery, updateData);
    if (updated.affectedRows > 0) {
      deferred.resolve({
        status: 1,
        message: "Profile photo removed successfully",
      });
    } else {
      deferred.resolve({
        status: 0,
        message: "Something went wrong. Please try again",
      });
    }
    return deferred.promise;
  },

  changeRegisteredMailId: async (req) => {
    const {user_id, email} = req.body;
    const deferred = q.defer();

    const emailAlreadyExists = await getQueryResults(`SELECT * FROM ${tableConfig.USER} WHERE email = '${email}'`);
    if (emailAlreadyExists.length > 0) {
      deferred.resolve({
        status: 0,
        message: "Email already exists",
      });
    } else {
      var fetch_query = `SELECT * FROM ${tableConfig.USER} WHERE id = '${user_id}'`;
      var user_result = await commonFunction.getQueryResults(fetch_query);

      if (user_result.length === 0) {
        deferred.resolve({
          status: 0,
          message: "Account not found",
        });
      } else {
        const updateQuery = `UPDATE ${tableConfig.USER} SET email = ?, is_verified = ? WHERE id = ?`;
        const updateData = [email, 0, user_id];
        await commonFunction.updateQuery(updateQuery, updateData);

        const random = Math.floor(100000 + Math.random() * 900000);

        const subject = "Reccomman - Email Address Updated";
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f3f3f3; border: 1px solid #ccc;">
            <h2 style="color: #2e7d32;">Email Change Verification</h2>
            <p>Hello ${user_result[0].name || "User"},</p>
            <p>We received a request to change your email address. To confirm this change, please use the verification code below:</p>
            <p><strong style="font-size: 20px; color: #04AFA3;">${random}</strong></p>
            <p>This code is valid for the next 10 minutes. If you did not make this request, please contact support immediately.</p>
            <hr>
            <p style="font-size: 12px; color: #555;">This is an automated message, please do not reply to this email.</p>
          </div>
        `;

        let otp_insert_query = `UPDATE ${tableConfig.OTP} SET otp = ?, status = ? WHERE user_id = ? AND status = 1`;
        var otp_data = [random, 0, user_id];
        await commonFunction.updateQuery(otp_insert_query, otp_data);

        await mailNotification.sendMail(email, subject, htmlContent);

        deferred.resolve({
          status: 1,
          message: "OTP sent to your email",
        });
      }
    }

    return deferred.promise;
  },

  showWalletBalance: async (req) => {
    const {user_id} = req.body;

    const deferred = q.defer();
    const query = `SELECT wallet_balance FROM ${tableConfig.USER} WHERE id = ${user_id}`;
    const wallet_balance = await getQueryResults(query);
    // console.log(wallet_balance[0]?.wallet_balance, "=====walllet balabae====");
    if (wallet_balance && wallet_balance.length > 0 && parseFloat(wallet_balance[0]?.wallet_balance) < 0) {
      const updateQuery = `UPDATE ${tableConfig.USER} SET wallet_balance = ? `;
      const updateData = [0];

      await commonFunction.insertQuery(updateQuery, updateData);

      const dwallet_balance = await getQueryResults(query);

      deferred.resolve({
        status: 1,
        data: dwallet_balance,
      });
      return deferred.promise;
    } else {
      deferred.resolve({
        status: 1,
        data: wallet_balance,
      });

      return deferred.promise;
    }
  },

  logout: async (req) => {
    const {user_id} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.USER} SET registration_token = ? WHERE id = ${user_id}`;

    const updateData = ["", user_id];

    const updates = await insertQuery(query, updateData);

    deferred.resolve({
      status: 1,
      message: "User logged out successfully",
    });

    return deferred.promise;
  },
  delete: async (req) => {
    const {user_id} = req.body;

    const deferred = q.defer();
    const query = `UPDATE ${tableConfig.USER} SET status = 100 WHERE id = ${user_id}`;

    try {
      const result = await commonFunction.updateQuery(query);

      if (result.affectedRows > 0) {
        deferred.resolve({
          status: 1,
          message: "User deleted successfully",
        });
      } else {
        deferred.resolve({
          status: 0,
          message: "User not found or status already set to 100",
        });
      }
    } catch (err) {
      deferred.resolve({
        status: 0,
        message: "An error occurred while updating user status",
      });
    }

    return deferred.promise;
  },
  postComments: async (req) => {
    const {user_id, name, email, comments} = req.body;

    const deferred = q.defer();
    const query = `INSERT INTO ${tableConfig.USER_QUERIES} SET ? `;
    const insertData = {
      user_id: user_id,
      name: name,
      email: email,
      comments: comments,
    };
    const insert_comment = await commonFunction.insertQuery(query, insertData);
    const subject = `Help & Support Request From ${name}`;
    const content = `
    <div style="font-family: Arial, sans-serif; padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 5px;">
    <h2 style="color: #333;">Help & Support Request</h2>
    <p style="color: #555; line-height: 1.6;">
    You have received a new support request from a user. Below are the details:
    </p>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Message:</strong> ${comments}</p>
    <p style="color: #555; margin-top: 20px;">
      Thank you
    </p>
    </div>
   `;
    const to_address = "enquiry@reccomman.asia";
    await mailNotification.sendMail(to_address, subject, content);
    deferred.resolve({
      status: 1,
      message: "We have received your message. We will get back via email",
    });

    return deferred.promise;
  },

  changePassword: async (req) => {
    const {user_id, new_password} = req.body;

    const deferred = q.defer();
    const hashed = md5(new_password);
    const query = `UPDATE ${tableConfig.USER} SET password = ? WHERE id = ?`;
    const updateData = [hashed, user_id];
    const updated = await commonFunction.updateQuery(query, updateData);
    deferred.resolve({
      status: 1,
      message: "Password changed successfully",
    });

    return deferred.promise;
  },

  saveContactDetail: async (req, res) => {
    const {phone_number, email, website_link, address} = req.body;

    const deferred = q.defer();
    const query = `INSERT INTO ${tableConfig.CONTACT_DETAIL} SET ? `;
    const insertData = {
      phone_number: phone_number,
      email: email,
      website_link: website_link,
      address: address,
    };
    const insert = await commonFunction.insertQuery(query, insertData);
    deferred.resolve({
      status: 1,
      message: "Contact details saved successfully",
    });

    return deferred.promise;
  },

  viewContactDetails: async (req, res) => {
    const deferred = q.defer();
    const query = `SELECT * FROM ${tableConfig.CONTACT_DETAIL}`;
    const data = await commonFunction.insertQuery(query);
    deferred.resolve({
      status: 1,
      data: data,
    });

    return deferred.promise;
  },

  requestWithdrawList: async (req) => {
    const {user_id} = req.body;
    const deferred = q.defer();
    console.log(user_id);
    var user_result = "";
    if (user_id != "") {
      var user_query = `SELECT * FROM ${tableConfig.WITHDRAW} WHERE user_id='${user_id}'`;
      user_result = await commonFunction.getQueryResults(user_query);
    }

    deferred.resolve({
      status: 1,
      data: user_result,
    });

    return deferred.promise;
  },

  withdrawRequestView: async (req) => {
    const {req_id} = req.body;
    const deferred = q.defer();
    var user_result = "";
    if (req_id != "") {
      var request_query = `SELECT * FROM ${tableConfig.WITHDRAW} WHERE wr_id='${req_id}'`;
      request_result = await commonFunction.getQueryResults(request_query);
    }

    deferred.resolve({
      status: 1,
      data: request_result,
    });

    return deferred.promise;
  },

  requestWithdraw: async (req, res) => {
    const {user_id, withdraw_amount, account_holder_name, account_number, bank_name} = req.body;

    const deferred = q.defer();

    // Validate required fields
    if (!user_id) {
      deferred.resolve({
        status: 0,
        message: "User ID is required",
      });
    } else if (!withdraw_amount) {
      deferred.resolve({
        status: 0,
        message: "Withdrawal amount is required",
      });
    } else if (isNaN(withdraw_amount)) {
      deferred.resolve({
        status: 0,
        message: "Withdrawal amount must be a number",
      });
    }
    //   else if (withdraw_amount < 1) {
    //     deferred.resolve({
    //       status: 0,
    //       message: "Minimum withdrawal amount is 1 $",
    //     });
    //   }
    else if (!account_holder_name) {
      deferred.resolve({
        status: 0,
        message: "Account holder name is required",
      });
    } else if (!account_number) {
      deferred.resolve({
        status: 0,
        message: "Account number is required",
      });
    } else if (!bank_name) {
      deferred.resolve({
        status: 0,
        message: "Bank name is required",
      });
    } else {
      const checkBalanceQuery = `SELECT wallet_balance FROM ${tableConfig.USER} WHERE id = ?`;
      conn.query(checkBalanceQuery, [user_id], async (err, user) => {
        if (err) {
          return res.status(500).json({message: "Internal Server Error", error: err.message});
        }

        if (!user || user.length === 0) {
          return res.status(404).json({message: "User not found"});
        }

        const wallet_balance = user[0].wallet_balance;
        console.log(wallet_balance);
        if (wallet_balance === 0) {
          deferred.resolve({
            status: 0,
            message: "Insufficient funds: Wallet balance is 0",
          });
        } else if (wallet_balance < withdraw_amount) {
          deferred.resolve({
            status: 0,
            message: `Insufficient funds: Available balance is $${wallet_balance.toFixed(
              2
            )}, requested withdrawal is $${withdraw_amount}`,
          });
        } else {
          const payment_id = await commonFunction.generateUniquePaymentId();
          const withdrawinsertQuery = `INSERT INTO ${tableConfig.WITHDRAW} SET ?`;
          const data = {
            user_id: user_id,
            withdraw_amount: withdraw_amount,
            account_holder_name: account_holder_name,
            account_number: account_number,
            bank_name: bank_name,
            created_at: new Date(),
            status: "pending",
            payment_id: payment_id,
            type: "debit",
          };
          console.log(data);

          try {
            const insertrequest = await commonFunction.insertQuery(withdrawinsertQuery, data);
            console.log(insertrequest);

            const query = `UPDATE ${tableConfig.USER} SET wallet_balance = (wallet_balance-?) WHERE id = ?`;
            const updateData = [withdraw_amount, user_id];
            const updated = await commonFunction.updateQuery(query, updateData);

            const subject = "Reccomman - Withdraw Request";

            const htmlContent = `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd;">
                <h2 style="color: #333;">Withdraw Request Notification</h2>
                <p>Hello Admin,</p>
                <p><strong>USER ID: ${user_id}</strong> has requested a withdrawal from their wallet.</p>
                <p><strong>Account Holder Name:</strong> ${account_holder_name}</p>
                <p><strong>Account Number:</strong> ${account_number}</p>
                <p><strong>Bank Name:</strong> ${bank_name}</p>
                <p><strong>Payment ID:</strong> ${payment_id}</p>
                <p><strong>Amount Requested:</strong> <span style="color: #04AFA3; font-weight: bold;">$${withdraw_amount}</span></p>
                <p><strong>Request Date:</strong> ${Date()}</p>
                <p>Please process the request as per your usual procedure.</p>
                <hr>
                <p style="font-size: 12px; color: #777;">This is an automated message, please do not reply to this email.</p>
              </div>
            `;
            const adminEmail = "enquiry@reccomman.asia";
            await mailNotification.sendMail(adminEmail, subject, htmlContent);

            deferred.resolve({
              status: 1,
              message: "Request sent successfully",
            });
          } catch (error) {
            deferred.resolve({
              status: 0,
              message: "An error occurred while processing the request",
              error: error.message,
            });
          }
        }
      });
    }

    return deferred.promise;
  },
};
