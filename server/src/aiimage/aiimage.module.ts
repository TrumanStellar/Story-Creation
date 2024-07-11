import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiImageEntity } from './entities/aiimage.entity';
import { IpfsModule } from 'src/ipfs/ipfs.module';
import { HttpModule } from '@nestjs/axios';
import { AiImageService } from './aiimage.service';
import { AiImageConsumer } from './aiimage.consumer';
import { ConfigModule } from '@nestjs/config';
import { AiImagesResovler } from './aiimage.resolver';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'aiimage',
    }),
    TypeOrmModule.forFeature([AiImageEntity]),
    IpfsModule,
    HttpModule,
  ],
  providers: [AiImageService, AiImageConsumer, AiImagesResovler],
  exports: [AiImageService],
})
export class AiimageModule {}
