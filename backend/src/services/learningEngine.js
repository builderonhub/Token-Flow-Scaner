const { db } = require("../config/database");

function nowIso() {
  return new Date().toISOString();
}

function round(value, decimals = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(decimals));
}

function getTableColumns(tableName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((column) => column.name);
}

function addMissingColumn(tableName, columns, definition) {
  const columnName = definition.trim().split(/\s+/)[0];

  if (columns.includes(columnName)) {
    return;
  }

  db.prepare(`
    ALTER TABLE ${tableName}
    ADD COLUMN ${definition}
  `).run();

  columns.push(columnName);
}

function ensureSchema() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS learning_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      exchange TEXT DEFAULT 'BINANCE',
      direction TEXT NOT NULL DEFAULT 'LONG',
      pattern_name TEXT NOT NULL,

      signals INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      flats INTEGER DEFAULT 0,

      win_rate REAL DEFAULT 0,
      loss_rate REAL DEFAULT 0,
      flat_rate REAL DEFAULT 0,

      avg_profit REAL DEFAULT 0,
      avg_win REAL DEFAULT 0,
      avg_loss REAL DEFAULT 0,
      avg_peak_roi REAL DEFAULT 0,
      avg_drawdown REAL DEFAULT 0,
      avg_hold_seconds REAL DEFAULT 0,

      expected_value REAL DEFAULT 0,

      tp10_hits INTEGER DEFAULT 0,
      tp20_hits INTEGER DEFAULT 0,
      sl_hits INTEGER DEFAULT 0,

      sample_status TEXT DEFAULT 'INSUFFICIENT',
      weight_multiplier REAL DEFAULT 1,

      calculated_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const columns = getTableColumns("learning_stats");

  const requiredColumns = [
    "exchange TEXT DEFAULT 'BINANCE'",
    "direction TEXT DEFAULT 'LONG'",
    "pattern_name TEXT",

    "signals INTEGER DEFAULT 0",
    "wins INTEGER DEFAULT 0",
    "losses INTEGER DEFAULT 0",
    "flats INTEGER DEFAULT 0",

    "win_rate REAL DEFAULT 0",
    "loss_rate REAL DEFAULT 0",
    "flat_rate REAL DEFAULT 0",

    "avg_profit REAL DEFAULT 0",
    "avg_win REAL DEFAULT 0",
    "avg_loss REAL DEFAULT 0",
    "avg_peak_roi REAL DEFAULT 0",
    "avg_drawdown REAL DEFAULT 0",
    "avg_hold_seconds REAL DEFAULT 0",

    "expected_value REAL DEFAULT 0",

    "tp10_hits INTEGER DEFAULT 0",
    "tp20_hits INTEGER DEFAULT 0",
    "sl_hits INTEGER DEFAULT 0",

    "sample_status TEXT DEFAULT 'INSUFFICIENT'",
    "weight_multiplier REAL DEFAULT 1",

    "calculated_at TEXT",
    "created_at TEXT",
    "updated_at TEXT",
  ];

  for (const definition of requiredColumns) {
    addMissingColumn(
      "learning_stats",
      columns,
      definition
    );
  }

  db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_learning_stats_pattern
    ON learning_stats(pattern_name)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_learning_stats_exchange
    ON learning_stats(exchange)
  `).run();
}

/**
 * Statistical confidence level.
 *
 * This is not yet used to adjust weights automatically.
 * It only stores state for the dashboard and later processing.
 */
function getSampleStatus(signals) {
  if (signals >= 100) {
    return "STRONG";
  }

  if (signals >= 30) {
    return "READY";
  }

  if (signals >= 10) {
    return "EARLY";
  }

  return "INSUFFICIENT";
}

/**
 * Suggested statistical weight.
 *
 * This is written only to learning_stats.
 * It does not yet affect the Alpha Signal Engine automatically.
 */
function calculateWeightMultiplier({
  signals,
  winRate,
  expectedValue,
}) {
  if (signals < 30) {
    return 1;
  }

  if (winRate >= 70 && expectedValue > 0) {
    return 1.15;
  }

  if (winRate >= 60 && expectedValue > 0) {
    return 1.08;
  }

  if (winRate < 35 || expectedValue < -2) {
    return 0.85;
  }

  if (winRate < 45 || expectedValue < 0) {
    return 0.93;
  }

  return 1;
}

function getPatternStatistics() {
  return db.prepare(`
    SELECT
      COALESCE(exchange, 'BINANCE') AS exchange,
        COALESCE(direction, 'LONG') AS direction,
      COALESCE(
        NULLIF(TRIM(pattern_name), ''),
        'UNKNOWN'
      ) AS pattern_name,

      COUNT(*) AS signals,

      SUM(
        CASE
          WHEN outcome_label = 'WIN' THEN 1
          ELSE 0
        END
      ) AS wins,

      SUM(
        CASE
          WHEN outcome_label = 'LOSS' THEN 1
          ELSE 0
        END
      ) AS losses,

      SUM(
        CASE
          WHEN outcome_label = 'FLAT' THEN 1
          ELSE 0
        END
      ) AS flats,

      AVG(
        CASE
          WHEN outcome_label = 'WIN'
          THEN current_roi
          ELSE NULL
        END
      ) AS avg_win,

      AVG(
        CASE
          WHEN outcome_label = 'LOSS'
          THEN current_roi
          ELSE NULL
        END
      ) AS avg_loss,

      AVG(current_roi) AS avg_profit,
      AVG(peak_roi) AS avg_peak_roi,
      AVG(max_drawdown) AS avg_drawdown,

      AVG(
        CASE
          WHEN closed_at IS NOT NULL
           AND signal_created_at IS NOT NULL
          THEN MAX(
            0,
            (
              julianday(closed_at) -
              julianday(signal_created_at)
            ) * 86400
          )
          ELSE NULL
        END
      ) AS avg_hold_seconds,

      SUM(
        CASE
          WHEN hit_tp10 = 1 THEN 1
          ELSE 0
        END
      ) AS tp10_hits,

      SUM(
        CASE
          WHEN hit_tp20 = 1 THEN 1
          ELSE 0
        END
      ) AS tp20_hits,

      SUM(
        CASE
          WHEN hit_sl = 1 THEN 1
          ELSE 0
        END
      ) AS sl_hits

    FROM signal_outcomes

    WHERE status = 'CLOSED'
      AND outcome_label IN ('WIN', 'LOSS', 'FLAT')

    GROUP BY
      COALESCE(exchange, 'BINANCE'),
      COALESCE(direction, 'LONG'),
      COALESCE(
        NULLIF(TRIM(pattern_name), ''),
        'UNKNOWN'
      )

    ORDER BY signals DESC
  `).all();
}

function getExistingStat(exchange, direction, patternName) {
  return db.prepare(`
    SELECT id
    FROM learning_stats
    WHERE exchange = ?
      AND direction = ?
      AND pattern_name = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(exchange, direction, patternName);
}

function removeDuplicateStats(
  exchange,
  direction,
  patternName,
  keepId
) {
  db.prepare(`
    DELETE FROM learning_stats
    WHERE exchange = ?
      AND direction = ?
      AND pattern_name = ?
      AND id != ?
  `).run(
    exchange,
    direction,
    patternName,
    keepId
  );
}

function savePatternStat(stat) {
  const signals = Number(stat.signals || 0);
  const wins = Number(stat.wins || 0);
  const losses = Number(stat.losses || 0);
  const flats = Number(stat.flats || 0);

  const winRate =
    signals > 0
      ? (wins / signals) * 100
      : 0;

  const lossRate =
    signals > 0
      ? (losses / signals) * 100
      : 0;

  const flatRate =
    signals > 0
      ? (flats / signals) * 100
      : 0;

  const avgWin = Number(stat.avg_win || 0);
  const avgLoss = Number(stat.avg_loss || 0);

  const expectedValue =
    (wins / Math.max(signals, 1)) * avgWin +
    (losses / Math.max(signals, 1)) * avgLoss;

  const sampleStatus = getSampleStatus(signals);

  const weightMultiplier = calculateWeightMultiplier({
    signals,
    winRate,
    expectedValue,
  });

  const timestamp = nowIso();

  /*
   * Declare values before calling getExistingStat().
   */
  const values = {
    exchange: stat.exchange || "BINANCE",
    direction: stat.direction || "LONG",
    patternName: stat.pattern_name || "UNKNOWN",

    signals,
    wins,
    losses,
    flats,

    winRate: round(winRate, 2),
    lossRate: round(lossRate, 2),
    flatRate: round(flatRate, 2),

    avgProfit: round(stat.avg_profit, 3),
    avgWin: round(avgWin, 3),
    avgLoss: round(avgLoss, 3),
    avgPeakRoi: round(stat.avg_peak_roi, 3),
    avgDrawdown: round(stat.avg_drawdown, 3),
    avgHoldSeconds: round(stat.avg_hold_seconds, 0),

    expectedValue: round(expectedValue, 3),

    tp10Hits: Number(stat.tp10_hits || 0),
    tp20Hits: Number(stat.tp20_hits || 0),
    slHits: Number(stat.sl_hits || 0),

    sampleStatus,
    weightMultiplier: round(weightMultiplier, 3),

    timestamp,
  };

  const existing = getExistingStat(
    values.exchange,
    values.direction,
    values.patternName
  );

  if (existing) {
    db.prepare(`
      UPDATE learning_stats
      SET
        signals = ?,
        wins = ?,
        losses = ?,
        flats = ?,

        win_rate = ?,
        loss_rate = ?,
        flat_rate = ?,

        avg_profit = ?,
        avg_win = ?,
        avg_loss = ?,
        avg_peak_roi = ?,
        avg_drawdown = ?,
        avg_hold_seconds = ?,

        expected_value = ?,

        tp10_hits = ?,
        tp20_hits = ?,
        sl_hits = ?,

        sample_status = ?,
        weight_multiplier = ?,

        calculated_at = ?,
        updated_at = ?

      WHERE id = ?
    `).run(
      values.signals,
      values.wins,
      values.losses,
      values.flats,

      values.winRate,
      values.lossRate,
      values.flatRate,

      values.avgProfit,
      values.avgWin,
      values.avgLoss,
      values.avgPeakRoi,
      values.avgDrawdown,
      values.avgHoldSeconds,

      values.expectedValue,

      values.tp10Hits,
      values.tp20Hits,
      values.slHits,

      values.sampleStatus,
      values.weightMultiplier,

      values.timestamp,
      values.timestamp,

      existing.id
    );

    removeDuplicateStats(
      values.exchange,
      values.direction,
      values.patternName,
      existing.id
    );

    return {
      action: "UPDATED",
      ...values,
    };
  }

  const result = db.prepare(`
    INSERT INTO learning_stats (
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

      calculated_at,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `).run(
    values.exchange,
    values.direction,
    values.patternName,

    values.signals,
    values.wins,
    values.losses,
    values.flats,

    values.winRate,
    values.lossRate,
    values.flatRate,

    values.avgProfit,
    values.avgWin,
    values.avgLoss,
    values.avgPeakRoi,
    values.avgDrawdown,
    values.avgHoldSeconds,

    values.expectedValue,

    values.tp10Hits,
    values.tp20Hits,
    values.slHits,

    values.sampleStatus,
    values.weightMultiplier,

    values.timestamp,
    values.timestamp,
    values.timestamp
  );

  return {
    action: "CREATED",
    id: Number(result.lastInsertRowid),
    ...values,
  };
}

function removeObsoleteStats(activePatterns) {
  if (!activePatterns.length) {
    return 0;
  }

  const activeKeys = new Set(
    activePatterns.map((row) => {
      const exchange = row.exchange || "BINANCE";
      const direction = row.direction || "LONG";
      const patternName = row.pattern_name || "UNKNOWN";

      return `${exchange}::${direction}::${patternName}`;
    })
  );

  const existingRows = db.prepare(`
    SELECT
      id,
      exchange,
      direction,
      pattern_name
    FROM learning_stats
  `).all();

  const deleteStmt = db.prepare(`
    DELETE FROM learning_stats
    WHERE id = ?
  `);

  let removed = 0;

  for (const row of existingRows) {
    const exchange = row.exchange || "BINANCE";
    const direction = row.direction || "LONG";
    const patternName = row.pattern_name || "UNKNOWN";

    const key = `${exchange}::${direction}::${patternName}`;

    if (!activeKeys.has(key)) {
      const result = deleteStmt.run(row.id);
      removed += result.changes;
    }
  }

  return removed;
}

function runLearningEngine() {
  try {
    ensureSchema();

    const statistics = getPatternStatistics();

    const results = [];

    const transaction = db.transaction(() => {
      for (const stat of statistics) {
        results.push(savePatternStat(stat));
      }

      return removeObsoleteStats(statistics);
    });

    const removed = transaction();

    return {
      ok: true,
      patterns: results.length,
      created: results.filter(
        (item) => item.action === "CREATED"
      ).length,
      updated: results.filter(
        (item) => item.action === "UPDATED"
      ).length,
      removed,
      results,
    };
  } catch (error) {
    console.error("Learning Engine failed:", error);

    return {
      ok: false,
      patterns: 0,
      created: 0,
      updated: 0,
      removed: 0,
      error: error.message,
    };
  }
}

module.exports = {
  runLearningEngine,
};
