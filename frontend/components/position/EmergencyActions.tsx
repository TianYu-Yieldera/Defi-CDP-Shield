"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Zap, Shield } from "lucide-react";
import { usePositionActions } from "@/hooks/usePositionActions";
import { useDEXAggregator } from "@/hooks/useDEXAggregator";
import { SWAP_TOKENS, CHAIN_IDS, TOKEN_INFO } from "@/lib/contracts/addresses";
import { GasFreeBadge } from "@/components/ui/gas-free-badge";
import type { CDPPosition } from "@/types";

interface EmergencyActionsProps {
  position: CDPPosition;
  onSuccess?: () => void;
}

export function EmergencyActions({ position, onSuccess }: EmergencyActionsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { emergencyCloseWithSwap, flashLoanEmergencyCloseWithSwap, isLoading, error } =
    usePositionActions();
  const { getSwapDataForCDP } = useDEXAggregator();

  const [isPreparingSwap, setIsPreparingSwap] = useState(false);
  const [swapPreview, setSwapPreview] = useState<{
    expectedOutput: string;
    minOutput: string;
  } | null>(null);

  const tokens = SWAP_TOKENS[chainId as keyof typeof SWAP_TOKENS] || SWAP_TOKENS[CHAIN_IDS.BASE_SEPOLIA];

  // Helper to map token symbol to address
  const getTokenAddress = (symbol: string): `0x${string}` => {
    const normalizedSymbol = symbol.toUpperCase();
    if (normalizedSymbol === 'WETH' || normalizedSymbol === 'ETH') return tokens.WETH;
    if (normalizedSymbol === 'USDC') return tokens.USDC;
    if (normalizedSymbol === 'DAI') return tokens.DAI;
    return tokens.WETH; // fallback
  };

  // Helper to get token decimals
  const getTokenDecimals = (symbol: string): number => {
    const normalizedSymbol = symbol.toUpperCase();
    if (normalizedSymbol === 'WETH' || normalizedSymbol === 'ETH') return TOKEN_INFO.WETH.decimals;
    if (normalizedSymbol === 'USDC') return TOKEN_INFO.USDC.decimals;
    if (normalizedSymbol === 'DAI') return TOKEN_INFO.DAI.decimals;
    return 18; // fallback
  };

  // Get token addresses and decimals based on position
  const collateralToken = getTokenAddress(position.collateralToken);
  const debtToken = getTokenAddress(position.borrowedToken);
  const collateralDecimals = getTokenDecimals(position.collateralToken);
  const debtDecimals = getTokenDecimals(position.borrowedToken);

  const collateralAmount = parseUnits(position.collateralAmount.toString(), collateralDecimals);
  const debtAmount = parseUnits(position.borrowedAmount.toString(), debtDecimals);

  const isHighRisk = position.healthFactor < 1.3;
  const isCritical = position.healthFactor < 1.1;

  // Preview swap for emergency close
  const handlePreviewSwap = async () => {
    setIsPreparingSwap(true);
    try {
      const swapData = await getSwapDataForCDP(
        collateralToken,
        debtToken,
        collateralAmount,
        0.02 // 2% slippage for emergency
      );

      if (swapData) {
        setSwapPreview({
          expectedOutput: formatUnits(swapData.minAmountOut * 100n / 98n, 6), // Approximate expected
          minOutput: formatUnits(swapData.minAmountOut, 6),
        });
      }
    } catch (err) {
      console.error("Failed to preview swap:", err);
    } finally {
      setIsPreparingSwap(false);
    }
  };

  // Execute emergency close
  const handleEmergencyClose = async () => {
    const hash = await emergencyCloseWithSwap(
      BigInt(position.id),
      collateralToken,
      debtToken,
      collateralAmount,
      0.02
    );

    if (hash) {
      onSuccess?.();
    }
  };

  // Execute flash loan emergency close
  const handleFlashLoanEmergencyClose = async () => {
    // First get swap data to calculate minAmountOut
    const swapData = await getSwapDataForCDP(
      collateralToken,
      debtToken,
      collateralAmount,
      0.02 // 2% slippage
    );

    if (!swapData) {
      console.error("Failed to get swap data for flash loan");
      return;
    }

    const hash = await flashLoanEmergencyCloseWithSwap(
      BigInt(position.id),
      swapData.minAmountOut
    );

    if (hash) {
      onSuccess?.();
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">
            Connect wallet to manage position
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isCritical ? "border-red-500" : isHighRisk ? "border-orange-500" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <Shield className="w-5 h-5 text-blue-500" />
            )}
            <CardTitle>Emergency Actions</CardTitle>
          </div>
          <GasFreeBadge />
        </div>
        <CardDescription>
          {isCritical
            ? "Critical risk! Immediate action recommended."
            : isHighRisk
            ? "High risk position. Consider reducing exposure."
            : "Position is healthy. Emergency actions available if needed."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Factor Display */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Health Factor</span>
            <span
              className={`font-bold ${
                isCritical
                  ? "text-red-500"
                  : isHighRisk
                  ? "text-orange-500"
                  : "text-green-500"
              }`}
            >
              {position.healthFactor.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Swap Preview */}
        {swapPreview && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Expected Output</span>
              <span>{swapPreview.expectedOutput} USDC</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Minimum (2% slippage)</span>
              <span>{swapPreview.minOutput} USDC</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Preview Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePreviewSwap}
            disabled={isPreparingSwap || isLoading}
          >
            {isPreparingSwap ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Preview Swap
          </Button>

          {/* Emergency Close */}
          <Button
            variant={isCritical ? "destructive" : "default"}
            className="w-full"
            onClick={handleEmergencyClose}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4 mr-2" />
            )}
            Emergency Close
          </Button>

          {/* Flash Loan Emergency Close */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleFlashLoanEmergencyClose}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Flash Loan Close (No Upfront Capital)
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Emergency Close:</strong> Converts collateral to debt token and repays loan.
          </p>
          <p>
            <strong>Flash Loan Close:</strong> Uses Aave flash loan - no upfront capital needed.
          </p>
          <p>Powered by 0x Protocol for optimal swap rates.</p>
        </div>
      </CardContent>
    </Card>
  );
}
