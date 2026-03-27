import { Controller, Post, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { SentMessageService } from './sent-message.service';
import { BearerAuthGuard } from '@/common/guards/bearer-auth.guard';

@Controller('telegram/sent-message')
@UseGuards(BearerAuthGuard)
export class SentMessageController {
  constructor(private readonly sentMessageService: SentMessageService) {}

  @Post('mark-delete/:postId')
  async markDelete(@Param('postId', ParseIntPipe) postId: number) {
    const marked = await this.sentMessageService.markToDeleteByPostId(postId);
    return { post_id: postId, marked };
  }

  @Get('stats')
  async getStats() {
    return this.sentMessageService.getDistinctPostIds();
  }
}
