'use client';

import { useEffect } from 'react';
import { JudgeMode } from '@/components/demo';
import { DemoControlPanel } from '@/components/demo';
import { useCDPStore } from '@/store/cdpStore';
import type { CDPPosition } from '@/types';

// 演示用示例仓位数据
const DEMO_POSITIONS: CDPPosition[] = [
  {
    id: 'demo-eth-aave',
    protocol: 'Aave V3',
    collateralAmount: 10,
    collateralToken: 'ETH',
    collateralValueUSD: 35000,
    borrowedAmount: 15000,
    borrowedToken: 'USDC',
    borrowedValueUSD: 15000,
    healthFactor: 1.8,
    liquidationPrice: 2100,
    currentPrice: 3500,
    apy: 3.2,
    timestamp: Date.now(),
  },
  {
    id: 'demo-wbtc-compound',
    protocol: 'Compound V3',
    collateralAmount: 0.5,
    collateralToken: 'WBTC',
    collateralValueUSD: 48000,
    borrowedAmount: 20000,
    borrowedToken: 'USDC',
    borrowedValueUSD: 20000,
    healthFactor: 2.1,
    liquidationPrice: 52000,
    currentPrice: 96000,
    apy: 2.8,
    timestamp: Date.now(),
  },
];

export default function DemoPage() {
  useEffect(() => {
    const store = useCDPStore.getState();
    if (store.positions.length === 0) {
      store.setPositions(DEMO_POSITIONS);
    }
  }, []);

  return (
    <>
      <JudgeMode language="en" />
      <DemoControlPanel />
    </>
  );
}
