"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useWriteContract,
  useAccount,
  useChainId,
  usePublicClient,
} from "wagmi";
import { erc20Abi } from "viem";
import { dexAggregatorAbi } from "@/lib/contracts/abis";
import { getContractAddresses } from "@/lib/contracts/addresses";
import { getSwapQuote, SwapQuote, calculateMinOutput } from "@/lib/dex/0xSwap";
import { useToast } from "@/components/ui/toast";

export interface UseDEXAggregatorResult {
  // State
  isLoading: boolean;
  isPending: boolean;
  error: string | null;
  quote: SwapQuote | null;

  // Functions
  getQuote: (
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint,
    slippage?: number
  ) => Promise<SwapQuote | null>;

  swap: (
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint,
    quote: SwapQuote
  ) => Promise<`0x${string}` | null>;

  swapWithQuote: (
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint,
    slippage?: number
  ) => Promise<`0x${string}` | null>;

  // For CDP integration
  getSwapDataForCDP: (
    collateralToken: `0x${string}`,
    debtToken: `0x${string}`,
    collateralAmount: bigint,
    slippage?: number
  ) => Promise<{ callData: `0x${string}`; minAmountOut: bigint } | null>;

  // Contract info
  contractAddress: `0x${string}` | null;
}

export function useDEXAggregator(): UseDEXAggregatorResult {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);

  const addresses = useMemo(() => getContractAddresses(chainId), [chainId]);
  const contractAddress = addresses?.DEXAggregator ?? null;

  const { writeContractAsync, isPending } = useWriteContract();

  // Get swap quote from 0x API
  const getQuote = useCallback(
    async (
      tokenIn: `0x${string}`,
      tokenOut: `0x${string}`,
      amountIn: bigint,
      slippage: number = 0.01
    ): Promise<SwapQuote | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const swapQuote = await getSwapQuote(
          {
            sellToken: tokenIn,
            buyToken: tokenOut,
            sellAmount: amountIn,
            slippagePercentage: slippage,
            takerAddress: contractAddress || undefined,
          },
          chainId
        );

        setQuote(swapQuote);
        return swapQuote;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to get quote";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chainId, contractAddress]
  );

  // Execute swap through DEXAggregator contract
  const swap = useCallback(
    async (
      tokenIn: `0x${string}`,
      tokenOut: `0x${string}`,
      amountIn: bigint,
      swapQuote: SwapQuote
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address || !publicClient) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Check allowance
        const allowance = await publicClient.readContract({
          address: tokenIn,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, contractAddress],
        });

        // Approve if needed
        if (allowance < amountIn) {
          addToast({
            type: "info",
            title: "Approval Required",
            description: "Please approve token spending",
          });

          const approveHash = await writeContractAsync({
            address: tokenIn,
            abi: erc20Abi,
            functionName: "approve",
            args: [contractAddress, amountIn],
          });

          await publicClient.waitForTransactionReceipt({ hash: approveHash });

          addToast({
            type: "success",
            title: "Approval Successful",
            description: "Now executing swap",
          });
        }

        // Calculate minimum output with slippage
        const minAmountOut = calculateMinOutput(BigInt(swapQuote.buyAmount), 0.01);

        addToast({
          type: "info",
          title: "Executing Swap",
          description: "Please confirm the transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: dexAggregatorAbi,
          functionName: "swapExactInput",
          args: [tokenIn, tokenOut, amountIn, minAmountOut, swapQuote.data],
        });

        addToast({
          type: "success",
          title: "Swap Submitted",
          description: "Transaction is being processed",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Swap failed";
        setError(message);
        addToast({
          type: "error",
          title: "Swap Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, publicClient, writeContractAsync, addToast]
  );

  // Convenience function: get quote and swap in one call
  const swapWithQuote = useCallback(
    async (
      tokenIn: `0x${string}`,
      tokenOut: `0x${string}`,
      amountIn: bigint,
      slippage: number = 0.01
    ): Promise<`0x${string}` | null> => {
      const swapQuote = await getQuote(tokenIn, tokenOut, amountIn, slippage);
      if (!swapQuote) return null;

      return swap(tokenIn, tokenOut, amountIn, swapQuote);
    },
    [getQuote, swap]
  );

  // Get swap data for CDP operations (emergency close, etc.)
  const getSwapDataForCDP = useCallback(
    async (
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`,
      collateralAmount: bigint,
      slippage: number = 0.01
    ): Promise<{ callData: `0x${string}`; minAmountOut: bigint } | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const swapQuote = await getSwapQuote(
          {
            sellToken: collateralToken,
            buyToken: debtToken,
            sellAmount: collateralAmount,
            slippagePercentage: slippage,
            takerAddress: contractAddress || undefined,
          },
          chainId
        );

        const minAmountOut = calculateMinOutput(BigInt(swapQuote.buyAmount), slippage);

        return {
          callData: swapQuote.data,
          minAmountOut,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to get swap data";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chainId, contractAddress]
  );

  return {
    isLoading,
    isPending,
    error,
    quote,
    getQuote,
    swap,
    swapWithQuote,
    getSwapDataForCDP,
    contractAddress,
  };
}
