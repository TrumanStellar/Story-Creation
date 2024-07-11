declare namespace Chain {
  interface ChainIntegration {
    /**
     * chain identifier.
     */
    chain: string;

    /**
     * chain readable name. eg.
     */
    name: string;

    /**
     * Story Factory address on chain
     */
    factoryAddress: string;

    /**
     * $Finds Token address
     */
    findsAddress: string;

    /**
     * Whether chain integration is enabled;
     */
    enabled: boolean;

    /**
     * Task Module Type
     * basic: use centralized task system
     * chain: use on-chain task system (ChainIntegration)
     */
    taskModule: TaskModuleType;

    /**
     * Verify the account is from publickey
     */
    isPkAccountMatched?: (pk: string, account: string) => Promise<boolean>;

    /**
     * verify the signature is account signed
     */
    isValidSignature: (params: IsValidSignatureParams) => Promise<boolean>;

    /**
     * Returns null if the story does not exist
     */
    getStory: (chainStoryId: string) => Promise<Story>;

    /**
     * Returns null if the story does not exist
     */
    getStoryNftSale: (chainStoryId: string) => Promise<NftSale>;
    /**
     * Returns null if the task does not exist
     */
    getTask: (chainStoryId: string, chainTaskId: string) => Promise<Task>;
    /**
     * Returns null if the submit does not exist
     */
    getSubmit: (
      chainStoryId: string,
      chainTaskId: string,
      chainSubmitId: string,
    ) => Promise<Submit>;
  }

  type TaskModuleType = 'chain' | 'basic';

  type IsValidSignatureParams = {
    signature: string;
    account: string;
    message: string;
  };

  type Story = {
    id: string;
    cid: string;
    author: string;
    addr: string;
  };

  type Task = {
    id: string;
    cid: string;
    creator: string;
    nft: string;
    rewardNfts: string[];
    status: 'TODO' | 'DONE' | 'CANCELLED';
  };

  type Submit = {
    id: string;
    cid: string;
    creator: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWED';
  };
}
