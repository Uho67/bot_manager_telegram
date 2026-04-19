# Troubleshooting

## Running in Dev Mode on Server

### Option 1: PM2 in Development Mode (recommended for server)

```bash
cd bot_api_telegram/telegram
npm run build                # compile TypeScript → dist/
npm run pm2:start:dev        # starts via PM2 with NODE_ENV=development
```

Monitor with:

```bash
npm run pm2:logs    # tail logs
npm run pm2:monit   # real-time dashboard
```

> **Note:** PM2 dev mode still runs the compiled `dist/main.js` — it only sets `NODE_ENV=development`. It does **not** auto-recompile on code changes.

### Option 2: NestJS Watch Mode (live reload, for active development)

```bash
cd bot_api_telegram/telegram
npm run start:dev     # nest start --watch (auto-recompiles on file changes)
```

For debugging (attaches Node inspector on port 9229):

```bash
npm run start:debug   # nest start --debug --watch
```

### Important Notes

- If the bot is **already running** in PM2 (e.g. production), stop it first before starting in dev mode:

  ```bash
  npm run pm2:stop
  ```

  Running two bot instances simultaneously causes Telegram polling conflicts.

- To enable PM2 file watching, edit `ecosystem.config.js` and set `watch: true` with appropriate `ignore_watch` paths:

  ```js
  watch: true,
  ignore_watch: ['node_modules', 'logs'],
  ```
