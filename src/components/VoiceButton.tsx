import { useState } from "react";
import { isRecognitionSupported, startRecognition } from "../voice";

export interface VoiceButtonProps {
  onText: (text: string) => void;
  hint?: string;
  /** big = 大号主按钮；row = 贴在某一行输入框右侧的小麦克风 */
  variant?: "big" | "row";
  onError?: (message: string) => void;
  /** 识别开始前的钩子，用来先确定「写入哪一行」 */
  onBeforeStart?: () => void;
}

export function VoiceButton({
  onText,
  hint,
  variant = "big",
  onError,
  onBeforeStart,
}: VoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isRecognitionSupported();

  const start = () => {
    setError(null);
    setListening(true);
    onBeforeStart?.();
    startRecognition({
      onResult: (text) => {
        setListening(false);
        onText(text);
      },
      onError: (message) => {
        setListening(false);
        setError(message);
        onError?.(message);
      },
      onEnd: () => setListening(false),
    });
  };

  if (variant === "row") {
    return (
      <button
        type="button"
        className="yp-mic-btn"
        onClick={start}
        aria-label="给这一行语音输入"
        title="给这一行语音输入"
      >
        <span aria-hidden="true">{listening ? "🎙" : "🎤"}</span>
      </button>
    );
  }

  return (
    <div className="yp-voice">
      {hint ? <p className="yp-hint yp-voice-hint">{hint}</p> : null}
      <button type="button" className="yp-big yp-voice-btn" onClick={start} aria-label="点这里，对着麦克风说一句">
        {listening ? "听着呢…" : "点一下，说一句"}
      </button>
      {!supported ? <p className="yp-hint">这个浏览器听不了语音，请直接用下面的按钮选。</p> : null}
      {error ? <p className="yp-hint">{error}</p> : null}
    </div>
  );
}
