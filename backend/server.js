const express = require("express");
const cors = require("cors");

const env = require("./src/config/env");
const { initSchema } = require("./src/db/schema");

const signalRoutes = require("./src/routes/signalRoutes");
const healthRoutes = require("./src/routes/healthRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const collectorRoutes = require("./src/routes/collectorRoutes");

const autoScannerLoop = require("./src/services/autoScannerLoop");

initSchema();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/collector", collectorRoutes);
app.use("/api/signals", signalRoutes);

app.listen(env.port, () => {
  console.log(
    `Flow Intelligence Scanner backend running on port ${env.port}`
  );

  if (env.enableAutoScanner) {
    autoScannerLoop.start({
      intervalMs: env.autoScannerIntervalMs,
      marketLimit: env.autoScannerMarketLimit,
      signalLimit: env.autoScannerSignalLimit,
    });
  } else {
    console.log("Flow AutoScanner is disabled (ENABLE_AUTO_SCANNER=false)");
  }
});
