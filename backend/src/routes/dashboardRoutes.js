const express = require("express");
const { db } = require("../config/database");


const router = express.Router();

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getTableColumns(tableName) {
  try {
    return new Set(
      db
        .prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .map((column) => column.name),
    );
  } catch (error) {
    console.error(
      `Cannot read columns from ${tableName}:`,
      error.message,
    );

    return new Set();
  }
}

function hasColumn(columns, name) {
  return columns.has(name);
}

function calculateTradeLevels(entryPrice, direction) {
  const entry = toNumber(entryPrice);
  const normalizedDirection = String(direction || "LONG").toUpperCase();

  if (entry <= 0) {
    return {
      tp10: 0,
      tp20: 0,
      sl: 0,
    };
  }

  if (normalizedDirection === "SHORT") {
    return {
      tp10: entry * 0.9,
      tp20: entry * 0.8,
      sl: entry * 1.05,
    };
  }

  return {
    tp10: entry * 1.1,
    tp20: entry * 1.2,
    sl: entry * 0.95,
  };
}

function normalizeSignalType(patternName) {
  const pattern = String(patternName || "").toUpperCase();

  if (pattern.includes("BUY_ZONE")) {
    return "BUY_ZONE";
  }

  if (pattern.includes("BUY")) {
    return "BUY";
  }

  if (pattern.includes("AVOID")) {
    return "AVOID";
  }

  return "WAIT";
}

function getLatestRealtimeCoins(limit = 20) {
  return db.prepare(`
    SELECT
      t.exchange,
      t.symbol,
      t.price,
      t.price_change_percent,
      t.volume,
      t.quote_volume,
      t.open_interest,
      t.funding_rate,
      t.created_at
    FROM market_ticks t
    INNER JOIN (
      SELECT
        exchange,
        symbol,
        MAX(id) AS latest_id
      FROM market_ticks
      WHERE exchange = 'BINANCE'
      GROUP BY exchange, symbol
    ) latest
      ON latest.latest_id = t.id
    ORDER BY t.quote_volume DESC
    LIMIT ?
  `).all(limit);
}

function getLatestSignals(limit = 50) {
  const outcomeColumns = getTableColumns("signal_outcomes");

  const canJoinOutcome =
    hasColumn(outcomeColumns, "signal_id");

  let rows;

  if (canJoinOutcome) {
    const outcomeCurrentPriceExpression =
      hasColumn(outcomeColumns, "current_price")
        ? "o.current_price"
        : "NULL";

    const currentPriceExpression = `
      COALESCE(
        (
          SELECT mt.price
          FROM market_ticks mt
          WHERE mt.symbol = s.symbol
          ORDER BY mt.created_at DESC
          LIMIT 1
        ),
        ${outcomeCurrentPriceExpression}
      )
    `;
const entryExpression =
  hasColumn(outcomeColumns, "entry_price")
    ? "o.entry_price"
    : hasColumn(outcomeColumns, "entry")
    ? "o.entry"
    : "NULL";

const currentRoiExpression = `
  CASE
    WHEN ${entryExpression} IS NULL
      OR ${entryExpression} <= 0
      OR ${currentPriceExpression} IS NULL
      OR ${currentPriceExpression} <= 0
    THEN 0

    WHEN UPPER(COALESCE(o.direction, 'LONG')) = 'SHORT'
    THEN (
      (${entryExpression} - ${currentPriceExpression})
      / ${entryExpression}
    ) * 100

    ELSE (
      (${currentPriceExpression} - ${entryExpression})
      / ${entryExpression}
    ) * 100
  END
`;
    const peakRoiExpression =
      hasColumn(outcomeColumns, "peak_roi")
        ? "o.peak_roi"
        : "0";

    const maxDrawdownExpression =
      hasColumn(outcomeColumns, "max_drawdown")
        ? "o.max_drawdown"
        : "0";

    const outcomeLabelExpression =
      hasColumn(outcomeColumns, "outcome_label")
        ? "o.outcome_label"
        : "NULL";

    const outcomeStatusExpression =
      hasColumn(outcomeColumns, "status")
        ? "o.status"
        : "NULL";

    const hitTp10Expression =
      hasColumn(outcomeColumns, "hit_tp10")
        ? "o.hit_tp10"
        : "0";

    const hitTp20Expression =
      hasColumn(outcomeColumns, "hit_tp20")
        ? "o.hit_tp20"
        : "0";

    const hitSlExpression =
      hasColumn(outcomeColumns, "hit_sl")
        ? "o.hit_sl"
        : "0";

    const tp10Expression =
      hasColumn(outcomeColumns, "tp10")
        ? "o.tp10"
        : "NULL";

    const tp20Expression =
      hasColumn(outcomeColumns, "tp20")
        ? "o.tp20"
        : "NULL";

    const slExpression =
      hasColumn(outcomeColumns, "sl")
        ? "o.sl"
        : "NULL";

    rows = db.prepare(`
      SELECT
        s.id,
        s.exchange,
        s.symbol,
        s.direction,
        s.signal_score,
        s.pattern_name,
        s.entry_price,
        s.volume_change,
        s.oi_change,
        s.funding_rate,
        s.reason,
        s.status,
        s.created_at,

        ${currentPriceExpression} AS current_price,
        ${currentRoiExpression} AS current_roi,
        ${peakRoiExpression} AS peak_roi,
        ${maxDrawdownExpression} AS max_drawdown,
        ${outcomeLabelExpression} AS outcome_label,
        ${outcomeStatusExpression} AS outcome_status,
        ${hitTp10Expression} AS hit_tp10,
        ${hitTp20Expression} AS hit_tp20,
        ${hitSlExpression} AS hit_sl,
        ${tp10Expression} AS stored_tp10,
        ${tp20Expression} AS stored_tp20,
        ${slExpression} AS stored_sl
      FROM signals s
      LEFT JOIN signal_outcomes o
        ON o.signal_id = s.id
      ORDER BY s.id DESC
      LIMIT ?
    `).all(limit);
  } else {
    rows = db.prepare(`
      SELECT
        s.id,
        s.exchange,
        s.symbol,
        s.direction,
        s.signal_score,
        s.pattern_name,
        s.entry_price,
        s.volume_change,
        s.oi_change,
        s.funding_rate,
        s.reason,
        s.status,
        s.created_at,

        NULL AS current_price,
        0 AS current_roi,
        0 AS peak_roi,
        0 AS max_drawdown,
        NULL AS outcome_label,
        NULL AS outcome_status,
        0 AS hit_tp10,
        0 AS hit_tp20,
        0 AS hit_sl,
        NULL AS stored_tp10,
        NULL AS stored_tp20,
        NULL AS stored_sl
      FROM signals s
      ORDER BY s.id DESC
      LIMIT ?
    `).all(limit);
  }

  return rows.map((row) => {
    const calculatedLevels = calculateTradeLevels(
      row.entry_price,
      row.direction,
    );

    return {
      id: row.id,
      exchange: row.exchange,
      symbol: row.symbol,
      direction: row.direction,

      signal: normalizeSignalType(row.pattern_name),
      pattern_name: row.pattern_name,

      signal_score: toNumber(row.signal_score),
      confidence: toNumber(row.signal_score),

      entry_price: toNumber(row.entry_price),
      current_price: toNumber(
        row.current_price,
        toNumber(row.entry_price),
      ),

      tp10:
        toNumber(row.stored_tp10) > 0
          ? toNumber(row.stored_tp10)
          : calculatedLevels.tp10,

      tp20:
        toNumber(row.stored_tp20) > 0
          ? toNumber(row.stored_tp20)
          : calculatedLevels.tp20,

      sl:
        toNumber(row.stored_sl) > 0
          ? toNumber(row.stored_sl)
          : calculatedLevels.sl,

      current_roi: toNumber(row.current_roi),
      peak_roi: toNumber(row.peak_roi),
      max_drawdown: toNumber(row.max_drawdown),

      volume_change: toNumber(row.volume_change),
      oi_change: toNumber(row.oi_change),
      funding_rate: toNumber(row.funding_rate),

      hit_tp10: toNumber(row.hit_tp10),
      hit_tp20: toNumber(row.hit_tp20),
      hit_sl: toNumber(row.hit_sl),

      outcome_label: row.outcome_label,
      status:
        row.outcome_status ||
        row.status ||
        "OPEN",

      reason: row.reason || "-",
      created_at: row.created_at,
    };
  });
}

function getTodaySignals(limit = 100) {
  return db.prepare(`
    SELECT *
    FROM signals
    WHERE DATE(created_at, 'localtime') =
          DATE('now', 'localtime')
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

function getOutcomeSummary() {
  return db.prepare(`
  SELECT
    COUNT(*) AS total_signals,

    SUM(
      CASE WHEN outcome_label='WIN'
      THEN 1 ELSE 0 END
    ) AS wins,

    SUM(
      CASE WHEN outcome_label='LOSS'
      THEN 1 ELSE 0 END
    ) AS losses,

    SUM(
      CASE WHEN outcome_label='FLAT'
      THEN 1 ELSE 0 END
    ) AS flats,

    AVG(current_roi) AS avg_profit,
    AVG(max_drawdown) AS avg_drawdown,
    AVG(peak_roi) AS avg_peak_roi

  FROM signal_outcomes
`).get();
}

function getBestPattern() {
  return db.prepare(`
    SELECT *
    FROM learning_stats
    WHERE signals > 0
    ORDER BY
      CASE
        WHEN signals >= 30 THEN 0
        ELSE 1
      END,
      expected_value DESC,
      win_rate DESC,
      signals DESC
    LIMIT 1
  `).get();
}

function getWorstPattern() {
  return db.prepare(`
    SELECT *
    FROM learning_stats
    WHERE signals > 0
    ORDER BY
      CASE
        WHEN signals >= 30 THEN 0
        ELSE 1
      END,
      expected_value ASC,
      win_rate ASC,
      signals DESC
    LIMIT 1
  `).get();
}

function getTopPatterns(limit = 5) {
  return db.prepare(`
    SELECT
      exchange,
      direction,
      pattern_name,
      signals,
      wins,
      losses,
      flats,
      win_rate,
      avg_profit,
      avg_drawdown,
      expected_value,
      sample_status,
      weight_multiplier,
      updated_at
    FROM learning_stats
    WHERE signals > 0
    ORDER BY
      CASE
        WHEN signals >= 30 THEN 0
        ELSE 1
      END,
      expected_value DESC,
      win_rate DESC,
      signals DESC
    LIMIT ?
  `).all(limit);
}

function getTopVolume(limit = 10) {
  return db.prepare(`
    SELECT
      t.symbol,
      t.price,
      t.quote_volume,
      t.created_at
    FROM market_ticks t
    INNER JOIN (
      SELECT
        symbol,
        MAX(id) AS latest_id
      FROM market_ticks
      WHERE exchange = 'BINANCE'
      GROUP BY symbol
    ) latest
      ON latest.latest_id = t.id
    ORDER BY t.quote_volume DESC
    LIMIT ?
  `).all(limit);
}

function getTopOI(limit = 10) {
  return db.prepare(`
    SELECT
      t.symbol,
      t.price,
      t.open_interest,
      t.created_at
    FROM market_ticks t
    INNER JOIN (
      SELECT
        symbol,
        MAX(id) AS latest_id
      FROM market_ticks
      WHERE exchange = 'BINANCE'
      GROUP BY symbol
    ) latest
      ON latest.latest_id = t.id
    ORDER BY t.open_interest DESC
    LIMIT ?
  `).all(limit);
}

function getTopFunding(limit = 10) {
  return db.prepare(`
    SELECT
      t.symbol,
      t.price,
      t.funding_rate,
      t.created_at
    FROM market_ticks t
    INNER JOIN (
      SELECT
        symbol,
        MAX(id) AS latest_id
      FROM market_ticks
      WHERE exchange = 'BINANCE'
      GROUP BY symbol
    ) latest
      ON latest.latest_id = t.id
    ORDER BY ABS(t.funding_rate) DESC
    LIMIT ?
  `).all(limit);
}

function getEvents(limit = 30) {
  return db.prepare(`
    SELECT *
    FROM bot_events
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

router.get("/", (req, res) => {
  try {
    const realtimeCoins = getLatestRealtimeCoins(20);
    const todaysSignals = getTodaySignals(100);
    const latestSignals = getLatestSignals(50);
    const seenSymbols = new Set();

    const topSpotSignals = latestSignals
    .filter((signal) => {
        const direction = String(
        signal.direction || "",
        ).toUpperCase();

        const action = String(
        signal.signal || "",
        ).toUpperCase();

        const status = String(
        signal.status || "",
        ).toUpperCase();

        return (
        direction === "LONG" &&
        ["BUY", "BUY_ZONE"].includes(action) &&
        ["OPEN", "PENDING"].includes(status)
        );
    })
    .sort(
        (a, b) =>
        Number(b.signal_score || 0) -
        Number(a.signal_score || 0),
    )
    .filter((signal) => {
        const symbol = String(signal.symbol || "");

        if (!symbol || seenSymbols.has(symbol)) {
        return false;
        }

        seenSymbols.add(symbol);
        return true;
    })
    .slice(0, 5);
    const summaryRow = getOutcomeSummary();

    const total = toNumber(summaryRow?.total_signals);
    const wins = toNumber(summaryRow?.wins);
    const losses = toNumber(summaryRow?.losses);
    const flats = toNumber(summaryRow?.flats);



    const openSignals = latestSignals.filter(
      (signal) =>
        String(signal.status || "").toUpperCase() ===
        "OPEN",
    ).length;

    const buySignals = latestSignals.filter(
      (signal) => signal.signal === "BUY",
    ).length;

    const buyZoneSignals = latestSignals.filter(
      (signal) => signal.signal === "BUY_ZONE",
    ).length;

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),

      summary: {
        totalSignals: total,
        wins,
        losses,
        flats,

        winRate:
          total > 0
            ? (wins / total) * 100
            : 0,

        averageProfit: toNumber(
          summaryRow?.avg_profit,
        ),

        averageDrawdown: toNumber(
          summaryRow?.avg_drawdown,
        ),

        averagePeakRoi: toNumber(
          summaryRow?.avg_peak_roi,
        ),

        signalsToday: todaysSignals.length,
        openSignals,
        buySignals,
        buyZoneSignals,
      },

      realtimeCoins,
      todaysSignals,
      topSpotSignals,
      latestSignals,

      bestPattern: getBestPattern(),
      worstPattern: getWorstPattern(),
      topPatterns: getTopPatterns(5),

      topVolume: getTopVolume(10),
      topOI: getTopOI(10),
      topFunding: getTopFunding(10),

      events: getEvents(30),
      
    });
  } catch (error) {
    console.error("Dashboard overview error:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.get("/signals", (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 50);

    const limit = Math.min(
      Math.max(
        Number.isFinite(requestedLimit)
          ? requestedLimit
          : 50,
        1,
      ),
      200,
    );

    const signals = getLatestSignals(limit);

    res.json({
      ok: true,
      signals,
    });
  } catch (error) {
    console.error("Dashboard signals error:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.get("/learning", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT
        exchange,
        direction,
        pattern_name,
        signals,
        wins,
        losses,
        flats,
        win_rate,
        loss_rate,
        flat_rate,
        avg_profit,
        avg_win,
        avg_loss,
        avg_peak_roi,
        avg_drawdown,
        avg_hold_seconds,
        expected_value,
        tp10_hits,
        tp20_hits,
        sl_hits,
        sample_status,
        weight_multiplier,
        updated_at
      FROM learning_stats
      ORDER BY
        signals DESC,
        expected_value DESC,
        win_rate DESC
    `).all();

    res.json({
      ok: true,
      learning: rows,
    });
  } catch (error) {
    console.error("Dashboard learning error:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
