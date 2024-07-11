import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { StoryModule } from './story/story.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { LoginModule } from './login/login.module';
import { ChainModule } from './chain/chain.module';
import { GqlModule } from './gql/gql.module';
import { StoryTaskModule } from './story-task/story-task.module';
import { StoryChainTaskModule } from './story-chain-task/story-chain-task.module';
import { AiimageModule } from './aiimage/aiimage.module';
import { AichatModule } from './aichat/aichat.module';

@Module({
  imports: [
    CoreModule,
    StoryModule,
    IpfsModule,
    LoginModule,
    ChainModule,
    GqlModule,
    StoryTaskModule,
    StoryChainTaskModule,
    AiimageModule,
    AichatModule,
  ],
  providers: [],
})
export class AppModule {}
