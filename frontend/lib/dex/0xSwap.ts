/**
 * 0x Protocol Swap API Integration
 * Provides DEX aggregation for optimal swap routes on BASE
 */

// BASE chain addresses
export const BASE_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006' as const,
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' as const,
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as const,
  cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' as const,
};

// BASE Sepolia addresses (testnet)
export const BASE_SEPOLIA_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006' as const,
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
};

// 0x Exchange Proxy addresses
export const ZX_EXCHANGE_PROXY = {
  BASE: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as const,
  BASE_SEPOLIA: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF' as const,
};

// API endpoints
const ZX_API_BASE = {
  BASE: 'https://base.api.0x.org',
  BASE_SEPOLIA: 'https://base-sepolia.api.0x.org',
};

export interface SwapQuoteParams {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount: bigint;
  slippagePercentage?: number;
  takerAddress?: `0x${string}`;
}

export interface SwapSource {
  name: string;
  proportion: string;
}

export interface SwapQuote {
  chainId: number;
  price: string;
  grossPrice: string;
  estimatedPriceImpact: string;
  value: string;
  gasPrice: string;
  gas: string;
  estimatedGas: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  buyAmount: string;
  grossBuyAmount: string;
  sellTokenAddress: string;
  sellAmount: string;
  grossSellAmount: string;
  sources: SwapSource[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
  expectedSlippage: string | null;
  // Transaction data
  to: `0x${string}`;
  data: `0x${string}`;
}

export interface SwapPriceParams {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount?: bigint;
  buyAmount?: bigint;
}

export interface SwapPrice {
  chainId: number;
  price: string;
  grossPrice: string;
  estimatedPriceImpact: string;
  value: string;
  gasPrice: string;
  gas: string;
  estimatedGas: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  buyAmount: string;
  grossBuyAmount: string;
  sellTokenAddress: string;
  sellAmount: string;
  grossSellAmount: string;
  sources: SwapSource[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
}

export class ZxSwapError extends Error {
  constructor(
    message: string,
    public code?: string,
    public reason?: string
  ) {
    super(message);
    this.name = 'ZxSwapError';
  }
}

function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_0X_API_KEY;
  if (!apiKey) {
    throw new ZxSwapError('0x API key not configured', 'MISSING_API_KEY');
  }
  return apiKey;
}

function getApiBase(chainId: number): string {
  switch (chainId) {
    case 8453: // BASE Mainnet
      return ZX_API_BASE.BASE;
    case 84532: // BASE Sepolia
      return ZX_API_BASE.BASE_SEPOLIA;
    default:
      throw new ZxSwapError(`Unsupported chain: ${chainId}`, 'UNSUPPORTED_CHAIN');
  }
}

/**
 * Get swap price (indicative, no transaction data)
 */
export async function getSwapPrice(
  params: SwapPriceParams,
  chainId: number = 8453
): Promise<SwapPrice> {
  const apiBase = getApiBase(chainId);
  const apiKey = getApiKey();

  const searchParams = new URLSearchParams({
    sellToken: params.sellToken,
    buyToken: params.buyToken,
  });

  if (params.sellAmount) {
    searchParams.set('sellAmount', params.sellAmount.toString());
  } else if (params.buyAmount) {
    searchParams.set('buyAmount', params.buyAmount.toString());
  } else {
    throw new ZxSwapError('Either sellAmount or buyAmount required', 'INVALID_PARAMS');
  }

  const response = await fetch(`${apiBase}/swap/v1/price?${searchParams}`, {
    headers: {
      '0x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ZxSwapError(
      error.reason || `API error: ${response.status}`,
      error.code,
      error.reason
    );
  }

  return response.json();
}

/**
 * Get swap quote with transaction data
 */
export async function getSwapQuote(
  params: SwapQuoteParams,
  chainId: number = 8453
): Promise<SwapQuote> {
  const apiBase = getApiBase(chainId);
  const apiKey = getApiKey();

  const searchParams = new URLSearchParams({
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    sellAmount: params.sellAmount.toString(),
    slippagePercentage: (params.slippagePercentage ?? 0.01).toString(),
  });

  if (params.takerAddress) {
    searchParams.set('takerAddress', params.takerAddress);
  }

  const response = await fetch(`${apiBase}/swap/v1/quote?${searchParams}`, {
    headers: {
      '0x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ZxSwapError(
      error.reason || `API error: ${response.status}`,
      error.code,
      error.reason
    );
  }

  const quote = await response.json();

  return {
    ...quote,
    to: quote.to as `0x${string}`,
    data: quote.data as `0x${string}`,
  };
}

/**
 * Calculate minimum output with slippage protection
 */
export function calculateMinOutput(
  expectedOutput: bigint,
  slippagePercentage: number = 0.01
): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercentage * 10000));
  const minOutput = (expectedOutput * (10000n - slippageBps)) / 10000n;
  return minOutput;
}

/**
 * Format swap sources for display
 */
export function formatSwapSources(sources: SwapSource[]): string {
  return sources
    .filter((s) => parseFloat(s.proportion) > 0)
    .map((s) => `${s.name} (${(parseFloat(s.proportion) * 100).toFixed(0)}%)`)
    .join(', ');
}

/**
 * Get token symbol from address
 */
export function getTokenSymbol(
  address: `0x${string}`,
  chainId: number = 8453
): string {
  const tokens = chainId === 84532 ? BASE_SEPOLIA_TOKENS : BASE_TOKENS;

  const normalizedAddress = address.toLowerCase();
  for (const [symbol, tokenAddress] of Object.entries(tokens)) {
    if (tokenAddress.toLowerCase() === normalizedAddress) {
      return symbol;
    }
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Check if token needs approval for 0x
 */
export function getZxAllowanceTarget(chainId: number = 8453): `0x${string}` {
  return chainId === 84532
    ? ZX_EXCHANGE_PROXY.BASE_SEPOLIA
    : ZX_EXCHANGE_PROXY.BASE;
}
