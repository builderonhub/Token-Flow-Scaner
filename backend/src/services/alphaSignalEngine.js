const { db } = require("../config/database");

const DEFAULT_SIGNAL_LIMIT = 5;
const DEFAULT_CANDIDATE_POOL = 80;
const TICK_LOOKBACK = 12;

/*
 * Futures includes symbols such as 1000TOKENUSDT while Spot uses TOKENUSDT.
 * Exclude them for now to avoid reporting pairs that cannot be bought directly on Spot.
 */
const FUTURES_ONLY_PREFIXES = [
  "1000",
];

const EXCLUDED_SYMBOLS = new Set([
  "BTCDOMUSDT",
  "DEFIUSDT",
]);

function clamp(value, min = 0, max = 100) {
  return Math.max(
    min,
    Math.min(max, Number(value || 0))
  );
}

function round(value, decimals = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Number(number.toFixed(decimals));
}

function pct(currentValue, previousValue) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);

  if (!current || !previous) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

function average(values) {
  const valid = values
    .map(Number)
    .filter(Number.isFinite);

  if (!valid.length) {
    return 0;
  }

  return (
    valid.reduce((sum, value) => sum + value, 0) /
    valid.length
  );
}

function rankScore(value, values, maxScore) {
  const clean = values
    .map(Number)
    .filter(Number.isFinite);

  if (!clean.length) {
    return 0;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);

  if (max === min) {
    return round(maxScore * 0.5, 2);
  }

  const normalized =
    (Number(value || 0) - min) /
    (max - min);

  return clamp(
    normalized * maxScore,
    0,
    maxScore
  );
}

function tableExists(tableName) {
  const row = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = ?
    LIMIT 1
  `).get(tableName);

  return Boolean(row);
}

/*
 * Use spot_symbols for exact validation when that table exists.
 * Otherwise, fall back to a conservative symbol filter.
 */
function getKnownSpotSymbols() {
  if (!tableExists("spot_symbols")) {
    return null;
  }

  const columns = db
    .prepare("PRAGMA table_info(spot_symbols)")
    .all()
    .map((column) => column.name);

  if (!columns.includes("symbol")) {
    return null;
  }

  let sql = `
    SELECT symbol
    FROM spot_symbols
    WHERE symbol IS NOT NULL
  `;

  if (columns.includes("status")) {
    sql += `
      AND (
        status IS NULL
        OR UPPER(status) IN (
          'TRADING',
          'ACTIVE',
          'ENABLED'
        )
      )
    `;
  }

  const rows = db.prepare(sql).all();

  return new Set(
    rows.map((row) =>
      String(row.symbol || "").toUpperCase()
    )
  );
}

function isSpotEligibleSymbol(symbol, knownSpotSymbols) {
  const normalized = String(symbol || "").toUpperCase();

  if (!normalized.endsWith("USDT")) {
    return false;
  }

  if (EXCLUDED_SYMBOLS.has(normalized)) {
    return false;
  }

  if (
    FUTURES_ONLY_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix)
    )
  ) {
    return false;
  }

  if (knownSpotSymbols instanceof Set) {
    return knownSpotSymbols.has(normalized);
  }

  return true;
}

function getLatestTicks(symbol, limit = TICK_LOOKBACK) {
  return db.prepare(`
    SELECT *
    FROM market_ticks
    WHERE exchange = 'BINANCE'
      AND symbol = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(symbol, limit);
}

function getCandidateMarkets(limit = DEFAULT_CANDIDATE_POOL) {
  return db.prepare(`
    SELECT latest_tick.*
    FROM market_ticks latest_tick

    JOIN (
      SELECT
        symbol,
        MAX(id) AS latest_id
      FROM market_ticks
      WHERE exchange = 'BINANCE'
      GROUP BY symbol
    ) latest
      ON latest.latest_id = latest_tick.id

    WHERE latest_tick.exchange = 'BINANCE'
      AND latest_tick.symbol LIKE '%USDT'

    ORDER BY latest_tick.quote_volume DESC
    LIMIT ?
  `).all(limit);
}

function calculateTickVolatility(orderedTicks) {
  const changes = [];

  for (
    let index = 1;
    index < orderedTicks.length;
    index++
  ) {
    const previousPrice = Number(
      orderedTicks[index - 1].price || 0
    );

    const currentPrice = Number(
      orderedTicks[index].price || 0
    );

    if (previousPrice > 0 && currentPrice > 0) {
      changes.push(
        Math.abs(pct(currentPrice, previousPrice))
      );
    }
  }

  return average(changes);
}

function buildCoinMetrics(symbol, btcChange = 0) {
  const ticks = getLatestTicks(
    symbol,
    TICK_LOOKBACK
  );

  if (ticks.length < 6) {
    return null;
  }

  const now = ticks[0];
  const previous = ticks[ticks.length - 1];
  const orderedTicks = [...ticks].reverse();

  const currentPrice = Number(now.price || 0);

  if (currentPrice <= 0) {
    return null;
  }

  let upTicks = 0;
  let downTicks = 0;

  const priceChanges = [];
  const volumeChanges = [];
  const oiChanges = [];

  for (
    let index = 1;
    index < orderedTicks.length;
    index++
  ) {
    const before = orderedTicks[index - 1];
    const after = orderedTicks[index];

    const beforePrice = Number(before.price || 0);
    const afterPrice = Number(after.price || 0);

    if (afterPrice > beforePrice) {
      upTicks++;
    } else if (afterPrice < beforePrice) {
      downTicks++;
    }

    priceChanges.push(
      pct(after.price, before.price)
    );

    volumeChanges.push(
      pct(
        after.quote_volume,
        before.quote_volume
      )
    );

    oiChanges.push(
      pct(
        after.open_interest,
        before.open_interest
      )
    );
  }

  const prices = ticks
    .map((tick) => Number(tick.price || 0))
    .filter(
      (price) =>
        Number.isFinite(price) && price > 0
    );

  const recentHigh = Math.max(...prices);
  const recentLow = Math.min(...prices);

  const pullbackFromHigh =
    recentHigh > 0
      ? pct(currentPrice, recentHigh)
      : 0;

  const reboundFromLow =
    recentLow > 0
      ? pct(currentPrice, recentLow)
      : 0;

  const shortPriceChange = pct(
    now.price,
    previous.price
  );

  const volumeChange = pct(
    now.quote_volume,
    previous.quote_volume
  );

  const oiChange = pct(
    now.open_interest,
    previous.open_interest
  );

  const recentPriceMomentum = average(
    priceChanges.slice(-4)
  );

  const recentVolumeMomentum = average(
    volumeChanges.slice(-4)
  );

  const recentOiMomentum = average(
    oiChanges.slice(-4)
  );

  const dayChange = Number(
    now.price_change_percent || 0
  );

  const relativeStrength =
    dayChange - Number(btcChange || 0);

  const fundingRate = Number(
    now.funding_rate || 0
  );

  const absFunding = Math.abs(fundingRate);

  const quoteVolume = Number(
    now.quote_volume || 0
  );

  const openInterest = Number(
    now.open_interest || 0
  );

  const volatilityPct =
    calculateTickVolatility(orderedTicks);

  /*
   * Money Flow favors acceleration in volume, price, and OI.
   * Absolute volume is used only as liquidity confirmation.
   */
  const liquidityStrength =
    Math.log10(Math.max(quoteVolume, 1));

  const moneyFlowStrength =
    Math.max(0, volumeChange) * 0.35 +
    Math.max(0, recentVolumeMomentum) * 0.45 +
    Math.max(0, shortPriceChange) * 1.6 +
    Math.max(0, oiChange) * 0.9 +
    liquidityStrength * 0.35;

  const momentumStrength =
    Math.max(0, recentPriceMomentum) * 4 +
    Math.max(0, shortPriceChange) * 1.5 +
    Math.max(0, upTicks - downTicks) * 1.5;

  const oiStrength =
    Math.max(0, oiChange) * 2.5 +
    Math.max(0, recentOiMomentum) * 3;

  /*
   * A healthy pullback is roughly 0.3% to 4% below the recent high.
   * Avoid assets that have just surged vertically or are falling sharply.
   */
  let pullbackStrength = 0;

  if (
    pullbackFromHigh <= -0.3 &&
    pullbackFromHigh >= -4
  ) {
    pullbackStrength = 1;
  } else if (
    pullbackFromHigh > -0.3 &&
    dayChange < 12
  ) {
    pullbackStrength = 0.7;
  } else if (
    pullbackFromHigh < -4 &&
    reboundFromLow > 0
  ) {
    pullbackStrength = 0.45;
  } else {
    pullbackStrength = 0.15;
  }

  return {
    exchange: "BINANCE",
    symbol,

    price: currentPrice,
    quoteVolume,
    openInterest,
    fundingRate,
    absFunding,

    shortPriceChange,
    recentPriceMomentum,

    volumeChange,
    recentVolumeMomentum,

    oiChange,
    recentOiMomentum,

    dayChange,
    btcChange: Number(btcChange || 0),
    relativeStrength,

    upTicks,
    downTicks,

    recentHigh,
    recentLow,
    pullbackFromHigh,
    reboundFromLow,

    volatilityPct,

    rawStrength: {
      moneyFlow: moneyFlowStrength,
      momentum: momentumStrength,
      oi: oiStrength,
      relativeStrength,
      pullback: pullbackStrength,
      liquidity: liquidityStrength,
    },
  };
}

function calculateTradeLevels(metric) {
  const entry = metric.price;

  /*
   * The entry zone adapts to volatility within reasonable bounds.
   */
  const entryZonePercent = clamp(
    metric.volatilityPct * 1.25,
    0.35,
    1.25
  );

  /*
   * TP and SL levels adapt to observed volatility.
   * Targets are not fixed to TP10, TP20, and SL5 for every token.
   */
  const target1Percent = clamp(
    6 + metric.volatilityPct * 4,
    7,
    14
  );

  const target2Percent = clamp(
    12 + metric.volatilityPct * 7,
    14,
    26
  );

  const stopLossPercent = clamp(
    3.5 + metric.volatilityPct * 2,
    4,
    8
  );

  return {
    entry,

    entryLow:
      entry * (1 - entryZonePercent / 100),

    entryHigh:
      entry * (1 + entryZonePercent / 100),

    target10:
      entry * (1 + target1Percent / 100),

    target20:
      entry * (1 + target2Percent / 100),

    stopLoss:
      entry * (1 - stopLossPercent / 100),

    entryZonePercent,
    target1Percent,
    target2Percent,
    stopLossPercent,

    rr10:
      target1Percent / stopLossPercent,

    rr20:
      target2Percent / stopLossPercent,
  };
}

function calculateSignalFromMetrics(metric) {
  const shortMove = Number(metric.shortPriceChange || 0);
  const volumeChange = Number(metric.volumeChange || 0);
  const oiChange = Number(metric.oiChange || 0);
  const relativeStrength = Number(metric.relativeStrength || 0);
  const pullback = Number(metric.pullbackFromHigh || 0);
  const fundingRate = Number(metric.fundingRate || 0);
  const absFunding = Math.abs(fundingRate);

  const upTicks = Number(metric.upTicks || 0);
  const downTicks = Number(metric.downTicks || 0);
  const tickBalance = upTicks - downTicks;
  const totalDirectionalTicks = upTicks + downTicks;

  /*
   * 1. MONEY FLOW - 0 to 30
   *
   * Do not score based only on high total volume.
   * Score whether volume is increasing together with price.
   */
  let moneyFlowScore = 0;

  if (volumeChange >= 0.2) moneyFlowScore += 3;
  if (volumeChange >= 0.5) moneyFlowScore += 3;
  if (volumeChange >= 1) moneyFlowScore += 4;
  if (volumeChange >= 2) moneyFlowScore += 5;
  if (volumeChange >= 5) moneyFlowScore += 5;
  if (volumeChange >= 10) moneyFlowScore += 4;

  if (shortMove > 0) moneyFlowScore += 2;
  if (shortMove >= 0.15) moneyFlowScore += 2;
  if (shortMove >= 0.4) moneyFlowScore += 2;

  /*
   * Rising volume with falling price may indicate distribution.
   */
  if (volumeChange > 2 && shortMove < -0.15) {
    moneyFlowScore -= 8;
  }

  if (volumeChange <= 0) {
    moneyFlowScore -= 4;
  }

  moneyFlowScore = clamp(moneyFlowScore, 0, 30);

  /*
   * 2. MOMENTUM - 0 to 20
   *
   * Favor newly forming momentum.
   * Avoid assets that have already moved too far.
   */
  let momentumScore = 0;

  if (shortMove > 0) momentumScore += 3;
  if (shortMove >= 0.08) momentumScore += 3;
  if (shortMove >= 0.2) momentumScore += 4;
  if (shortMove >= 0.5) momentumScore += 3;

  if (tickBalance >= 1) momentumScore += 2;
  if (tickBalance >= 3) momentumScore += 3;
  if (tickBalance >= 5) momentumScore += 2;

  /*
   * Excessive momentum over a few minutes often indicates chasing.
   */
  if (shortMove >= 2) momentumScore -= 4;
  if (shortMove >= 4) momentumScore -= 6;

  if (shortMove < 0) momentumScore -= 5;
  if (tickBalance < 0) momentumScore -= 3;

  momentumScore = clamp(momentumScore, 0, 20);

  /*
   * 3. OPEN INTEREST - 0 to 18
   *
   * Rising OI confirms new positions entering the market.
   */
  let oiScore = 0;

  if (oiChange > 0) oiScore += 3;
  if (oiChange >= 0.05) oiScore += 3;
  if (oiChange >= 0.15) oiScore += 3;
  if (oiChange >= 0.3) oiScore += 3;
  if (oiChange >= 0.7) oiScore += 3;
  if (oiChange >= 1.5) oiScore += 3;

  /*
   * Rising price with falling OI may only be short covering.
   */
  if (shortMove > 0.2 && oiChange < -0.05) {
    oiScore = Math.min(oiScore, 3);
  }

  if (oiChange < -0.2) {
    oiScore = 0;
  }

  oiScore = clamp(oiScore, 0, 18);

  /*
   * 4. FUNDING - 0 to 12
   *
   * Slightly negative or near-zero funding is favorable.
   * Excessively positive funding indicates a crowded long market.
   */
  let fundingScore = 0;

  if (fundingRate >= -0.0003 && fundingRate <= 0.00005) {
    fundingScore = 12;
  } else if (
    fundingRate > 0.00005 &&
    fundingRate <= 0.00015
  ) {
    fundingScore = 10;
  } else if (
    fundingRate > 0.00015 &&
    fundingRate <= 0.0003
  ) {
    fundingScore = 7;
  } else if (
    fundingRate < -0.0003 &&
    fundingRate >= -0.0008
  ) {
    fundingScore = 7;
  } else if (absFunding <= 0.0006) {
    fundingScore = 4;
  } else {
    fundingScore = 0;
  }

  /*
   * 5. RELATIVE STRENGTH - 0 to 12
   */
  let relativeStrengthScore = 0;

  if (relativeStrength >= -0.3) relativeStrengthScore += 2;
  if (relativeStrength >= 0) relativeStrengthScore += 2;
  if (relativeStrength >= 0.5) relativeStrengthScore += 3;
  if (relativeStrength >= 1.5) relativeStrengthScore += 3;
  if (relativeStrength >= 3) relativeStrengthScore += 2;

  if (relativeStrength < -1) {
    relativeStrengthScore = Math.min(
      relativeStrengthScore,
      2
    );
  }

  relativeStrengthScore = clamp(
    relativeStrengthScore,
    0,
    12
  );

  /*
   * 6. ENTRY / PULLBACK - 0 to 8
   *
   * pullback = 0 means price is near its short-term high.
   * Roughly -0.2% to -2.5% is usually a reasonable entry range.
   */
  let pullbackScore = 0;

  if (pullback <= -0.15 && pullback >= -0.5) {
    pullbackScore = 6;
  } else if (pullback < -0.5 && pullback >= -1.5) {
    pullbackScore = 8;
  } else if (pullback < -1.5 && pullback >= -3) {
    pullbackScore = 6;
  } else if (pullback > -0.15 && shortMove <= 0.5) {
    pullbackScore = 4;
  } else if (pullback < -3 && pullback >= -5) {
    pullbackScore = 3;
  } else {
    pullbackScore = 1;
  }

  /*
   * Absolute quality score.
   */
  let score =
    moneyFlowScore +
    momentumScore +
    oiScore +
    fundingScore +
    relativeStrengthScore +
    pullbackScore;

  /*
   * Cross-confirmation bonus.
   */
  if (
    volumeChange > 1 &&
    shortMove > 0 &&
    oiChange > 0
  ) {
    score += 5;
  }

  if (
    moneyFlowScore >= 18 &&
    momentumScore >= 10 &&
    oiScore >= 8
  ) {
    score += 4;
  }

  if (
    relativeStrength > 0 &&
    fundingScore >= 7 &&
    pullbackScore >= 4
  ) {
    score += 3;
  }

  /*
   * Risk penalty.
   */
  if (volumeChange > 3 && shortMove < 0) {
    score -= 10;
  }

  if (shortMove > 1.5 && pullback > -0.2) {
    score -= 8;
  }

  if (relativeStrength < -2) {
    score -= 8;
  }

  if (oiChange < -0.3) {
    score -= 8;
  }

  if (fundingScore === 0) {
    score -= 6;
  }

  score = clamp(score, 0, 100);

  /*
   * Hard confirmation.
   *
   * BUY requires market flow, momentum, and OI confirmation.
   * BUY_ZONE may be newly forming, but cannot be weak across all dimensions.
   */
  const hasMoneyFlow =
    volumeChange > 0.3 &&
    moneyFlowScore >= 10;

  const hasMomentum =
    shortMove > 0 &&
    momentumScore >= 7 &&
    tickBalance >= 0;

  const hasOiConfirmation =
    oiChange > 0.03 &&
    oiScore >= 6;

  const healthyFunding = fundingScore >= 7;

  const healthyRelativeStrength =
    relativeStrength >= -0.5;

  const notOverextended =
    shortMove < 2.5 &&
    metric.dayChange < 25;

  const buyConfirmed =
    score >= 66 &&
    hasMoneyFlow &&
    hasMomentum &&
    hasOiConfirmation &&
    healthyFunding &&
    healthyRelativeStrength &&
    notOverextended;

  const buyZoneConfirmed =
    score >= 52 &&
    moneyFlowScore >= 9 &&
    momentumScore >= 5 &&
    oiScore >= 3 &&
    fundingScore >= 4 &&
    relativeStrength >= -1.2 &&
    notOverextended;

  let action = "WAIT";

  if (buyConfirmed) {
    action = "BUY";
  } else if (buyZoneConfirmed) {
    action = "BUY_ZONE";
  } else if (
    score < 28 ||
    relativeStrength < -4 ||
    fundingScore === 0 ||
    (volumeChange < 0 && shortMove < 0)
  ) {
    action = "AVOID";
  }

  /*
   * Short-term volatility from 12 ticks.
   */
  const tickPrices = Array.isArray(metric.ticks)
    ? [...metric.ticks]
        .reverse()
        .map((tick) => Number(tick.price || 0))
        .filter((price) => Number.isFinite(price) && price > 0)
    : [];

  const tickReturns = [];

  for (let index = 1; index < tickPrices.length; index++) {
    const before = tickPrices[index - 1];
    const after = tickPrices[index];

    if (!before || !after) continue;

    tickReturns.push(
      Math.abs(((after - before) / before) * 100)
    );
  }

  const averageTickMove = tickReturns.length
    ? tickReturns.reduce((sum, value) => sum + value, 0) /
      tickReturns.length
    : 0.25;

  const volatilityPercent = clamp(
    averageTickMove * 3,
    0.6,
    4
  );

  /*
   * Dynamic entry zone.
   *
   * BUY: entry may be near the current price.
   * BUY_ZONE: wait for a minor pullback.
   */
  const entry = metric.price;

  const entryDiscount =
    action === "BUY"
      ? volatilityPercent * 0.15
      : volatilityPercent * 0.45;

  const entryZoneWidth = clamp(
    volatilityPercent * 0.35,
    0.25,
    1.5
  );

  const entryCenter =
    entry * (1 - entryDiscount / 100);

  const entryLow =
    entryCenter * (1 - entryZoneWidth / 200);

  const entryHigh =
    entryCenter * (1 + entryZoneWidth / 200);

  /*
   * TP and SL adapt to volatility and flow strength.
   */
  const stopPercent = clamp(
    volatilityPercent * 1.35,
    1.8,
    6
  );

  const firstTargetPercent = clamp(
    stopPercent * 1.5,
    3,
    10
  );

  const secondTargetPercent = clamp(
    stopPercent * 2.5,
    5,
    18
  );

  const target10 =
    entryCenter * (1 + firstTargetPercent / 100);

  const target20 =
    entryCenter * (1 + secondTargetPercent / 100);

  const stopLoss =
    entryCenter * (1 - stopPercent / 100);

  /*
   * Confidence is high only when the main factors agree.
   */
  const confirmationCount = [
    hasMoneyFlow,
    hasMomentum,
    hasOiConfirmation,
    healthyFunding,
    healthyRelativeStrength,
    pullbackScore >= 4,
  ].filter(Boolean).length;

  let confidence =
    score * 0.72 +
    confirmationCount * 4;

  if (action === "BUY") confidence += 5;
  if (action === "WAIT") confidence -= 8;
  if (action === "AVOID") confidence -= 15;

  confidence = clamp(confidence, 20, 95);

  const breakdown = {
    moneyFlow: {
      score: round(moneyFlowScore, 2),
      max: 30,
      quoteVolume: round(metric.quoteVolume, 2),
      volumeChange: round(volumeChange, 3),
      priceChange: round(shortMove, 3),
      reason:
        moneyFlowScore >= 20
          ? "Strong Money Flow: volume and price are rising together"
          : moneyFlowScore >= 10
          ? "Money Flow is forming"
          : volumeChange > 0 && shortMove < 0
          ? "Volume is rising while price falls: possible distribution"
          : "Money Flow is not strong enough",
    },

    momentum: {
      score: round(momentumScore, 2),
      max: 20,
      priceChange: round(shortMove, 3),
      upTicks,
      downTicks,
      reason:
        momentumScore >= 14
          ? "Clear momentum growth confirmed by multiple ticks"
          : momentumScore >= 7
          ? "Momentum is newly forming"
          : shortMove > 1.5
          ? "Momentum is overheated: avoid chasing"
          : "Momentum is weak",
    },

    openInterest: {
      score: round(oiScore, 2),
      max: 18,
      openInterest: round(metric.openInterest, 2),
      oiChange: round(oiChange, 3),
      reason:
        oiScore >= 12
          ? "Strong OI growth confirms new capital"
          : oiScore >= 6
          ? "OI is rising"
          : shortMove > 0 && oiChange < 0
          ? "Price is rising while OI falls: possible short covering"
          : "OI is not confirmed",
    },

    funding: {
      score: round(fundingScore, 2),
      max: 12,
      fundingRate,
      reason:
        fundingScore >= 10
          ? "Healthy funding: the market is not crowded long"
          : fundingScore >= 7
          ? "Funding is acceptable"
          : fundingScore >= 4
          ? "Funding is slightly overheated"
          : "Funding is excessive or abnormal",
    },

    relativeStrength: {
      score: round(relativeStrengthScore, 2),
      max: 12,
      dayChange: round(metric.dayChange, 3),
      btcChange: round(metric.btcChange, 3),
      relativeStrength: round(relativeStrength, 3),
      reason:
        relativeStrength >= 1.5
          ? "Strong Relative Strength: outperforming BTC"
          : relativeStrength >= 0
          ? "Positive Relative Strength"
          : relativeStrength >= -1
          ? "Neutral Relative Strength"
          : "Weak Relative Strength",
    },

    pullback: {
      score: round(pullbackScore, 2),
      max: 8,
      recentHigh: round(metric.recentHigh, 8),
      pullbackFromHigh: round(pullback, 3),
      volatilityPercent: round(volatilityPercent, 3),
      reason:
        pullbackScore >= 7
          ? "Good entry: sufficient pullback"
          : pullbackScore >= 4
          ? "Entry is acceptable"
          : pullback > -0.2 && shortMove > 1
          ? "Near the short-term high: elevated FOMO risk"
          : "Entry is not attractive",
    },
  };

  const reasons = [
    breakdown.moneyFlow.reason,
    breakdown.openInterest.reason,
    breakdown.funding.reason,
    breakdown.momentum.reason,
    breakdown.relativeStrength.reason,
    breakdown.pullback.reason,
  ];

  return {
    exchange: "BINANCE",
    symbol: metric.symbol,
    direction: "LONG",
    confirmationCount,
    action,
    signal: action,

    score: round(score, 2),
    flowScore: round(score, 2),

    entry: round(entryCenter, 8),
    entryLow: round(entryLow, 8),
    entryHigh: round(entryHigh, 8),

    target10: round(target10, 8),
    target20: round(target20, 8),
    stopLoss: round(stopLoss, 8),

    riskPercent: round(stopPercent, 2),
    reward10Percent: round(firstTargetPercent, 2),
    reward20Percent: round(secondTargetPercent, 2),

    rr10: round(firstTargetPercent / stopPercent, 2),
    rr20: round(secondTargetPercent / stopPercent, 2),

    confidence: round(confidence, 2),

    dayChange: round(metric.dayChange, 3),
    shortPriceChange: round(shortMove, 3),
    relativeStrength: round(relativeStrength, 3),

    volumeChange: round(volumeChange, 3),
    oiChange: round(oiChange, 3),

    quoteVolume: round(metric.quoteVolume, 2),
    fundingRate,

    pattern: action,

    reason: reasons.join(" | "),

    breakdown,

    raw: {
      breakdown,
      reasons,
      price: metric.price,
      flowScore: round(score, 2),
      confirmationCount,
      volatilityPercent: round(volatilityPercent, 3),
      mode: "FLOW_INTELLIGENCE_ABSOLUTE",
      createdAt: new Date().toISOString(),
    },
  };
}

function scanTopCoins(
  limit = DEFAULT_SIGNAL_LIMIT
) {
  const safeLimit = clamp(
    Number(limit || DEFAULT_SIGNAL_LIMIT),
    1,
    20
  );

  const candidatePoolSize = Math.max(
    DEFAULT_CANDIDATE_POOL,
    safeLimit * 12
  );

  const knownSpotSymbols =
    getKnownSpotSymbols();

  const candidates = getCandidateMarkets(
    candidatePoolSize
  ).filter((row) =>
    isSpotEligibleSymbol(
      row.symbol,
      knownSpotSymbols
    )
  );

  const btcRow = candidates.find(
    (row) => row.symbol === "BTCUSDT"
  );

  const btcChange = btcRow
    ? Number(
        btcRow.price_change_percent || 0
      )
    : 0;

  const universe = candidates
    .map((row) =>
      buildCoinMetrics(
        row.symbol,
        btcChange
      )
    )
    .filter(Boolean);

  const calculated = universe.map((metric) =>
    calculateSignalFromMetrics(
      metric,
      universe
    )
  );

  /*
   * Debug the top 20 signals before filtering.
   */
  

  /*
   * The dashboard only receives assets that are viable Spot candidates.
   * Exclude WAIT and AVOID from the Top 5.
   */
  const actionable = calculated.filter(
    (signal) =>
      signal.action === "BUY" ||
      signal.action === "BUY_ZONE"
  );

  actionable.sort((a, b) => {
    const actionPriority = {
      BUY: 2,
      BUY_ZONE: 1,
    };

    const actionDifference =
      actionPriority[b.action] -
      actionPriority[a.action];

    if (actionDifference !== 0) {
      return actionDifference;
    }

    return (
      b.flowScore - a.flowScore ||
      Number(b.confirmationCount || 0) -
        Number(a.confirmationCount || 0) ||
      b.quoteVolume - a.quoteVolume
    );
  });

  return actionable.slice(0, safeLimit);
}


function saveSignals(signals) {
  const insertSignal = db.prepare(`
    INSERT INTO signals (
      exchange,
      symbol,
      direction,
      signal_score,
      pattern_name,
      entry_price,
      volume_change,
      oi_change,
      funding_rate,
      reason,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const findRecentOpenSignal = db.prepare(`
    SELECT id
    FROM signals
    WHERE symbol = ?
      AND status = 'OPEN'
      AND created_at >= datetime(
        'now',
        '-1 hour'
      )
    LIMIT 1
  `);

  let inserted = 0;

  const saveTransaction = db.transaction(
    (items) => {
      for (const signal of items) {
        if (
          signal.action !== "BUY" &&
          signal.action !== "BUY_ZONE"
        ) {
          continue;
        }

        const existing =
          findRecentOpenSignal.get(
            signal.symbol
          );

        if (existing) {
          continue;
        }

        insertSignal.run(
          signal.exchange,
          signal.symbol,
          signal.direction,
          signal.flowScore,
          signal.action,
          signal.entry,
          signal.volumeChange,
          signal.oiChange,
          signal.fundingRate,
          signal.reason,
          "OPEN"
        );

        inserted++;
      }
    }
  );

  saveTransaction(
    Array.isArray(signals)
      ? signals
      : []
  );

  return inserted;
}

function writeFlowScanEvent(inserted, signals = []) {
  const safeSignals = Array.isArray(signals)
    ? signals
    : [];

  db.prepare(`
    INSERT INTO bot_events (
      level,
      type,
      message,
      raw_json
    )
    VALUES (?, ?, ?, ?)
  `).run(
    "INFO",
    "FLOW_SCAN",
    `Flow scan completed. Actionable signals: ${safeSignals.length}. New signals: ${Number(inserted || 0)}`,
    JSON.stringify({
      inserted: Number(inserted || 0),
      count: safeSignals.length,
      top: safeSignals.slice(0, 5),
    })
  );
}

function runFlowScan(limit = DEFAULT_SIGNAL_LIMIT) {
  const signals = scanTopCoins(limit);

  const safeSignals = Array.isArray(signals)
    ? signals
    : [];

  const inserted = saveSignals(safeSignals);

  writeFlowScanEvent(
    inserted,
    safeSignals
  );

  return {
    ok: true,
    inserted,
    count: safeSignals.length,
    signals: safeSignals,
  };
}

module.exports = {
  runFlowScan,
  scanTopCoins,
};
