const express = require("express");
const flowSignalEngine = require("../services/alphaSignalEngine");

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const limit = Math.max(
      1,
      Math.min(100, Number(req.query.limit || 10))
    );

    const signals = flowSignalEngine.scanTopCoins(limit);

    res.json({
      ok: true,
      count: signals.length,
      signals,
    });
  } catch (error) {
    console.error("GET /api/signals failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/scan", (req, res) => {
  try {
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number(req.body?.limit || req.query.limit || 10)
      )
    );

    const result = flowSignalEngine.runFlowScan(limit);

    res.json(result);
  } catch (error) {
    console.error("POST /api/signals/scan failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;