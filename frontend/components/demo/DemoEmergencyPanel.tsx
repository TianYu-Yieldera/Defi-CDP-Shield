// DemoEmergencyPanel - 闪电贷紧急平仓模拟演示
// 无需钱包连接，展示 Flash Loan Emergency Close 核心流程

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Zap,
  Shield,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useCDPStore } from '@/store/cdpStore';
import { getVoiceService } from '@/services/voice/VoiceService';
import { playSound } from '@/services/voice/SoundGenerator';
import { triggerVibration } from '@/hooks/useVibration';

type FlashLoanStatus = 'idle' | 'preparing' | 'running' | 'success';

interface DemoEmergencyPanelProps {
  language?: 'en' | 'zh';
}

const FLASH_LOAN_STEPS = [
  { key: 'borrow',     en: 'Borrow 15,000 USDC via Aave V3 Flash Loan',  zh: '通过 Aave V3 闪电贷借入 15,000 USDC' },
  { key: 'repay-debt', en: 'Repay position debt → release collateral',    zh: '偿还仓位债务 → 释放抵押品' },
  { key: 'swap',       en: 'Swap 10 ETH → 34,930 USDC via 0x Protocol',  zh: '通过 0x 兑换 10 ETH → 34,930 USDC' },
  { key: 'repay-loan', en: 'Repay flash loan 15,000 USDC + 7.5 fee',     zh: '偿还闪电贷 15,000 USDC + 7.5 手续费' },
  { key: 'return',     en: 'Return 19,922.5 USDC to user',               zh: '返还 19,922.5 USDC 给用户' },
];

export function DemoEmergencyPanel({ language = 'zh' }: DemoEmergencyPanelProps) {
  const positions = useCDPStore((s) => s.positions);
  const updatePosition = useCDPStore((s) => s.updatePosition);

  const position = positions[0];

  const [status, setStatus] = useState<FlashLoanStatus>('idle');
  const [currentStep, setCurrentStep] = useState(-1);

  const [initialPosition] = useState(() => position ? { ...position } : null);

  const isHighRisk = position ? position.healthFactor < 1.3 : false;
  const isCritical = position ? position.healthFactor < 1.1 : false;
  const isClosed = status === 'success';
  const isProcessing = status === 'preparing' || status === 'running';

  // 执行闪电贷紧急平仓模拟
  const handleFlashLoanClose = useCallback(async () => {
    if (isProcessing || isClosed || !position) return;

    const voiceService = getVoiceService();

    // 准备阶段
    setStatus('preparing');
    setCurrentStep(-1);
    voiceService.speak(
      language === 'zh'
        ? '启动闪电贷紧急平仓。无需任何前置资金，全部在一笔原子交易中完成。'
        : 'Initiating flash loan emergency close. Zero upfront capital. All completed in one atomic transaction.',
      language
    );
    await new Promise((r) => setTimeout(r, 2500));

    // 逐步执行
    setStatus('running');
    for (let i = 0; i < FLASH_LOAN_STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 1500));
    }

    // 成功
    await new Promise((r) => setTimeout(r, 500));
    setStatus('success');
    playSound.success();
    triggerVibration('success');
    updatePosition(position.id, { healthFactor: 0 });

    voiceService.speak(
      language === 'zh'
        ? '闪电贷紧急平仓成功！零资金投入，零Gas费用，仓位已安全关闭。用户收回 19,922 USDC。'
        : 'Flash loan emergency close successful! Zero capital, zero gas. Position safely closed. User received 19,922 USDC.',
      language
    );
  }, [isProcessing, isClosed, language, position, updatePosition]);

  // 重置
  const handleReset = useCallback(() => {
    setStatus('idle');
    setCurrentStep(-1);
    if (initialPosition && position) {
      updatePosition(position.id, {
        healthFactor: initialPosition.healthFactor,
        currentPrice: initialPosition.currentPrice,
        collateralValueUSD: initialPosition.collateralValueUSD,
      });
    }
  }, [initialPosition, position, updatePosition]);

  if (!position) return null;

  return (
    <Card className={`w-full max-w-lg transition-all duration-300 ${
      isClosed
        ? 'border-green-500'
        : isCritical
        ? 'border-red-500 shadow-red-500/10 shadow-lg'
        : isHighRisk
        ? 'border-orange-500'
        : ''
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isClosed ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : isCritical ? (
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
            ) : (
              <Shield className="w-5 h-5 text-blue-500" />
            )}
            <CardTitle className="text-lg">
              {language === 'zh' ? '闪电贷紧急保护' : 'Flash Loan Protection'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-green-500 text-white text-xs">
              Gas Free
            </Badge>
            <Badge variant="outline" className="text-xs border-purple-300 text-purple-600">
              Aave V3
            </Badge>
          </div>
        </div>
        <CardDescription>
          {isClosed
            ? (language === 'zh' ? '仓位已通过闪电贷安全关闭。' : 'Position safely closed via flash loan.')
            : isCritical
            ? (language === 'zh' ? '紧急！健康因子低于清算线，建议立即执行闪电贷平仓。' : 'Critical! Health factor below liquidation threshold. Flash loan close recommended.')
            : isHighRisk
            ? (language === 'zh' ? '仓位风险升高，可随时执行闪电贷保护。' : 'Position risk elevated. Flash loan protection available.')
            : (language === 'zh' ? '仓位健康。使用右下角控制面板模拟市场下跌。' : 'Position healthy. Use the control panel to simulate a market crash.')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Position Info */}
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{language === 'zh' ? '协议' : 'Protocol'}</span>
            <span className="text-sm font-medium">{position.protocol}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{language === 'zh' ? '抵押品' : 'Collateral'}</span>
            <span className="text-sm font-medium">
              {position.collateralAmount} {position.collateralToken} (${position.collateralValueUSD.toLocaleString()})
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{language === 'zh' ? '债务' : 'Debt'}</span>
            <span className="text-sm font-medium">
              {position.borrowedAmount.toLocaleString()} {position.borrowedToken}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{language === 'zh' ? '健康因子' : 'Health Factor'}</span>
            <span className={`font-bold text-lg ${
              isClosed ? 'text-gray-400'
                : isCritical ? 'text-red-500 animate-pulse'
                : isHighRisk ? 'text-orange-500'
                : 'text-green-500'
            }`}>
              {isClosed ? (language === 'zh' ? '已关闭' : 'CLOSED') : position.healthFactor.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Flash Loan Progress */}
        {(status === 'preparing' || status === 'running') && (
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
              <Zap className="h-4 w-4" />
              {language === 'zh' ? '闪电贷执行中 — 单笔原子交易' : 'Flash Loan in Progress — Single Atomic Transaction'}
            </div>

            {status === 'preparing' && (
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                {language === 'zh' ? '构建交易...' : 'Building transaction...'}
              </div>
            )}

            {status === 'running' && FLASH_LOAN_STEPS.map((step, i) => (
              <div key={step.key} className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                i < currentStep
                  ? 'text-green-600 dark:text-green-400'
                  : i === currentStep
                  ? 'text-purple-700 dark:text-purple-300 font-medium'
                  : 'text-muted-foreground/50'
              }`}>
                {i < currentStep ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : i === currentStep ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500 flex-shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 flex-shrink-0" />
                )}
                <span>{language === 'zh' ? step.zh : step.en}</span>
              </div>
            ))}
          </div>
        )}

        {/* Success */}
        {isClosed && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 space-y-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              {language === 'zh' ? '闪电贷平仓成功！' : 'Flash Loan Close Successful!'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-gray-800">
                <div className="text-muted-foreground">{language === 'zh' ? '用户投入' : 'Capital Used'}</div>
                <div className="font-bold text-green-600">0 USDC</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-gray-800">
                <div className="text-muted-foreground">Gas</div>
                <div className="font-bold text-green-600">0 ETH (Sponsored)</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-gray-800">
                <div className="text-muted-foreground">{language === 'zh' ? '闪电贷手续费' : 'Flash Loan Fee'}</div>
                <div className="font-medium">7.50 USDC (0.05%)</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-gray-800">
                <div className="text-muted-foreground">{language === 'zh' ? '用户收回' : 'User Received'}</div>
                <div className="font-bold text-green-600">19,922.50 USDC</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-center pt-1">
              {language === 'zh'
                ? '避免了协议清算罚金（通常 5-10%），为用户节省约 $1,750'
                : 'Avoided protocol liquidation penalty (typically 5-10%), saving ~$1,750'}
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isClosed && (
          <Button
            className={`w-full h-12 text-base ${
              isCritical
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : ''
            }`}
            variant={isCritical ? 'default' : 'outline'}
            onClick={handleFlashLoanClose}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Zap className="w-5 h-5 mr-2" />
            )}
            {language === 'zh' ? '闪电贷紧急平仓（零资金）' : 'Flash Loan Emergency Close (Zero Capital)'}
          </Button>
        )}

        {/* Reset */}
        {isClosed && (
          <Button variant="outline" className="w-full" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {language === 'zh' ? '重置演示' : 'Reset Demo'}
          </Button>
        )}

        {/* How it works */}
        {!isProcessing && !isClosed && (
          <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
            <p className="font-medium">{language === 'zh' ? '闪电贷如何拯救仓位？' : 'How does Flash Loan save your position?'}</p>
            <p>
              {language === 'zh'
                ? '悖论：要拯救仓位需要钱，但你的钱锁在仓位里。闪电贷在一笔交易内先借钱还债、释放抵押品、卖出还贷——全程零资金投入。'
                : 'The paradox: saving your position requires capital, but your capital is locked IN the position. Flash loans solve this by borrowing, repaying debt, releasing collateral, and swapping — all in one atomic transaction with zero upfront capital.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
