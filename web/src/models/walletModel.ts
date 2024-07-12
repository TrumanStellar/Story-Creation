import { getChains } from '@/services/api';
import { ChainLogos, WalletLogos } from '@/utils/logos';
import {
  getTokenFromStorage,
  getTokenMessage,
  refreshToken,
} from '@/utils/token';
import { ChainType, WalletProvider, WalletType } from '@/wallets';
import { FreighterWalletProvider } from '@/wallets/Freighter';
import { useRequest } from 'ahooks';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ChainWallet {
  chainType: ChainType;
  icon: string;
  wallets: Wallet[];
}

interface Wallet {
  name: string;
  icon: string;
  walletType: WalletType;
  provider: WalletProvider;
  noShortenAccount?: boolean;
  noSignature?: boolean;
}

export default () => {
  const [connecting, setConnecting] = useState(false);

  const { data: chains } = useRequest(async () => {
    return (await getChains()).chains;
  });

  const [connectedWallets, setConnectedWallets] = useState<
    Record<ChainType, Wallet | undefined>
  >({
    [ChainType.Stellar]: undefined,
  });

  const [accounts, setAccounts] = useState<Record<ChainType, string>>({
    [ChainType.Stellar]: '',
  });

  const [pubKeys, setPubKeys] = useState<Record<ChainType, string>>({
    [ChainType.Stellar]: '',
  });

  const getWalletEvents = (walletType: WalletType) => {
    return {
      onConnect: (payload: { address: string; pubKey?: string }) => {
        const { address, pubKey } = payload;
        const chainType = getChainType(walletType);
        setAccounts((accounts) => ({
          ...accounts,
          [chainType]: address,
        }));
        setPubKeys((pubKeys) => ({
          ...pubKeys,
          [chainType]: pubKey || '',
        }));
        setConnectedWallets((state) => ({
          ...state,
          [chainType]: wallets.find((w) => w.walletType === walletType)!!,
        }));
      },
      onDisconnect: () => {
        const chainType = getChainType(walletType);
        setAccounts((accounts) => ({
          ...accounts,
          [chainType]: '',
        }));
        setConnectedWallets((state) => ({
          ...state,
          [chainType]: undefined,
        }));
      },
      onAccountChanged: (payload: { address: string; pubKey?: string }) => {
        const { address, pubKey } = payload;
        const chainType = getChainType(walletType);
        setAccounts((accounts) => ({
          ...accounts,
          [chainType]: address,
        }));
        setPubKeys((pubKeys) => ({
          ...pubKeys,
          [chainType]: pubKey || '',
        }));
      },
    };
  };

  const chainWallets: ChainWallet[] = useMemo(() => {
    if (!chains || chains.length === 0) return [];

    const _chainWallets: ChainWallet[] = [];
    const stellarChainInfo = chains.find((c) => c.type === ChainType.Stellar);
    stellarChainInfo &&
      _chainWallets.push({
        chainType: ChainType.Stellar,
        icon: ChainLogos[ChainType.Stellar],
        wallets: [
          {
            name: 'Freighter',
            icon: WalletLogos[WalletType.Freighter],
            walletType: WalletType.Freighter,
            provider: new FreighterWalletProvider(
              getWalletEvents(WalletType.Freighter),
              stellarChainInfo.factoryAddress,
              stellarChainInfo.findsAddress,
            ),
          },
        ],
      });

    return _chainWallets;
  }, [chains]);

  const getChainType = useCallback(
    (walletType: WalletType) => {
      return chainWallets.find((chainWallet) =>
        chainWallet.wallets.find((wallet) => wallet.walletType === walletType),
      )!!.chainType;
    },
    [chainWallets],
  );

  const wallets = useMemo(() => {
    let wallets: Wallet[] = [];
    for (const cw of chainWallets) {
      wallets = [...wallets, ...cw.wallets];
    }
    return wallets;
  }, [chainWallets]);

  const connect = useCallback(
    async (walletType: WalletType) => {
      const _wallet = wallets.find((w) => w.walletType === walletType);
      if (_wallet) {
        if (await _wallet.provider.isAvailable()) {
          try {
            setConnecting(true);
            await _wallet.provider.connect();
          } catch (e) {
          } finally {
            setConnecting(false);
          }
        } else {
          _wallet.provider.openWebsite();
        }
      }
    },
    [wallets],
  );

  const disconnect = useCallback(
    async (chainType: ChainType) => {
      const wallet = connectedWallets[chainType];
      await wallet?.provider.disconnect();
    },
    [connectedWallets],
  );

  useEffect(() => {
    for (const _wallet of wallets) {
      if (_wallet.provider.getAutoConnect()) {
        _wallet?.provider.silentConnect();
      }
    }
  }, [chainWallets]);

  const getToken = useCallback(
    (chainType: ChainType) => {
      if (!chainType) return;
      const account = accounts[chainType];
      if (!account) {
        return '';
      } else {
        return getTokenFromStorage(account, chainType);
      }
    },
    [accounts, connectedWallets],
  );

  const getTokenAsync = useCallback(
    async (chainType: ChainType, refresh = false) => {
      if (!chainType) return;
      const account = accounts[chainType];
      const pubKey = pubKeys[chainType];
      if (!account) {
        return '';
      } else {
        const token = getTokenFromStorage(account, chainType);
        if (!token && refresh) {
          const message = getTokenMessage();
          const wallet = connectedWallets[chainType];
          if (!wallet) {
            return '';
          }
          if (wallet.noSignature) {
            return await refreshToken(account, chainType, message, '', '');
          } else {
            const signature = await wallet.provider.signMessage(message);
            return await refreshToken(
              account,
              chainType,
              message,
              pubKey,
              signature,
            );
          }
        }
        return token;
      }
    },
    [accounts, connectedWallets],
  );

  return {
    chainWallets,
    connectedWallets,
    wallets,
    accounts,
    connect,
    connecting,
    disconnect,
    getToken,
    getTokenAsync,
    chains,
  };
};
