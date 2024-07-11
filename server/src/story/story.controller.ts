import { Controller, Get, HttpException, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { StoryService } from './story.service';
import axios from 'axios';
import { Request, Response } from 'express';

@Controller('story')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Get('sync/:chain/:chainStoryId')
  async syncStoryInfo(
    @Param('chain') chain: string,
    @Param('chainStoryId') chainStoryId,
  ): Promise<boolean> {
    const story = await this.storyService.getStory({ chain, chainStoryId });
    if (story) {
      await this.storyService.createStoryInfoSyncTask({ chain, chainStoryId });
      return true;
    } else {
      return false;
    }
  }

  @Post('stellar-rpc')
  async proxyRequest(@Req() req: Request, @Res() res: Response) {
    const url =
      '';

    try {
      // @ts-ignore
      const response = await axios({
        method: req.method,
        url: url,
        // headers: req.headers,
        data: req.body,
      });
      console.log(response);
      // @ts-ignore
      res.status(response.status).json(response.data);
    } catch (error) {
      throw new HttpException('Proxy request failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
