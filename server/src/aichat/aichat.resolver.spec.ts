import { Test, TestingModule } from '@nestjs/testing';
import { AichatResolver } from './aichat.resolver';

describe('AichatResolver', () => {
  let resolver: AichatResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AichatResolver],
    }).compile();

    resolver = module.get<AichatResolver>(AichatResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
