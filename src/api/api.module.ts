import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as https from 'https';

@Global()
@Module({
	imports: [
		HttpModule.registerAsync({
			useFactory: (configService: ConfigService) => {
				const botToken = configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
				const authToken = createHash('sha256').update(botToken).digest('hex');

				const httpsAgent = new https.Agent({
					rejectUnauthorized: false,
				});

				return {
					baseURL: configService.get<string>('API_BASE_URL'),
					timeout: 15000,
					headers: {
						Authorization: `Bearer ${authToken}`,
					},
					httpsAgent,
				};
			},
			inject: [ConfigService],
		}),
	],
	exports: [HttpModule],
})
export class ApiModule implements OnModuleInit {
	private readonly logger = new Logger('HTTP');

	constructor(private readonly httpService: HttpService) { }

	onModuleInit() {
		const axios = this.httpService.axiosRef;

		// Request interceptor
		axios.interceptors.request.use(
			(config) => {
				// Add Xdebug session for PHP debugging in PhpStorm
				config.params = {
					...config.params,
					XDEBUG_SESSION_START: 'PHPSTORM',
				};

				this.logger.debug('═══════════════════════════════════════');
				this.logger.debug(`➡️  REQUEST: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
				this.logger.debug(`Headers: ${JSON.stringify(config.headers, null, 2)}`);
				if (config.params) {
					this.logger.debug(`Params: ${JSON.stringify(config.params, null, 2)}`);
				}
				if (config.data) {
					this.logger.debug(`Body: ${JSON.stringify(config.data, null, 2)}`);
				}
				this.logger.debug('═══════════════════════════════════════');
				return config;
			},
			(error) => {
				this.logger.error(`❌ REQUEST ERROR: ${error.message}`);
				return Promise.reject(error);
			},
		);

		// Response interceptor
		axios.interceptors.response.use(
			(response) => {
				this.logger.debug('───────────────────────────────────────');
				this.logger.debug(`✅ RESPONSE: ${response.status} ${response.statusText}`);
				this.logger.debug(`URL: ${response.config.url}`);
				this.logger.debug(`Data: ${JSON.stringify(response.data, null, 2)}`);
				this.logger.debug('───────────────────────────────────────');
				return response;
			},
			(error) => {
				this.logger.error('───────────────────────────────────────');
				this.logger.error(`❌ RESPONSE ERROR: ${error.message}`);
				if (error.response) {
					this.logger.error(`Status: ${error.response.status}`);
					this.logger.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
				}
				if (error.config) {
					this.logger.error(`URL: ${error.config.baseURL}${error.config.url}`);
				}
				this.logger.error('───────────────────────────────────────');
				return Promise.reject(error);
			},
		);

		this.logger.log('Axios HTTP interceptors initialized');
	}
}
