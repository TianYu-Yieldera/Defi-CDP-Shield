// SpeechSynthesizer - 语音合成服务封装

import type { SupportedLanguage, VoiceError } from './types';
import {
  DEFAULT_VOICE_CONFIG,
  MAX_SYNTHESIS_TEXT_LENGTH,
  SUPPORTED_LANGUAGES,
  ERROR_CODES,
  CHINESE_REGEX,
} from '@/lib/voice/constants';

export interface SynthesizerCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: VoiceError) => void;
  onPause?: () => void;
  onResume?: () => void;
}

export class SpeechSynthesizer {
  private isSpeaking = false;
  private isPaused = false;
  private callbacks: SynthesizerCallbacks = {};
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voiceCache: Map<string, SpeechSynthesisVoice | null> = new Map();
  private voicesLoaded = false;

  constructor() {
    this.loadVoices();
  }

  // 加载可用的语音
  private loadVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // 某些浏览器需要等待 voiceschanged 事件
    speechSynthesis.onvoiceschanged = () => {
      this.cacheVoices();
      this.voicesLoaded = true;
    };

    // 尝试立即加载
    this.cacheVoices();
  }

  // 等待语音加载完成
  private waitForVoices(): Promise<void> {
    if (this.voicesLoaded || speechSynthesis.getVoices().length > 0) {
      this.cacheVoices();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const check = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.cacheVoices();
          this.voicesLoaded = true;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      // Timeout after 2 seconds - proceed without specific voice
      setTimeout(() => resolve(), 2000);
      check();
    });
  }

  // 对语音质量打分，分数越高越好
  private scoreVoice(voice: SpeechSynthesisVoice): number {
    let score = 0;
    const name = voice.name.toLowerCase();

    // Google 在线语音质量最高（Chrome 专属）
    if (name.includes('google')) score += 100;

    // Microsoft 神经网络语音（Windows 11 自带，较自然）
    if (name.includes('natural') || name.includes('neural')) score += 80;

    // 已知的高质量语音
    if (name.includes('xiaoxiao') || name.includes('晓晓')) score += 70;
    if (name.includes('yunxi') || name.includes('云希')) score += 65;
    if (name.includes('samantha')) score += 60; // macOS
    if (name.includes('karen') || name.includes('daniel')) score += 55; // macOS

    // 在线语音通常比本地语音好
    if (!voice.localService) score += 20;

    // 系统默认语音作为合理备选
    if (voice.default) score += 5;

    return score;
  }

  // 缓存语音 — 按质量评分排序，选最佳
  private cacheVoices(): void {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // 中文语音：按评分选最佳
    const zhVoices = voices
      .filter(v => v.lang.startsWith('zh'))
      .sort((a, b) => this.scoreVoice(b) - this.scoreVoice(a));
    this.voiceCache.set('zh', zhVoices[0] || null);

    // 英文语音：按评分选最佳
    const enVoices = voices
      .filter(v => v.lang.startsWith('en'))
      .sort((a, b) => this.scoreVoice(b) - this.scoreVoice(a));
    this.voiceCache.set('en', enVoices[0] || null);

    this.voicesLoaded = true;
  }

  // 获取适合的语音（公开方法，供 VoiceService.speakDirect 使用）
  getVoice(language: SupportedLanguage): SpeechSynthesisVoice | null {
    let voice = this.voiceCache.get(language);

    if (!voice) {
      this.cacheVoices();
      voice = this.voiceCache.get(language);
    }

    return voice || null;
  }

  // 自动检测语言
  private detectLanguage(text: string): SupportedLanguage {
    return CHINESE_REGEX.test(text) ? 'zh' : 'en';
  }

  // 检查是否支持语音合成
  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  // 设置回调函数
  setCallbacks(callbacks: SynthesizerCallbacks): void {
    this.callbacks = callbacks;
  }

  // 语音播报
  async speak(text: string, language?: SupportedLanguage): Promise<void> {
    if (!SpeechSynthesizer.isSupported()) {
      throw {
        code: ERROR_CODES.NOT_SUPPORTED,
        message: 'Speech Synthesis not supported',
      };
    }

    // 停止当前播放，完全清理队列
    speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;

    // 确保语音已加载（Chrome 在 Windows 上需要等待）
    await this.waitForVoices();

    // 截断过长文本
    const truncatedText = text.length > MAX_SYNTHESIS_TEXT_LENGTH
      ? text.substring(0, MAX_SYNTHESIS_TEXT_LENGTH) + '...'
      : text;

    // 自动检测语言
    const detectedLanguage = language || this.detectLanguage(truncatedText);
    const langConfig = SUPPORTED_LANGUAGES[detectedLanguage];

    // 等待 cancel 完全生效（Chrome bug workaround）
    // 加长延迟确保 primer utterance 和之前的 cancel 都处理完毕
    await new Promise(resolve => setTimeout(resolve, 200));

    return new Promise<void>((resolve, reject) => {
      // 创建语音合成实例
      const utterance = new SpeechSynthesisUtterance(truncatedText);
      utterance.lang = langConfig.synthesisLang;
      utterance.rate = DEFAULT_VOICE_CONFIG.synthesis.rate;
      utterance.pitch = DEFAULT_VOICE_CONFIG.synthesis.pitch;
      utterance.volume = DEFAULT_VOICE_CONFIG.synthesis.volume;

      // 设置语音
      const voice = this.getVoice(detectedLanguage);
      if (voice) {
        utterance.voice = voice;
      }

      // 安全超时：如果 15 秒后既没有 onend 也没有 onerror，自动 resolve
      const safetyTimeout = setTimeout(() => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.callbacks.onEnd?.();
        resolve();
      }, 15000);

      // 事件处理
      utterance.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.callbacks.onStart?.();
      };

      utterance.onend = () => {
        clearTimeout(safetyTimeout);
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.callbacks.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        clearTimeout(safetyTimeout);
        this.isSpeaking = false;
        this.isPaused = false;
        this.currentUtterance = null;

        // 忽略 interrupted/canceled 错误
        if (event.error === 'interrupted' || event.error === 'canceled') {
          resolve();
          return;
        }

        const error: VoiceError = {
          code: ERROR_CODES.SYNTHESIS_ERROR,
          message: `Speech synthesis error: ${event.error}`,
        };
        this.callbacks.onError?.(error);
        reject(error);
      };

      this.currentUtterance = utterance;
      speechSynthesis.speak(utterance);
    });
  }

  // 停止播报
  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
  }

  // 暂停播报
  pause(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis && this.isSpeaking) {
      speechSynthesis.pause();
      this.isPaused = true;
      this.callbacks.onPause?.();
    }
  }

  // 恢复播报
  resume(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis && this.isPaused) {
      speechSynthesis.resume();
      this.isPaused = false;
      this.callbacks.onResume?.();
    }
  }

  // 获取当前状态
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  // 获取可用语音列表
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }
    return speechSynthesis.getVoices();
  }

  // 设置语速
  setRate(rate: number): void {
    if (rate >= 0.1 && rate <= 10) {
      DEFAULT_VOICE_CONFIG.synthesis.rate = rate;
    }
  }

  // 设置音调
  setPitch(pitch: number): void {
    if (pitch >= 0 && pitch <= 2) {
      DEFAULT_VOICE_CONFIG.synthesis.pitch = pitch;
    }
  }

  // 设置音量
  setVolume(volume: number): void {
    if (volume >= 0 && volume <= 1) {
      DEFAULT_VOICE_CONFIG.synthesis.volume = volume;
    }
  }
}
