require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  dbPath: process.env.DB_PATH || "./data/alpha-flow-scanner.db",

  binanceRest: process.env.BINANCE_FUTURES_REST || "https://fapi.binance.com",
  binanceWs: process.env.BINANCE_FUTURES_WS || "wss://fstream.binance.com/ws",

  defaultExchange: process.env.DEFAULT_EXCHANGE || "BINANCE",
  enableCollector: process.env.ENABLE_COLLECTOR === "true",

  enableAutoScanner: process.env.ENABLE_AUTO_SCANNER === "true",
  autoScannerIntervalMs: Number(process.env.AUTO_SCANNER_INTERVAL_MS || 30000),
  autoScannerMarketLimit: Number(process.env.AUTO_SCANNER_MARKET_LIMIT || 80),
  autoScannerSignalLimit: Number(process.env.AUTO_SCANNER_SIGNAL_LIMIT || 5),
};

