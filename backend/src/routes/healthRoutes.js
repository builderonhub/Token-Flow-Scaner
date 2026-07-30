const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "alpha-flow-scanner",
    status: "running",
    time: new Date().toISOString(),
  });
});

module.exports = router;