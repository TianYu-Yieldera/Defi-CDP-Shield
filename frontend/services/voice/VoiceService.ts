// VoiceService - 语音服务核心 (单例模式)

import { SpeechRecognizer } from './SpeechRecognizer';
import { SpeechSynthesizer } from './SpeechSynthesizer';
import { CommandProcessor } from './CommandProcessor';
import { ResponseGenerator } from './ResponseGenerator';
import { getSoundGenerator } from './SoundGenerator';
import { useVoiceStore } from '@/store/voiceStore';
import type { RecognitionResult, VoiceError, SupportedLanguage, VoiceSettings } from './types';
import { checkBrowserSupport, VIBRATION_PATTERNS } from '@/lib/voice/constants';

export class VoiceService {
  private static instance: VoiceService | null = null;

  private recognizer: SpeechRecognizer;
  private synthesizer: SpeechSynthesizer;
  private commandProcessor: CommandProcessor;
  private responseGenerator: ResponseGenerator;
  private isInitialized = false;

  private constructor() {
    this.recognizer = new SpeechRecognizer();
    this.synthesizer = new SpeechSynthesizer();
    this.commandProcessor = new CommandProcessor();
    this.responseGenerator = new ResponseGenerator();

    this.setupCallbacks();
  }

  // 获取单例实例
  static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  // 重置单例 (用于测试)
  static resetInstance(): void {
    if (VoiceService.instance) {
      VoiceService.instance.cleanup();
      VoiceService.instance = null;
    }
  }

  // 设置回调函数
  private setupCallbacks(): void {
    const store = useVoiceStore.getState();

    // 识别回调
    this.recognizer.setCallbacks({
      onStart: () => {
        store.setListening(true);
        store.setError(null);
      },
      onResult: (result: RecognitionResult) => {
        if (result.isFinal) {
          store.setTranscript(result.transcript);
          store.setLanguage(result.language);
        } else {
          store.setInterimTranscript(result.transcript);
        }
      },
      onEnd: () => {
        store.setListening(false);
      },
      onError: (error: VoiceError) => {
        store.setListening(false);
        store.setError(error);
      },
    });

    // 合成回调
    this.synthesizer.setCallbacks({
      onStart: () => {
        store.setSpeaking(true);
      },
      onEnd: () => {
        store.setSpeaking(false);
      },
      onError: (error: VoiceError) => {
        store.setSpeaking(false);
        store.setError(error);
      },
    });
  }

  // 初始化服务
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    const store = useVoiceStore.getState();
    const support = checkBrowserSupport();

    // 检查浏览器支持
    const isSupported = support.speechRecognition && support.speechSynthesis;
    store.setSupported(isSupported);

    if (!isSupported) {
      store.setError({
        code: 'voice_not_supported',
        message: 'Browser does not support voice features',
      });
      return false;
    }

    // 请求麦克风权限
    try {
      const hasPermission = await SpeechRecognizer.requestPermission();
      store.setPermission(hasPermission);

      if (!hasPermission) {
        store.setError({
          code: 'no_microphone_permission',
          message: 'Microphone permission denied',
        });
        return false;
      }
    } catch (error) {
      store.setPermission(false);
      return false;
    }

    this.isInitialized = true;
    return true;
  }

  // 开始语音识别
  async startListening(): Promise<void> {
    const store = useVoiceStore.getState();

    // 调试：标记 startListening 被调用
    store.setStatus('processing');

    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        store.setStatus('idle');
        store.setError({ code: 'init_failed', message: 'VoiceService initialization failed' });
        return;
      }
    }

    if (store.isListening) {
      this.stopListening();
      return;
    }

    // 停止当前播报
    if (store.isSpeaking) {
      this.stopSpeaking();
    }

    // Chrome 要求 speechSynthesis.speak() 在用户手势上下文内调用
    // 语音识别需要几秒钟，用户手势会过期，导致后续 TTS 被静默拒绝
    // 解决方案：在用户点击时用一个静音 utterance "解锁" SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0.01;
      primer.rate = 10;
      speechSynthesis.speak(primer);
    }

    // 清除之前的状态
    store.setTranscript('');
    store.setInterimTranscript('');
    store.setResponse('');
    store.setError(null);

    // 播放开始音效
    this.playSound('start');

    try {
      const result = await this.recognizer.start();

      if (result.isFinal && result.transcript) {
        await this.processCommand(result.transcript, result.language);
      } else {
        // 识别结束但没有获得文本 — 给用户反馈
        this.playSound('stop');
        const language = useVoiceStore.getState().language || 'zh';
        const noSpeechMsg = this.responseGenerator.generateError('no_speech_detected', language);
        store.setResponse(noSpeechMsg);
        store.setStatus('idle');
      }
    } catch (error: unknown) {
      // 将错误存入 store 以便调试
      const voiceError = error as VoiceError;
      store.setError(voiceError?.code
        ? voiceError
        : { code: 'unknown_error', message: String(error) }
      );

      // 确保退出 listening 状态（onend 可能未触发，如网络问题导致 Chrome 卡死）
      if (useVoiceStore.getState().isListening) {
        store.setListening(false);
      }

      // 生成用户可见的错误反馈
      const language = useVoiceStore.getState().language || 'zh';
      const errorCode = voiceError?.code || 'recognition_error';
      const errorMsg = this.responseGenerator.generateError(errorCode, language);
      store.setResponse(errorMsg);

      this.playSound('stop');
      console.warn('Recognition error:', voiceError?.message || error);
    }
  }

  // 停止语音识别
  stopListening(): void {
    this.recognizer.stop();
    useVoiceStore.getState().setListening(false);
  }

  // 处理语音命令
  private async processCommand(transcript: string, language: SupportedLanguage): Promise<void> {
    const store = useVoiceStore.getState();

    // 处理命令
    store.setStatus('processing');
    const commandResult = this.commandProcessor.process(transcript);

    // 生成响应
    const response = this.responseGenerator.generate(commandResult);
    store.setResponse(response);

    // 语音播报 — 识别后直接用原生 API，避免 cancel() 重置用户激活状态
    this.speakDirect(response, language);
  }

  // 直接播报（不调用 cancel，用于识别后的响应）
  private speakDirect(text: string, language: SupportedLanguage): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const store = useVoiceStore.getState();
    const langCode = language === 'zh' ? 'zh-CN' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    // 略慢的语速 + 微调音高 → 更自然的听感
    utterance.rate = language === 'zh' ? 0.92 : 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    // 使用 synthesizer 缓存的最优语音（按质量评分选择）
    const voice = this.synthesizer.getVoice(language);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      store.setSpeaking(true);
    };
    utterance.onend = () => {
      store.setSpeaking(false);
    };
    utterance.onerror = () => {
      store.setSpeaking(false);
    };

    speechSynthesis.speak(utterance);
  }

  // 语音播报
  async speak(text: string, language?: SupportedLanguage): Promise<void> {
    const store = useVoiceStore.getState();

    // 停止当前识别
    if (store.isListening) {
      this.stopListening();
    }

    try {
      await this.synthesizer.speak(text, language);
    } catch (error) {
      console.warn('Speech synthesis error:', error);
    }
  }

  // 停止语音播报
  stopSpeaking(): void {
    this.synthesizer.stop();
    useVoiceStore.getState().setSpeaking(false);
  }

  // 播放音效
  playSound(type: 'critical' | 'warning' | 'success' | 'start' | 'stop' | 'notification'): void {
    // 检查音效是否启用
    const { settings } = useVoiceStore.getState();
    if (!settings.soundEnabled) return;

    try {
      const soundGenerator = getSoundGenerator();
      switch (type) {
        case 'critical':
          soundGenerator.playCritical();
          break;
        case 'warning':
          soundGenerator.playWarning();
          break;
        case 'success':
          soundGenerator.playSuccess();
          break;
        case 'start':
          soundGenerator.playStart();
          break;
        case 'stop':
          soundGenerator.playStop();
          break;
        case 'notification':
          soundGenerator.playNotification();
          break;
      }
    } catch (error) {
      console.warn('Sound playback error:', error);
    }
  }

  // 触发震动
  vibrate(type: 'critical' | 'warning' | 'notification'): void {
    // 检查震动是否启用
    const { settings } = useVoiceStore.getState();
    if (!settings.vibrationEnabled) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = VIBRATION_PATTERNS[type];
      if (pattern) {
        try {
          navigator.vibrate(pattern);
        } catch (error) {
          console.warn('Vibration error:', error);
        }
      }
    }
  }

  // 更新设置
  updateSettings(settings: Partial<VoiceSettings>): void {
    const store = useVoiceStore.getState();
    store.updateSettings(settings);

    // 应用语速设置到合成器
    if (settings.speechRate !== undefined) {
      this.synthesizer.setRate(settings.speechRate);
    }
  }

  // 获取当前设置
  getSettings(): VoiceSettings {
    return useVoiceStore.getState().settings;
  }

  // 获取命令处理器 (复用单例内的实例)
  getCommandProcessor(): CommandProcessor {
    return this.commandProcessor;
  }

  // 获取响应生成器 (复用单例内的实例)
  getResponseGenerator(): ResponseGenerator {
    return this.responseGenerator;
  }

  // 获取服务状态
  getStatus(): {
    isInitialized: boolean;
    isListening: boolean;
    isSpeaking: boolean;
    isSupported: boolean;
    hasPermission: boolean;
  } {
    const store = useVoiceStore.getState();
    return {
      isInitialized: this.isInitialized,
      isListening: store.isListening,
      isSpeaking: store.isSpeaking,
      isSupported: store.isSupported,
      hasPermission: store.hasPermission,
    };
  }

  // 清理资源
  cleanup(): void {
    this.stopListening();
    this.stopSpeaking();
    this.isInitialized = false;
  }

  // 检查是否支持语音功能
  static checkSupport(): {
    speechRecognition: boolean;
    speechSynthesis: boolean;
    vibration: boolean;
  } {
    return checkBrowserSupport();
  }
}

// 导出单例获取函数
export function getVoiceService(): VoiceService {
  return VoiceService.getInstance();
}
