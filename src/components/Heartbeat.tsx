import { useEffect, useState } from "react";
import { getLastSyncAt } from "../sync";

function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} 秒前`;
  return `${Math.floor(seconds / 60)} 分钟前`;
}

export function Heartbeat() {
  const [, tick] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const ago = Date.now() - getLastSyncAt();

  return (
    <span className="yyt-hb" role="status" aria-live="polite">
      <span className="yyt-hb-dot" data-state={hidden ? "idle" : "live"} aria-hidden="true" />
      <span>{hidden ? "连接中…" : `已同步 · ${formatAgo(ago)}`}</span>
    </span>
  );
}
