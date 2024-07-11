import { Process, Processor } from '@nestjs/bull';
import { AichatService } from './aichat.service';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AiChatJobPayload } from './aichat.job-payload';

function getConcurrencyFromEnv(defaultvalue: number) {
  if (process.env.AI_CHAT_CONCURRENCY) {
    return parseInt(process.env.AI_CHAT_CONCURRENCY, 10);
  } else {
    return defaultvalue;
  }
}

@Processor('aichat')
export class AichatConsumer {
  private readonly logger = new Logger(AichatConsumer.name);
  constructor(private readonly service: AichatService) {}

  @Process({
    concurrency: getConcurrencyFromEnv(4),
  })
  async process(job: Job<AiChatJobPayload>) {
    try {
      this.logger.log(`Processing job ${job.id}`);
      const result = await this.service.chat(job.data.messages);
      this.logger.log(`Job ${job.id} completed`);

      return result;
    } catch (e) {
      this.logger.error(e, e.stack);
      throw e;
    }
  }
}
