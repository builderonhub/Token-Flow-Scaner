import "./style.css";

const app = document.querySelector("#app");

document.head.insertAdjacentHTML(
  "beforeend",
  `
    <style>
      .section-gap {
        margin-bottom: 18px;
      }

      .opportunity-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));

        @media (max-width: 1400px) {
          .opportunity-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

      .opportunity-card {
        min-width: 0;
        border: 1px solid #1d2636;
        border-radius: 14px;
        padding: 16px;
        background: #0c111b;
      }

      .opportunity-card.opportunity-buy {
        border-color: rgba(85, 217, 139, 0.35);
        background:
          linear-gradient(
            180deg,
            rgba(85, 217, 139, 0.08),
            rgba(12, 17, 27, 0.96)
          );
      }

      .opportunity-card.opportunity-zone {
        border-color: rgba(79, 140, 255, 0.35);
        background:
          linear-gradient(
            180deg,
            rgba(79, 140, 255, 0.08),
            rgba(12, 17, 27, 0.96)
          );
      }

      .opportunity-card.opportunity-wait {
        border-color: rgba(246, 200, 95, 0.25);
      }

      .opportunity-card.opportunity-avoid {
        border-color: rgba(255, 107, 122, 0.25);
        opacity: 0.8;
      }

      .opportunity-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .opportunity-symbol {
        display: block;
        margin-bottom: 4px;
        color: #f4f7fb;
        font-size: 20px;
        font-weight: 800;
      }

      .opportunity-pattern {
        color: #758096;
        font-size: 10px;
        line-height: 1.4;
      }

      .signal-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 74px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.05em;
      }

      .signal-buy {
        color: #55d98b;
        background: rgba(85, 217, 139, 0.12);
      }

      .signal-buy-zone {
        color: #7eabff;
        background: rgba(44, 109, 255, 0.14);
      }

      .signal-wait {
        color: #f6c85f;
        background: rgba(246, 200, 95, 0.12);
      }

      .signal-avoid {
        color: #ff6b7a;
        background: rgba(255, 107, 122, 0.12);
      }

      .price-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 14px;
      }

      .price-box {
        min-width: 0;
        border: 1px solid #18202e;
        border-radius: 10px;
        padding: 10px;
        background: rgba(8, 11, 18, 0.65);
      }

      .price-box span {
        display: block;
        margin-bottom: 5px;
        color: #758096;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .price-box strong {
        display: block;
        overflow: hidden;
        color: #f4f7fb;
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .price-box.positive strong {
        color: #55d98b;
      }

      .price-box.negative strong {
        color: #ff6b7a;
      }

      .opportunity-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 13px;
      }

      .opportunity-meta div {
        min-width: 0;
      }

      .opportunity-meta span {
        display: block;
        margin-bottom: 3px;
        color: #758096;
        font-size: 9px;
        text-transform: uppercase;
      }

      .opportunity-meta strong {
        display: block;
        overflow: hidden;
        color: #d8deea;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .opportunity-reason {
        margin: 0;
        color: #8993a6;
        font-size: 11px;
        line-height: 1.55;
      }

      .opportunity-time {
        display: block;
        margin-top: 12px;
        color: #5f6879;
        font-size: 10px;
      }

 

      .signal-symbol-cell strong,
      .signal-symbol-cell span {
        display: block;
      }

      .signal-symbol-cell strong {
        color: #f4f7fb;
        font-size: 13px;
      }

      .signal-symbol-cell span {
        margin-top: 4px;
        color: #758096;
        font-size: 10px;
      }

      .reason-cell {
        width: auto;
        min-width: 0;
        white-space: normal;
      }

      .reason-text {
        max-width: none;
        color: #8993a6;
        font-size: 11px;
        line-height: 1.5;
        overflow-wrap: anywhere;
        white-space: normal;
      }

      .roi-positive {
        color: #55d98b;
      }

      .roi-negative {
        color: #ff6b7a;
      }

      .status-open,
      .status-pending,
      .status-closed,
      .outcome-win,
      .outcome-loss,
      .outcome-flat {
        display: inline-flex;
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 9px;
        font-weight: 800;
      }

      .status-open,
      .status-pending {
        color: #f6c85f;
        background: rgba(246, 200, 95, 0.12);
      }

      .status-closed {
        color: #aab2c2;
        background: rgba(170, 178, 194, 0.1);
      }

      .outcome-win {
        color: #55d98b;
        background: rgba(85, 217, 139, 0.12);
      }

      .outcome-loss {
        color: #ff6b7a;
        background: rgba(255, 107, 122, 0.12);
      }

      .outcome-flat {
        color: #f6c85f;
        background: rgba(246, 200, 95, 0.12);
      }

      .empty-opportunities {
        grid-column: 1 / -1;
        padding: 50px 20px;
        color: #778196;
        text-align: center;
      }

      @media (max-width: 1100px) {
        .opportunity-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      
      }

      @media (max-width: 720px) {
        .opportunity-grid {
          grid-template-columns: 1fr;
        }

      }
    </style>
  `,
);

app.innerHTML = `
  <main class="dashboard">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Binance Futures Flow Intelligence</p>
        <h1>Flow Intelligence Scanner</h1>
        <p class="subtitle">
          Realtime futures flow signals for Spot trading support
        </p>
      </div>

      <div class="header-actions">
        <span id="connectionStatus" class="status status-loading">
          Loading
        </span>

        <button id="refreshButton" class="refresh-button" type="button">
          Refresh
        </button>
      </div>
    </header>

    <section class="summary-grid">
      <article class="summary-card">
        <span class="summary-label">Signals Today</span>
        <strong id="signalsToday">0</strong>
      </article>

      <article class="summary-card">
        <span class="summary-label">Open Signals</span>
        <strong id="openSignals">0</strong>
      </article>

      <article class="summary-card">
        <span class="summary-label">Win Rate</span>
        <strong id="winRate">0.00%</strong>
      </article>

      <article class="summary-card">
        <span class="summary-label">Best Pattern</span>
        <strong id="bestPattern">-</strong>
      </article>
    </section>

    <section class="panel section-gap">
      <div class="panel-header">
        <div>
        <h2>Top 5 Spot Signals</h2>
        <p>Top 5 LONG signals for Spot trading support</p>
        </div>

        <span id="scanUpdatedAt" class="last-updated">
          Not updated
        </span>
      </div>

      <div id="errorBox" class="error-box hidden"></div>

      <div id="opportunityGrid" class="opportunity-grid">
        <div class="empty-opportunities">
          Loading realtime opportunities...
        </div>
      </div>

      
    </section>

    <section class="panel section-gap">
      <div class="panel-header">
        <div>
          <h2>Latest Signals</h2>
          <p>
            Signals already recorded and tracked by Outcome Tracker
          </p>
        </div>
      </div>

      <div class="table-wrapper signals-table-wrapper">
        <table class="signals-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Signal</th>
              <th>Entry</th>
              <th>Current</th>
              <th>ROI</th>
              <th>TP10</th>
              <th>TP20</th>
              <th>SL</th>
              <th>Score</th>
              <th>Flow</th>
              <th>OI</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody id="signalsTableBody">
            <tr>
              <td colspan="14" class="empty-cell">
                Loading latest signals...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Learning Statistics</h2>
          <p>
            Statistical performance by pattern
          </p>
        </div>

        <span id="learningUpdatedAt" class="last-updated">
          Not updated
        </span>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Samples</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Flats</th>
              <th>Win Rate</th>
              <th>Expected Value</th>
              <th>Avg Profit</th>
              <th>Avg Drawdown</th>
              <th>Status</th>
              <th>Weight</th>
            </tr>
          </thead>

          <tbody id="learningTableBody">
            <tr>
              <td colspan="11" class="empty-cell">
                Loading learning statistics...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
`;

const elements = {
  connectionStatus: document.querySelector("#connectionStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  errorBox: document.querySelector("#errorBox"),

  signalsToday: document.querySelector("#signalsToday"),
  openSignals: document.querySelector("#openSignals"),
  winRate: document.querySelector("#winRate"),
  bestPattern: document.querySelector("#bestPattern"),

  opportunityGrid: document.querySelector("#opportunityGrid"),
  scanUpdatedAt: document.querySelector("#scanUpdatedAt"),

  signalsTableBody: document.querySelector("#signalsTableBody"),

  learningTableBody: document.querySelector(
    "#learningTableBody",
  ),

  learningUpdatedAt: document.querySelector(
    "#learningUpdatedAt",
  ),
};

function normalizeSignalName(value) {
  switch (value) {
    case "FLOW_RANK_BUY":
      return "BUY";

    case "FLOW_RANK_BUY_ZONE":
      return "BUY_ZONE";

    case "FLOW_RANK_WATCH":
      return "WAIT";

    default:
      return value || "UNKNOWN";
  }
}
function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPercent(value, digits = 2) {
  return `${toNumber(value).toFixed(digits)}%`;
}

function formatPrice(value) {
  const number = toNumber(value);

  if (number === 0) return "-";

  return number.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatCompactNumber(value) {
  const number = toNumber(value);

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "-";

  const normalized = String(value).includes("T")
    ? String(value)
    : `${String(value).replace(" ", "T")}Z`;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function getSignalClass(action) {
  const normalized = String(action || "").toUpperCase();

  if (normalized === "BUY") return "signal-buy";
  if (normalized === "BUY_ZONE") return "signal-buy-zone";
  if (normalized === "AVOID") return "signal-avoid";

  return "signal-wait";
}

function getOpportunityClass(action) {
  const normalized = String(action || "").toUpperCase();

  if (normalized === "BUY") return "opportunity-buy";
  if (normalized === "BUY_ZONE") return "opportunity-zone";
  if (normalized === "AVOID") return "opportunity-avoid";

  return "opportunity-wait";
}

function getRoiClass(value) {
  const number = toNumber(value);

  if (number > 0) return "roi-positive";
  if (number < 0) return "roi-negative";

  return "";
}

function getMetricClass(value) {
  const number = toNumber(value);

  if (number > 0) return "metric-positive";
  if (number < 0) return "metric-negative";

  return "metric-neutral";
}

function getWinRateClass(value) {
  const number = toNumber(value);

  if (number >= 60) return "metric-positive";
  if (number < 40) return "metric-negative";

  return "metric-neutral";
}

function getStatusClass(status, outcome) {
  const normalizedOutcome = String(
    outcome || "",
  ).toUpperCase();

  if (normalizedOutcome === "WIN") return "outcome-win";
  if (normalizedOutcome === "LOSS") return "outcome-loss";
  if (normalizedOutcome === "FLAT") return "outcome-flat";

  const normalizedStatus = String(
    status || "",
  ).toUpperCase();

  if (normalizedStatus === "CLOSED") return "status-closed";
  if (normalizedStatus === "OPEN") return "status-open";

  return "status-pending";
}

function getSampleStatusClass(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "READY") return "sample-ready";
  if (normalized === "EARLY") return "sample-early";

  return "sample-neutral";
}

function normalizeOpportunity(item) {
  const action = normalizeSignalName(
    item.action ||
    item.signal ||
    item.pattern_name ||
    "WAIT",
  );

  const entry = toNumber(
    item.entry ??
    item.entry_price,
  );

  const entryLow = toNumber(
    item.entryLow ??
    item.entry_low ??
    (entry > 0 ? entry * 0.995 : 0),
  );

  const entryHigh = toNumber(
    item.entryHigh ??
    item.entry_high ??
    (entry > 0 ? entry * 1.005 : 0),
  );
  let parsedRaw = item.raw;

  if (typeof parsedRaw === "string") {
    try {
      parsedRaw = JSON.parse(parsedRaw);
    } catch {
      parsedRaw = null;
    }
  }
  return {
    symbol: item.symbol || "UNKNOWN",

    action,

    score: toNumber(
      item.flowScore ??
      item.flow_score ??
      item.signal_score ??
      item.score,
    ),

    confidence: toNumber(
      item.confidence ??
      item.flowScore ??
      item.flow_score ??
      item.signal_score ??
      item.score,
    ),

    entry,
    entryLow,
    entryHigh,

    target10: toNumber(
      item.target10 ??
      item.tp10,
    ),

    target20: toNumber(
      item.target20 ??
      item.tp20,
    ),

    stopLoss: toNumber(
      item.stopLoss ??
      item.sl,
    ),

    currentPrice: toNumber(
      item.current_price ??
      item.currentPrice ??
      item.price ??
      item.raw?.price
    ),

    currentRoi: toNumber(
      item.current_roi ??
      item.currentRoi
    ),

    oiChange: toNumber(
      item.oiChange ??
      item.oi_change,
    ),

    fundingRate: toNumber(
      item.fundingRate ??
      item.funding_rate,
    ),

    pattern: action,
    reason: item.reason || "-",

    createdAt:
      item.createdAt ||
      item.created_at ||
      null,
  };
}

function sortOpportunities(rows) {
  const actionPriority = {
    BUY: 4,
    BUY_ZONE: 3,
    WAIT: 2,
    AVOID: 1,
  };

  return [...rows].sort((a, b) => {
    const actionDifference =
      (actionPriority[String(b.action).toUpperCase()] || 0) -
      (actionPriority[String(a.action).toUpperCase()] || 0);

    if (actionDifference !== 0) {
      return actionDifference;
    }

    return toNumber(b.score) - toNumber(a.score);
  });
}

function renderSummary(dashboard) {
  const summary = dashboard.summary || {};
  const bestPattern = dashboard.bestPattern || {};

  elements.signalsToday.textContent =
    toNumber(summary.signalsToday).toLocaleString();

  elements.openSignals.textContent =
    toNumber(summary.openSignals).toLocaleString();

  elements.winRate.textContent =
    formatPercent(summary.winRate);

  elements.winRate.className =
    getWinRateClass(summary.winRate);

  elements.bestPattern.textContent =
    bestPattern.pattern_name || "-";

}

function renderOpportunities(topSpotSignals) {
  const normalized = Array.isArray(topSpotSignals)
    ? topSpotSignals.map(normalizeOpportunity)
    : [];

  const displayRows = sortOpportunities(normalized).slice(0, 5);

  if (!displayRows.length) {
    elements.opportunityGrid.innerHTML = `
      <div class="empty-opportunities">
        No realtime opportunities found.
      </div>
    `;
    return;
  }

  elements.opportunityGrid.innerHTML = displayRows
    .map((item) => {
      const action = normalizeSignalName(
        item.action
      ).toUpperCase();

      return `
        <article class="opportunity-card ${getOpportunityClass(
          action,
        )}">
          <div class="opportunity-header">
            <div>
              <strong class="opportunity-symbol">
                ${escapeHtml(item.symbol)}
              </strong>

              <span class="opportunity-pattern">
                ${escapeHtml(action)}
              </span>
            </div>

            <span class="signal-badge ${getSignalClass(
              action,
            )}">
              ${escapeHtml(action)}
            </span>
          </div>

          <div class="price-grid">
            <div class="price-box">
              <span>Entry</span>
              <strong>
                ${formatPrice(item.entry)}
              </strong>
            </div>

            <div class="price-box">
              <span>Entry Zone</span>
              <strong>
                ${
                  item.entryLow > 0 && item.entryHigh > 0
                    ? `${formatPrice(
                        item.entryLow
                      )} - ${formatPrice(
                        item.entryHigh
                      )}`
                    : "-"
                }
              </strong>
            </div>

            <div class="price-box positive">
              <span>TP10</span>
              <strong>
                ${formatPrice(item.target10)}
              </strong>
            </div>

            <div class="price-box positive">
              <span>TP20</span>
              <strong>
                ${formatPrice(item.target20)}
              </strong>
            </div>

            <div class="price-box negative">
              <span>Stop Loss</span>
              <strong>
                ${formatPrice(item.stopLoss)}
              </strong>
            </div>

            <div class="price-box">
              <span>Confidence</span>
              <strong>
                ${formatPercent(item.confidence)}
              </strong>
            </div>
          </div>

          <div class="opportunity-meta">
            <div>
              <span>Flow Score</span>
              <strong>
                ${formatCompactNumber(item.score)}
              </strong>
            </div>

            <div>
              <span>OI Change</span>
              <strong class="${getMetricClass(
                item.oiChange
              )}">
                ${formatPercent(item.oiChange, 3)}
              </strong>
            </div>

            <div>
              <span>Funding</span>
              <strong>
                ${formatPercent(
                  item.fundingRate * 100,
                  4
                )}
              </strong>
            </div>
          </div>

          <p class="opportunity-reason">
            ${escapeHtml(item.reason)}
          </p>

          <span class="opportunity-time">
            ${formatDateTime(item.createdAt)}
          </span>
        </article>
      `;
    })
    .join("");
}

function renderSignals(signals) {
  const rows = Array.isArray(signals)
    ? signals.slice(0, 30)
    : [];

  if (!rows.length) {
    elements.signalsTableBody.innerHTML = `
      <tr>
        <td colspan="14" class="empty-cell">
          No signals found.
        </td>
      </tr>
    `;
    return;
  }

  elements.signalsTableBody.innerHTML = rows
    .map((signal) => {
      const action = normalizeSignalName(
        signal.action ||
        signal.signal ||
        signal.pattern_name ||
        "WAIT",
      ).toUpperCase();

      const statusText =
        signal.outcome_label &&
        signal.outcome_label !== "PENDING"
          ? signal.outcome_label
          : signal.status || "PENDING";

      return `
        <tr>
          <td>
            <div class="signal-symbol-cell">
              <strong>${escapeHtml(signal.symbol)}</strong>
              <span>
                ${escapeHtml(signal.exchange)} -
                ${escapeHtml(signal.direction)}
              </span>
            </div>
          </td>

          <td>
            <span class="signal-badge ${getSignalClass(
              action,
            )}">
              ${escapeHtml(action)}
            </span>
          </td>

          <td>${formatPrice(signal.entry_price)}</td>
          <td>${formatPrice(signal.current_price)}</td>

          <td class="${getRoiClass(signal.current_roi)}">
            ${formatPercent(signal.current_roi)}
          </td>

          <td class="metric-positive">
            ${formatPrice(signal.tp10)}
          </td>

          <td class="metric-positive">
            ${formatPrice(signal.tp20)}
          </td>

          <td class="metric-negative">
            ${formatPrice(signal.sl)}
          </td>

          <td>
            ${formatCompactNumber(signal.signal_score)}
          </td>

          <td class="${getMetricClass(
            signal.volume_change,
          )}">
            ${formatPercent(signal.volume_change)}
          </td>

          <td class="${getMetricClass(signal.oi_change)}">
            ${formatPercent(signal.oi_change, 3)}
          </td>

          <td>
            <span class="${getStatusClass(
              signal.status,
              signal.outcome_label,
            )}">
              ${escapeHtml(statusText)}
            </span>
          </td>

          <td class="reason-cell">
            <div class="reason-text">
              ${escapeHtml(signal.reason)}
            </div>
          </td>

          <td>
            ${formatDateTime(signal.created_at)}
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderLearning(learning) {
  const normalizePatternName = (patternName) => {
    switch (patternName) {
      case "FLOW_RANK_BUY":
        return "BUY";

      case "FLOW_RANK_BUY_ZONE":
        return "BUY_ZONE";

      case "FLOW_RANK_WATCH":
        return "WAIT";

      default:
        return patternName || "UNKNOWN";
    }
  };

  const rows = Array.isArray(learning)
    ? [...learning].sort((a, b) => {
        const sampleDifference =
          toNumber(b.signals) - toNumber(a.signals);

        if (sampleDifference !== 0) {
          return sampleDifference;
        }

        return (
          toNumber(b.expected_value) -
          toNumber(a.expected_value)
        );
      })
    : [];

  if (!rows.length) {
    elements.learningTableBody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-cell">
          No learning statistics found.
        </td>
      </tr>
    `;
    return;
  }

  elements.learningTableBody.innerHTML = rows
    .map((row) => {
      const patternName = normalizePatternName(
        row.pattern_name
      );

      return `
        <tr>
          <td>
            <div class="pattern-cell">
              <strong>
                ${escapeHtml(patternName)}
              </strong>

              <span>
                ${escapeHtml(row.exchange || "-")} -
                ${escapeHtml(row.direction || "-")}
              </span>
            </div>
          </td>

          <td>
            ${toNumber(row.signals).toLocaleString()}
          </td>

          <td class="metric-positive">
            ${toNumber(row.wins).toLocaleString()}
          </td>

          <td class="metric-negative">
            ${toNumber(row.losses).toLocaleString()}
          </td>

          <td class="metric-neutral">
            ${toNumber(row.flats).toLocaleString()}
          </td>

          <td class="${getWinRateClass(row.win_rate)}">
            ${formatPercent(row.win_rate)}
          </td>

          <td class="${getMetricClass(
            row.expected_value
          )}">
            ${toNumber(row.expected_value).toFixed(3)}
          </td>

          <td class="${getMetricClass(
            row.avg_profit
          )}">
            ${formatPercent(row.avg_profit)}
          </td>

          <td class="${getMetricClass(
            row.avg_drawdown
          )}">
            ${formatPercent(row.avg_drawdown)}
          </td>

          <td>
            <span class="sample-badge ${getSampleStatusClass(
              row.sample_status
            )}">
              ${escapeHtml(
                row.sample_status || "UNKNOWN"
              )}
            </span>
          </td>

          <td>
            <span class="weight-badge">
              ${toNumber(
                row.weight_multiplier,
                1
              ).toFixed(2)}x
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setLoading(isLoading) {
  elements.refreshButton.disabled = isLoading;

  elements.refreshButton.textContent = isLoading
    ? "Loading..."
    : "Refresh";

  if (isLoading) {
    elements.connectionStatus.textContent = "Loading";
    elements.connectionStatus.className =
      "status status-loading";
  }
}

function setConnected() {
  elements.connectionStatus.textContent = "Connected";
  elements.connectionStatus.className =
    "status status-connected";
}

function showError(message) {
  elements.errorBox.textContent = message;
  elements.errorBox.classList.remove("hidden");

  elements.connectionStatus.textContent = "Disconnected";
  elements.connectionStatus.className =
    "status status-error";
}

function clearError() {
  elements.errorBox.textContent = "";
  elements.errorBox.classList.add("hidden");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `${url} returned HTTP ${response.status}`,
    );
  }

  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `${url} returned ok=false`,
    );
  }

  return payload;
}

async function loadDashboard() {
  setLoading(true);
  clearError();

  try {
    const [dashboardPayload, learningPayload] =
      await Promise.all([
        fetchJson("/api/dashboard"),
        fetchJson("/api/dashboard/learning"),
      ]);

    renderSummary(dashboardPayload);
    renderOpportunities(
      dashboardPayload.topSpotSignals,
    );
    renderSignals(dashboardPayload.latestSignals);
    renderLearning(learningPayload.learning);

    const updatedAt = new Date().toLocaleString();

    elements.scanUpdatedAt.textContent = updatedAt;
    elements.learningUpdatedAt.textContent = updatedAt;

    setConnected();
  } catch (error) {
    console.error("Dashboard load failed:", error);

    showError(
      error instanceof Error
        ? error.message
        : "Unable to load dashboard",
    );
  } finally {
    setLoading(false);
  }
}

elements.refreshButton.addEventListener(
  "click",
  loadDashboard,
);

loadDashboard();

setInterval(loadDashboard, 30_000);
