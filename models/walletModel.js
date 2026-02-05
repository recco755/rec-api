const sql = require('../connection')
const q = require('q')

module.exports = {
    createWallet: async function (req, res) {
        const deferred = q.defer()
        const query = `
            CREATE TABLE wallet (
             wallet_id int NOT NULL AUTO_INCREMENT,
             wallet_balance INT DEFAULT 0,
             user_id INT,
             service_id INT,
             wallet_owner VARCHAR(30) NOT NULL,
             created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (wallet_id),
             CONSTRAINT fk_walletUser FOREIGN KEY (user_id) REFERENCES user(id),
             CONSTRAINT fk_walletService FOREIGN KEY (service_id) REFERENCES services(id)
            )
        `
        sql.query(query, deferred.promise)
        const result = await sql.query(query)
        res.json({success: "Table created successfully"})
    },
}