var tableConfig = require("../config/table_name.json");
var q = require("q");
var commonFunction = require("../models/commonfunction");

const QUERY_DAILY_LIMIT = 10;

function formatQueryWaitRemaining(expiresAt) {
  const end =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const ms = Math.max(0, end.getTime() - Date.now());
  const totalMinutes = Math.ceil(ms / 60000);
  if (totalMinutes < 60) {
    return {
      wait_label: `${totalMinutes} min${totalMinutes === 1 ? "" : "s"}`,
      hours_remaining: 0,
      minutes_remaining: totalMinutes,
    };
  }
  const hours = Math.ceil(totalMinutes / 60);
  return {
    wait_label: `${hours} hr${hours === 1 ? "" : "s"}`,
    hours_remaining: hours,
    minutes_remaining: totalMinutes,
  };
}

function toFullProfileUrl(profileUrl) {
  if (!profileUrl || typeof profileUrl !== "string") return null;
  if (profileUrl.startsWith("http")) return profileUrl;
  const baseUrl = process.env.BASE_URL || "http://13.212.181.108:8888";
  const sliced = profileUrl.slice(profileUrl.lastIndexOf("/"));
  return `${baseUrl}${sliced}`;
}

async function getRequesterQueryPushMeta(requesterUserId) {
  const dailyRows = await commonFunction.getQueryResults(
    `SELECT COUNT(DISTINCT created_at) AS pushes_today
     FROM ${tableConfig.CIRCLE_QUERY_DELIVERY}
     WHERE requester_user_id = ${requesterUserId}
     AND created_at >= CURDATE()
     AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
  );
  const dailyUsed =
    dailyRows && dailyRows[0]
      ? parseInt(dailyRows[0].pushes_today, 10) || 0
      : 0;

  const activeRows = await commonFunction.getQueryResults(
    `SELECT MAX(expires_at) AS active_expires_at,
            COUNT(DISTINCT recipient_user_id) AS recipient_count
     FROM ${tableConfig.CIRCLE_QUERY_DELIVERY}
     WHERE requester_user_id = ${requesterUserId}
     AND expires_at > NOW()`
  );

  let hasActive = false;
  let activeExpiresAt = null;
  let recipientCount = 0;
  let wait = null;

  if (activeRows && activeRows[0] && activeRows[0].active_expires_at) {
    hasActive = true;
    activeExpiresAt = activeRows[0].active_expires_at;
    recipientCount = parseInt(activeRows[0].recipient_count, 10) || 0;
    wait = formatQueryWaitRemaining(activeExpiresAt);
  }

  const activeExpiresIso =
    activeExpiresAt instanceof Date
      ? activeExpiresAt.toISOString()
      : activeExpiresAt;

  return {
    has_active_query: hasActive,
    active_expires_at: activeExpiresIso,
    active_recipient_count: recipientCount,
    wait_label: wait ? wait.wait_label : null,
    hours_remaining: wait ? wait.hours_remaining : null,
    minutes_remaining: wait ? wait.minutes_remaining : null,
    daily_queries_used: dailyUsed,
    daily_query_limit: QUERY_DAILY_LIMIT,
    daily_queries_remaining: Math.max(0, QUERY_DAILY_LIMIT - dailyUsed),
  };
}

function mapDeliveryRow(row) {
  const offerExpires =
    row.offer_expires_at instanceof Date
      ? row.offer_expires_at.toISOString()
      : row.offer_expires_at;
  const sentAt =
    row.sent_at instanceof Date ? row.sent_at.toISOString() : row.sent_at;
  return {
    delivery_id: row.delivery_id,
    offer_expires_at: offerExpires,
    sent_at: sentAt,
    requester_user_id: row.requester_user_id,
    requester_name: row.requester_name,
    requester_profile_url: toFullProfileUrl(row.requester_profile_url),
    query_text: row.query_text,
    status: "open",
  };
}

module.exports = {
  getCircleQueryDetails: async (req) => {
    const { user_id } = req.body;
    const deferred = q.defer();
    const query = `SELECT cq.*, u.name AS requester_name, u.profile_url AS requester_profile_url
      FROM ${tableConfig.CIRCLE_QUERY} cq
      LEFT JOIN ${tableConfig.USER} u ON u.id = cq.user_id
      WHERE cq.user_id = ${user_id} LIMIT 1`;
    const rows = await commonFunction.getQueryResults(query);
    if (!rows || rows.length === 0) {
      deferred.resolve({
        status: 1,
        data: null,
        message: "No query found",
      });
      return deferred.promise;
    }
    const row = rows[0];
    deferred.resolve({
      status: 1,
      data: {
        ...row,
        requester_profile_url: toFullProfileUrl(row.requester_profile_url),
      },
    });
    return deferred.promise;
  },

  saveCircleQueryDetails: async (req) => {
    const { user_id, query_text } = req.body;
    const deferred = q.defer();
    const trimmed = (query_text || "").trim();
    if (!trimmed) {
      deferred.resolve({ status: 0, message: "Query text is required" });
      return deferred.promise;
    }
    const date = new Date();
    const checkQuery = `SELECT id FROM ${tableConfig.CIRCLE_QUERY} WHERE user_id = ${user_id} LIMIT 1`;
    const existing = await commonFunction.getQueryResults(checkQuery);

    if (existing && existing.length > 0) {
      const updateQuery = `UPDATE ${tableConfig.CIRCLE_QUERY} SET query_text = ?, updated_at = ? WHERE user_id = ?`;
      const updated = await commonFunction.updateQuery(updateQuery, [
        trimmed,
        date,
        user_id,
      ]);
      deferred.resolve({
        status: updated.affectedRows > 0 ? 1 : 0,
        message:
          updated.affectedRows > 0
            ? "Query saved successfully"
            : "No changes made",
      });
    } else {
      const insertQuery = `INSERT INTO ${tableConfig.CIRCLE_QUERY} SET ?`;
      const insertData = {
        user_id,
        query_text: trimmed,
        created_at: date,
        updated_at: date,
      };
      const inserted = await commonFunction.insertQuery(insertQuery, insertData);
      deferred.resolve({
        status: inserted.affectedRows > 0 ? 1 : 0,
        message:
          inserted.affectedRows > 0
            ? "Query saved successfully"
            : "Something went wrong",
      });
    }
    return deferred.promise;
  },

  pushCircleQueryToContacts: async (req) => {
    const deferred = q.defer();
    const requesterUserId = parseInt(req.body.user_id, 10);
    let durationMinutes = parseInt(req.body.duration_minutes, 10);
    if (!requesterUserId) {
      deferred.resolve({ status: 0, message: "Invalid user_id" });
      return deferred.promise;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      durationMinutes = 60;
    }

    let targets = req.body.target_user_ids;
    if (typeof targets === "string") {
      try {
        targets = JSON.parse(targets);
      } catch (e) {
        targets = [];
      }
    }
    if (!Array.isArray(targets)) {
      targets = [];
    }

    const uniqueTargets = [
      ...new Set(
        targets
          .map((id) => parseInt(id, 10))
          .filter(
            (id) => Number.isFinite(id) && id > 0 && id !== requesterUserId
          )
      ),
    ];

    if (uniqueTargets.length === 0) {
      deferred.resolve({ status: 0, message: "No valid contacts selected" });
      return deferred.promise;
    }

    const queryCheck = await commonFunction.getQueryResults(
      `SELECT id FROM ${tableConfig.CIRCLE_QUERY} WHERE user_id = ${requesterUserId} LIMIT 1`
    );
    if (!queryCheck || queryCheck.length === 0) {
      deferred.resolve({
        status: 0,
        message: "Save your query first under Ask your circle",
      });
      return deferred.promise;
    }

    const forceReplace =
      req.body.force_replace === true ||
      req.body.force_replace === 1 ||
      req.body.force_replace === "1";

    const pushMeta = await getRequesterQueryPushMeta(requesterUserId);

    if (pushMeta.daily_queries_used >= QUERY_DAILY_LIMIT) {
      deferred.resolve({
        status: 0,
        error_code: "DAILY_LIMIT",
        message: `Daily query limit reached (${QUERY_DAILY_LIMIT}/${QUERY_DAILY_LIMIT}). Try again tomorrow.`,
        ...pushMeta,
      });
      return deferred.promise;
    }

    if (pushMeta.has_active_query && !forceReplace) {
      deferred.resolve({
        status: 0,
        error_code: "ACTIVE_QUERY",
        message: `You already have an active query. Wait about ${pushMeta.wait_label}, or delete the active query to send another. Daily queries: ${pushMeta.daily_queries_used}/${QUERY_DAILY_LIMIT} used.`,
        ...pushMeta,
      });
      return deferred.promise;
    }

    if (pushMeta.has_active_query && forceReplace) {
      await commonFunction.updateQuery(
        `UPDATE ${tableConfig.CIRCLE_QUERY_DELIVERY} SET expires_at = NOW() WHERE requester_user_id = ? AND expires_at > NOW()`,
        [requesterUserId]
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
    let inserted = 0;
    for (const recipientUserId of uniqueTargets) {
      const insertData = {
        requester_user_id: requesterUserId,
        recipient_user_id: recipientUserId,
        expires_at: expiresAt,
        dismissed_at: null,
        liked_at: null,
        created_at: now,
      };
      const ins = await commonFunction.insertQuery(
        `INSERT INTO ${tableConfig.CIRCLE_QUERY_DELIVERY} SET ?`,
        insertData
      );
      if (ins && ins.affectedRows > 0) inserted += 1;
    }
    const updatedMeta = await getRequesterQueryPushMeta(requesterUserId);
    deferred.resolve({
      status: inserted > 0 ? 1 : 0,
      message:
        inserted > 0
          ? `Query sent successfully to ${inserted} selected contact(s). Daily usage: ${updatedMeta.daily_queries_used}/${QUERY_DAILY_LIMIT}.`
          : "Could not schedule query",
      inserted,
      ...updatedMeta,
    });
    return deferred.promise;
  },

  getCircleQueryPushStatus: async (req) => {
    const deferred = q.defer();
    const requesterUserId = parseInt(req.body.user_id, 10);
    if (!requesterUserId) {
      deferred.resolve({ status: 0, message: "Invalid user_id" });
      return deferred.promise;
    }
    const meta = await getRequesterQueryPushMeta(requesterUserId);
    deferred.resolve({
      status: 1,
      message: "OK",
      ...meta,
    });
    return deferred.promise;
  },

  cancelActiveCircleQuery: async (req) => {
    const deferred = q.defer();
    const requesterUserId = parseInt(req.body.user_id, 10);
    if (!requesterUserId) {
      deferred.resolve({ status: 0, message: "Invalid user_id" });
      return deferred.promise;
    }
    const updated = await commonFunction.updateQuery(
      `UPDATE ${tableConfig.CIRCLE_QUERY_DELIVERY} SET expires_at = NOW() WHERE requester_user_id = ? AND expires_at > NOW()`,
      [requesterUserId]
    );
    const cancelled = updated.affectedRows || 0;
    const meta = await getRequesterQueryPushMeta(requesterUserId);
    deferred.resolve({
      status: cancelled > 0 ? 1 : 0,
      message:
        cancelled > 0
          ? "Active query removed. You can send a new query."
          : "No active query to remove",
      cancelled_deliveries: cancelled,
      ...meta,
    });
    return deferred.promise;
  },

  getHomeCircleQueryOverlayForRecipient: async (req) => {
    const deferred = q.defer();
    const recipientId = parseInt(req.body.user_id, 10);
    if (!recipientId) {
      deferred.resolve({ status: 0, message: "Invalid user_id", data: null });
      return deferred.promise;
    }
    let limit = parseInt(req.body.limit, 10);
    let offset = parseInt(req.body.offset, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const whereClause = `d.recipient_user_id = ${recipientId}
        AND d.expires_at > NOW()
        AND d.dismissed_at IS NULL
        AND d.liked_at IS NULL`;

    const countRows = await commonFunction.getQueryResults(
      `SELECT COUNT(*) AS total_count
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}`
    );
    const totalCount =
      countRows && countRows[0]
        ? parseInt(countRows[0].total_count, 10) || 0
        : 0;

    const qText = `SELECT d.id AS delivery_id,
      d.expires_at AS offer_expires_at,
      d.created_at AS sent_at,
      cq.user_id AS requester_user_id,
      cq.query_text,
      u.name AS requester_name,
      u.profile_url AS requester_profile_url
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
    const rows = await commonFunction.getQueryResults(qText);
    if (!rows || rows.length === 0) {
      deferred.resolve({
        status: 1,
        data: null,
        items: [],
        has_more: false,
        total_count: totalCount,
        offset,
        limit,
        message: "No active query",
        delivery_id: null,
      });
      return deferred.promise;
    }
    const items = rows.map(mapDeliveryRow);
    const first = items[0];
    const hasMore = offset + items.length < totalCount;
    deferred.resolve({
      status: 1,
      items,
      has_more: hasMore,
      total_count: totalCount,
      offset,
      limit,
      data: first,
      delivery_id: first.delivery_id,
      message: "OK",
    });
    return deferred.promise;
  },

  dismissCircleQueryDelivery: async (req) => {
    const deferred = q.defer();
    const recipientId = parseInt(req.body.user_id, 10);
    const deliveryId = parseInt(req.body.delivery_id, 10);
    if (!recipientId || !deliveryId) {
      deferred.resolve({ status: 0, message: "Invalid parameters" });
      return deferred.promise;
    }
    const updated = await commonFunction.updateQuery(
      `UPDATE ${tableConfig.CIRCLE_QUERY_DELIVERY} SET dismissed_at = NOW() WHERE id = ? AND recipient_user_id = ? AND dismissed_at IS NULL`,
      [deliveryId, recipientId]
    );
    deferred.resolve({
      status: updated.affectedRows > 0 ? 1 : 0,
      message: updated.affectedRows > 0 ? "Dismissed" : "Nothing to dismiss",
    });
    return deferred.promise;
  },

  likeCircleQueryDelivery: async (req) => {
    const deferred = q.defer();
    const recipientId = parseInt(req.body.user_id, 10);
    const deliveryId = parseInt(req.body.delivery_id, 10);
    if (!recipientId || !deliveryId) {
      deferred.resolve({ status: 0, message: "Invalid parameters" });
      return deferred.promise;
    }
    const updated = await commonFunction.updateQuery(
      `UPDATE ${tableConfig.CIRCLE_QUERY_DELIVERY} SET liked_at = NOW() WHERE id = ? AND recipient_user_id = ? AND dismissed_at IS NULL AND liked_at IS NULL`,
      [deliveryId, recipientId]
    );
    deferred.resolve({
      status: updated.affectedRows > 0 ? 1 : 0,
      message: updated.affectedRows > 0 ? "Liked" : "Nothing to like",
    });
    return deferred.promise;
  },

  getHomeCircleQueryInboxForRecipient: async (req) => {
    const deferred = q.defer();
    const recipientId = parseInt(req.body.user_id, 10);
    if (!recipientId) {
      deferred.resolve({ status: 0, message: "Invalid user_id", data: null });
      return deferred.promise;
    }
    let limit = parseInt(req.body.limit, 10);
    let offset = parseInt(req.body.offset, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const whereClause = `d.recipient_user_id = ${recipientId}
        AND d.expires_at > NOW()
        AND d.dismissed_at IS NOT NULL
        AND d.liked_at IS NULL`;

    const countRows = await commonFunction.getQueryResults(
      `SELECT COUNT(*) AS total_count
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}`
    );
    const totalCount =
      countRows && countRows[0]
        ? parseInt(countRows[0].total_count, 10) || 0
        : 0;

    const qText = `SELECT d.id AS delivery_id,
      d.expires_at AS offer_expires_at,
      d.created_at AS sent_at,
      cq.user_id AS requester_user_id,
      cq.query_text,
      u.name AS requester_name,
      u.profile_url AS requester_profile_url
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}
      ORDER BY d.dismissed_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
    const rows = await commonFunction.getQueryResults(qText);
    if (!rows || rows.length === 0) {
      deferred.resolve({
        status: 1,
        data: null,
        items: [],
        has_more: false,
        total_count: totalCount,
        offset,
        limit,
        message: "No saved queries",
        delivery_id: null,
      });
      return deferred.promise;
    }
    const items = rows.map(mapDeliveryRow);
    const first = items[0];
    const hasMore = offset + items.length < totalCount;
    deferred.resolve({
      status: 1,
      items,
      has_more: hasMore,
      total_count: totalCount,
      offset,
      limit,
      data: first,
      delivery_id: first.delivery_id,
      message: "OK",
    });
    return deferred.promise;
  },

  getHomeCircleQueryLikesForRecipient: async (req) => {
    const deferred = q.defer();
    const recipientId = parseInt(req.body.user_id, 10);
    if (!recipientId) {
      deferred.resolve({ status: 0, message: "Invalid user_id", data: null });
      return deferred.promise;
    }
    let limit = parseInt(req.body.limit, 10);
    let offset = parseInt(req.body.offset, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const whereClause = `d.recipient_user_id = ${recipientId}
        AND d.expires_at > NOW()
        AND d.liked_at IS NOT NULL
        AND d.dismissed_at IS NULL`;

    const countRows = await commonFunction.getQueryResults(
      `SELECT COUNT(*) AS total_count
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}`
    );
    const totalCount =
      countRows && countRows[0]
        ? parseInt(countRows[0].total_count, 10) || 0
        : 0;

    const qText = `SELECT d.id AS delivery_id,
      d.expires_at AS offer_expires_at,
      d.created_at AS sent_at,
      cq.user_id AS requester_user_id,
      cq.query_text,
      u.name AS requester_name,
      u.profile_url AS requester_profile_url
      FROM ${tableConfig.CIRCLE_QUERY_DELIVERY} d
      INNER JOIN ${tableConfig.CIRCLE_QUERY} cq ON cq.user_id = d.requester_user_id
      INNER JOIN ${tableConfig.USER} u ON u.id = d.requester_user_id
      WHERE ${whereClause}
      ORDER BY d.liked_at DESC
      LIMIT ${limit} OFFSET ${offset}`;
    const rows = await commonFunction.getQueryResults(qText);
    if (!rows || rows.length === 0) {
      deferred.resolve({
        status: 1,
        data: null,
        items: [],
        has_more: false,
        total_count: totalCount,
        offset,
        limit,
        message: "No liked queries",
        delivery_id: null,
      });
      return deferred.promise;
    }
    const items = rows.map(mapDeliveryRow);
    const first = items[0];
    const hasMore = offset + items.length < totalCount;
    deferred.resolve({
      status: 1,
      items,
      has_more: hasMore,
      total_count: totalCount,
      offset,
      limit,
      data: first,
      delivery_id: first.delivery_id,
      message: "OK",
    });
    return deferred.promise;
  },
};
