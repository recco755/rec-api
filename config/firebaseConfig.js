
var admin = require("firebase-admin");

var serviceAccount = require("./recommando-1619442022598-firebase-adminsdk-hm8gd-73fb2903a8.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://recommando-1619442022598-default-rtdb.firebaseio.com"
});

module.exports.admin = admin