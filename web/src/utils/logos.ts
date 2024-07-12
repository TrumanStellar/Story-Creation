import FreighterLogo from '@/assets/freighter-logo.png';
import StellarLogo from '@/assets/stellar-logo.svg';
import { ChainType, WalletType } from '@/wallets';

export const ChainLogos: Record<ChainType, string> = {
  [ChainType.Stellar]: StellarLogo,
};

export const WalletLogos: Record<WalletType, string> = {
  [WalletType.Freighter]: FreighterLogo,
};
