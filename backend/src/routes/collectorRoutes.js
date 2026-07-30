const express = require("express");
const collector = require("../services/binanceCollector");

const router = express.Router();

router.post("/binance/sync-markets", async (req, res) => {
  try {
    const result = await collector.syncMarkets();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

router.post("/binance/snapshot", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10);
    const result = await collector.collectMarketSnapshot(limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;