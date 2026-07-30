const { db } = require("../config/database");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      base_asset TEXT,
      quote_asset TEXT,
      status TEXT DEFAULT 'ACTIVE',
      is_watchlisted INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exchange, symbol)
    );

    CREATE TABLE IF NOT EXISTS market_ticks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL DEFAULT 0,
      price_change_percent REAL DEFAULT 0,
      volume REAL DEFAULT 0,
      quote_volume REAL DEFAULT 0,
      open_interest REAL DEFAULT 0,
      funding_rate REAL DEFAULT 0,
      event_time INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol_time
    ON market_ticks(symbol, created_at);

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      signal_score REAL DEFAULT 0,
      pattern_name TEXT,
      entry_price REAL DEFAULT 0,
      volume_change REAL DEFAULT 0,
      oi_change REAL DEFAULT 0,
      funding_rate REAL DEFAULT 0,
      reason TEXT,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS signal_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL DEFAULT 0,
      price_5m REAL,
      price_15m REAL,
      price_30m REAL,
      price_1h REAL,
      pnl_5m REAL,
      pnl_15m REAL,
      pnl_30m REAL,
      pnl_1h REAL,
      max_profit REAL,
      max_drawdown REAL,
      outcome_label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(signal_id) REFERENCES signals(id)
    );

    CREATE TABLE IF NOT EXISTS learning_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_name TEXT NOT NULL,
      direction TEXT NOT NULL,
      total_signals INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      avg_profit REAL DEFAULT 0,
      avg_drawdown REAL DEFAULT 0,
      best_profit REAL DEFAULT 0,
      worst_loss REAL DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(pattern_name, direction)
    );

    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      min_score REAL DEFAULT 70,
      total_signals INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      avg_profit REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange TEXT NOT NULL,
      symbol TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(exchange, symbol)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bot_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT DEFAULT 'INFO',
      type TEXT,
      message TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedDefaults();
  migrateLegacyContentToEnglish();

  console.log("SQLite schema ready");
}

function containsNonAscii(value) {
  return /[^\x00-\x7F]/.test(String(value || ""));
}

function migrateLegacyContentToEnglish() {
  const migrationKey = "migration_english_content_v1";
  const migration = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(migrationKey);

  if (migration?.value === "complete") {
    return;
  }

  const legacySignals = db
    .prepare("SELECT id, reason FROM signals WHERE reason IS NOT NULL")
    .all()
    .filter((row) => containsNonAscii(row.reason));

  const updateSignal = db.prepare(`
    UPDATE signals
    SET reason = ?
    WHERE id = ?
  `);

  const updatePattern = db.prepare(`
    UPDATE patterns
    SET description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE name = ?
  `);

  const saveMigration = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, 'complete', CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = 'complete',
      updated_at = CURRENT_TIMESTAMP
  `);

  const migrate = db.transaction(() => {
    for (const signal of legacySignals) {
      updateSignal.run(
        "Legacy signal explanation migrated to English. Review the recorded market metrics for details.",
        signal.id
      );
    }

    updatePattern.run(
      "Strong volume and open interest growth, favoring momentum.",
      "VOLUME_OI_BREAKOUT"
    );
    updatePattern.run(
      "Extreme funding imbalance, looking for a reversal signal.",
      "FUNDING_EXTREME_REVERSAL"
    );
    updatePattern.run(
      "Price and volume confirm the same direction.",
      "PRICE_VOLUME_CONFIRMATION"
    );

    saveMigration.run(migrationKey);
  });

  migrate();

  if (legacySignals.length > 0) {
    console.log(
      `Migrated ${legacySignals.length} legacy signal explanations to English`
    );
  }
}

function seedDefaults() {
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES (?, ?)
  `);

  insertSetting.run("signal_min_score", "70");
  insertSetting.run("outcome_windows", "5m,15m,30m,1h");
  insertSetting.run("collector_exchange", "BINANCE");
  insertSetting.run("telegram_enabled", "false");

  const insertPattern = db.prepare(`
    INSERT OR IGNORE INTO patterns (name, description, min_score)
    VALUES (?, ?, ?)
  `);

  insertPattern.run(
    "VOLUME_OI_BREAKOUT",
    "Strong volume and open interest growth, favoring momentum.",
    70
  );

  insertPattern.run(
    "FUNDING_EXTREME_REVERSAL",
    "Extreme funding imbalance, looking for a reversal signal.",
    75
  );

  insertPattern.run(
    "PRICE_VOLUME_CONFIRMATION",
    "Price and volume confirm the same direction.",
    70
  );
}

module.exports = { initSchema };
