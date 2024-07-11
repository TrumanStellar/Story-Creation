import { Field, ObjectType } from '@nestjs/graphql';
import { AiImageStatus } from '../enum/aiimage-status.enum';

@ObjectType('AiImage')
export class AiImageModel {
  @Field()
  id: string;

  @Field()
  status: AiImageStatus;

  @Field()
  imageUrl: string;
}
