# Telegram Bot — NestJS Service

NestJS microservice that powers the Telegram bot. Handles user interactions, catalog browsing,
and post mailouts. Communicates with the main Symfony API (`bot_api/`) and stores state locally
in SQLite.

---

## Requirements

| Tool | Version |
|------|---------|
| Node.js | >= 20 |
| npm | >= 10 |
| PM2 | latest (global) |
| Git | any |

---

## Environment Variables

Copy `.env` and fill in the real values:

```bash
cp .env .env.local   # or edit .env directly on the server
```

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `1234567890:AAF...` |
| `API_BASE_URL` | Base URL of the Symfony API | `https://your-api.example.com` |
| `API_AUTH_SALT` | Salt used to sign API requests | any long random string |
| `NODE_ENV` | Runtime environment | `production` / `development` |
| `PORT` | HTTP port for the REST API | `3000` (default) |
| `ENABLE_HTTP_DEBUG` | Log all outgoing HTTP requests | `false` |

> The bot authenticates to the Symfony API using `Bearer SHA256(TELEGRAM_BOT_TOKEN)`.
> No separate API secret is needed beyond the bot token.

---

## First-Time Deployment

Run these steps once on a fresh server.

### 1. Install PM2 globally

```bash
npm install -g pm2
```

### 2. Clone the repository and enter the project directory

```bash
git clone <repository-url>
cd bot_api_telegram/telegram
```

### 3. Configure environment

```bash
cp .env .env.backup          # keep original as reference
nano .env                    # set real TELEGRAM_BOT_TOKEN and API_BASE_URL
```

### 4. Install dependencies

```bash
npm ci
```

### 5. Build the TypeScript source

```bash
npm run build
```

### 6. Create the logs directory

PM2 writes logs to `./logs/` — create it before first start:

```bash
mkdir -p logs
```

> SQLite (`db.sqlite`) is created automatically by TypeORM on first startup.
> No manual database setup is needed.

### 7. Start the bot with PM2

```bash
npm run pm2:start
```

### 8. Verify it is running

```bash
pm2 status telegram-bot
npm run pm2:logs        # watch live logs, Ctrl+C to exit
```

### 9. Persist PM2 across server reboots

```bash
pm2 save
pm2 startup             # follow the printed instruction (run the sudo command it shows)
```

---

## Deploying Changes

Use the deploy script — it handles everything automatically:

```bash
bash scripts/deploy.sh
```

The script performs these steps:
1. `git pull` — fetch latest code
2. `npm ci` — clean install of dependencies
3. `npm run build` — recompile TypeScript
4. `pm2 restart telegram-bot` (or `pm2 start` if not yet registered)
5. `pm2 save` — persist the updated process list

---

## Manual Update (alternative)

If you need more control, run each step yourself:

```bash
git pull
npm ci
npm run build
npm run pm2:restart
```

---

## PM2 Commands Reference

```bash
npm run pm2:start       # Start in production mode
npm run pm2:stop        # Stop the bot
npm run pm2:restart     # Restart (picks up new build)
npm run pm2:delete      # Remove from PM2 entirely
npm run pm2:logs        # Tail logs
npm run pm2:monit       # Real-time monitoring dashboard
pm2 status              # Status of all PM2 processes
```

---

## Cache Management API

The bot exposes a small REST API for managing its in-memory cache.
All endpoints require a Bearer token = `SHA256(TELEGRAM_BOT_TOKEN)`.

**Generate the token:**
```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest('hex'));"
```

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/cache` | Clear all cached entries |
| `GET` | `/cache/stats` | Show total entries and all cache keys |

**Example:**
```bash
curl -X DELETE http://localhost:3000/cache \
  -H "Authorization: Bearer <token>"
```

---

## Development

```bash
npm run start:dev    # Watch mode — auto-reloads on file changes
npm run lint         # ESLint + auto-fix
npm run format       # Prettier format
```

> **Note:** No global `nest` CLI required. `npm run` scripts automatically use the local
> `node_modules/.bin/nest`. If you see `Command 'nest' not found`, use `npm run start:dev`
> instead of calling `nest` directly.

---

## Tests

```bash
npm run test         # Unit tests
npm run test:e2e     # End-to-end tests
npm run test:cov     # Coverage report
```
