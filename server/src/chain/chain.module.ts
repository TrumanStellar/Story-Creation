import { Module } from '@nestjs/common';
import { StoryModule } from 'src/story/story.module';
import { ChainService } from './chain.service';
import { StellarModule } from './stellar/stellar.module';

@Module({
  imports: [
    StoryModule,
    StellarModule,
  ],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
