/* mail configuration for sending verification mails and forgot password mails, template must be implemented */
module.exports = {
  domain: "http://54.169.4.185:3000/",
  smtp: "smtp.sendgrid.net",
  port: 587,
  secure: false,
  service: "SendGrid",
  auth: {
    user: "srduryodhan97@gmail.com", //chinnu@smitiv.co
    pass: "qhscsjugxzkhrjvq", //Smitiv@smitiv@smitiv@123
  },
  SENDGRID_API_KEY:
    "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",
};
