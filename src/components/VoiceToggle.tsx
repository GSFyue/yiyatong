import { useState } from "react";
import { isVoiceEnabled, setVoiceEnabled } from "../voice";

export function VoiceToggle() {
  const [on, setOn] = useState(isVoiceEnabled());

  const toggle = () => {
    const next = !on;
    setVoiceEnabled(next);
    setOn(next);
  };

  return (
    <button type="button" className="yp-secondary" aria-pressed={on} onClick={toggle}>
      语音播报：{on ? "开" : "关"}
    </button>
  );
}
