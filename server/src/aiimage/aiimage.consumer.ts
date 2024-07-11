import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AiImageJobPayload } from './dto/aiimage.job-payload';
import { AiImageService } from './aiimage.service';
import { Logger } from '@nestjs/common';

function getConcurrencyFromEnv(defaultvalue: number) {
  if (process.env.AI_IMAGE_CONCURRENCY) {
    return parseInt(process.env.AI_IMAGE_CONCURRENCY, 10);
  } else {
    return defaultvalue;
  }
}

@Processor('aiimage')
export class AiImageConsumer {
  private logger = new Logger(AiImageConsumer.name);
  constructor(private readonly aiImageService: AiImageService) {}
  @Process({
    concurrency: getConcurrencyFromEnv(4), // TODO manage by config
  })
  async process(job: Job<AiImageJobPayload>) {
    try {
      await this.aiImageService.process(job.data.id);
    } catch (e) {
      this.logger.error(e, e.stack);
      throw e;
    }
  }
}
