"use client";

import { useState, useCallback } from "react";
import { useWalletClient, usePublicClient, useChainId, useAccount } from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  getSwapQuote,
  getSwapPrice,
  SwapQuote,
  SwapPrice,
  ZxSwapError,
  getZxAllowanceTarget,
  calculateMinOutput,
  formatSwapSources,
} from "@/lib/dex/0xSwap";
import { useToast } from "@/components/ui/toast";

export interface UseSwapParams {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount: bigint;
  slippagePercentage?: number;
}

export interface SwapState {
  quote: SwapQuote | null;
  price: SwapPrice | null;
  isLoading: boolean;
  isApproving: boolean;
  isSwapping: boolean;
  error: string | null;
  needsApproval: boolean;
  sources: string;
}

export interface UseSwapResult extends SwapState {
  fetchQuote: (params: UseSwapParams) => Promise<SwapQuote | null>;
  fetchPrice: (params: UseSwapParams) => Promise<SwapPrice | null>;
  executeSwap: (quote: SwapQuote) => Promise<`0x${string}` | null>;
  approve: (token: `0x${string}`, amount: bigint) => Promise<boolean>;
  checkAllowance: (token: `0x${string}`, amount: bigint) => Promise<boolean>;
  reset: () => void;
}

export function useSwap(): UseSwapResult {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { address } = useAccount();
  const { addToast } = useToast();

  const [state, setState] = useState<SwapState>({
    quote: null,
    price: null,
    isLoading: false,
    isApproving: false,
    isSwapping: false,
    error: null,
    needsApproval: false,
    sources: "",
  });

  const reset = useCallback(() => {
    setState({
      quote: null,
      price: null,
      isLoading: false,
      isApproving: false,
      isSwapping: false,
      error: null,
      needsApproval: false,
      sources: "",
    });
  }, []);

  const checkAllowance = useCallback(
    async (token: `0x${string}`, amount: bigint): Promise<boolean> => {
      if (!publicClient || !address) return false;

      try {
        const allowanceTarget = getZxAllowanceTarget(chainId);
        const allowance = await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, allowanceTarget],
        });

        return allowance >= amount;
      } catch (error) {
        console.error("Failed to check allowance:", error);
        return false;
      }
    },
    [publicClient, address, chainId]
  );

  const fetchPrice = useCallback(
    async (params: UseSwapParams): Promise<SwapPrice | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const price = await getSwapPrice(
          {
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.sellAmount,
          },
          chainId
        );

        const sources = formatSwapSources(price.sources);
        setState((prev) => ({ ...prev, price, sources, isLoading: false }));
        return price;
      } catch (error) {
        const message =
          error instanceof ZxSwapError ? error.message : "Failed to fetch price";
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
        return null;
      }
    },
    [chainId]
  );

  const fetchQuote = useCallback(
    async (params: UseSwapParams): Promise<SwapQuote | null> => {
      if (!address) {
        setState((prev) => ({
          ...prev,
          error: "Wallet not connected",
        }));
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const quote = await getSwapQuote(
          {
            sellToken: params.sellToken,
            buyToken: params.buyToken,
            sellAmount: params.sellAmount,
            slippagePercentage: params.slippagePercentage,
            takerAddress: address,
          },
          chainId
        );

        const needsApproval = !(await checkAllowance(
          params.sellToken,
          params.sellAmount
        ));
        const sources = formatSwapSources(quote.sources);

        setState((prev) => ({
          ...prev,
          quote,
          sources,
          needsApproval,
          isLoading: false,
        }));

        return quote;
      } catch (error) {
        const message =
          error instanceof ZxSwapError ? error.message : "Failed to fetch quote";
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
        addToast({
          type: "error",
          title: "Quote Failed",
          description: message,
        });
        return null;
      }
    },
    [address, chainId, checkAllowance, addToast]
  );

  const approve = useCallback(
    async (token: `0x${string}`, amount: bigint): Promise<boolean> => {
      if (!walletClient || !publicClient || !address) {
        addToast({
          type: "error",
          title: "Wallet not connected",
          description: "Please connect your wallet first",
        });
        return false;
      }

      setState((prev) => ({ ...prev, isApproving: true }));

      try {
        const allowanceTarget = getZxAllowanceTarget(chainId);

        addToast({
          type: "info",
          title: "Approving token",
          description: "Please confirm the approval transaction",
        });

        const hash = await walletClient.writeContract({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [allowanceTarget, amount],
        });

        addToast({
          type: "info",
          title: "Waiting for confirmation",
          description: "Transaction submitted, waiting for confirmation",
        });

        await publicClient.waitForTransactionReceipt({ hash });

        setState((prev) => ({ ...prev, isApproving: false, needsApproval: false }));
        addToast({
          type: "success",
          title: "Approval successful",
          description: "Token approved for swapping",
        });

        return true;
      } catch (error) {
        console.error("Approval failed:", error);
        setState((prev) => ({ ...prev, isApproving: false }));
        addToast({
          type: "error",
          title: "Approval failed",
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      }
    },
    [walletClient, publicClient, address, chainId, addToast]
  );

  const executeSwap = useCallback(
    async (quote: SwapQuote): Promise<`0x${string}` | null> => {
      if (!walletClient || !publicClient || !address) {
        addToast({
          type: "error",
          title: "Wallet not connected",
          description: "Please connect your wallet first",
        });
        return null;
      }

      setState((prev) => ({ ...prev, isSwapping: true }));

      try {
        addToast({
          type: "info",
          title: "Executing swap",
          description: "Please confirm the swap transaction",
        });

        const hash = await walletClient.sendTransaction({
          to: quote.to,
          data: quote.data,
          value: BigInt(quote.value),
          account: address,
          chain: walletClient.chain,
        });

        addToast({
          type: "info",
          title: "Swap submitted",
          description: "Waiting for confirmation",
        });

        await publicClient.waitForTransactionReceipt({ hash });

        setState((prev) => ({ ...prev, isSwapping: false, quote: null }));
        addToast({
          type: "success",
          title: "Swap successful",
          description: `Swapped successfully via ${formatSwapSources(quote.sources)}`,
        });

        return hash;
      } catch (error) {
        console.error("Swap failed:", error);
        setState((prev) => ({ ...prev, isSwapping: false }));
        addToast({
          type: "error",
          title: "Swap failed",
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return null;
      }
    },
    [walletClient, publicClient, address, addToast]
  );

  return {
    ...state,
    fetchQuote,
    fetchPrice,
    executeSwap,
    approve,
    checkAllowance,
    reset,
  };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: string | bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string {
  const value = typeof amount === "string" ? amount : amount.toString();
  const formatted = formatUnits(BigInt(value), decimals);
  const num = parseFloat(formatted);

  if (num === 0) return "0";
  if (num < 0.0001) return "< 0.0001";

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  });
}

/**
 * Parse token amount from user input
 */
export function parseTokenAmount(
  input: string,
  decimals: number = 18
): bigint {
  try {
    return parseUnits(input, decimals);
  } catch {
    return 0n;
  }
}
