import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SentMessage } from './sent-message.entity';

export interface SentMessageRecord {
  post_id: number;
  chat_id: number;
  message_id: number;
  sent_at: Date;
}

@Injectable()
export class SentMessageService {
  constructor(
    @InjectRepository(SentMessage)
    private readonly repo: Repository<SentMessage>,
  ) {}

  async bulkInsert(records: SentMessageRecord[]): Promise<void> {
    if (records.length === 0) return;
    const CHUNK = 180;
    for (let i = 0; i < records.length; i += CHUNK) {
      await this.repo.insert(records.slice(i, i + CHUNK));
    }
  }

  async markToDeleteByPostId(postId: number): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(SentMessage)
      .set({ to_delete: true })
      .where('post_id = :postId', { postId })
      .execute();
    return result.affected ?? 0;
  }

  async findToDelete(limit = 500): Promise<SentMessage[]> {
    return this.repo.find({
      where: { to_delete: true },
      take: limit,
    });
  }

  async deleteByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo.delete({ id: In(ids) });
  }

  async getDistinctPostIds(): Promise<{ post_id: number; count: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('sm')
      .select('sm.post_id', 'post_id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sm.post_id')
      .orderBy('sm.post_id', 'DESC')
      .getRawMany<{ post_id: number; count: string }>();

    return rows.map((r) => ({ post_id: r.post_id, count: Number(r.count) }));
  }
}
