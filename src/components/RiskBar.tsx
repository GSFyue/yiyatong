import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Task } from "../types";

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RiskBar({
  task,
  onWithdraw,
  onRelease,
  verifyMissing,
  verifyReady,
}: {
  task: Task;
  onWithdraw?: () => void;
  onRelease?: () => void;
  /** 还差几步核验；undefined 表示这张卡不涉及核验 */
  verifyMissing?: number;
  /** 核验是否已经做完 */
  verifyReady?: boolean;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (task.state !== "cooling") return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [task.state]);

  if (task.state === "cooling") {
    const remain = (task.coolingUntil ?? 0) - Date.now();
    const hasVerify = typeof verifyMissing === "number";
    const ready = hasVerify && verifyReady === true;
    const releaseText = hasVerify
      ? ready
        ? "核验已过，提前放行"
        : `还差 ${verifyMissing} 步才能放行`
      : "仍要确认";
    return (
      <div className="yyt-risk yyt-risk-cooling" role="status">
        <p>{task.reason}</p>
        <p className="yyt-mono">冷静期剩余 {mmss(remain)}</p>
        <div className="yyt-row">
          <Button size="sm" variant="outline" onClick={onWithdraw} aria-label="撤回这笔请求">
            撤回
          </Button>
          <Button size="sm" onClick={onRelease} disabled={hasVerify && !ready} aria-label={releaseText}>
            {releaseText}
          </Button>
        </div>
        {hasVerify && !ready ? <p className="yyt-hint">三步核验做完了，才能提前放行。</p> : null}
      </div>
    );
  }

  if (task.state === "blocked") {
    return (
      <div className="yyt-risk yyt-risk-blocked" role="status">
        <p>{task.reason ?? "已被规则拦截"}</p>
        <p className="yyt-hint">系统拦住了这笔。要办的话，请直接打个电话确认。</p>
      </div>
    );
  }

  if (task.state === "approved") {
    return (
      <div className="yyt-risk yyt-risk-approved">
        <p>规则校验通过，可以代办。</p>
      </div>
    );
  }

  return null;
}
