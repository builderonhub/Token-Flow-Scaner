const { db } = require("../config/database");

const TP10_PERCENT = 10;
const TP20_PERCENT = 20;
const STOP_LOSS_PERCENT = -5;
const MAX_TRACKING_SECONDS = 24 * 60 * 60;

const CHECKPOINT_DEFS = [
  {
    key: "5m",
    seconds: 5 * 60,
    priceColumn: "price_5m",
    pnlColumn: "pnl_5m",
  },
  {
    key: "15m",
    seconds: 15 * 60,
    priceColumn: "price_15m",
    pnlColumn: "pnl_15m",
  },
  {
    key: "30m",
    seconds: 30 * 60,
    priceColumn: "price_30m",
    pnlColumn: "pnl_30m",
  },
  {
    key: "1h",
    seconds: 60 * 60,
    priceColumn: "price_1h",
    pnlColumn: "pnl_1h",
  },
  {
    key: "4h",
    seconds: 4 * 60 * 60,
  },
  {
    key: "24h",
    seconds: 24 * 60 * 60,
  },
];

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

function calculateRoi(currentPrice, entryPrice, direction = "LONG") {
  const current = Number(currentPrice);
  const entry = Number(entryPrice);

  if (
    !Number.isFinite(current) ||
    !Number.isFinite(entry) ||
    current <= 0 ||
    entry <= 0
  ) {
    return 0;
  }

  const normalizedDirection = String(direction || "LONG").toUpperCase();

  if (normalizedDirection === "SHORT") {
    return ((entry - current) / entry) * 100;
  }

  return ((current - entry) / entry) * 100;
}

/**
 * Calculate drawdown from peak ROI to current ROI.
 *
 * Example:
 * peak ROI    = 10%
 * current ROI = 5%
 *
 * The price decline from the peak is approximately:
 * (1.05 / 1.10 - 1) * 100 = -4.545%
 */
function calculateDrawdownFromPeak(currentRoi, peakRoi) {
  const currentMultiplier = 1 + Number(currentRoi || 0) / 100;
  const peakMultiplier = 1 + Number(peakRoi || 0) / 100;

  if (
    !Number.isFinite(currentMultiplier) ||
    !Number.isFinite(peakMultiplier) ||
    currentMultiplier <= 0 ||
    peakMultiplier <= 0
  ) {
    return 0;
  }

  if (currentRoi >= peakRoi) {
    return 0;
  }

  return (currentMultiplier / peakMultiplier - 1) * 100;
}

function parseJson(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }

    return fallback;
  } catch {
    return fallback;
  }
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
    CREATE TABLE IF NOT EXISTS signal_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL UNIQUE,
      exchange TEXT DEFAULT 'BINANCE',
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'LONG',

      pattern_name TEXT,
      signal_score REAL,

      entry_price REAL DEFAULT 0,
      current_price REAL,

      price_5m REAL,
      price_15m REAL,
      price_30m REAL,
      price_1h REAL,

      pnl_5m REAL,
      pnl_15m REAL,
      pnl_30m REAL,
      pnl_1h REAL,

      max_profit REAL DEFAULT 0,
      peak_roi REAL DEFAULT 0,
      max_drawdown REAL DEFAULT 0,
      current_roi REAL DEFAULT 0,

      hit_tp10 INTEGER DEFAULT 0,
      hit_tp20 INTEGER DEFAULT 0,
      hit_sl INTEGER DEFAULT 0,

      status TEXT DEFAULT 'PENDING',
      outcome_label TEXT DEFAULT 'PENDING',

      checkpoints_json TEXT,

      signal_created_at TEXT,
      checked_at TEXT,
      closed_at TEXT,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
   * CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
   * Missing columns therefore need to be detected and migrated explicitly.
   */
  const columns = getTableColumns("signal_outcomes");

  const requiredColumns = [
    "exchange TEXT DEFAULT 'BINANCE'",
    "direction TEXT DEFAULT 'LONG'",
    "pattern_name TEXT",
    "signal_score REAL",
    "entry_price REAL DEFAULT 0",
    "current_price REAL",

    "price_5m REAL",
    "price_15m REAL",
    "price_30m REAL",
    "price_1h REAL",

    "pnl_5m REAL",
    "pnl_15m REAL",
    "pnl_30m REAL",
    "pnl_1h REAL",

    "max_profit REAL DEFAULT 0",
    "peak_roi REAL DEFAULT 0",
    "max_drawdown REAL DEFAULT 0",
    "current_roi REAL DEFAULT 0",

    "hit_tp10 INTEGER DEFAULT 0",
    "hit_tp20 INTEGER DEFAULT 0",
    "hit_sl INTEGER DEFAULT 0",

    "status TEXT DEFAULT 'PENDING'",
    "outcome_label TEXT DEFAULT 'PENDING'",

    "checkpoints_json TEXT",
    "signal_created_at TEXT",
    "checked_at TEXT",
    "closed_at TEXT",
    "updated_at TEXT",
  ];

  for (const definition of requiredColumns) {
    addMissingColumn(
      "signal_outcomes",
      columns,
      definition
    );
  }

  /*
   * Normalize legacy data to avoid NULL values and inconsistent statuses.
   */
  db.prepare(`
    UPDATE signal_outcomes
    SET
      exchange = COALESCE(exchange, 'BINANCE'),
      direction = COALESCE(direction, 'LONG'),
      peak_roi = COALESCE(peak_roi, 0),
      max_profit = COALESCE(max_profit, peak_roi, 0),
      max_drawdown = COALESCE(max_drawdown, 0),
      current_roi = COALESCE(current_roi, 0),
      hit_tp10 = COALESCE(hit_tp10, 0),
      hit_tp20 = COALESCE(hit_tp20, 0),
      hit_sl = COALESCE(hit_sl, 0),
      status = COALESCE(status, 'PENDING'),
      outcome_label = COALESCE(outcome_label, 'PENDING'),
      checkpoints_json = COALESCE(checkpoints_json, '{}')
  `).run();

  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_signal_outcomes_signal_id
    ON signal_outcomes(signal_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_signal_outcomes_status
    ON signal_outcomes(status)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_signal_outcomes_symbol
    ON signal_outcomes(symbol)
  `).run();
}

function getLatestPrice(symbol, exchange = "BINANCE") {
  return db.prepare(`
    SELECT price, created_at
    FROM market_ticks
    WHERE exchange = ?
      AND symbol = ?
      AND price IS NOT NULL
      AND price > 0
    ORDER BY id DESC
    LIMIT 1
  `).get(exchange, symbol);
}

function createPendingOutcomes() {
  ensureSchema();

  const signals = db.prepare(`
    SELECT *
    FROM signals
    WHERE status = 'OPEN'
    ORDER BY id DESC
    LIMIT 100
  `).all();

  const existsStmt = db.prepare(`
    SELECT id
    FROM signal_outcomes
    WHERE signal_id = ?
    LIMIT 1
  `);

  const insertStmt = db.prepare(`
    INSERT INTO signal_outcomes (
      signal_id,
      exchange,
      symbol,
      direction,
      pattern_name,
      signal_score,
      entry_price,
      current_price,
      max_profit,
      peak_roi,
      max_drawdown,
      current_roi,
      hit_tp10,
      hit_tp20,
      hit_sl,
      status,
      outcome_label,
      checkpoints_json,
      signal_created_at,
      checked_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  let created = 0;

  const transaction = db.transaction((signalRows) => {
    for (const signal of signalRows) {
      const existing = existsStmt.get(signal.id);

      if (existing) {
        continue;
      }

      const exchange = signal.exchange || "BINANCE";
      const latest = getLatestPrice(signal.symbol, exchange);

      const entryPrice = Number(
        signal.entry_price ||
        signal.entry ||
        latest?.price ||
        0
      );

      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        continue;
      }

      const timestamp = nowIso();

      const result = insertStmt.run(
        signal.id,
        exchange,
        signal.symbol,
        signal.direction || "LONG",
        signal.pattern_name || signal.pattern || null,
        Number(
          signal.signal_score ??
          signal.alpha_score ??
          signal.score ??
          0
        ),
        round(entryPrice, 8),
        round(entryPrice, 8),
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "PENDING",
        "PENDING",
        JSON.stringify({}),
        signal.created_at || timestamp,
        timestamp,
        timestamp
      );

      if (result.changes > 0) {
        created++;
      }
    }
  });

  transaction(signals);

  return created;
}

function createCheckpoint({
  currentPrice,
  currentRoi,
  peakRoi,
  maxDrawdown,
}) {
  return {
    price: round(currentPrice, 8),
    roi: round(currentRoi, 3),
    peakRoi: round(peakRoi, 3),
    maxDrawdown: round(maxDrawdown, 3),
    checkedAt: nowIso(),
  };
}

function getCheckpointValue(checkpoints, key, property) {
  const value = checkpoints?.[key]?.[property];

  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function determineOutcome({
  hitTp10,
  hitTp20,
  hitSl,
  peakRoi,
  currentRoi,
  ageSeconds,
}) {
  /*
   * TP20 takes precedence over SL.
   *
   * If historical data shows that the coin reached TP20 before declining,
   * the outcome remains a WIN because the target was reached.
   */
  if (hitTp20) {
    return {
      status: "CLOSED",
      label: "WIN",
      shouldClose: true,
    };
  }

  if (hitSl) {
    return {
      status: "CLOSED",
      label: "LOSS",
      shouldClose: true,
    };
  }

  if (ageSeconds < MAX_TRACKING_SECONDS) {
    return {
      status: "PENDING",
      label: "PENDING",
      shouldClose: false,
    };
  }

  if (hitTp10) {
    return {
      status: "CLOSED",
      label: "WIN",
      shouldClose: true,
    };
  }

  /*
   * If profitable or previously up at least 3% without reaching TP10,
   * record FLAT instead of LOSS.
   *
   * This prevents a profitable position from being classified as a LOSS.
   */
  if (currentRoi > 0 || peakRoi >= 3) {
    return {
      status: "CLOSED",
      label: "FLAT",
      shouldClose: true,
    };
  }

  return {
    status: "CLOSED",
    label: "LOSS",
    shouldClose: true,
  };
}

function updatePendingOutcomes() {
  ensureSchema();

  const rows = db.prepare(`
    SELECT *
    FROM signal_outcomes
    WHERE status = 'PENDING'
    ORDER BY id ASC
    LIMIT 200
  `).all();

  const updateStmt = db.prepare(`
    UPDATE signal_outcomes
    SET
      current_price = ?,
      current_roi = ?,
      peak_roi = ?,
      max_profit = ?,
      max_drawdown = ?,

      price_5m = ?,
      price_15m = ?,
      price_30m = ?,
      price_1h = ?,

      pnl_5m = ?,
      pnl_15m = ?,
      pnl_30m = ?,
      pnl_1h = ?,

      hit_tp10 = ?,
      hit_tp20 = ?,
      hit_sl = ?,

      status = ?,
      outcome_label = ?,

      checkpoints_json = ?,
      checked_at = ?,
      closed_at = ?,
      updated_at = ?
    WHERE id = ?
      AND status = 'PENDING'
  `);

  let checked = 0;
  let closed = 0;

  const transaction = db.transaction((outcomes) => {
    for (const outcome of outcomes) {
      const latest = getLatestPrice(
        outcome.symbol,
        outcome.exchange || "BINANCE"
      );

      if (!latest?.price) {
        continue;
      }

      const entryPrice = Number(outcome.entry_price || 0);
      const currentPrice = Number(latest.price || 0);

      if (
        !Number.isFinite(entryPrice) ||
        !Number.isFinite(currentPrice) ||
        entryPrice <= 0 ||
        currentPrice <= 0
      ) {
        continue;
      }

      const currentRoi = calculateRoi(
        currentPrice,
        entryPrice,
        outcome.direction
      );

      /*
       * Peak ROI can only increase or remain unchanged.
       */
        const previousPeakRoi = Number(outcome.peak_roi || 0);

        const peakRoi = Math.max(
        previousPeakRoi,
        currentRoi,
        0
        );

        const maxProfit = peakRoi;

      /*
       * Current drawdown is measured from the peak.
       * max_drawdown retains the lowest historical value.
       */
      const currentDrawdown = calculateDrawdownFromPeak(
        currentRoi,
        peakRoi
      );

      const previousMaxDrawdown = Number(
        outcome.max_drawdown || 0
      );

      const maxDrawdown = Math.min(
        previousMaxDrawdown,
        currentDrawdown,
        0
      );

      /*
       * Once enabled, checkpoint flags never return to zero.
       */
      const hitTp10 =
        Number(outcome.hit_tp10 || 0) === 1 ||
        peakRoi >= TP10_PERCENT
          ? 1
          : 0;

      const hitTp20 =
        Number(outcome.hit_tp20 || 0) === 1 ||
        peakRoi >= TP20_PERCENT
          ? 1
          : 0;

      const hitSl =
        Number(outcome.hit_sl || 0) === 1 ||
        currentRoi <= STOP_LOSS_PERCENT
          ? 1
          : 0;

      const signalTimestamp = new Date(
        outcome.signal_created_at ||
        outcome.created_at
      ).getTime();

      const validSignalTimestamp = Number.isFinite(signalTimestamp)
        ? signalTimestamp
        : Date.now();

      const ageSeconds = Math.max(
        0,
        Math.floor(
          (Date.now() - validSignalTimestamp) / 1000
        )
      );

      const checkpoints = parseJson(
        outcome.checkpoints_json,
        {}
      );

      /*
       * Write each checkpoint exactly once.
       * Never overwrite an existing checkpoint value.
       */
      for (const definition of CHECKPOINT_DEFS) {
        if (
          ageSeconds >= definition.seconds &&
          !checkpoints[definition.key]
        ) {
          checkpoints[definition.key] = createCheckpoint({
            currentPrice,
            currentRoi,
            peakRoi,
            maxDrawdown,
          });
        }
      }

      const result = determineOutcome({
        hitTp10,
        hitTp20,
        hitSl,
        peakRoi,
        currentRoi,
        ageSeconds,
      });

      const timestamp = nowIso();

      let closedAt = outcome.closed_at || null;

      if (result.shouldClose && !closedAt) {
        closedAt = timestamp;
      }

      const updateResult = updateStmt.run(
        round(currentPrice, 8),
        round(currentRoi, 3),
        round(peakRoi, 3),
        round(maxProfit, 3),
        round(maxDrawdown, 3),

        getCheckpointValue(checkpoints, "5m", "price"),
        getCheckpointValue(checkpoints, "15m", "price"),
        getCheckpointValue(checkpoints, "30m", "price"),
        getCheckpointValue(checkpoints, "1h", "price"),

        getCheckpointValue(checkpoints, "5m", "roi"),
        getCheckpointValue(checkpoints, "15m", "roi"),
        getCheckpointValue(checkpoints, "30m", "roi"),
        getCheckpointValue(checkpoints, "1h", "roi"),

        hitTp10,
        hitTp20,
        hitSl,

        result.status,
        result.label,

        JSON.stringify(checkpoints),
        timestamp,
        closedAt,
        timestamp,
        outcome.id
      );

      if (updateResult.changes > 0) {
        checked++;

        if (result.status === "CLOSED") {
          closed++;
        }
      }
    }
  });

  transaction(rows);

  return {
    checked,
    closed,
  };
}

function runOutcomeTracker() {
  try {
    ensureSchema();

    const created = createPendingOutcomes();
    const updated = updatePendingOutcomes();

    return {
      ok: true,
      created,
      checked: updated.checked,
      closed: updated.closed,
    };
  } catch (error) {
    console.error("Outcome Tracker failed:", error);

    return {
      ok: false,
      created: 0,
      checked: 0,
      closed: 0,
      error: error.message,
    };
  }
}

module.exports = {
  runOutcomeTracker,
};
