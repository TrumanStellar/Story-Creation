import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AiImageModel } from './models/aiimage.model';
import { AiImageService } from './aiimage.service';

@Resolver(() => AiImageModel)
export class AiImagesResovler {
  constructor(private readonly service: AiImageService) {}

  @Mutation(() => AiImageModel)
  async createAiImage(
    @Args('style') style: string,
    @Args('prompt') prompt: string,
    @Args('ratio') ratio: string,
  ) {
    return this.service.create({
      style,
      prompt,
      ratio,
    });
  }

  @Query(() => AiImageModel)
  async aiImage(@Args('id') id: string) {
    return this.service.getById(id);
  }
}
