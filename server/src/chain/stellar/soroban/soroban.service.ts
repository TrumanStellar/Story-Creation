import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StoryChainTaskService } from 'src/story-chain-task/story-chain-task.service';
import { StoryService } from 'src/story/story.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Address, BASE_FEE, Contract, Networks, xdr } from '@stellar/stellar-sdk';
import { NftType } from 'src/story/entities/nft-sale.entity';
import { StoryChainTask, StoryChainTaskStatus } from 'src/story-chain-task/entities/story-chain-task.entity';
import { StoryChainTaskSubmit, StoryChainTaskSubmitStatus } from 'src/story-chain-task/entities/story-chain-task-submit.entity';
import { IpfsService } from 'src/ipfs/ipfs.service';
import { BuyAssetDto, ClaimReservedAssetDto, CreateTaskDto, PublishAssetDto } from '../stellar.controller';
import { StellarAsset } from '../entities/stellar-asset.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarTX } from '../entities/stellar-tx.entity';


@Injectable()
export class SorobanService implements Chain.ChainIntegration {
    public chain = 'stellar';
    public name = 'Stellar';
    public taskModule: Chain.TaskModuleType = 'chain';
    public enabled = true;
    public factoryAddress = '';
    public findsAddress = '';

    private logger = new Logger(SorobanService.name);
    public stellarRpc: string;
    public stellarServer: StellarSdk.SorobanRpc.Server;
    public stellarHorizonServer: StellarSdk.Horizon.Server;
    public assetAdminKeypair: StellarSdk.Keypair;
    public INTERVALS: number;

    constructor(
        private readonly _storySvc: StoryService,
        private readonly _configSvc: ConfigService,
        private readonly _storyTaskSvc: StoryChainTaskService,
        private readonly _ipfsSvc: IpfsService,
        @InjectRepository(StellarAsset)
        private readonly _stellarAssetRepo: Repository<StellarAsset>,
        @InjectRepository(StellarTX)
        private readonly _stellarTXRepo: Repository<StellarTX>,
        @InjectRepository(StoryChainTask)
        private readonly _taskRepo: Repository<StoryChainTask>,
        @InjectRepository(StoryChainTaskSubmit)
        private readonly _submitRepo: Repository<StoryChainTaskSubmit>,
    ) { }

    async onModuleInit() {
        this.enabled = this._configSvc.get('STELLAR_ENABLE') === 'true';
        if (!this.enabled) return;
        const enableSync = this._configSvc.get('STELLAR_ENABLE_SYNC') === 'true';
        this.factoryAddress = this._configSvc.get('STELLAR_FACTORY_ADDRESS');
        this.stellarRpc = this._configSvc.get('STELLAR_RPC');
        this.stellarServer = new StellarSdk.SorobanRpc.Server(this.stellarRpc);
        this.stellarHorizonServer = new StellarSdk.Horizon.Server(this._configSvc.get('STELLAR_HORIZON_RPC'));
        this.assetAdminKeypair = StellarSdk.Keypair.fromSecret(this._configSvc.get('STELLAR_ASSET_ADMIN'));
        this.INTERVALS = this._configSvc.get('STELLAR_SYNC_TIME');

        if (enableSync) {
            this.syncChainStoryData().catch((err) => {
                this.logger.error(`stellarSync chain data failed`, err);
            });
            this.syncStellar().catch((err) => {
                this.logger.error(`sync stellar tx data failed`, err);
            });
        }
    }

    async stateToJson(sourceValue, xdrValue: xdr.ScMapEntry[]) {
        let jsonObj = {};
        const map = new Map();
        const story = sourceValue["_attributes"];
        let story_key;
        if (story["key"]["_value"]?.["_value"]) {
            story_key = parseFloat(story["key"]["_value"]["_value"]);
        } else {
            story_key = Buffer.from(story["key"]["_value"]["data"]).toString('utf-8');;
        }

        const valueMap = new Map();
        for (let i = 0; i < xdrValue.length; i++) {
            const xdrValueInfo = xdrValue[i];
            const xdrKeyType = xdrValueInfo.key().switch().name;
            let key;
            if (xdrKeyType == 'scvString') {
                key = xdrValueInfo.key().str().toString();
            } else if (xdrKeyType == 'scvU64') {
                key = parseFloat(xdrValueInfo.key().u64().toString());
            }
            const xdrValueItemType = xdrValueInfo.val().switch().name;
            let items: null | xdr.ScMapEntry[];
            let itemsValue = {};
            if (xdrValueItemType == 'scvMap') {
                items = xdrValueInfo.val().map();
                for (let ii = 0; ii < items.length; ii++) {
                    let item_key;
                    let item_value;
                    const itemInfo = items[ii];
                    const item_key_type = itemInfo.key().switch().name
                    if (item_key_type == 'scvSymbol') {
                        item_key = itemInfo.key().sym().toString();
                    } else {
                        //
                    }
                    const item_val_type = itemInfo.val().switch().name
                    if (item_val_type == 'scvString') {
                        item_value = itemInfo.val().str().toString();
                    } else if (item_val_type == 'scvAddress') {
                        item_value = Address.fromScAddress(itemInfo.val().address()).toString();
                    } else if (item_val_type == 'scvU64') {
                        item_value = parseFloat(itemInfo.val().u64().toString());
                    } else if (item_val_type == 'scvU32') {
                        item_value = parseFloat(itemInfo.val().u32().toString());
                    } else if (item_val_type == 'scvI32') {
                        item_value = parseFloat(itemInfo.val().i32().toString());
                    } else if (item_val_type == 'scvI128') {
                        item_value = parseFloat(itemInfo.val().i128().lo().toString());
                    }
                    itemsValue[item_key] = item_value
                }
            }
            valueMap.set(key, itemsValue)
        }
        return valueMap;
    }

    async getStoryFactory() {
        const getLedgerKeySymbol = (contractId: string) => {
            const instance = new Contract(contractId).getFootprint();
            return instance;
        };
        let keys = getLedgerKeySymbol(this.factoryAddress);
        const contractData = await this.stellarServer.getLedgerEntries(keys)
        const cpntractDataEntry = contractData.entries[0].val.value() as xdr.ContractDataEntry;
        const instanceMap = cpntractDataEntry.val()?.instance()?.storage()?.[0]?.val()?.value() as xdr.ScMapEntry[] || [];
        let story_factory = {};
        for (let i = 0; i < instanceMap.length; i++) {
            const instance = JSON.parse(JSON.stringify(instanceMap[i]))["_attributes"];
            const xdr = instanceMap[i].val().value() as xdr.ScMapEntry[];
            const instance_key = instance["key"]["_value"]["data"];
            const key = Buffer.from(instance_key).toString('utf-8');
            const instance_value = instance["val"]["_value"];
            let value;
            let value_map = new Map();
            if (key === "next_sid") {
                value = parseFloat(instance_value["_value"]);
                story_factory[key] = value;
            } else {
                for (let ii = 0; ii < instance_value.length; ii++) {
                    const instance_map = await this.stateToJson(instance_value[ii], xdr);
                    for (const [key, value] of instance_map) {
                        value_map.set(key, value);
                    }
                }
                story_factory[key] = value_map;
            }
        }
        return story_factory;
    }

    async isPkAccountMatched(pubkey: string, account: string): Promise<boolean> {
        return true;
    }

    async isValidSignature(params: Chain.IsValidSignatureParams,): Promise<boolean> {
        const stellar_keypair = StellarSdk.Keypair.fromPublicKey(params.account);
        const sigArray = params.signature.slice(1, -1).split(',');
        const sigNumbers = sigArray.map(Number);
        const isValid = stellar_keypair.verify(Buffer.from(params.message), Buffer.from(sigNumbers));
        return isValid;
    }

    public async formatGeneralMetadatas(metadatas: Chain.GeneralMetadata[],): Promise<Chain.MetadataJsonFile[]> {
        return metadatas.map((m) => ({
            item: m,
            json: {
                name: m.name,
                description: m.description,
                image: m.image,
            },
        }));
    }

    public async getStory(chainStoryId: string): Promise<Chain.Story> {
        const storyFactory = await this.getStoryFactory();
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const story = storyFactory["stories"].get(parseFloat(chainStoryId));
        if (story.story_id.toString() == '0' || story == undefined) return null;
        return {
            id: chainStoryId,
            author: story.author,
            cid: story.cid,
            addr: this.factoryAddress,
        };
    }

    public async getSyncStory(chainStoryId: string, storyFactory): Promise<Chain.Story> {
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const story = storyFactory["stories"].get(parseFloat(chainStoryId));
        if (story.story_id.toString() == '0' || story == undefined) return null;
        return {
            id: chainStoryId,
            author: story.author,
            cid: story.cid,
            addr: this.factoryAddress,
        };
    }

    public async getStoryNftSale(chainStoryId: string): Promise<Chain.NftSale> {
        const sale = await this._stellarAssetRepo.findOne({ where: { storyId: chainStoryId, isPublished: true } });
        if (!sale) return null;
        return {
            authorClaimed: sale.authorClaimed,
            authorReserved: sale.authorReserved,
            total: sale.total,
            sold: sale.sold,
            saleAddr: this.factoryAddress,
            name: sale.name,
            uriPrefix: sale.imageCID,
            type: '',
            price: sale.price.toString(),
        };
    }

    public async getSyncStoryNftSale(chainStoryId: string, storyFactory): Promise<Chain.NftSale> {
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const sale = storyFactory["story_nft"].get(parseFloat(chainStoryId));
        if (sale == undefined) return null;
        return {
            authorClaimed: sale.author_claimed,
            authorReserved: sale.author_reserve,
            total: sale.total,
            sold: sale.sold,
            saleAddr: this.factoryAddress,
            name: sale.name,
            uriPrefix: sale.uri_prefix,
            type: '',
            price: sale.price.toString(),
        };
    }

    public async publishStellarAssets(params: PublishAssetDto) {
        const { publicKey, story_id, code, name, description, imageCID, total, price, authorReserved } = params;
        let assetInDB = await this._stellarAssetRepo.findOne({
            where: { storyId: story_id },
        });
        if (assetInDB && assetInDB.isPublished) {
            return 'All ready published.';
        }
        if (!assetInDB) {
            assetInDB = this._stellarAssetRepo.create({
                storyId: story_id,
                code: '',
                issuer: '',
                name,
                contractId: '',
                description,
                imageCID,
                price: price.toString(),
                total: parseFloat(total) * 10000000,
                authorReserved: parseFloat(authorReserved) * 10000000,
            });
        }
        const issuerKeypair = StellarSdk.Keypair.random();
        this.logger.debug(`Issuer PublicKey: ${issuerKeypair.publicKey()}`);
        this.logger.debug(`Issuer Secret:    ${issuerKeypair.secret()}`);
        const nftAsset = new StellarSdk.Asset(code, issuerKeypair.publicKey());
        const metadata = {
            name: name,
            description: description,
            issuer: issuerKeypair.publicKey(),
            code: nftAsset.getCode(),
            image: `ipfs://${imageCID}`,
            fixed_number: 1,
            display_decimals: 7,
        };
        const metadataCID = (await this._ipfsSvc.storeJson(metadata)).cid;
        this.logger.debug(`Asset metadataCID: ${metadataCID}`);
        const userAccount = await this.stellarHorizonServer.loadAccount(publicKey);
        const transaction = new StellarSdk.TransactionBuilder(userAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
            .addOperation(StellarSdk.Operation.createAccount({
                destination: issuerKeypair.publicKey(),
                startingBalance: '2',
            }))
            .addOperation(StellarSdk.Operation.changeTrust({
                asset: nftAsset,
                limit: total,
                source: this.assetAdminKeypair.publicKey(),
            }))
            .addOperation(StellarSdk.Operation.manageData({
                name: 'ipfshash',
                value: `ipfs://${metadataCID}`,
                source: issuerKeypair.publicKey(),
            }))
            .addOperation(StellarSdk.Operation.payment({
                destination: this.assetAdminKeypair.publicKey(),
                asset: nftAsset,
                amount: total,
                source: issuerKeypair.publicKey(),
            }))
            .addOperation(StellarSdk.Operation.setOptions({
                masterWeight: 0,
                source: issuerKeypair.publicKey()
            }))
            .setTimeout(300)
            .build();
        transaction.sign(issuerKeypair, this.assetAdminKeypair);

        assetInDB.storyId = story_id;
        assetInDB.code = code;
        assetInDB.issuer = issuerKeypair.publicKey();
        assetInDB.name = name;
        assetInDB.description = description;
        assetInDB.imageCID = imageCID;
        assetInDB.total = parseFloat(total) * 10000000;
        assetInDB.authorReserved = parseFloat(authorReserved) * 10000000;
        assetInDB.sold = 0;
        assetInDB.authorClaimed = 0;
        assetInDB.price = price.toString();
        await this._stellarAssetRepo.save(assetInDB);

        const stellarTX = this._stellarTXRepo.create({
            storyId: story_id,
            txType: 'PublishAsset',
            code,
            issuer: issuerKeypair.publicKey(),
            txHash: transaction.hash().toString('hex')
        });
        await this._stellarTXRepo.save(stellarTX);

        return transaction.toXDR();
    }

    public async buyStellarAssets(params: BuyAssetDto) {
        const { publicKey, story_id, buyNum, story_author } = params;
        const assetInDB = await this._stellarAssetRepo.findOne({
            where: { storyId: story_id },
        });
        if (!assetInDB || !assetInDB.isPublished) {
            return 'Not found asset.'
        }
        const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
        const userAccount = await this.stellarHorizonServer.loadAccount(publicKey);
        const transaction = new StellarSdk.TransactionBuilder(userAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
            .addOperation(StellarSdk.Operation.payment({
                asset: StellarSdk.Asset.native(),
                amount: (parseFloat(assetInDB.price) * parseFloat(buyNum) * 10000000).toString(),
                destination: story_author
            }))
            .addOperation(StellarSdk.Operation.changeTrust({
                asset: nftAsset,
                limit: (assetInDB.total / 10000000).toString(),
                source: publicKey,
            }))
            .addOperation(StellarSdk.Operation.payment({
                destination: publicKey,
                asset: nftAsset,
                amount: buyNum,
                source: this.assetAdminKeypair.publicKey(),
            }))
            .setTimeout(300)
            .build();
        transaction.sign(this.assetAdminKeypair);
        const stellarTX = this._stellarTXRepo.create({
            storyId: story_id,
            txType: 'BuyAsset',
            code: assetInDB.code,
            num: (parseFloat(buyNum) * 10000000),
            issuer: assetInDB.issuer,
            txHash: transaction.hash().toString('hex')
        });
        await this._stellarTXRepo.save(stellarTX);

        return transaction.toXDR();
    }

    async claimReservedStellarAsset(params: ClaimReservedAssetDto) {
        const { publicKey, story_id, buyNum } = params;
        const assetInDB = await this._stellarAssetRepo.findOne({
            where: { storyId: story_id },
        });
        if (!assetInDB || !assetInDB.isPublished) {
            return 'Not found asset.'
        }
        if (assetInDB.authorClaimed + parseFloat(buyNum) * 10000000 > assetInDB.authorReserved) {
            return 'Claim too much.';
        }
        const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
        const userAccount = await this.stellarHorizonServer.loadAccount(publicKey);
        const transaction = new StellarSdk.TransactionBuilder(userAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
            .addOperation(StellarSdk.Operation.changeTrust({
                asset: nftAsset,
                limit: (assetInDB.total / 10000000).toString(),
                source: publicKey,
            }))
            .addOperation(StellarSdk.Operation.payment({
                destination: publicKey,
                asset: nftAsset,
                amount: buyNum,
                source: this.assetAdminKeypair.publicKey(),
            }))
            .setTimeout(300)
            .build();
        transaction.sign(this.assetAdminKeypair);
        const stellarTX = this._stellarTXRepo.create({
            storyId: story_id,
            txType: 'AuthorClaimAsset',
            code: assetInDB.code,
            num: (parseFloat(buyNum) * 10000000),
            issuer: assetInDB.issuer,
            txHash: transaction.hash().toString('hex')
        });
        await this._stellarTXRepo.save(stellarTX);
        return transaction.toXDR();
    }

    async createTaskTransfer(params: CreateTaskDto) {
        const { publicKey, story_id, cid, nft_address, reward_nfts } = params;
        const assetInDB = await this._stellarAssetRepo.findOne({
            where: { storyId: story_id },
        });
        if (!assetInDB || !assetInDB.isPublished) {
            return 'Not found asset.'
        }
        const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
        const storyFactoryContract = new StellarSdk.Contract(this.factoryAddress);
        const userAccount = await this.stellarHorizonServer.loadAccount(publicKey);
        const transaction = new StellarSdk.TransactionBuilder(userAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
            .addOperation(StellarSdk.Operation.payment({
                destination: this.assetAdminKeypair.publicKey(),
                asset: nftAsset,
                amount: reward_nfts,
                source: publicKey,
            }))
            .setTimeout(300)
            .build();
        return transaction.toXDR();
    }

    async createTaskSubmit(params: CreateTaskDto) {

    }

    async getStellarAssetSale(storyId: string) {
        const assetInDB = await this._stellarAssetRepo.findOne({ where: { storyId, isPublished: true } });
        return assetInDB;
    }

    async getStellarTx(txHash: string): Promise<boolean> {
        try {
            const transactionResult = await this.stellarHorizonServer.transactions()
                .transaction(txHash)
                .call();
            if (transactionResult.successful) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async getTask(
        chainStoryId: string,
        chainTaskId: string,
    ): Promise<Chain.Task> {
        const storyFactory = await this.getStoryFactory();
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const taskInfo = storyFactory["story_task"].get(chainStoryId + "," + chainTaskId);
        if (taskInfo == undefined) return null;
        return {
            id: chainTaskId,
            cid: taskInfo.cid,
            creator: taskInfo.creator,
            nft: taskInfo.nft_address,
            rewardNfts: [taskInfo.reward_nfts.toString()],
            status: taskInfo.status,
        };
    }

    async getSyncTask(
        chainStoryId: string,
        chainTaskId: string,
        storyFactory
    ): Promise<Chain.Task> {
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const taskInfo = storyFactory["story_task"].get(chainStoryId + "," + chainTaskId);
        if (taskInfo == undefined) return null;
        return {
            id: chainTaskId,
            cid: taskInfo.cid,
            creator: taskInfo.creator,
            nft: taskInfo.nft_address,
            rewardNfts: [taskInfo.reward_nfts.toString()],
            status: taskInfo.status,
        };
    }

    async getSubmit(
        chainStoryId: string,
        chainTaskId: string,
        chainSubmitId: string,
    ): Promise<Chain.Submit> {
        const storyFactory = await this.getStoryFactory();
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const submitInfo = storyFactory["task_submit"].get(chainStoryId + "," + chainTaskId + "," + chainSubmitId);
        if (submitInfo == undefined) return null;
        return {
            id: chainSubmitId,
            cid: submitInfo.cid,
            creator: submitInfo.creator,
            status: submitInfo.status
        };
    }

    async getSyncSubmit(
        chainStoryId: string,
        chainTaskId: string,
        chainSubmitId: string,
        storyFactory
    ): Promise<Chain.Submit> {
        if (JSON.stringify(storyFactory) === JSON.stringify({})) return null;
        const submitInfo = storyFactory["task_submit"].get(chainStoryId + "," + chainTaskId + "," + chainSubmitId);
        if (submitInfo == undefined) return null;
        return {
            id: chainSubmitId,
            cid: submitInfo.cid,
            creator: submitInfo.creator,
            status: submitInfo.status
        };
    }

    private async syncChainStoryData() {
        const INTERVALS = this.INTERVALS * 1000;
        while (true) {
            try {
                this.logger.debug(`[stellarSync] start`);
                const storiesInDb = await this._storySvc.listStories({
                    chain: [this.chain],
                });
                const salesInDb = await this._storySvc.listNftSales({
                    chain: [this.chain],
                });
                this.logger.debug(
                    `[stellarSync] ${storiesInDb.length} stories & ${salesInDb.length} sales in db`,
                );
                const storyTasksInDb = await this._storyTaskSvc.listTasks({
                    chain: this.chain,
                });
                const storyTaskSubmitsInDb = await this._storyTaskSvc.listSubmits({
                    chain: this.chain,
                });
                this.logger.debug(
                    `[stellarSyncChainTask] ${storyTasksInDb.length} tasks & ${storyTaskSubmitsInDb.length} submits in db`,
                );
                const storyFactory = await this.getStoryFactory();
                const nextStoryId = storyFactory["next_sid"];
                this.logger.debug(
                    `[stellarSync] there is ${nextStoryId - 1} stories on chain`
                );
                const toCreateStories: Parameters<StoryService['createStories']>[0] = [];
                const toUpdateStories: Parameters<StoryService['updateStoriesContentHash']>[0] = [];
                const toCreateSales: Parameters<StoryService['createNftSales']>[0] = [];
                const toUpdateSales: Parameters<StoryService['updateNftSales']>[0] = [];
                for (let storyId = 1; storyId < nextStoryId; storyId++) {
                    const existedStoryInDb = storiesInDb.find(
                        (story) => story.chainStoryId === storyId.toString(),
                    );
                    // sync story
                    const storyInfo = await this.getSyncStory(storyId.toString(), storyFactory);
                    if (!existedStoryInDb) {
                        // not existed in db, will create story
                        toCreateStories.push({
                            chain: this.chain,
                            chainStoryId: storyInfo.id,
                            onChainAddr: storyInfo.addr,
                            author: storyInfo.author,
                            contentHash: storyInfo.cid,
                        });
                    } else {
                        // existed in db, check whether to update
                        if (existedStoryInDb.contentHash !== storyInfo.cid) {
                            // story cid updated, shoule update in db
                            toUpdateStories.push({
                                chain: this.chain,
                                chainStoryId: storyInfo.id,
                                contentHash: storyInfo.cid,
                            });
                        }
                    }
                    // sync story task
                    const nextTaskId = storyFactory["stories"].get(storyId).next_task_id;
                    if (nextStoryId > 1) {
                        for (let taskId = 1; taskId < nextTaskId; taskId++) {
                            const storyTaskInfo = await this.getSyncTask(storyId.toString(), taskId.toString(), storyFactory);
                            if (storyTaskInfo) {
                                const exitedStoryTaskInDb = storyTasksInDb.find(
                                    (task) => task.chainTaskId === taskId.toString() && task.chainStoryId === storyId.toString(),
                                );
                                if (!exitedStoryTaskInDb) {
                                    const taskStatus = await this.changeTaskStatus(storyTaskInfo.status);
                                    await this._storyTaskSvc.createTask({
                                        chain: this.chain,
                                        chainStoryId: storyId.toString(),
                                        chainTaskId: taskId.toString(),
                                        creator: storyTaskInfo.creator,
                                        nft: storyTaskInfo.nft,
                                        rewardNfts: storyTaskInfo.rewardNfts,
                                        cid: storyTaskInfo.cid,
                                        status: taskStatus,
                                    });
                                } else {
                                    const taskStatus = await this.changeTaskStatus(storyTaskInfo.status);
                                    if (exitedStoryTaskInDb.status == StoryChainTaskStatus.Todo && taskStatus == StoryChainTaskStatus.Cancelled) {
                                        if (parseFloat(storyTaskInfo.rewardNfts[0]) != 0) {
                                            const assetInDB = await this._stellarAssetRepo.findOne({ where: { storyId: storyId.toString() } });
                                            const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
                                            const assetAdminAccount = await this.stellarHorizonServer.loadAccount(this.assetAdminKeypair.publicKey());
                                            const transaction = new StellarSdk.TransactionBuilder(assetAdminAccount, {
                                                fee: StellarSdk.BASE_FEE,
                                                networkPassphrase: StellarSdk.Networks.PUBLIC,
                                            })
                                                .addOperation(StellarSdk.Operation.payment({
                                                    destination: storyTaskInfo.creator,
                                                    asset: nftAsset,
                                                    amount: (parseFloat(storyTaskInfo.rewardNfts[0]) / 10000000).toString(),
                                                    source: this.assetAdminKeypair.publicKey(),
                                                }))
                                                .setTimeout(300)
                                                .build();
                                            transaction.sign(this.assetAdminKeypair);
                                            try {
                                                const transactionResult = await this.stellarHorizonServer.submitTransaction(transaction);
                                                this.logger.debug(`Task cancelled. Asset Transaction Hash: ${transactionResult.hash}`);
                                            } catch (err) {
                                                this.logger.debug(`Task cancelled fail. Story ID: ${storyId.toString()}. Task ID: ${taskId.toString()}`);
                                                console.log(err.response.data.extras);
                                            }
                                        }
                                        await this._storyTaskSvc.updateTask({
                                            chain: this.chain,
                                            chainStoryId: storyId.toString(),
                                            chainTaskId: taskId.toString(),
                                            cid: storyTaskInfo.cid,
                                            status: taskStatus
                                        });
                                    } else {
                                        await this._storyTaskSvc.updateTask({
                                            chain: this.chain,
                                            chainStoryId: storyId.toString(),
                                            chainTaskId: taskId.toString(),
                                            cid: storyTaskInfo.cid,
                                            status: taskStatus
                                        });
                                    }
                                }
                            }
                            // storyTaskSubmit
                            let task_key = storyId.toString() + ',' + taskId.toString();
                            const nextSubmitId = storyFactory["story_task"].get(task_key).next_submit_id;
                            if (nextSubmitId > 1) {
                                for (let submitId = 1; submitId < nextSubmitId; submitId++) {
                                    const storyTaskSubmitInfo = await this.getSyncSubmit(storyId.toString(), taskId.toString(), submitId.toString(), storyFactory);
                                    if (storyTaskSubmitInfo) {
                                        const exitedStoryTaskSubmitInDb = storyTaskSubmitsInDb.find(
                                            (submit) => submit.chainStoryId === storyId.toString() && submit.chainTaskId === taskId.toString() && submit.chainSubmitId === submitId.toString(),
                                        );
                                        if (!exitedStoryTaskSubmitInDb) {
                                            const taskSubmitStatus = await this.changeTaskSubmitStatus(storyTaskSubmitInfo.status);
                                            await this._storyTaskSvc.createSubmit({
                                                chain: this.chain,
                                                chainStoryId: storyId.toString(),
                                                chainTaskId: taskId.toString(),
                                                chainSubmitId: submitId.toString(),
                                                creator: storyTaskSubmitInfo.creator,
                                                cid: storyTaskSubmitInfo.cid,
                                                status: taskSubmitStatus,
                                            });
                                        } else {
                                            const taskSubmitStatus = await this.changeTaskSubmitStatus(storyTaskSubmitInfo.status);
                                            if (exitedStoryTaskSubmitInDb.status == StoryChainTaskSubmitStatus.PENDING && taskSubmitStatus == StoryChainTaskSubmitStatus.APPROVED) {
                                                const taskInDB = await this._taskRepo.findOne({ where: { chainStoryId: storyId.toString(), chainTaskId: taskId.toString() } });
                                                if (parseFloat(taskInDB.rewardNfts[0]) != 0) {
                                                    const assetInDB = await this._stellarAssetRepo.findOne({ where: { storyId: storyId.toString() } });
                                                    const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
                                                    const assetAdminAccount = await this.stellarHorizonServer.loadAccount(this.assetAdminKeypair.publicKey());
                                                    const transaction = new StellarSdk.TransactionBuilder(assetAdminAccount, {
                                                        fee: StellarSdk.BASE_FEE,
                                                        networkPassphrase: StellarSdk.Networks.PUBLIC,
                                                    })
                                                        .addOperation(StellarSdk.Operation.payment({
                                                            destination: storyTaskSubmitInfo.creator,
                                                            asset: nftAsset,
                                                            amount: (parseFloat(storyTaskInfo.rewardNfts[0]) / 10000000).toString(),
                                                            source: this.assetAdminKeypair.publicKey(),
                                                        }))
                                                        .setTimeout(300)
                                                        .build();
                                                    transaction.sign(this.assetAdminKeypair);
                                                    try {
                                                        const transactionResult = await this.stellarHorizonServer.submitTransaction(transaction);
                                                        this.logger.debug(`Task done. Asset Transaction Hash: ${transactionResult.hash}`);
                                                    } catch (err) {
                                                        this.logger.debug(`Task done fail. Story ID: ${storyId.toString()}. Task ID: ${taskId.toString()}. Submit ID: ${submitId.toString()}`);
                                                        console.log(err.response.data.extras);
                                                    }
                                                }
                                            }
                                            await this._storyTaskSvc.updateSubmit({
                                                chain: this.chain,
                                                chainStoryId: storyId.toString(),
                                                chainTaskId: taskId.toString(),
                                                chainSubmitId: submitId.toString(),
                                                status: taskSubmitStatus,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                this.logger.debug(`[stellarSync] stories : ${toCreateStories.length} created ${toUpdateStories.length} updated`);
                this.logger.debug(`[stellarSync] sales : ${toCreateSales.length} created ${toUpdateSales.length} updated`);
                await this._storySvc.createStories(toCreateStories);
                await this._storySvc.updateStoriesContentHash(toUpdateStories);
                await this._storySvc.createNftSales(toCreateSales);
                await this._storySvc.updateNftSales(toUpdateSales);
                this.logger.debug(`[stellarSync] done`);
            }
            catch (e) {
                this.logger.error(`stellarSync Stellar chain story and nft data failed`, e);
            }
            finally {
                await new Promise((res) => setTimeout(res, INTERVALS));
            }
        }
    }

    private async changeTaskStatus(taskStatus: string): Promise<StoryChainTaskStatus> {
        if (taskStatus == "TODO") {
            return StoryChainTaskStatus.Todo;
        }
        if (taskStatus == "CANCELLED") {
            return StoryChainTaskStatus.Cancelled;
        }
        if (taskStatus == "DONE") {
            return StoryChainTaskStatus.Done;
        }
    }

    private async changeTaskSubmitStatus(taskSubmitStatus: string): Promise<StoryChainTaskSubmitStatus> {
        if (taskSubmitStatus == "PEDING") {
            return StoryChainTaskSubmitStatus.PENDING;
        }
        if (taskSubmitStatus == "APPROVED") {
            return StoryChainTaskSubmitStatus.APPROVED;
        }
        if (taskSubmitStatus == "WITHDRAWED") {
            return StoryChainTaskSubmitStatus.WITHDRAWED;
        }
    }

    async syncStellar() {
        const INTERVALS = 10 * 1000;
        while (true) {
            try {
                this.logger.debug(`Star Sync Stellar Data`);
                const txInDBList = await this._stellarTXRepo.findAndCount({ where: { isSuccessful: false } });
                if (txInDBList[0].length == 0) {
                    this.logger.debug(`There are 0 unprocessed transactions in DB`);
                    continue;
                }
                this.logger.debug(`There are ${txInDBList[1]} unprocessed transactions in DB`);
                let txProcessNum = 0;
                for (let txInDB of txInDBList[0]) {
                    const txSuccessful = await this.getStellarTx(txInDB.txHash);
                    if (txSuccessful) {
                        const assetInDB = await this._stellarAssetRepo.findOne({ where: { code: txInDB.code, issuer: txInDB.issuer, storyId: txInDB.storyId } });
                        if (txInDB.txType == 'PublishAsset') {
                            const nftAsset = new StellarSdk.Asset(assetInDB.code, assetInDB.issuer);
                            assetInDB.contractId = nftAsset.contractId(StellarSdk.Networks.PUBLIC);
                            assetInDB.isPublished = true;
                            await this._stellarAssetRepo.save(assetInDB);
                            txProcessNum++;
                        }
                        if (txInDB.txType == 'BuyAsset') {
                            assetInDB.sold = assetInDB.sold + txInDB.num;
                            await this._stellarAssetRepo.save(assetInDB);
                            txProcessNum++
                        }
                        if (txInDB.txType == 'AuthorClaimAsset') {
                            assetInDB.authorClaimed = assetInDB.authorClaimed + txInDB.num;
                            await this._stellarAssetRepo.save(assetInDB);
                            txProcessNum++
                        }
                        txInDB.isSuccessful = true;
                        await this._stellarTXRepo.save(txInDB);

                        const salesInDb = await this._storySvc.listNftSales({
                            chain: [this.chain],
                        });
                        const toCreateSales: Parameters<StoryService['createNftSales']>[0] = [];
                        const toUpdateSales: Parameters<StoryService['updateNftSales']>[0] = [];
                        const sale = await this.getStoryNftSale(assetInDB.storyId);
                        if (sale) {
                            const existedSaleInDb = salesInDb.find(
                                (sale) => sale.chainStoryId === assetInDB.storyId,
                            );
                            if (!existedSaleInDb) {
                                // not existed in db, will create sale
                                toCreateSales.push({
                                    chain: this.chain,
                                    chainStoryId: assetInDB.storyId,
                                    nftSaleAddr: this.factoryAddress,
                                    name: unescape(sale.name),
                                    uriPrefix: sale.uriPrefix,
                                    type: NftType.NON_FUNGIBLE_TOKEN,
                                    price: sale.price,
                                    total: sale.total,
                                    sold: sale.sold,
                                    authorClaimed: sale.authorClaimed,
                                    authorReserved: sale.authorReserved,
                                });
                            } else {
                                if (
                                    existedSaleInDb.sold !== sale.sold ||
                                    existedSaleInDb.authorClaimed !== sale.authorClaimed
                                ) {
                                    // state changed , will update sale
                                    toUpdateSales.push({
                                        ...existedSaleInDb,
                                        sold: sale.sold,
                                        authorClaimed: sale.authorClaimed,
                                    });
                                }
                            }
                        }
                        await this._storySvc.createNftSales(toCreateSales);
                        await this._storySvc.updateNftSales(toUpdateSales);
                    }
                }
                this.logger.debug(`${txProcessNum} transactions are processed.`);
            } catch (err) {
                this.logger.debug(`Sync Stellar Error:\n${err}`);
            } finally {
                await new Promise((res) => setTimeout(res, INTERVALS));
            }
        }
    }
}
