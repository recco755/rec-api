const nodemailer = require("nodemailer");

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Replace with your SMTP server if using a different service
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: "enquiry@reccomman.asia",
    pass: "afklsdtoqiojmsnz",
  },
});

module.exports = {
  sendMail: async (
    to_address,
    subject,
    htmlContent,
    from_address = "enquiry@reccomman.asia"
  ) => {
    try {
      const mailOptions = {
        from: from_address,
        to: to_address,
        subject: subject,
        html: htmlContent,
      };

      const response = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", response.messageId);
    } catch (err) {
      console.error("Error while sending email:", err);
    }
  },
};
