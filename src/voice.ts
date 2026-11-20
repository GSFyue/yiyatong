import { KEYS } from "./sync";

let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEYS.VOICE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function isVoiceEnabled(): boolean {
  return enabled;
}

export function setVoiceEnabled(value: boolean): void {
  enabled = value;
  try {
    localStorage.setItem(KEYS.VOICE_KEY, value ? "1" : "0");
  } catch {
    // 忽略存储失败
  }
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    cachedVoice =
      voices.find((v) => /zh[-_]?(CN|Hans)/i.test(v.lang)) ??
      voices.find((v) => v.lang.toLowerCase().startsWith("zh")) ??
      cachedVoice;
  }
  return cachedVoice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => pickZhVoice();
  pickZhVoice();
}

/** 中文语音播报。语音开关关闭或浏览器不支持时静默跳过，绝不抛错。 */
export function speak(text: string): void {
  if (!enabled || !text) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voice = pickZhVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // 播报失败不影响主流程
  }
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface RecognitionHandlers {
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

/** 中文语音识别。麦克风失败时回调 onError，页面据此降级为「大按钮选择」。 */
export function startRecognition(handlers: RecognitionHandlers): void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    handlers.onError("这个浏览器不支持语音输入，请用下面的按钮选。");
    return;
  }
  const recognition = new Ctor();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event: unknown) => {
    const results = (event as { results?: { 0?: { 0?: { transcript?: string } } } }).results;
    const text = results?.[0]?.[0]?.transcript ?? "";
    if (text) handlers.onResult(text);
  };
  recognition.onerror = (event) => {
    handlers.onError(
      event?.error === "not-allowed"
        ? "没有拿到麦克风权限，请用下面的按钮选。"
        : "听不清楚，请再说一次，或用下面的按钮选。",
    );
  };
  recognition.onend = () => handlers.onEnd?.();
  try {
    recognition.start();
  } catch {
    handlers.onError("语音输入启动失败，请用下面的按钮选。");
  }
}
