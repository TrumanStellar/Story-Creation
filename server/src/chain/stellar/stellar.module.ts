import { Module } from '@nestjs/common';
import { SorobanService } from './soroban/soroban.service';
import { ConfigModule } from '@nestjs/config';
import { StoryChainTaskModule } from 'src/story-chain-task/story-chain-task.module';
import { StoryModule } from 'src/story/story.module';
import { IpfsModule } from 'src/ipfs/ipfs.module';
import { StellarController } from './stellar.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StellarAsset } from './entities/stellar-asset.entity';
import { StellarTX } from './entities/stellar-tx.entity';
import { StoryChainTask } from 'src/story-chain-task/entities/story-chain-task.entity';
import { StoryChainTaskSubmit } from 'src/story-chain-task/entities/story-chain-task-submit.entity';

@Module({
  imports: [ConfigModule, StoryModule, StoryChainTaskModule, IpfsModule,
    TypeOrmModule.forFeature([StellarAsset, StellarTX, StoryChainTask, StoryChainTaskSubmit]),
  ],
  providers: [SorobanService],
  exports: [SorobanService],
  controllers: [StellarController]
})
export class StellarModule { }
