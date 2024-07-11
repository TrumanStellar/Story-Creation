import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AichatService } from './aichat.service';

@Resolver()
export class AichatResolver {
  constructor(private readonly service: AichatService) {}
  @Mutation(() => String)
  async runAichat(@Args('messages', { type: () => [String] }) input: string[]) {
    return await this.service.runChatInQueue(input);
  }
}
