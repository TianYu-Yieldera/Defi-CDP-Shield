'use client';

import { SwapTestPanel } from '@/components/swap';

export default function SwapTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">0x Swap Test</h1>
        <SwapTestPanel />
      </div>
    </div>
  );
}
