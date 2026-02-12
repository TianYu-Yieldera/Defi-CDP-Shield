// DemoGuide - 演示指南与测试清单
// 为评委和演示者提供可交互的测试步骤

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Circle,
  Mic,
  Volume2,
  Bell,
  Zap,
  Shield,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { playSound } from '@/services/voice/SoundGenerator';
import { triggerVibration } from '@/hooks/useVibration';

interface TestStep {
  id: string;
  label: string;
  labelCN: string;
  action?: () => void;
  actionLabel?: string;
  actionLabelCN?: string;
}

interface TestScenario {
  id: string;
  title: string;
  titleCN: string;
  description: string;
  descriptionCN: string;
  icon: React.ReactNode;
  highlight: string;
  highlightCN: string;
  steps: TestStep[];
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'voice-ai',
    title: 'AI Voice Assistant',
    titleCN: 'AI 语音助手交互',
    description: 'Natural language voice interaction with bilingual support',
    descriptionCN: '自然语言语音交互，中英文双语支持',
    icon: <Mic className="h-5 w-5" />,
    highlight: 'Pure browser-side voice recognition, no backend needed',
    highlightCN: '纯浏览器端语音识别，无需后端服务',
    steps: [
      {
        id: 'voice-1',
        label: 'Click the blue mic button (bottom-right)',
        labelCN: '点击右下角蓝色麦克风按钮',
      },
      {
        id: 'voice-2',
        label: 'Say "Check my risk" (English) or "查看风险" (Chinese)',
        labelCN: '说 "查看风险" 或 "Check my risk"',
      },
      {
        id: 'voice-3',
        label: 'Listen to AI voice response with risk analysis',
        labelCN: '听 AI 语音播报风险分析结果',
      },
      {
        id: 'voice-4',
        label: 'Try: "My positions" / "我的仓位"',
        labelCN: '试试说 "我的仓位" / "My positions"',
      },
      {
        id: 'voice-5',
        label: 'Try: "Any alerts?" / "有没有预警"',
        labelCN: '试试说 "有没有预警" / "Any alerts?"',
      },
      {
        id: 'voice-6',
        label: 'Switch language and test again',
        labelCN: '切换语言后再次测试',
      },
    ],
  },
  {
    id: 'alert-system',
    title: 'Real-time Alert System',
    titleCN: '实时风险预警系统',
    description: 'Multi-level alerts with sound, vibration and voice',
    descriptionCN: '多级别预警：声音 + 震动 + 语音播报',
    icon: <Bell className="h-5 w-5" />,
    highlight: '3-level alert: Caution → Warning → Critical',
    highlightCN: '三级预警：注意 → 警告 → 紧急',
    steps: [
      {
        id: 'alert-1',
        label: 'Open Demo Control Panel (bottom-right)',
        labelCN: '展开右下角 Demo Control Panel',
      },
      {
        id: 'alert-2',
        label: 'Drag Health Factor slider to 1.4 (yellow = Caution)',
        labelCN: '将健康因子滑块拖到 1.4（黄色 = 注意）',
      },
      {
        id: 'alert-3',
        label: 'Drag to 1.2 (orange = Warning, hear alert sound)',
        labelCN: '拖到 1.2（橙色 = 警告，听到警报音效）',
        action: () => playSound.warning(),
        actionLabel: 'Play Warning',
        actionLabelCN: '播放警告音',
      },
      {
        id: 'alert-4',
        label: 'Drag to 1.05 (red = Critical, urgent alarm)',
        labelCN: '拖到 1.05（红色 = 紧急，急促警报）',
        action: () => { playSound.critical(); triggerVibration('critical'); },
        actionLabel: 'Play Critical',
        actionLabelCN: '播放紧急警报',
      },
      {
        id: 'alert-5',
        label: 'Drag back to 1.8 (success sound, alert cleared)',
        labelCN: '拖回 1.8（成功音效，警报消除）',
        action: () => playSound.success(),
        actionLabel: 'Play Success',
        actionLabelCN: '播放成功音效',
      },
    ],
  },
  {
    id: 'market-sim',
    title: 'Market Simulation',
    titleCN: '市场模拟演示',
    description: 'One-click preset scenarios: crash, decline, recovery',
    descriptionCN: '一键预设场景：暴跌、衰退、恢复',
    icon: <TrendingDown className="h-5 w-5" />,
    highlight: 'Automated multi-step scenarios with timed execution',
    highlightCN: '自动化多步骤场景，定时执行',
    steps: [
      {
        id: 'sim-1',
        label: 'In Demo Control Panel, click "Price Crash" scenario',
        labelCN: '在 Demo Control Panel 中点击 "Price Crash" 场景',
      },
      {
        id: 'sim-2',
        label: 'Watch: price drops → health factor drops → alerts trigger',
        labelCN: '观察：价格下跌 → 健康因子下降 → 触发多级预警',
      },
      {
        id: 'sim-3',
        label: 'Try "Health Declining": gradual HF drop 1.8→1.6→1.4→1.2→1.05',
        labelCN: '试试 "Health Declining"：健康因子逐步下降 1.8→1.6→1.4→1.2→1.05',
      },
      {
        id: 'sim-4',
        label: 'Try "Market Recovery": dip then bounce, ends with success',
        labelCN: '试试 "Market Recovery"：先跌后涨，以成功音效结束',
      },
    ],
  },
  {
    id: 'emergency-protection',
    title: 'Flash Loan Protection',
    titleCN: '闪电贷紧急保护',
    description: 'Zero-capital emergency close via Aave V3 flash loan',
    descriptionCN: '通过 Aave V3 闪电贷实现零资金紧急平仓',
    icon: <Shield className="h-5 w-5" />,
    highlight: 'Flash loan: borrow → repay debt → swap → repay loan — all in one tx',
    highlightCN: '闪电贷：借款 → 还债 → 兑换 → 还贷 — 全部一笔交易完成',
    steps: [
      {
        id: 'emergency-1',
        label: 'Switch to "Demo" tab — see Flash Loan Protection panel',
        labelCN: '切换到「演示」Tab — 查看闪电贷保护面板',
      },
      {
        id: 'emergency-2',
        label: 'Open Control Panel, drag Health Factor to 1.05 (red = critical)',
        labelCN: '展开控制面板，将健康因子拖到 1.05（红色 = 紧急）',
        action: () => { playSound.critical(); triggerVibration('critical'); },
        actionLabel: 'Play Alert',
        actionLabelCN: '播放警报',
      },
      {
        id: 'emergency-3',
        label: 'Click "Flash Loan Emergency Close" — watch 5-step process',
        labelCN: '点击「闪电贷紧急平仓」— 观察 5 步执行流程',
      },
      {
        id: 'emergency-4',
        label: 'See result: 0 capital, 0 gas, $19,922 returned, $1,750 saved',
        labelCN: '查看结果：零资金、零Gas、返还 $19,922、节省 $1,750',
        action: () => playSound.success(),
        actionLabel: 'Play Success',
        actionLabelCN: '播放成功音效',
      },
    ],
  },
];

interface DemoGuideProps {
  language: 'en' | 'zh';
}

export function DemoGuide({ language }: DemoGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedScenario, setExpandedScenario] = useState<string | null>('voice-ai');

  const toggleStep = useCallback((stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const toggleScenario = useCallback((scenarioId: string) => {
    setExpandedScenario((prev) => (prev === scenarioId ? null : scenarioId));
  }, []);

  const resetAll = useCallback(() => {
    setCompletedSteps(new Set());
  }, []);

  const totalSteps = TEST_SCENARIOS.reduce((sum, s) => sum + s.steps.length, 0);
  const completedCount = completedSteps.size;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-4">
      {/* 进度概览 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">
                {language === 'zh' ? '演示进度' : 'Demo Progress'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {completedCount} / {totalSteps}{' '}
                {language === 'zh' ? '步骤完成' : 'steps completed'}
                {' '}({progressPercent}%)
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {language === 'zh' ? '重置' : 'Reset'}
            </Button>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 推荐演示顺序 */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-sm font-medium mb-2">
            {language === 'zh' ? '推荐 5 分钟演示顺序：' : 'Recommended 5-min demo order:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEST_SCENARIOS.map((s, i) => (
              <Badge
                key={s.id}
                variant="secondary"
                className="cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => {
                  setExpandedScenario(s.id);
                }}
              >
                {i + 1}. {language === 'zh' ? s.titleCN : s.title}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 场景列表 */}
      {TEST_SCENARIOS.map((scenario) => {
        const isExpanded = expandedScenario === scenario.id;
        const scenarioCompleted = scenario.steps.filter((s) =>
          completedSteps.has(s.id)
        ).length;
        const allDone = scenarioCompleted === scenario.steps.length;

        return (
          <Card
            key={scenario.id}
            className={allDone ? 'border-green-500/30 bg-green-500/5' : ''}
          >
            <CardHeader
              className="pb-2 cursor-pointer"
              onClick={() => toggleScenario(scenario.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${allDone ? 'bg-green-500/20 text-green-400' : 'bg-primary/10 text-primary'}`}>
                    {scenario.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {language === 'zh' ? scenario.titleCN : scenario.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {language === 'zh' ? scenario.descriptionCN : scenario.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={allDone ? 'default' : 'secondary'} className="text-xs">
                    {scenarioCompleted}/{scenario.steps.length}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {/* 亮点标签 */}
              <div className="mt-2 ml-12">
                <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary">
                  {language === 'zh' ? scenario.highlightCN : scenario.highlight}
                </Badge>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-2">
                <div className="space-y-2 ml-1">
                  {scenario.steps.map((step, index) => {
                    const isDone = completedSteps.has(step.id);
                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                          isDone ? 'bg-green-500/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <button
                          onClick={() => toggleStep(step.id)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            <span className="text-muted-foreground mr-1.5">{index + 1}.</span>
                            {language === 'zh' ? step.labelCN : step.label}
                          </p>
                        </div>
                        {step.action && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              step.action?.();
                              toggleStep(step.id);
                            }}
                          >
                            {language === 'zh' ? step.actionLabelCN : step.actionLabel}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
