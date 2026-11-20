import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "../hooks/useNow";
import {
  deadlineView,
  requiredVerifyKeys,
  VERIFY_HINT,
  VERIFY_LABEL,
  VERIFY_SHORT,
  verifyProgress,
  type Task,
  type VerifyStepKey,
} from "../types";
import { RiskBar } from "./RiskBar";
import { StatusBadge } from "./StatusBadge";
import { TraceTimeline } from "./TraceTimeline";

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface TaskCardProps {
  task: Task;
  passcodeSet: boolean;
  askingReason: boolean;
  onApprove: () => void;
  onAskReason: () => void;
  onRejectDirect: () => void;
  onPasscode: (code: string) => void;
  onWithdraw: () => void;
  onRelease: () => void;
  onTrust: () => void;
  onVerify: (key: VerifyStepKey) => void;
  verifyGuide?: boolean;
  guide?: string;
}

export function TaskCard({
  task,
  passcodeSet,
  askingReason,
  onApprove,
  onAskReason,
  onRejectDirect,
  onPasscode,
  onWithdraw,
  onRelease,
  onTrust,
  onVerify,
  verifyGuide,
  guide,
}: TaskCardProps) {
  const [showPasscode, setShowPasscode] = useState(false);
  const [code, setCode] = useState("");
  const [showTrace, setShowTrace] = useState(false);

  const isPending = task.state === "pending";

  // 时限与倒计时都随真实时间走
  const now = useNow(30000);
  const view = deadlineView(task, now);
  const verifyRequired = task.verification?.required === true;
  const requiredKeys = requiredVerifyKeys(task, passcodeSet);
  const progress = verifyProgress(task, passcodeSet);
  const blockedByVerify = verifyRequired && progress.missing.length > 0;
  const visibleSteps = (task.verification?.steps ?? []).filter(
    (s) => requiredKeys.includes(s.key) || s.done,
  );
  return (
    <article className="yyt-panel" data-guide={guide}>
      <div className="yyt-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span className="yyt-chip">{task.kind}</span>
          <h3 className="yyt-section-title" style={{ marginTop: 8 }}>
            {task.title}
          </h3>
          <p className="yyt-hint">
            {task.from} 发起 · {task.channel} · <span className="yyt-chip">模拟数据</span>
          </p>
        </div>
        <div>
          <StatusBadge state={task.state} />
          {verifyRequired && !["blocked", "rejected", "done"].includes(task.state) ? (
            <span className="yyt-badge yyt-badge-pending" style={{ marginLeft: 6 }}>
              待核验
            </span>
          ) : null}
        </div>
      </div>

      <div className="yyt-tri">
        <div className="yyt-tri-item">
          <span className="yyt-tri-label">金额</span>
          <span className={`yyt-tri-value${task.amount > 0 ? " yyt-tri-money" : ""}`}>
            {task.amount > 0 ? `¥${task.amount}` : "不涉及"}
          </span>
        </div>
        <div className="yyt-tri-item">
          <span className="yyt-tri-label">对象</span>
          <span className="yyt-tri-value">{task.to}</span>
        </div>
        <div className="yyt-tri-item">
          <span className="yyt-tri-label">时间</span>
          <span className="yyt-tri-value yyt-tri-time">{formatWhen(task.at)}</span>
        </div>
      </div>

      {view ? (
        <div className="yyt-meta">
          {task.consequence ? (
            <div className="yyt-meta-row">
              <span className="yyt-meta-label">不办会怎样</span>
              <span className="yyt-meta-value yyt-meta-desc">{task.consequence}</span>
            </div>
          ) : null}
          <div className="yyt-meta-row">
            <span className="yyt-meta-label">时限</span>
            <span className="yyt-meta-value" style={{ color: view.color }}>
              {view.text}
            </span>
            {view.tag ? (
              <span className="yyt-urgent" style={{ color: view.color }}>
                {view.tag}
              </span>
            ) : null}
            {view.remaining ? (
              <span className="yyt-remaining" style={{ color: view.color }}>
                {view.remaining}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {view?.alert ? (
        <p className={`yyt-deadline-alert${view.urgency === "overdue" ? " yyt-deadline-alert-late" : ""}`}>
          {view.alert}
        </p>
      ) : null}

      {verifyRequired ? (
        <div className="yyt-verify" data-guide={verifyGuide ? "verify" : undefined}>
          <div className="yyt-verify-head">
            <span className="yyt-verify-title">转账前核验</span>
            <span className="yyt-verify-count">
              {progress.done}/{progress.total}
            </span>
            <span className={`yyt-verify-status${blockedByVerify ? "" : " is-done"}`}>
              {blockedByVerify
                ? `还差 ${progress.missing.length} 步才能确认：${progress.missing.map((k) => VERIFY_SHORT[k]).join("、")}`
                : "三步都做完了，可以提前放行。"}
            </span>
          </div>
          <p className="yyt-verify-lead">
            AI 换脸已经能一键生成，「我是你儿子」这句话不能当证据。这三步做完，才能确认。
          </p>
          <div className="yyt-verify-steps">
            {visibleSteps.map((step) => {
              const isRequired = requiredKeys.includes(step.key);
              return (
                <div
                  key={step.key}
                  className={`yyt-verify-row${isRequired ? "" : " is-optional"}${step.done ? " is-done" : ""}`}
                >
                  <span className="yyt-verify-tick" aria-hidden="true">
                    {step.done ? "✔" : "○"}
                  </span>
                  <div className="yyt-verify-text">
                    <div className="yyt-verify-name">{VERIFY_LABEL[step.key]}</div>
                    <div className="yyt-verify-hint">{VERIFY_HINT[step.key]}</div>
                    {step.done && step.ts ? (
                      <div className="yyt-verify-ts">已完成 · {formatWhen(step.ts)}</div>
                    ) : null}
                  </div>
                  {isRequired && !step.done ? (
                    <button
                      type="button"
                      className="yyt-verify-btn"
                      disabled={step.key === "passcode" && !passcodeSet}
                      onClick={() => onVerify(step.key)}
                    >
                      {step.key === "passcode" && !passcodeSet ? "还没设暗号" : "标记完成"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="yyt-verify-note">
            这三步是我们自己定的规矩，不是技术鉴定。做到的是「多一道只有家里人过得了的关」，不是「认出谁是真的」。
          </p>
        </div>
      ) : null}

      <RiskBar
        task={task}
        onWithdraw={onWithdraw}
        onRelease={onRelease}
        verifyMissing={verifyRequired ? progress.missing.length : undefined}
        verifyReady={verifyRequired ? progress.missing.length === 0 : undefined}
      />

      {isPending ? (
        <div className="yyt-row" style={{ marginTop: 8 }}>
          <Button onClick={onApprove} disabled={blockedByVerify} aria-label="确认代办这件事">
            {blockedByVerify ? `还差 ${progress.missing.length} 步才能确认` : "确认代办"}
          </Button>
          <Button variant="outline" className="yyt-btn-reject" onClick={onAskReason} aria-label="问爸妈为什么不办">
            拒绝
          </Button>
          <Button variant="ghost" className="yyt-btn-text" onClick={() => setShowPasscode((v) => !v)} aria-label="要求核对暗号">
            要求核对暗号
          </Button>
          {task.amount > 0 ? (
            <Button variant="ghost" onClick={onTrust} aria-label="把收款方加入可信名单">
              标记为可信对象
            </Button>
          ) : null}
        </div>
      ) : null}

      {askingReason ? (
        <div className="yyt-ask">
          <p>已问爸妈为什么，等他们回一句。回一句就记在留痕里。</p>
          <Button variant="outline" size="sm" onClick={onRejectDirect} aria-label="不问了，直接拒绝">
            不问了，直接拒绝
          </Button>
        </div>
      ) : null}

      {showPasscode ? (
        <div className="yyt-row" style={{ marginTop: 12 }}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="输入家人约定的暗号"
            aria-label="输入暗号"
            className="max-w-56"
          />
          <Button
            onClick={() => {
              onPasscode(code);
              setCode("");
            }}
            aria-label="提交暗号"
          >
            核对
          </Button>
          {!passcodeSet ? <span className="yyt-hint">还没设置暗号，先到下面「设置」里设一个。</span> : null}
        </div>
      ) : null}

      <div className="yyt-row" style={{ marginTop: 12 }}>
        <Button variant="link" size="sm" onClick={() => setShowTrace((v) => !v)} aria-label="查看留痕">
          {showTrace ? "收起留痕" : "看留痕"}
        </Button>
      </div>

      {showTrace ? <TraceTimeline items={task.trace} /> : null}
    </article>
  );
}
