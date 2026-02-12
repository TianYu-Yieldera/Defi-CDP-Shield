"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { useCDPShield, SwapParams } from "./useCDPShield";
import { useDEXAggregator } from "./useDEXAggregator";
import { useToast } from "@/components/ui/toast";
import { getContractAddresses } from "@/lib/contracts/addresses";

export interface PositionAction {
  type: "reduce" | "partial" | "emergency" | "full";
  positionId: bigint;
  // For reduce leverage
  debtToRepay?: bigint;
  // For partial close
  percentage?: bigint;
  // For all swap operations
  collateralToken?: `0x${string}`;
  debtToken?: `0x${string}`;
  collateralAmount?: bigint;
  // Common
  slippage?: number;
  useFlashLoan?: boolean;
}

export interface UsePositionActionsResult {
  isLoading: boolean;
  error: string | null;

  // High-level actions
  executeAction: (action: PositionAction) => Promise<`0x${string}` | null>;

  // Individual actions with auto swap data
  reduceLeverageWithSwap: (
    positionId: bigint,
    debtToRepay: bigint,
    collateralToken: `0x${string}`,
    debtToken: `0x${string}`,
    collateralAmount: bigint,
    slippage?: number
  ) => Promise<`0x${string}` | null>;

  emergencyCloseWithSwap: (
    positionId: bigint,
    collateralToken: `0x${string}`,
    debtToken: `0x${string}`,
    collateralAmount: bigint,
    slippage?: number
  ) => Promise<`0x${string}` | null>;

  flashLoanEmergencyCloseWithSwap: (
    positionId: bigint,
    minAmountOut: bigint
  ) => Promise<`0x${string}` | null>;
}

export function usePositionActions(): UsePositionActionsResult {
  const { address } = useAccount();
  const chainId = useChainId();
  const { addToast } = useToast();

  const cdpShield = useCDPShield();
  const dexAggregator = useDEXAggregator();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = getContractAddresses(chainId);

  // Helper to build SwapParams struct
  const buildSwapParams = useCallback(
    (
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`,
      amountIn: bigint,
      minAmountOut: bigint,
      swapData: `0x${string}`
    ): SwapParams => ({
      dexAggregator: addresses?.DEXAggregator ?? ("0x0" as `0x${string}`),
      tokenIn: collateralToken,
      tokenOut: debtToken,
      amountIn,
      minAmountOut,
      swapData,
    }),
    [addresses]
  );

  // Reduce leverage with automatic swap data generation
  const reduceLeverageWithSwap = useCallback(
    async (
      positionId: bigint,
      debtToRepay: bigint,
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`,
      collateralAmount: bigint,
      slippage: number = 0.01
    ): Promise<`0x${string}` | null> => {
      if (!address) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Preparing Swap",
          description: "Getting optimal swap route...",
        });

        // Get swap data from 0x
        const swapData = await dexAggregator.getSwapDataForCDP(
          collateralToken,
          debtToken,
          collateralAmount,
          slippage
        );

        if (!swapData) {
          throw new Error("Failed to get swap data");
        }

        addToast({
          type: "info",
          title: "Executing Reduce Leverage",
          description: "Please confirm the transaction",
        });

        // Build SwapParams struct
        const swapParams = buildSwapParams(
          collateralToken,
          debtToken,
          collateralAmount,
          swapData.minAmountOut,
          swapData.callData
        );

        // Execute reduce leverage
        const hash = await cdpShield.reduceLeverage(
          positionId,
          debtToRepay,
          swapParams
        );

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        setError(message);
        addToast({
          type: "error",
          title: "Reduce Leverage Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, cdpShield, dexAggregator, addToast, buildSwapParams]
  );

  // Emergency close with automatic swap data generation
  const emergencyCloseWithSwap = useCallback(
    async (
      positionId: bigint,
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`,
      collateralAmount: bigint,
      slippage: number = 0.02 // Higher slippage for emergency
    ): Promise<`0x${string}` | null> => {
      if (!address) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Emergency Close",
          description: "Getting optimal swap route...",
        });

        // Get swap data from 0x
        const swapData = await dexAggregator.getSwapDataForCDP(
          collateralToken,
          debtToken,
          collateralAmount,
          slippage
        );

        if (!swapData) {
          throw new Error("Failed to get swap data");
        }

        addToast({
          type: "info",
          title: "Executing Emergency Close",
          description: "Please confirm - This is urgent!",
        });

        // Build SwapParams struct
        const swapParams = buildSwapParams(
          collateralToken,
          debtToken,
          collateralAmount,
          swapData.minAmountOut,
          swapData.callData
        );

        // Execute emergency close
        const hash = await cdpShield.emergencyClose(positionId, swapParams);

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Emergency close failed";
        setError(message);
        addToast({
          type: "error",
          title: "Emergency Close Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, cdpShield, dexAggregator, addToast, buildSwapParams]
  );

  // Flash loan emergency close (contract handles swap internally)
  const flashLoanEmergencyCloseWithSwap = useCallback(
    async (
      positionId: bigint,
      minAmountOut: bigint
    ): Promise<`0x${string}` | null> => {
      if (!address) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Flash Loan Emergency Close",
          description: "Initiating flash loan...",
        });

        // Execute flash loan emergency close
        const hash = await cdpShield.flashLoanEmergencyClose(
          positionId,
          minAmountOut
        );

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Flash loan failed";
        setError(message);
        addToast({
          type: "error",
          title: "Flash Loan Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, cdpShield, addToast]
  );

  // Generic action executor
  const executeAction = useCallback(
    async (action: PositionAction): Promise<`0x${string}` | null> => {
      switch (action.type) {
        case "reduce":
          if (
            !action.debtToRepay ||
            !action.collateralToken ||
            !action.debtToken ||
            !action.collateralAmount
          ) {
            setError("Missing parameters for reduce leverage");
            return null;
          }
          return reduceLeverageWithSwap(
            action.positionId,
            action.debtToRepay,
            action.collateralToken,
            action.debtToken,
            action.collateralAmount,
            action.slippage
          );

        case "partial":
          if (
            !action.percentage ||
            !action.collateralToken ||
            !action.debtToken ||
            !action.collateralAmount
          ) {
            setError("Missing parameters for partial close");
            return null;
          }
          {
            const swapData = await dexAggregator.getSwapDataForCDP(
              action.collateralToken,
              action.debtToken,
              action.collateralAmount,
              action.slippage
            );
            if (!swapData) return null;

            const swapParams = buildSwapParams(
              action.collateralToken,
              action.debtToken,
              action.collateralAmount,
              swapData.minAmountOut,
              swapData.callData
            );

            return cdpShield.partialClose(
              action.positionId,
              action.percentage,
              swapParams
            );
          }

        case "emergency":
          if (!action.collateralToken || !action.debtToken || !action.collateralAmount) {
            setError("Missing parameters for emergency close");
            return null;
          }
          if (action.useFlashLoan) {
            // For flash loan, we need to calculate expected output
            const swapData = await dexAggregator.getSwapDataForCDP(
              action.collateralToken,
              action.debtToken,
              action.collateralAmount,
              action.slippage
            );
            return flashLoanEmergencyCloseWithSwap(
              action.positionId,
              swapData?.minAmountOut ?? 0n
            );
          }
          return emergencyCloseWithSwap(
            action.positionId,
            action.collateralToken,
            action.debtToken,
            action.collateralAmount,
            action.slippage
          );

        case "full":
          if (!action.collateralToken || !action.debtToken || !action.collateralAmount) {
            setError("Missing parameters for full close");
            return null;
          }
          {
            const swapData = await dexAggregator.getSwapDataForCDP(
              action.collateralToken,
              action.debtToken,
              action.collateralAmount,
              action.slippage
            );
            if (!swapData) return null;

            const swapParams = buildSwapParams(
              action.collateralToken,
              action.debtToken,
              action.collateralAmount,
              swapData.minAmountOut,
              swapData.callData
            );

            return cdpShield.fullClose(action.positionId, swapParams);
          }

        default:
          setError("Unknown action type");
          return null;
      }
    },
    [
      cdpShield,
      dexAggregator,
      buildSwapParams,
      reduceLeverageWithSwap,
      emergencyCloseWithSwap,
      flashLoanEmergencyCloseWithSwap,
    ]
  );

  return {
    isLoading: isLoading || cdpShield.isLoading || dexAggregator.isLoading,
    error: error || cdpShield.error || dexAggregator.error,
    executeAction,
    reduceLeverageWithSwap,
    emergencyCloseWithSwap,
    flashLoanEmergencyCloseWithSwap,
  };
}
