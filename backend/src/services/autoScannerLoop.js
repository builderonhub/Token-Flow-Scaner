const collector = require("./binanceCollector");
const flowSignalEngine = require("./alphaSignalEngine");
const { db } = require("../config/database");

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_MARKET_LIMIT = 80;
const DEFAULT_SIGNAL_LIMIT = 5;

let scannerTimer = null;
let scannerRunning = false;
let scanInProgress = false;

function writeBotEvent(level, type, message, raw = null) {
  try {
    db.prepare(`
      INSERT INTO bot_events (
        level,
        type,
        message,
        raw_json
      )
      VALUES (?, ?, ?, ?)
    `).run(
      level,
      type,
      message,
      raw ? JSON.stringify(raw) : null
    );
  } catch (error) {
    console.error(
      "Flow AutoScanner: failed to write event:",
      error.message
    );
  }
}

async function runOnce(options = {}) {
  if (scanInProgress) {
    return {
      ok: false,
      skipped: true,
      reason: "SCAN_ALREADY_RUNNING",
    };
  }

  scanInProgress = true;

  const marketLimit = Math.max(
    1,
    Number(
      options.marketLimit ||
        process.env.AUTO_SCANNER_MARKET_LIMIT ||
        DEFAULT_MARKET_LIMIT
    )
  );

  const signalLimit = Math.max(
    1,
    Number(
      options.signalLimit ||
        process.env.AUTO_SCANNER_SIGNAL_LIMIT ||
        DEFAULT_SIGNAL_LIMIT
    )
  );

  try {
    /*
     * Step 1:
     * Fetch fresh Binance Futures data and write it to market_ticks.
     */
    const snapshot = await collector.collectMarketSnapshot(
      marketLimit
    );

    /*
     * Step 2:
     * Run the scan only after the collector has updated the data.
     */
    const scan = flowSignalEngine.runFlowScan(
      signalLimit
    );

    const signals = Array.isArray(scan?.signals)
      ? scan.signals
      : [];

    const topSignal = signals[0] || null;

    console.log(
      `Flow AutoScanner: ticks=${Number(
        snapshot?.inserted || snapshot?.count || 0
      )}, inserted=${Number(
        scan?.inserted || 0
      )}, top=${topSignal?.symbol || "NONE"} ${
        topSignal?.action || ""
      } ${
        topSignal?.flowScore ??
        topSignal?.score ??
        ""
      }`
    );

    return {
      ok: true,
      snapshot,
      scan,
    };
  } catch (error) {
    console.error(
      "Flow AutoScanner failed:",
      error
    );

    writeBotEvent(
      "ERROR",
      "FLOW_SCAN_ERROR",
      `Flow scanner failed: ${error.message}`,
      {
        error: error.message,
        stack: error.stack,
      }
    );

    return {
      ok: false,
      error: error.message,
    };
  } finally {
    scanInProgress = false;
  }
}

function start(options = {}) {
  if (scannerRunning) {
    return {
      ok: true,
      started: false,
      reason: "AUTO_SCANNER_ALREADY_RUNNING",
    };
  }

  const intervalMs = Math.max(
    5_000,
    Number(
      options.intervalMs ||
        process.env.AUTO_SCANNER_INTERVAL_MS ||
        DEFAULT_INTERVAL_MS
    )
  );

  const marketLimit = Math.max(
    1,
    Number(
      options.marketLimit ||
        process.env.AUTO_SCANNER_MARKET_LIMIT ||
        DEFAULT_MARKET_LIMIT
    )
  );

  const signalLimit = Math.max(
    1,
    Number(
      options.signalLimit ||
        process.env.AUTO_SCANNER_SIGNAL_LIMIT ||
        DEFAULT_SIGNAL_LIMIT
    )
  );

  scannerRunning = true;

  console.log(
    `Flow AutoScanner started: interval=${intervalMs}ms, markets=${marketLimit}, signals=${signalLimit}`
  );

  /*
   * Run immediately when the backend starts.
   */
  runOnce({
    marketLimit,
    signalLimit,
  }).catch((error) => {
    console.error(
      "Initial Flow AutoScanner run failed:",
      error.message
    );
  });

  /*
   * Then repeat at the configured interval.
   */
  scannerTimer = setInterval(() => {
    runOnce({
      marketLimit,
      signalLimit,
    }).catch((error) => {
      console.error(
        "Scheduled Flow AutoScanner run failed:",
        error.message
      );
    });
  }, intervalMs);

  if (
    scannerTimer &&
    typeof scannerTimer.unref === "function"
  ) {
    scannerTimer.unref();
  }

  return {
    ok: true,
    started: true,
    intervalMs,
    marketLimit,
    signalLimit,
  };
}

function stop() {
  if (scannerTimer) {
    clearInterval(scannerTimer);
    scannerTimer = null;
  }

  scannerRunning = false;

  console.log("Flow AutoScanner stopped");

  return {
    ok: true,
    stopped: true,
  };
}

function getStatus() {
  return {
    running: scannerRunning,
    scanInProgress,
    intervalActive: Boolean(scannerTimer),
  };
}

module.exports = {
  start,
  stop,
  runOnce,
  getStatus,
};
