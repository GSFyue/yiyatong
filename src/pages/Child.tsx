import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "../components/TaskCard";
import { TraceTimeline, type TraceEntry } from "../components/TraceTimeline";
import { useGuide } from "../guide";
import { useLimits, useTasks } from "../hooks/useStore";
import { buildReceiptLink, decodePayload, lookupPasscode, type TaskPayload } from "../link";
import { useUrl } from "../router";
import { sendSignal, subscribeSignal } from "../sync";
import {
  approveTask,
  createTask,
  markVerifyStep,
  rejectTask,
  releaseCooling,
  setPasscode,
  toggleTrusted,
  updateLimits,
  verifyPasscode,
  withdrawCooling,
} from "../state";
import type { Task } from "../types";
import { speak } from "../voice";

export function Child() {
  const tasks = useTasks();
  const limits = useLimits();
  const guide = useGuide();
  const { hashParams } = useUrl();
  const [fromLink, setFromLink] = useState<string | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [trustedInput, setTrustedInput] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [asking, setAsking] = useState<Record<string, boolean>>({});

  // 左栏点某条任务时，右栏/另一标签页定位到对应卡片并高亮 1.5 秒
  useEffect(
    () =>
      subscribeSignal((signal) => {
        if (signal.type !== "focus") return;
        const el = document.querySelector(`[data-task-id="${signal.taskId}"]`);
        if (!el) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        el.classList.add("yyt-focus-flash");
        window.setTimeout(() => el.classList.remove("yyt-focus-flash"), 1500);
      }),
    [],
  );

  // 父母回了拒绝理由 → 写进留痕
  useEffect(
    () =>
      subscribeSignal((signal) => {
        if (signal.type !== "reject-reply") return;
        setAsking((prev) => ({ ...prev, [signal.taskId]: false }));
        rejectTask(signal.taskId, signal.reason);
      }),
    [],
  );

  useEffect(() => {
    const encoded = hashParams.get("task");
    if (!encoded) return;
    const payload = decodePayload<TaskPayload>(encoded);
    if (!payload) return;
    setFromLink(payload.title);
    if (!tasks.some((t) => t.id === payload.id)) {
      createTask({
        kind: payload.kind,
        title: payload.title,
        to: payload.to,
        amount: payload.amount,
        channel: payload.channel,
        from: payload.from,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashParams]);

  const pending = useMemo(
    () => tasks.filter((t) => t.state === "pending" || t.state === "cooling").sort((a, b) => b.at - a.at),
    [tasks],
  );
  const settled = useMemo(
    () => tasks.filter((t) => t.state !== "pending" && t.state !== "cooling").sort((a, b) => b.at - a.at),
    [tasks],
  );

  const trace: TraceEntry[] = useMemo(
    () =>
      tasks
        .flatMap((task) => task.trace.map((item) => ({ ...item, taskTitle: task.title })))
        .sort((a, b) => b.ts - a.ts),
    [tasks],
  );

  const submitPasscode = (id: string, code: string) => {
    const result = verifyPasscode(id, code);
    if (!result.ok && result.error) setPasscodeError(result.error);
    if (result.ok) setPasscodeError(null);
  };

  const askReason = (id: string) => {
    sendSignal({ type: "reject-request", taskId: id });
    setAsking((prev) => ({ ...prev, [id]: true }));
  };

  const lookup = () => {
    const id = lookupPasscode(passcodeInput.trim());
    if (!id) {
      setPasscodeError("这台设备上没有这个口令。换个设备请用链接。");
      return;
    }
    setPasscodeError(null);
    const task = tasks.find((t) => t.id === id);
    if (task) document.querySelector(`[data-task-id="${task.id}"]`)?.scrollIntoView({ block: "center" });
  };

  const copyReceipt = async (task: Task) => {
    try {
      await navigator.clipboard.writeText(buildReceiptLink(task));
      setCopied(task.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const numberField = (value: number, label: string, onCommit: (next: number) => void) => (
    <Input
      type="number"
      value={value}
      min={0}
      className="max-w-32"
      aria-label={label}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (Number.isFinite(next) && next >= 0) onCommit(next);
      }}
    />
  );

  return (
    <div className="yyt-child">
      <p className="yyt-hint yyt-child-lead">限额、暗号、可信名单，是家人自己定的规矩。</p>
      <p className="yyt-child-hook">
        每 100 个独居老人，只有 9 个会自己挂号。剩下那 91 个，最后都落到你头上。
      </p>

      {fromLink ? (
        <div className="yyt-panel yyt-child-banner" style={{ borderColor: "var(--yyt-accent)" }}>
          <b>来自父母端的请求</b>
          <p className="yyt-hint">
            {fromLink} —— 下面是父母那边发过来的那件事。
          </p>
        </div>
      ) : null}

      <section style={{ marginTop: 12 }}>
        <h2 className="yyt-section-title">待办</h2>
        {pending.length === 0 ? (
          <div className="yyt-panel" data-guide="task-card">
            <p className="yyt-hint">暂时没有要办的事。</p>
            <p className="yyt-child-hook">
              眼下没有待办。也许多数独居老人，正卡在「自己挂号」这一步上 —— 每 100 个里，有 91 个要靠家里人。
            </p>
          </div>
        ) : (
          pending.map((task, index) => (
            <div key={task.id} data-task-id={task.id}>
              <TaskCard
                task={task}
                passcodeSet={Boolean(limits.passcode)}
                askingReason={Boolean(asking[task.id])}
                guide={index === 0 ? "task-card" : undefined}
                onApprove={() => approveTask(task.id)}
                onAskReason={() => askReason(task.id)}
                onRejectDirect={() => rejectTask(task.id)}
                onPasscode={(code) => submitPasscode(task.id, code)}
                onWithdraw={() => withdrawCooling(task.id)}
                onRelease={() => releaseCooling(task.id)}
                onTrust={() => toggleTrusted(task.to)}
                onVerify={(key) => {
                  const next = markVerifyStep(task.id, key);
                  if (next) speak("记下了。");
                }}
                verifyGuide={guide.active}
              />
            </div>
          ))
        )}
      </section>

      <section style={{ marginTop: 8 }}>
        <h2 className="yyt-section-title">口令查询</h2>
        <div className="yyt-panel">
          <p className="yyt-hint">父母那边念的 6 位数字。同一台设备上可以直接查到。</p>
          <div className="yyt-row" style={{ marginTop: 10 }}>
            <Input
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 位数字"
              aria-label="任务口令"
              className="max-w-40"
            />
            <Button variant="outline" onClick={lookup} aria-label="查这个口令">
              查一下
            </Button>
          </div>
          {passcodeError ? (
            <p className="yyt-hint" style={{ color: "var(--yyt-danger)", marginTop: 8 }}>
              {passcodeError}
            </p>
          ) : null}
        </div>
      </section>

      <section style={{ marginTop: 8 }}>
        <h2 className="yyt-section-title">已处理</h2>
        {settled.length === 0 ? (
          <div className="yyt-panel">
            <p className="yyt-hint">还没有处理过的请求。</p>
          </div>
        ) : (
          <div className="yyt-panel">
            {settled.map((task) => (
              <div key={task.id} className="yyt-row" style={{ justifyContent: "space-between", padding: "10px 0" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{task.title}</div>
                  <div className="yyt-hint">
                    {task.kind} · {task.to} · {task.amount > 0 ? `¥${task.amount}` : "不涉及"}
                    {task.reason ? ` · ${task.reason}` : ""}
                  </div>
                </div>
                {task.state === "approved" ? (
                  <Button variant="outline" size="sm" onClick={() => copyReceipt(task)} aria-label="复制回执链接">
                    {copied === task.id ? "已复制回执" : "复制回执链接"}
                  </Button>
                ) : (
                  <span className={`yyt-badge yyt-badge-${task.state}`}>
                    {task.state === "blocked" ? "已拦截" : task.state === "done" ? "已完成" : task.state === "rejected" ? "已拒绝" : task.state}
                  </span>
                )}
              </div>
            ))}
            <p className="yyt-hint" style={{ marginTop: 8 }}>
              跨设备时，把「回执链接」发给父母，点一下那边就生效了。同设备不用这一步。
            </p>
          </div>
        )}
      </section>

      <section style={{ marginTop: 8 }}>
        <h2 className="yyt-section-title">设置</h2>
        <div className="yyt-panel">
          <div className="yyt-row" style={{ justifyContent: "space-between", padding: "10px 0" }}>
            <label htmlFor="per-tx">单笔限额（元）</label>
            <span data-guide="limit-input">
              {numberField(limits.perTx, "单笔限额", (next) => updateLimits({ perTx: next }))}
            </span>
          </div>
          <div className="yyt-row" style={{ justifyContent: "space-between", padding: "10px 0" }}>
            <label htmlFor="per-day">每日累计限额（元）</label>
            {numberField(limits.perDay, "每日累计限额", (next) => updateLimits({ perDay: next }))}
          </div>
          <div className="yyt-row" style={{ justifyContent: "space-between", padding: "10px 0" }}>
            <label>夜间时段（起 - 止，小时）</label>
            <span className="yyt-row">
              <Input
                type="number"
                min={0}
                max={23}
                value={limits.nightStart}
                className="max-w-24"
                aria-label="夜间开始小时"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next >= 0 && next <= 23) updateLimits({ nightStart: next });
                }}
              />
              <span>到</span>
              <Input
                type="number"
                min={0}
                max={23}
                value={limits.nightEnd}
                className="max-w-24"
                aria-label="夜间结束小时"
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next >= 0 && next <= 23) updateLimits({ nightEnd: next });
                }}
              />
            </span>
          </div>
        </div>

        <div className="yyt-panel">
          <h3 className="yyt-section-title" style={{ fontSize: 16 }}>
            约定暗号
          </h3>
          <p className="yyt-hint">只有家人知道，不要用生日。</p>
          <div className="yyt-row" style={{ marginTop: 10 }}>
            <Input
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder={limits.passcode ? "已设置（留空表示不改）" : "设一个暗号"}
              aria-label="设置暗号"
              className="max-w-48"
            />
            <Button
              onClick={() => {
                if (newPasscode.trim()) setPasscode(newPasscode.trim());
                setNewPasscode("");
              }}
              disabled={!newPasscode.trim()}
              aria-label="保存暗号"
            >
              设置
            </Button>
            {limits.passcode ? (
              <Button variant="outline" onClick={() => setPasscode(undefined)} aria-label="清除暗号">
                清除
              </Button>
            ) : null}
          </div>
          {limits.passcode ? <p className="yyt-hint" style={{ marginTop: 8 }}>暗号已设置。</p> : null}
        </div>

        <div className="yyt-panel">
          <h3 className="yyt-section-title" style={{ fontSize: 16 }}>
            可信收款方
          </h3>
          <p className="yyt-hint">名单里的人，第一次转账也不用再冷静期。</p>
          <div className="yyt-row" style={{ marginTop: 10 }}>
            <Input
              value={trustedInput}
              onChange={(e) => setTrustedInput(e.target.value)}
              placeholder="比如：省医院"
              aria-label="新增可信收款方"
              className="max-w-48"
            />
            <Button
              variant="outline"
              onClick={() => {
                const name = trustedInput.trim();
                if (!name) return;
                toggleTrusted(name);
                setTrustedInput("");
              }}
              aria-label="加入可信名单"
            >
              加入
            </Button>
          </div>
          <ul className="yyt-list" style={{ marginTop: 10 }}>
            {limits.trustedList.length === 0 ? (
              <li className="yyt-hint">名单还是空的。</li>
            ) : (
              limits.trustedList.map((name) => (
                <li key={name}>
                  {name}{" "}
                  <Button variant="link" size="sm" onClick={() => toggleTrusted(name)} aria-label={`移除 ${name}`}>
                    移除
                  </Button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 8 }} data-guide="trace">
        <h2 className="yyt-section-title">家庭留痕</h2>
        <div className="yyt-panel">
          <TraceTimeline items={trace} showTask />
        </div>
      </section>
    </div>
  );
}
