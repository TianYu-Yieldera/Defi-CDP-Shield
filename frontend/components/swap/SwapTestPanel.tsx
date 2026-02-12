"use client";

import { useState } from "react";
import { useChainId, useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useSwap, formatTokenAmount, parseTokenAmount } from "@/hooks/useSwap";
import { getSwapPrice, getSwapQuote } from "@/lib/dex/0xSwap";
import { SWAP_TOKENS, TOKEN_INFO, CHAIN_IDS } from "@/lib/contracts/addresses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowDownUp, CheckCircle, XCircle, Info } from "lucide-react";

type TokenSymbol = "WETH" | "USDC" | "DAI";

export function SwapTestPanel() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const {
    quote,
    isLoading,
    isApproving,
    isSwapping,
    error,
    needsApproval,
    sources,
    fetchQuote,
    approve,
    executeSwap,
    reset,
  } = useSwap();

  const [sellToken, setSellToken] = useState<TokenSymbol>("WETH");
  const [buyToken, setBuyToken] = useState<TokenSymbol>("USDC");
  const [sellAmount, setSellAmount] = useState("0.001");
  const [pricePreview, setPricePreview] = useState<string | null>(null);

  const tokens = SWAP_TOKENS[chainId as keyof typeof SWAP_TOKENS] || SWAP_TOKENS[CHAIN_IDS.BASE_SEPOLIA];
  const isTestnet = chainId === CHAIN_IDS.BASE_SEPOLIA;

  const handleGetPrice = async () => {
    if (!sellAmount || parseFloat(sellAmount) <= 0) return;

    try {
      const sellTokenInfo = TOKEN_INFO[sellToken];
      const amount = parseUnits(sellAmount, sellTokenInfo.decimals);

      const price = await getSwapPrice(
        {
          sellToken: tokens[sellToken] as `0x${string}`,
          buyToken: tokens[buyToken] as `0x${string}`,
          sellAmount: amount,
        },
        chainId
      );

      const buyTokenInfo = TOKEN_INFO[buyToken];
      const formattedBuyAmount = formatUnits(BigInt(price.buyAmount), buyTokenInfo.decimals);
      setPricePreview(formattedBuyAmount);
    } catch (err) {
      console.error("Price fetch error:", err);
      setPricePreview(null);
    }
  };

  const handleGetQuote = async () => {
    if (!sellAmount || parseFloat(sellAmount) <= 0) return;

    const sellTokenInfo = TOKEN_INFO[sellToken];
    const amount = parseUnits(sellAmount, sellTokenInfo.decimals);

    await fetchQuote({
      sellToken: tokens[sellToken] as `0x${string}`,
      buyToken: tokens[buyToken] as `0x${string}`,
      sellAmount: amount,
      slippagePercentage: 0.01,
    });
  };

  const handleApprove = async () => {
    if (!quote) return;

    const sellTokenInfo = TOKEN_INFO[sellToken];
    const amount = parseUnits(sellAmount, sellTokenInfo.decimals);

    await approve(tokens[sellToken] as `0x${string}`, amount);
  };

  const handleSwap = async () => {
    if (!quote) return;
    await executeSwap(quote);
  };

  const swapTokens = () => {
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
    setPricePreview(null);
    reset();
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>0x Swap Test</CardTitle>
          <CardDescription>Connect wallet to test swap</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please connect your wallet first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="w-5 h-5" />
          0x Swap Test
        </CardTitle>
        <CardDescription>
          Test 0x Protocol DEX aggregation on {isTestnet ? "BASE Sepolia" : "BASE"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sell Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Sell</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => {
                setSellAmount(e.target.value);
                setPricePreview(null);
              }}
              className="flex-1 px-3 py-2 border rounded-md"
              placeholder="0.0"
              step="0.001"
              min="0"
            />
            <select
              value={sellToken}
              onChange={(e) => {
                setSellToken(e.target.value as TokenSymbol);
                setPricePreview(null);
                reset();
              }}
              className="px-3 py-2 border rounded-md"
            >
              <option value="WETH">WETH</option>
              <option value="USDC">USDC</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={swapTokens}>
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        {/* Buy Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Buy</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={
                quote
                  ? formatTokenAmount(quote.buyAmount, TOKEN_INFO[buyToken].decimals)
                  : pricePreview || ""
              }
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-gray-50"
              placeholder="0.0"
            />
            <select
              value={buyToken}
              onChange={(e) => {
                setBuyToken(e.target.value as TokenSymbol);
                setPricePreview(null);
                reset();
              }}
              className="px-3 py-2 border rounded-md"
            >
              <option value="USDC">USDC</option>
              <option value="WETH">WETH</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
        </div>

        {/* Price Info */}
        {(pricePreview || quote) && (
          <div className="p-3 bg-gray-50 rounded-md text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate</span>
              <span>
                1 {sellToken} ={" "}
                {quote
                  ? (
                      parseFloat(formatUnits(BigInt(quote.buyAmount), TOKEN_INFO[buyToken].decimals)) /
                      parseFloat(sellAmount)
                    ).toFixed(4)
                  : pricePreview
                  ? (parseFloat(pricePreview) / parseFloat(sellAmount)).toFixed(4)
                  : "..."}{" "}
                {buyToken}
              </span>
            </div>
            {sources && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sources</span>
                <span className="text-xs">{sources}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {!quote ? (
            <>
              <Button
                onClick={handleGetPrice}
                variant="outline"
                className="w-full"
                disabled={isLoading || !sellAmount}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Info className="w-4 h-4 mr-2" />
                )}
                Get Price
              </Button>
              <Button
                onClick={handleGetQuote}
                className="w-full"
                disabled={isLoading || !sellAmount}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Get Quote
              </Button>
            </>
          ) : needsApproval ? (
            <Button
              onClick={handleApprove}
              className="w-full"
              disabled={isApproving}
            >
              {isApproving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve {sellToken}
            </Button>
          ) : (
            <Button
              onClick={handleSwap}
              className="w-full"
              disabled={isSwapping}
            >
              {isSwapping ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Swap
            </Button>
          )}

          {quote && (
            <Button variant="ghost" onClick={reset} className="w-full">
              Reset
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          <p>Powered by 0x Protocol</p>
          <p>Chain: {isTestnet ? "BASE Sepolia (Testnet)" : "BASE Mainnet"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
