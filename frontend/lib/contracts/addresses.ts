/**
 * Contract addresses for CDP Shield
 * BASE Sepolia Testnet
 */

export const CHAIN_IDS = {
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532,
} as const;

export interface ContractAddresses {
  CDPShield: `0x${string}`;
  DEXAggregator: `0x${string}`;
  FlashLoanReceiver: `0x${string}`;
  MockAavePool: `0x${string}`;
  MockPriceOracle: `0x${string}`;
  MockWETH: `0x${string}`;
  MockUSDC: `0x${string}`;
  MockDAI: `0x${string}`;
}

// BASE Sepolia Testnet addresses
export const BASE_SEPOLIA_ADDRESSES: ContractAddresses = {
  CDPShield: '0xe2E8d33CB59CfCA118EF5F44A24764e7b88A4534',
  DEXAggregator: '0x9099f10611807D3Be5cd901BaAc42AEF7A4a3658',
  FlashLoanReceiver: '0xDd02C2734410bbc865Fc28715a0F0755416E18d7',
  MockAavePool: '0xdF47B2cb7d2a224E3701bEDbe1Cf00D9085e7191',
  MockPriceOracle: '0xb1317a834a22CE7E4b26dEcb566F6Fe3D795e42E',
  MockWETH: '0xD6d436677E6F9EbC729A5eC9D76b8f3B9F79807F',
  MockUSDC: '0xfB7CAe102DbF4a52dcD57E4EaC9eAd9fc41584b1',
  MockDAI: '0x9C0b8124781F2710Fa7f5c8D8e919941aA216c1E',
};

// BASE Mainnet addresses (to be deployed)
export const BASE_MAINNET_ADDRESSES: Partial<ContractAddresses> = {
  // Will be populated after mainnet deployment
};

// 0x Exchange Proxy addresses
export const ZX_EXCHANGE_PROXY = {
  [CHAIN_IDS.BASE_MAINNET]: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as const,
  [CHAIN_IDS.BASE_SEPOLIA]: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as const,
};

// Get addresses by chain ID
export function getContractAddresses(chainId: number): ContractAddresses | null {
  switch (chainId) {
    case CHAIN_IDS.BASE_SEPOLIA:
      return BASE_SEPOLIA_ADDRESSES;
    case CHAIN_IDS.BASE_MAINNET:
      return BASE_MAINNET_ADDRESSES as ContractAddresses;
    default:
      return null;
  }
}

// Token addresses for swaps
export const SWAP_TOKENS = {
  [CHAIN_IDS.BASE_SEPOLIA]: {
    WETH: BASE_SEPOLIA_ADDRESSES.MockWETH,
    USDC: BASE_SEPOLIA_ADDRESSES.MockUSDC,
    DAI: BASE_SEPOLIA_ADDRESSES.MockDAI,
  },
  [CHAIN_IDS.BASE_MAINNET]: {
    WETH: '0x4200000000000000000000000000000000000006' as const,
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as const,
  },
};

// Token metadata
export const TOKEN_INFO = {
  WETH: { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
  USDC: { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  DAI: { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
} as const;
