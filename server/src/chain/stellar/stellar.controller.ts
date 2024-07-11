import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SorobanService } from './soroban/soroban.service';

export class PublishAssetDto {
    publicKey: string;      // 用户的钱包地址
    story_id: string;
    code: string;           // NFT的Code，有约束：<=12字符，大小写字母，数字
    name: string;
    description: string;
    imageCID: string;
    total: string;          // 发布数量，传字符串，发一个为：0.0000001，100个为：0.0000100
    price: number;
    authorReserved: string;
}

export class BuyAssetDto {
    publicKey: string;      // 用户(购买者)的钱包地址
    story_id: string;
    buyNum: string;         // 购买数量，传字符串，买一个为：0.0000001
    story_author: string;   // 作者钱包地址
}

export class ClaimReservedAssetDto {
    publicKey: string;      // 用户(购买者)的钱包地址
    story_id: string;
    buyNum: string;         // 购买数量，传字符串，买一个为：0.0000001
}

export class CreateTaskDto {
    publicKey: string;      // 用户的钱包地址
    story_id: string;
    cid: string;
    nft_address: string;
    reward_nfts: string;    // 购买数量，传字符串，买一个为：0.0000001
}

@Controller('stellar')
export class StellarController {

    constructor(
        private readonly _stellarSvc: SorobanService,
    ) { }

    @Post('publishAsset')
    async publishAsset(@Body() params: PublishAssetDto) {
        return await this._stellarSvc.publishStellarAssets(params);
    }

    @Post('buyAsset')
    async buyAsset(@Body() params: BuyAssetDto) {
        return await this._stellarSvc.buyStellarAssets(params);
    }

    @Post('claimReservedAsset')
    async claimReservedAsset(@Body() params: ClaimReservedAssetDto) {
        return await this._stellarSvc.claimReservedStellarAsset(params);
    }

    @Post('createTaskTransfer')
    async createTaskTransfer(@Body() params: CreateTaskDto) {
        return this._stellarSvc.createTaskTransfer(params);
    }

    @Get('asset/:storyId')
    async getAssetSale(@Param('storyId') storyId: string) {
        return await this._stellarSvc.getStellarAssetSale(storyId);
    }
}
