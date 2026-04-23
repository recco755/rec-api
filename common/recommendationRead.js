var tableConfig = require("../config/table_name.json");
var commonFunction = require("../models/commonfunction");

function buildUnreadSelect(viewerId, recommendationAlias = "r") {
  const safeViewerId = Number(viewerId || 0);
  return `, CASE
    WHEN rr.id IS NULL THEN 1
    WHEN rr.last_seen_status <> ${recommendationAlias}.status THEN 1
    ELSE 0
  END AS is_unread`;
}

function buildUnreadJoin(viewerId, recommendationAlias = "r") {
  const safeViewerId = Number(viewerId || 0);
  return `LEFT JOIN ${tableConfig.RECOMMENDATION_READS} rr
    ON rr.recommendation_id = ${recommendationAlias}.id
   AND rr.user_id = ${safeViewerId}`;
}

async function markRecommendationRead({ recommendationId, userId }) {
  const safeRecommendationId = Number(recommendationId || 0);
  const safeUserId = Number(userId || 0);
  if (!safeRecommendationId || !safeUserId) {
    return { affectedRows: 0 };
  }

  const currentQuery = `SELECT status FROM ${tableConfig.RECOMMENDATIONS} WHERE id = ${safeRecommendationId} LIMIT 1`;
  const currentRows = await commonFunction.getQueryResults(currentQuery);
  if (!currentRows || currentRows.length === 0) {
    return { affectedRows: 0 };
  }

  const now = new Date();
  const status = currentRows[0].status || null;
  const upsertQuery = `INSERT INTO ${tableConfig.RECOMMENDATION_READS}
    (recommendation_id, user_id, last_seen_status, opened_at, last_seen_updated_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      last_seen_status = VALUES(last_seen_status),
      opened_at = VALUES(opened_at),
      last_seen_updated_at = VALUES(last_seen_updated_at),
      updated_at = VALUES(updated_at)`;

  return commonFunction.insertQuery(upsertQuery, [
    safeRecommendationId,
    safeUserId,
    status,
    now,
    now,
    now,
    now,
  ]);
}

module.exports = {
  buildUnreadSelect,
  buildUnreadJoin,
  markRecommendationRead,
};
