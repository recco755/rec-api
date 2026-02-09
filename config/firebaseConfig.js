
var admin = require("firebase-admin");

var serviceAccount = require("./recco-b66a5-firebase-adminsdk-fbsvc-ec6b1bc4bc.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://recco-b66a5-default-rtdb.asia-southeast1.firebasedatabase.app"
});

module.exports.admin = admin