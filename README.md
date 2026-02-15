<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

First, install all dependencies:

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode (recommended for development)
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Running with PM2

PM2 is a process manager for Node.js applications that keeps your application running in the background and automatically restarts it if it crashes.

### Prerequisites

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Build the project first:
   ```bash
   npm run build
   ```

### PM2 Commands

```bash
# Start in production mode
$ npm run pm2:start

# Start in development mode
$ npm run pm2:start:dev

# Stop the application
$ npm run pm2:stop

# Restart the application
$ npm run pm2:restart

# View logs
$ npm run pm2:logs

# Monitor (real-time dashboard)
$ npm run pm2:monit

# Delete from PM2
$ npm run pm2:delete

# View status
$ pm2 status

# Save PM2 process list and enable auto-start on reboot
$ pm2 save
$ pm2 startup  # Follow the instructions shown
```

### PM2 Configuration

The PM2 configuration is in `ecosystem.config.js`. It includes:
- Auto-restart on crashes
- Memory limit monitoring (1GB)
- Logging to `./logs/` directory
- Environment-specific settings

## Cache Management API

The application provides REST API endpoints for managing the in-memory cache service (`CacheService`). This cache stores:
- Posts (e.g., `post:start`)
- Categories (e.g., `category:1`, `category:list`)
- Products (e.g., `product:10`)

All endpoints are protected by Bearer token authentication and allow you to clear the entire cache or view cache statistics.

### Authentication

All cache endpoints require Bearer token authentication. The token must be the SHA256 hash of the `TELEGRAM_BOT_TOKEN` environment variable.

**Token Generation:**
```javascript
const crypto = require('crypto');
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const authToken = crypto.createHash('sha256').update(botToken).digest('hex');
```

**Request Header:**
```
Authorization: Bearer <sha256_hash_of_bot_token>
```

### Endpoints

#### Clear All Cache

**Endpoint:** `DELETE /cache`

Clears **all entries** from the in-memory cache service. This removes all cached posts, categories, and products. The cache will be repopulated as data is requested from the external API.

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/cache \
  -H "Authorization: Bearer <your_sha256_hash_token>"
```

**Example Response:**
```json
{
  "message": "Cache cleared successfully",
  "cleared": 15
}
```

#### Get Cache Statistics

**Endpoint:** `GET /cache/stats`

Returns cache statistics including the total number of entries and a list of all cache keys currently stored in the in-memory cache.

**Example Request:**
```bash
curl -X GET http://localhost:3000/cache/stats \
  -H "Authorization: Bearer <your_sha256_hash_token>"
```

**Example Response:**
```json
{
  "totalEntries": 15,
  "keys": [
    "post:start",
    "category:1",
    "category:2",
    "product:10",
    "product:11"
  ]
}
```

### Error Responses

**401 Unauthorized** - Missing or invalid Bearer token:
```json
{
  "statusCode": 401,
  "message": "Missing Authorization header"
}
```

### Quick Test

1. Generate the auth token:
   ```bash
   node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN || '').digest('hex'));"
   ```

2. Test the endpoint:
   ```bash
   curl -X DELETE http://localhost:3000/cache \
     -H "Authorization: Bearer <generated_token>"
   ```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
