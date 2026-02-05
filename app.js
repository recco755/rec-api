const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
var expressValidator = require("express-validator");
const path = require('path');
const admin = require('./config/firebaseConfig').admin;
const cronJobs = require('./cronJobs');

// get config vars
dotenv.config();
app.set("trust proxy", 1); // trust first proxy

app.use(cors());
app.use(expressValidator());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public/profiles/')));
app.use(express.static(path.join(__dirname, 'public/businessIcons/')));

// app.use('/send_notification', (req, res) => {

//   console.log("push notification ...........................");
  
//   const registrationToken = 'e5cLgD-FvE7knDBQQRvvx6:APA91bFgaYFZilbDaa0xlOaRS4Pxs3F8u_sDpzNCYxVwV-ikwZglOMLbFSchSfXfsfoY_afU7dH0P__DLTXfzGOhW6DQtGKCRAcXdgLQWHrZhANHiOPIgvGK1WBDwJGU5hLDr1MCu_lQ';

//   const message = {
//           notification: {
//             title: 'Recommen notification',
//             body: 'first notification in the month of august............'
//           },
//           token: registrationToken
//   };

//   // Send a message to the device corresponding to the provided
//   // registration token.
//   admin.messaging().send(message)
//   .then((response) => {
//       // Response is a message ID string.
//       console.log('Successfully sent message:', response);
//   })
//   .catch((error) => {
//       console.log('Error sending message:', error);
//   });

// })
app.get('/api/v1/api-docs-json', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger.json'));
});
const swaggerDocument = require("./swagger.json");
var options = {
  explorer: true,
  swaggerOptions: {
    basicAuth: {
      name: "Authorization",
      schema: {
        type: "basic",
        in: "header",
      },
      value: "Basic ZTNmYWRtaW46ZTNmcGFzc3dvcmQ=",
    },
  },
};
app.use(
  "/api/v1/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, options)
);;
// app.use(
//   session({
//     secret: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNjE5MzUyODk5LCJleHAiOjE2MTkzNzQ0OTl9",
//     resave: true,
//     saveUninitialized: true,
//     cookie: { expires: 60000 * 360, maxAge: 60000 * 360 },
//   })
// );
// app.use("/api/v1", s3_image_upload); 
require("./routes/index.route.js")(app);
app.get("/", (req, res) => {
  console.log("Welcome to Recommendo");
  res.json({ message: "Welcome to Recommendo Application ." });
});

app.listen("8888", () => {
  console.log("Server started on the port 8888");
});
