import { Module } from '@nestjs/common';
import { AichatService } from './aichat.service';
import { AichatResolver } from './aichat.resolver';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatEntity } from './aichat.entity';
import { AichatConsumer } from './aichat.consumer';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'aichat',
    }),
    TypeOrmModule.forFeature([AiChatEntity]),
  ],
  providers: [AichatService, AichatResolver, AichatConsumer],
  controllers: [],
})
export class AichatModule {}
