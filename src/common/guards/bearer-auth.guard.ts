import {
	Injectable,
	CanActivate,
	ExecutionContext,
	UnauthorizedException,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Guard that validates Bearer token authentication
 * Token must match SHA256 hash of TELEGRAM_BOT_TOKEN
 */
@Injectable()
export class BearerAuthGuard implements CanActivate {
	private readonly logger = new Logger(BearerAuthGuard.name);
	private readonly expectedToken: string;

	constructor(private readonly configService: ConfigService) {
		const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
		this.expectedToken = createHash('sha256').update(botToken).digest('hex');
	}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers.authorization;

		if (!authHeader) {
			this.logger.warn('Missing Authorization header');
			throw new UnauthorizedException('Missing Authorization header');
		}

		const [scheme, token] = authHeader.split(' ');

		if (scheme !== 'Bearer') {
			this.logger.warn(`Invalid authorization scheme: ${scheme}`);
			throw new UnauthorizedException('Invalid authorization scheme');
		}

		if (!token) {
			this.logger.warn('Missing Bearer token');
			throw new UnauthorizedException('Missing Bearer token');
		}

		if (token !== this.expectedToken) {
			this.logger.warn('Invalid Bearer token');
			throw new UnauthorizedException('Invalid Bearer token');
		}

		return true;
	}
}
