import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsersService } from '@/api/users/users.service';
import { API_ENDPOINTS } from '@/common/constants';

@Injectable()
export class UserSyncCronService {
	private readonly logger = new Logger(UserSyncCronService.name);

	constructor(
		private readonly httpService: HttpService,
		private readonly usersService: UsersService,
	) { }

	/**
	 * Sync users to external API every 5 minutes
	 */
	@Cron('*/1 * * * *')
	async handleUserSync() {
		this.logger.log('Starting user sync...');

		try {
			const users = await this.usersService.findAll();

			if (users.length === 0) {
				this.logger.log('No users to sync');
				return;
			}

			this.logger.log(`Syncing ${users.length} users`);

			const usersPayload = users.map((user) => ({
				chat_id: user.chat_id.toString(),
				name: user.name,
				username: user.username,
				status: user.status,
			}));

			const { status } = await firstValueFrom(
				this.httpService.post(API_ENDPOINTS.USERS_MASS_UPDATE, {
					users: usersPayload,
				}),
			);

			if (status === 200) {
				this.logger.log(`API success, deleting ${users.length} users`);
				const deletedCount = await this.usersService.deleteAll();
				this.logger.log(`Deleted ${deletedCount} users`);
			} else {
				this.logger.warn(`API returned ${status}, keeping users`);
			}
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			this.logger.error('User sync failed:', errorMessage);

			if (
				error &&
				typeof error === 'object' &&
				'response' in error &&
				error.response &&
				typeof error.response === 'object' &&
				'status' in error.response &&
				'data' in error.response
			) {
				this.logger.error(
					`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
				);
			}
		}
	}
}
