const crypto = require("crypto");

const PREFIX = "Recco";
const PREFIX_LEN = PREFIX.length; // 5

/**
 * Total reference length counting "Recco" + digits together.
 * Default 10 chars → "Recco" (5) + 5 random digits, e.g. Recco38472.
 * On duplicate keys, grows to 11, 12, … (more digits after Recco).
 */
const INITIAL_TOTAL_LEN = 10;
const MAX_TOTAL_LEN = 24;
const MAX_TRIES_PER_LENGTH = 50;

function randomDigitSuffix(len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += crypto.randomInt(0, 10).toString();
  }
  return s;
}

function isDuplicateKeyError(err) {
  return err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062);
}

/**
 * Inserts wallet_peer_transfer with a unique reference_code.
 * @param {import('mysql').Connection} conn
 * @param {string} tableName trusted table name from config
 * @param {{ sender_user_id: string|number, recipient_user_id: string|number, amount: number, note: string|null }} row
 * @param {(err: Error|null, referenceCode: string|null) => void} done
 */
function insertWalletPeerTransferWithReference(conn, tableName, row, done) {
  function tryTotalLength(totalLen) {
    const digitCount = totalLen - PREFIX_LEN;
    if (digitCount < 1) {
      done(new Error("reference total length too small"), null);
      return;
    }

    let tries = 0;

    function attempt() {
      const ref = PREFIX + randomDigitSuffix(digitCount);
      const sql = `INSERT INTO ${tableName} (sender_user_id, recipient_user_id, amount, note, reference_code) VALUES (?, ?, ?, ?, ?)`;
      conn.query(
        sql,
        [row.sender_user_id, row.recipient_user_id, row.amount, row.note, ref],
        (err, _insertRes) => {
          if (!err) {
            done(null, ref);
            return;
          }
          if (isDuplicateKeyError(err) && tries < MAX_TRIES_PER_LENGTH) {
            tries += 1;
            attempt();
            return;
          }
          if (isDuplicateKeyError(err) && totalLen < MAX_TOTAL_LEN) {
            tryTotalLength(totalLen + 1);
            return;
          }
          done(err, null);
        }
      );
    }

    attempt();
  }

  tryTotalLength(INITIAL_TOTAL_LEN);
}

module.exports = {insertWalletPeerTransferWithReference};
