# Alpha Flow Scanner

Alpha Flow Scanner is an open-source dashboard that uses public Binance Futures data to monitor market flow, volume, open interest, and funding rates. It scores notable markets, generates reference entry zones, and tracks signal outcomes in a local database.

> [!WARNING]
> This project is intended for research and technical reference only. It is not financial advice, does not guarantee profits, and does not place trades automatically. Digital asset trading involves a high risk of capital loss.

## Features

- Collects Binance USDT Perpetual market data.
- Monitors price, volume, open interest, and funding rate changes.
- Generates `BUY` and `BUY_ZONE` signals with flow scores and explanations.
- Displays reference entry zones, targets, and stop-loss levels.
- Tracks signal outcomes and produces learning statistics from historical data.
- Refreshes the dashboard every 30 seconds.
- Stores data in SQLite without requiring an external database service.

## Tech stack

- Backend: Node.js, Express, better-sqlite3, and Axios.
- Frontend: Vite, JavaScript, HTML, and CSS.
- Data source: Binance Futures public REST API.

## Requirements

- Node.js 20 or later.
- npm.
- Network access to the Binance Futures API.

## Installation

### 1. Backend

```bash
cd backend
npm install
```

Copy the example configuration file:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux**

```bash
cp .env.example .env
```

Start the backend:

```bash
npm run dev
```

The backend runs at `http://localhost:5000` by default. On its first run, it creates a SQLite database in `backend/data`.

### 2. Sync the market list

After the backend starts, call the following endpoint **once** to add currently active Binance Futures markets to the database:

**Windows PowerShell**

```powershell
Invoke-RestMethod -Method Post http://localhost:5000/api/collector/binance/sync-markets
```

**macOS/Linux**

```bash
curl -X POST http://localhost:5000/api/collector/binance/sync-markets
```

The scanner starts with the backend and repeats according to `AUTO_SCANNER_INTERVAL_MS`. After the first market sync, restart the backend or wait for the next scan cycle.

### 3. Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:5000`.

## Configuration

Important variables in `backend/.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | Backend API port |
| `DB_PATH` | `./data/alpha-flow-scanner.db` | SQLite database path |
| `BINANCE_FUTURES_REST` | `https://fapi.binance.com` | Binance Futures REST endpoint |
| `ENABLE_AUTO_SCANNER` | `true` | Enables or disables the automatic scan loop |
| `AUTO_SCANNER_INTERVAL_MS` | `30000` | Scan interval in milliseconds |
| `AUTO_SCANNER_MARKET_LIMIT` | `80` | Number of high-volume markets to collect |
| `AUTO_SCANNER_SIGNAL_LIMIT` | `5` | Maximum number of opportunities per scan |

Never commit `.env` files, databases, or private tokens. The root `.gitignore` excludes them from Git.

## Main API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check backend health |
| `GET` | `/api/dashboard` | Retrieve aggregated dashboard data |
| `POST` | `/api/collector/binance/sync-markets` | Sync the active market list |
| `POST` | `/api/collector/binance/snapshot` | Collect a market snapshot manually |
| `GET` | `/api/signals` | Retrieve calculated signals |
| `POST` | `/api/signals/scan` | Run a signal scan manually |

## Deployment

The backend requires a continuously running Node.js process for the scanner loop. It can run on a local computer, VPS, Oracle Cloud VM, or a platform that supports background workers. SQLite also requires persistent storage.

Build the frontend with:

```bash
cd frontend
npm run build
```

The current scanner loop and SQLite database should not run directly on Vercel Functions because background processes and local filesystem state are not continuously preserved. You can deploy the frontend to Vercel and point its API requests to a separately hosted backend after adding a production API URL configuration.

## Privacy and security

- The project only calls public market endpoints and does not require a Binance API key.
- Never publish `.env` files, bot tokens, or personal databases.
- Data-changing endpoints are currently unauthenticated. Do not expose the backend publicly without adding access controls.
- If a repository has ever contained a secret, remove it from the entire Git history and rotate the affected credential before publishing.

## License

Released under the [MIT License](LICENSE). You may use, modify, and redistribute the project under the license terms.
