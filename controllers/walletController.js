const conn = require("../connection");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const walletModel = require("../models/walletModel");
const {response} = require("express");
module.exports = {
  createWallet: (req, res) => {
    walletModel.createWallet(req, res);
  },

  addWalletBalance: async (req, res) => {
    const {amount} = req.body;
    const {service_id} = req.query;
    let sgd = amount * 100;
    // let sgd = (amount + amount * 0.04) * 100;
    const findService = `SELECT * FROM services WHERE id = ${service_id}`;
    conn.query(findService, async (err, result) => {
      if (err) res.send(err.message);
      const createStripeCustomer = await stripe.customers.create({
        name: result[0].business_name,
      });
      const ephemeralKey = await stripe.ephemeralKeys.create(
        {customer: createStripeCustomer.id},
        {apiVersion: "2020-08-27"}
      );
      const paymentIntent = await stripe.paymentIntents.create({
        amount: sgd,
        currency: "SGD",
        customer: createStripeCustomer.id,
      });
      const insertIntoWallet = `INSERT INTO wallet(service_id, payment_id, wallet_balance, wallet_owner) VALUES (${result[0].id}, '${paymentIntent.id}', ${amount}, "SERVICE_PROVIDER")`;
      console.log(insertIntoWallet, "========");
      conn.query(insertIntoWallet, (err, result) => {
        if (err) {
          const checkExistsBalance = `SELECT wallet_balance FROM wallet WHERE wallet_owner = "SERVICE_PROVIDER" AND service_id = ${service_id}`;
          conn.query(checkExistsBalance, (err, result) => {
            if (err) throw err;
            const {wallet_balance} = result[0];
            const addBalance = Number(wallet_balance) + Number(amount);
            const updateWalletBalance = `UPDATE wallet set wallet_balance = ${addBalance} WHERE wallet_owner = "SERVICE_PROVIDER" AND service_id = ${service_id}`;
            conn.query(updateWalletBalance, (err, result) => {
              if (err) {
                res.send(err.message);
              }
              res.send({
                amount: "Amount added to wallet",
                available: wallet_balance,
              });
            });
            return;
          });
          return;
        }
      });
    });
  },

  withDrawAmount: async (req, res) => {
    const {amount} = req.body;
    if (Number(amount) < 20) throw {message: "Withdraw Amount Below Required Minimum"};
    const {withdraw_user_type, id} = req.query;
    if (withdraw_user_type === "USER") {
      const user = `SELECT user_id FROM wallet where wallet_owner = "USER" AND user_id = ${id}`;
      conn.query(user, (err, result) => {
        if (err) throw err.message;
        if (!result[0]) {
          res.send("No user found");
        } else {
          const findAmount = `SELECT wallet_balance from wallet where user_id = ${id} AND wallet_owner = "USER" AND wallet_balance != 0 `;
          conn.query(findAmount, (err, result) => {
            if (err) throw err.message;
            if (!result[0]) {
              res.json({error: "Wallet balance is not available"});
            } else {
              const {wallet_balance} = result[0];
              console.log(wallet_balance);
              const withdraw = Number(Number(wallet_balance) - Number(amount));
              const withdraw_amount = `UPDATE wallet SET wallet_balance = ${withdraw} where user_id = ${id} AND wallet_owner = "USER" AND wallet_balance != 0`;
              conn.query(withdraw_amount, (err, result) => {
                if (err) throw err.message;
                const statement = `INSERT INTO withdraw_request(user_id, withdraw_amount, status) VALUES (${id}, ${amount}, "pending" )`;
                conn.query(statement, (err, data) => {
                  if (err) response.json({err: err.message});
                  res.json(data[0]);
                });
                res.send({Wallet_balance: withdraw});
              });
              return;
            }
            return;
          });
        }
        return;
      });
    } else {
      const service_provider = `SELECT service_id FROM wallet where wallet_owner = "SERVICE_PROVIDER" AND service_id = ${id}`;
      conn.query(service_provider, (err, data) => {
        if (err) throw err.message;
        if (data.length === 0) res.json({error: "No Service Provider found"});
        const find_service_amount = `SELECT wallet_balance FROM wallet WHERE wallet_owner = "SERVICE_PROVIDER" AND service_id = ${id} AND wallet_balance != 0`;
        conn.query(find_service_amount, (err, result) => {
          if (err) throw err.message;
          if (result.length === 0) {
            res.json({error: "No Sufficient fund found"});
          } else {
            const {wallet_balance} = result[0];
            const sp_amount = Number(wallet_balance) - Number(amount);
            const sp_with_amount = `UPDATE wallet SET wallet_balance = ${sp_amount} where wallet_owner = "SERVICE_PROVIDER" AND service_id = ${id} AND wallet_balance !=0`;
            conn.query(sp_with_amount, (err, result) => {
              if (err) throw err.message;
            });
            const statement = `INSERT INTO withdraw_request(service_id, withdraw_amount, status) VALUES (${id}, ${amount}, "pending" )`;
            conn.query(statement, (err, result) => {
              if (err) {
                res.json({error: err.message});
              }
              const withdraw_statement = `SELECT wr_id, service_id, withdraw_amount, created_at FROM withdraw_request where service_id =${id}`;
              conn.query(withdraw_statement, (err, result) => {
                if (err) {
                  res.json(err);
                } else {
                  res.json(result.insertId);
                }
              });
            });
          }
        });
      });
    }
  },

  user_wallet_balance: async (req, res) => {
    const {wallet_user_id} = req.query;
    const find_user = `SELECT user_id FROM wallet WHERE user_id = '${wallet_user_id}'`;
    conn.query(find_user, (err, data) => {
      if (err) res.json({error: "User not found"});
      if (!data[0]) {
        res.status(404).json({message: "User not found"});
      } else {
        const find_balance = `SELECT wallet_balance FROM wallet where user_id = ${wallet_user_id} AND wallet_owner = "USER"`;
        conn.query(find_balance, async (err, data) => {
          if (err) res.json({error: err.message});
          const {wallet_balance} = data[0];
          res.json({wallet_balance});
        });
      }
    });
  },

  service_wallet_balance: async (req, res) => {
    const {wallet_service_id} = req.query;
    const find_user = `SELECT service_id FROM wallet WHERE service_id = '${wallet_service_id}'`;
    conn.query(find_user, (err, data) => {
      if (err) res.json({error: "Service provider account not found"});
      if (!data[0]) {
        res.status(404).json({message: "Service provider account not found"});
      } else {
        const find_balance = `SELECT wallet_balance FROM wallet where service_id = ${wallet_service_id} AND wallet_owner = "SERVICE_PROVIDER"`;
        conn.query(find_balance, async (err, data) => {
          if (err) res.json({error: err.message});
          const {wallet_balance} = data[0];
          res.json({wallet_balance});
        });
      }
    });
  },
};
