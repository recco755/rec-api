const mysql = require("mysql");
const express = require("express");
let stagingOptions = {
  host: "reccomman.chuue1f9cntj.ap-southeast-1.rds.amazonaws.com",
  user: "reccomman",
  password: "reccomman123",
  database: "recommendo",
  multipleStatements: true,
};

const mysqlConnection = mysql.createConnection(stagingOptions);

mysqlConnection.connect((err) => {
  try {
    if (err) {
      throw err;
    } else {
      console.log("Mysql Connected !!!");
    }
  } catch (error) {
    throw error;
  }
});

module.exports = mysqlConnection;
