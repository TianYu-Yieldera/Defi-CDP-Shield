"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useWriteContract,
  useAccount,
  useChainId,
  usePublicClient,
} from "wagmi";
import { cdpShieldAbi } from "@/lib/contracts/abis";
import { getContractAddresses } from "@/lib/contracts/addresses";
import { useToast } from "@/components/ui/toast";

// SwapParams struct from contract
export interface SwapParams {
  dexAggregator: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
  swapData: `0x${string}`;
}

// Position struct from contract
export interface ContractPosition {
  owner: `0x${string}`;
  protocol: `0x${string}`;
  collateralToken: `0x${string}`;
  debtToken: `0x${string}`;
  collateralAmount: bigint;
  debtAmount: bigint;
  healthFactor: bigint;
  status: number; // 0 = Active, 1 = Closed, 2 = Liquidated
  lastUpdated: bigint;
}

export interface UseCDPShieldResult {
  // State
  isLoading: boolean;
  isPending: boolean;
  error: string | null;

  // Read functions
  getPosition: (positionId: bigint) => Promise<ContractPosition | null>;
  getUserPositions: (user: `0x${string}`) => Promise<bigint[]>;
  calculateHealthFactor: (
    collateralAmount: bigint,
    debtAmount: bigint,
    collateralToken: `0x${string}`,
    debtToken: `0x${string}`
  ) => Promise<bigint>;

  // Write functions
  registerPosition: (
    protocol: `0x${string}`,
    collateralToken: `0x${string}`,
    debtToken: `0x${string}`,
    collateralAmount: bigint,
    debtAmount: bigint
  ) => Promise<`0x${string}` | null>;

  reduceLeverage: (
    positionId: bigint,
    debtToRepay: bigint,
    swapParams: SwapParams
  ) => Promise<`0x${string}` | null>;

  partialClose: (
    positionId: bigint,
    percentage: bigint,
    swapParams: SwapParams
  ) => Promise<`0x${string}` | null>;

  emergencyClose: (
    positionId: bigint,
    swapParams: SwapParams
  ) => Promise<`0x${string}` | null>;

  fullClose: (
    positionId: bigint,
    swapParams: SwapParams
  ) => Promise<`0x${string}` | null>;

  // Flash loan functions (simplified params - contract handles swap internally)
  flashLoanReduceLeverage: (
    positionId: bigint,
    debtToRepay: bigint,
    minAmountOut: bigint
  ) => Promise<`0x${string}` | null>;

  flashLoanEmergencyClose: (
    positionId: bigint,
    minAmountOut: bigint
  ) => Promise<`0x${string}` | null>;

  // Contract info
  contractAddress: `0x${string}` | null;
}

export function useCDPShield(): UseCDPShieldResult {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = useMemo(() => getContractAddresses(chainId), [chainId]);
  const contractAddress = addresses?.CDPShield ?? null;

  const { writeContractAsync, isPending } = useWriteContract();

  // Get position by ID
  const getPosition = useCallback(
    async (positionId: bigint): Promise<ContractPosition | null> => {
      if (!contractAddress || !publicClient) return null;

      try {
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "getPosition",
          args: [positionId],
        });

        const pos = result as {
          owner: `0x${string}`;
          protocol: `0x${string}`;
          collateralToken: `0x${string}`;
          debtToken: `0x${string}`;
          collateralAmount: bigint;
          debtAmount: bigint;
          healthFactor: bigint;
          status: number;
          lastUpdated: bigint;
        };

        return {
          owner: pos.owner,
          protocol: pos.protocol,
          collateralToken: pos.collateralToken,
          debtToken: pos.debtToken,
          collateralAmount: pos.collateralAmount,
          debtAmount: pos.debtAmount,
          healthFactor: pos.healthFactor,
          status: pos.status,
          lastUpdated: pos.lastUpdated,
        };
      } catch (err) {
        console.error("Failed to get position:", err);
        return null;
      }
    },
    [contractAddress, publicClient]
  );

  // Get user positions
  const getUserPositions = useCallback(
    async (user: `0x${string}`): Promise<bigint[]> => {
      if (!contractAddress || !publicClient) return [];

      try {
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "getUserPositions",
          args: [user],
        });

        return result as bigint[];
      } catch (err) {
        console.error("Failed to get user positions:", err);
        return [];
      }
    },
    [contractAddress, publicClient]
  );

  // Calculate health factor
  const calculateHealthFactor = useCallback(
    async (
      collateralAmount: bigint,
      debtAmount: bigint,
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`
    ): Promise<bigint> => {
      if (!contractAddress || !publicClient) return 0n;

      try {
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "calculateHealthFactor",
          args: [collateralAmount, debtAmount, collateralToken, debtToken],
        });

        return result as bigint;
      } catch (err) {
        console.error("Failed to calculate health factor:", err);
        return 0n;
      }
    },
    [contractAddress, publicClient]
  );

  // Register a new position
  const registerPosition = useCallback(
    async (
      protocol: `0x${string}`,
      collateralToken: `0x${string}`,
      debtToken: `0x${string}`,
      collateralAmount: bigint,
      debtAmount: bigint
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Registering Position",
          description: "Please confirm the transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "registerPosition",
          args: [protocol, collateralToken, debtToken, collateralAmount, debtAmount],
        });

        addToast({
          type: "success",
          title: "Position Registered",
          description: "Your position is now being monitored",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        addToast({
          type: "error",
          title: "Registration Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Reduce leverage with SwapParams
  const reduceLeverage = useCallback(
    async (
      positionId: bigint,
      debtToRepay: bigint,
      swapParams: SwapParams
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Reducing Leverage",
          description: "Please confirm the transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "reduceLeverage",
          args: [positionId, debtToRepay, swapParams],
        });

        addToast({
          type: "success",
          title: "Transaction Submitted",
          description: "Waiting for confirmation",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        addToast({
          type: "error",
          title: "Transaction Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Partial close with SwapParams
  const partialClose = useCallback(
    async (
      positionId: bigint,
      percentage: bigint,
      swapParams: SwapParams
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Partial Close",
          description: "Please confirm the transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "partialClose",
          args: [positionId, percentage, swapParams],
        });

        addToast({
          type: "success",
          title: "Transaction Submitted",
          description: "Waiting for confirmation",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        addToast({
          type: "error",
          title: "Transaction Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Emergency close with SwapParams
  const emergencyClose = useCallback(
    async (
      positionId: bigint,
      swapParams: SwapParams
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Emergency Close",
          description: "Please confirm the transaction - This is urgent!",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "emergencyClose",
          args: [positionId, swapParams],
        });

        addToast({
          type: "success",
          title: "Emergency Close Submitted",
          description: "Position is being closed",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
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
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Full close with SwapParams
  const fullClose = useCallback(
    async (
      positionId: bigint,
      swapParams: SwapParams
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Full Close",
          description: "Please confirm the transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "fullClose",
          args: [positionId, swapParams],
        });

        addToast({
          type: "success",
          title: "Transaction Submitted",
          description: "Position is being fully closed",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        addToast({
          type: "error",
          title: "Transaction Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Flash loan reduce leverage (simplified - contract handles swap internally)
  const flashLoanReduceLeverage = useCallback(
    async (
      positionId: bigint,
      debtToRepay: bigint,
      minAmountOut: bigint
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Flash Loan Reduce Leverage",
          description: "Initiating flash loan transaction",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "flashLoanReduceLeverage",
          args: [positionId, debtToRepay, minAmountOut],
        });

        addToast({
          type: "success",
          title: "Flash Loan Submitted",
          description: "Leverage reduction in progress",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
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
    [contractAddress, address, writeContractAsync, addToast]
  );

  // Flash loan emergency close (simplified - contract handles swap internally)
  const flashLoanEmergencyClose = useCallback(
    async (
      positionId: bigint,
      minAmountOut: bigint
    ): Promise<`0x${string}` | null> => {
      if (!contractAddress || !address) {
        setError("Wallet not connected or contract not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        addToast({
          type: "info",
          title: "Flash Loan Emergency Close",
          description: "Initiating emergency flash loan",
        });

        const hash = await writeContractAsync({
          address: contractAddress,
          abi: cdpShieldAbi,
          functionName: "flashLoanEmergencyClose",
          args: [positionId, minAmountOut],
        });

        addToast({
          type: "success",
          title: "Emergency Flash Loan Submitted",
          description: "Position is being emergency closed",
        });

        return hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transaction failed";
        setError(message);
        addToast({
          type: "error",
          title: "Emergency Flash Loan Failed",
          description: message,
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractAddress, address, writeContractAsync, addToast]
  );

  return {
    isLoading,
    isPending,
    error,
    getPosition,
    getUserPositions,
    calculateHealthFactor,
    registerPosition,
    reduceLeverage,
    partialClose,
    emergencyClose,
    fullClose,
    flashLoanReduceLeverage,
    flashLoanEmergencyClose,
    contractAddress,
  };
}
