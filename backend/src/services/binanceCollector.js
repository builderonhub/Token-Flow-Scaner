const { db } = require("../config/database");
const binance = require("./binanceFuturesClient");

function logEvent(type, message, raw = null, level = "INFO") {
  db.prepare(`
    INSERT INTO bot_events (level, type, message, raw_json)
    VALUES (?, ?, ?, ?)
  `).run(level, type, message, raw ? JSON.stringify(raw) : null);
}

async function syncMarkets() {
  const info = await binance.getExchangeInfo();

  const symbols = info.symbols.filter((s) => {
    return (
      s.contractType === "PERPETUAL" &&
      s.quoteAsset === "USDT" &&
      s.status === "TRADING"
    );
  });

  const stmt = db.prepare(`
    INSERT INTO markets (
      exchange, symbol, base_asset, quote_asset, status, is_watchlisted, updated_at
    )
    VALUES (?, ?, ?, ?, 'ACTIVE', 1, CURRENT_TIMESTAMP)
    ON CONFLICT(exchange, symbol) DO UPDATE SET
      base_asset = excluded.base_asset,
      quote_asset = excluded.quote_asset,
      status = 'ACTIVE',
      updated_at = CURRENT_TIMESTAMP
  `);

  const tx = db.transaction((rows) => {
    for (const s of rows) {
      stmt.run("BINANCE", s.symbol, s.baseAsset, s.quoteAsset);
    }
  });

  tx(symbols);

  logEvent("MARKET_SYNC", `Synced ${symbols.length} Binance Futures markets`);

  return {
    ok: true,
    count: symbols.length,
  };
}

async function collectMarketSnapshot(limit = 100) {
  const tickers = await binance.get24hTickers();
  const premiumList = await binance.getPremiumIndex();

  const fundingMap = new Map();

  for (const item of premiumList) {
    fundingMap.set(item.symbol, Number(item.lastFundingRate || 0));
  }

    const marketRows = db.prepare(`
    SELECT symbol
    FROM markets
    WHERE exchange = 'BINANCE'
        AND status = 'ACTIVE'
        AND is_watchlisted = 1
    `).all();

    const activeSet = new Set(marketRows.map((m) => m.symbol));

    const selectedTickers = tickers
    .filter((t) => activeSet.has(t.symbol))
    .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0))
    .slice(0, limit);

  const insertTick = db.prepare(`
    INSERT INTO market_ticks (
      exchange,
      symbol,
      price,
      price_change_percent,
      volume,
      quote_volume,
      open_interest,
      funding_rate,
      event_time
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;

  for (const t of selectedTickers) {
    let openInterest = 0;

    try {
      const oi = await binance.getOpenInterest(t.symbol);
      openInterest = Number(oi.openInterest || 0);
    } catch (err) {
      logEvent(
        "OPEN_INTEREST_FAILED",
        `Failed to fetch OI for ${t.symbol}: ${err.message}`,
        { symbol: t.symbol },
        "WARN"
      );
    }

    insertTick.run(
      "BINANCE",
      t.symbol,
      Number(t.lastPrice || 0),
      Number(t.priceChangePercent || 0),
      Number(t.volume || 0),
      Number(t.quoteVolume || 0),
      openInterest,
      Number(fundingMap.get(t.symbol) || 0),
      Number(t.closeTime || Date.now())
    );

    inserted++;
  }

  logEvent("MARKET_SNAPSHOT", `Inserted ${inserted} Binance market ticks`);

  return {
    ok: true,
    inserted,
  };
}

module.exports = {
  syncMarkets,
  collectMarketSnapshot,
};