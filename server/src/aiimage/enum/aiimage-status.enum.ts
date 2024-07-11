import { registerEnumType } from '@nestjs/graphql';

export enum AiImageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ERROR = 'error',
  SUCCESS = 'success',
}

registerEnumType(AiImageStatus, {
  name: 'AiImageStatus',
});
