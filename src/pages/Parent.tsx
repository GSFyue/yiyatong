import { useEffect, useMemo, useRef, useState } from "react";
import { BigCard } from "../components/BigCard";
import { VoiceButton } from "../components/VoiceButton";
import { VoiceToggle } from "../components/VoiceToggle";
import { useGuide } from "../guide";
import { useNow } from "../hooks/useNow";
import { useTasks } from "../hooks/useStore";
import { buildChildLink, decodePayload, formatPasscode, makePasscode, rememberPasscode } from "../link";
import { setQueryParams, useUrl } from "../router";
import { getSplit, setSplit, useSplit } from "../split";
import { sendSignal, subscribeSignal } from "../sync";
import { applyReceipt, createTask, markDone, type ReceiptPayload } from "../state";
import {
  deadlineForSpec,
  deadlineView,
  formatDeadline,
  KIND_SPECS,
  STATE_LABEL,
  type Task,
  type TaskKind,
} from "../types";
import { speak } from "../voice";
import "../styles/parent.css";

const REASON_PRESETS = ["明天真的没号了", "医院催着交钱", "家里已经没菜了"];

/** 语音写入的目标行 */
type VoiceField = "title" | "to" | "amount";

const FIELD_LABEL: Record<VoiceField, string> = { title: "要做什么", to: "给谁", amount: "多少钱" };

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 「八十块」「一百二十」这类中文数字说出来的金额 */
function parseChineseNumber(text: string): number | null {
  const matched = text.match(/[零一二两三四五六七八九十百千]+/);
  if (!matched) return null;
  let section = 0;
  let digit = 0;
  for (const ch of matched[0]) {
    if (ch === "十") {
      section += (digit || 1) * 10;
      digit = 0;
    } else if (ch === "百") {
      section += (digit || 1) * 100;
      digit = 0;
    } else if (ch === "千") {
      section += (digit || 1) * 1000;
      digit = 0;
    } else {
      digit = CN_DIGITS[ch] ?? 0;
    }
  }
  const total = section + digit;
  return total > 0 ? total : null;
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Parent() {
  const tasks = useTasks();
  const now = useNow(30000);
  const { hashParams } = useUrl();
  const guide = useGuide();
  const split = useSplit();
  const [view, setView] = useState<"home" | "confirm">("home");
  const [kind, setKind] = useState<TaskKind>("挂号");
  const [title, setTitle] = useState(KIND_SPECS[0].title);
  const [to, setTo] = useState(KIND_SPECS[0].to);
  const [amount, setAmount] = useState("0");
  const [created, setCreated] = useState<{ task: Task; code: string; link: string } | null>(null);
  const [receiptNote, setReceiptNote] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reasonRequest, setReasonRequest] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceField, setVoiceField] = useState<VoiceField>("title");
  const voiceFieldRef = useRef<VoiceField>("title");
  const fieldRefs = useRef<Record<VoiceField, HTMLInputElement | null>>({
    title: null,
    to: null,
    amount: null,
  });

  const setVoiceTarget = (field: VoiceField) => {
    voiceFieldRef.current = field;
    setVoiceField(field);
  };

  const spec = KIND_SPECS.find((k) => k.kind === kind) ?? KIND_SPECS[0];
  const iframeSrc = `${location.pathname}?role=child`;

  useEffect(() => {
    const encoded = hashParams.get("receipt");
    if (!encoded) return;
    const payload = decodePayload<ReceiptPayload>(encoded);
    if (!payload) {
      setReceiptNote({ text: "这条回执看不懂，请让孩子重新发一次。", tone: "warn" });
      return;
    }
    const applied = applyReceipt(payload);
    if (!applied) {
      setReceiptNote({ text: "这条回执没对上本机的记录，请让孩子重新发一次。", tone: "warn" });
      return;
    }
    // 流转表里没有这一步（例如这条已经办完），状态原样返回，必须说清楚没生效
    if (applied.state !== payload.state) {
      setReceiptNote({
        text: `这件事本机已经是「${STATE_LABEL[applied.state]}」了，这条回执没有重复改状态。`,
        tone: "warn",
      });
      return;
    }
    if (payload.state === "approved") {
      markDone(applied.id);
      speak("孩子已经帮你办好了。");
      setReceiptNote({ text: "孩子的回执收到了，这件事已经办好了。", tone: "ok" });
    } else {
      speak("这笔被拦下了，请打个电话给孩子确认。");
      setReceiptNote({ text: "孩子的回执收到了，这笔还需要你们再说一次。", tone: "ok" });
    }
  }, [hashParams]);

  // 导览第 3 步需要停在「说好了，发出」这一步；回到第 2 步时要把大字卡还回来
  useEffect(() => {
    if (!guide.active) return;
    if (guide.index === 2) {
      setView("confirm");
      setKind("挂号");
      setTitle(KIND_SPECS[0].title);
      setTo(KIND_SPECS[0].to);
    } else {
      setView("home");
    }
  }, [guide.active, guide.index]);

  // 孩子问「为什么不办」，请父母回一句
  useEffect(
    () =>
      subscribeSignal((signal) => {
        if (signal.type !== "reject-request") return;
        setReasonRequest(signal.taskId);
      }),
    [],
  );

  // 右栏 iframe 3 秒内没 ready 时给出兜底提示，不静默失败
  useEffect(() => {
    if (!split.active) return;
    const timer = setTimeout(() => {
      if (!getSplit().frameLoaded) setSplit({ frameFailed: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [split.active]);

  // load 事件不代表子页真的跑起来了，要确认子女端应用已经挂载
  const checkFrameReady = (attempt = 0) => {
    let ready = false;
    try {
      const doc = frameRef.current?.contentDocument;
      ready = !!doc && !!doc.querySelector(".yyt-child");
    } catch {
      ready = false;
    }
    if (ready) {
      setSplit({ frameLoaded: true, frameFailed: false });
      try {
        frameRef.current?.contentWindow?.scrollTo(0, 0);
      } catch {
        // 跨域或尚未就绪时忽略
      }
      return;
    }
    if (attempt < 20) {
      setTimeout(() => checkFrameReady(attempt + 1), 100);
      return;
    }
    setSplit({ frameFailed: true, frameLoaded: false });
  };

  const handleFrameLoad = () => {
    checkFrameReady(0);
  };

  const myRequests = useMemo(
    () => [...tasks].filter((t) => t.from === "妈妈" || t.from === "我").sort((a, b) => b.at - a.at),
    [tasks],
  );

  const pickKind = (next: TaskKind) => {
    const nextSpec = KIND_SPECS.find((k) => k.kind === next) ?? KIND_SPECS[0];
    setKind(next);
    setTitle(nextSpec.title);
    setTo(nextSpec.to);
    setAmount("0");
    setView("confirm");
  };

  const submit = () => {
    const value = Math.max(0, Number(amount) || 0);
    if (kind === "转账" && value <= 0) {
      speak("转账要填金额。");
      return;
    }
    const task = createTask({
      kind,
      title: title.trim() || spec.title,
      to: to.trim() || spec.to,
      amount: value,
      channel: spec.channel,
      consequence: spec.consequence,
      lateText: spec.lateText,
      deadlineTs: deadlineForSpec(spec),
    });
    const code = makePasscode(`${task.id}-${task.at}`);
    rememberPasscode(code, task.id);
    setCreated({ task, code, link: buildChildLink(task) });
    setView("home");
  };

  /** 识别结果按「当前聚焦的那一行」写入，不再固定写进第一行。 */
  const applyVoice = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const target = voiceFieldRef.current;
    if (target === "amount") {
      const digits = clean.replace(/[^\d]/g, "");
      let value = digits ? Number(digits) : Number.NaN;
      if (!digits) {
        const chinese = parseChineseNumber(clean);
        if (chinese !== null) value = chinese;
      }
      if (!Number.isFinite(value) || value <= 0) {
        speak("金额请说数字，比如八十块。");
        return;
      }
      setAmount(String(value));
    } else if (target === "to") {
      setTo(clean);
    } else {
      setTitle(clean);
      const hit = KIND_SPECS.find((k) => clean.includes(k.kind));
      // 只改类型，不调 pickKind —— pickKind 会把三行内容全部重置
      if (hit) setKind(hit.kind);
    }
    fieldRefs.current[target]?.focus();
    speak(clean);
  };

  const openChild = () => {    const url = `${location.origin}${location.pathname}#/child`;
    const win = window.open(url, "yyt-child", "width=520,height=920");
    setPopupBlocked(win === null);
  };

  const enterSplit = () => setSplit({ active: true, frameLoaded: false, frameFailed: false });
  const exitSplit = () => setSplit({ active: false, frameLoaded: false, frameFailed: false });

  const focusTask = (taskId: string) => sendSignal({ type: "focus", taskId });

  const replyReason = (taskId: string, reason: string) => {
    const text = reason.trim();
    if (!text) return;
    sendSignal({ type: "reject-reply", taskId, reason: text });
    setReasonRequest(null);
    speak("你把原因说给孩子了。");
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const content = (
    <>
      <div className="yp-toolbar">
        <VoiceToggle />
        {split.active ? null : (
          <>
            <button type="button" className="yp-secondary" onClick={openChild} aria-label="打开子女端">
              打开子女端
            </button>
            <button type="button" className="yp-secondary" onClick={enterSplit} aria-label="并排演示">
              并排演示
            </button>
          </>
        )}
        <button
          type="button"
          className="yp-secondary"
          onClick={() => setQueryParams({ guide: "1" })}
          aria-label="演示导览"
        >
          演示导览
        </button>
      </div>

      {popupBlocked ? (
        <div className="yp-notice yp-notice-blocked">
          <p>浏览器挡住了新窗口。请允许弹出窗口，或让子女在同一台电脑上打开子女端。</p>
        </div>
      ) : null}

      {receiptNote ? (
        <div className={`yp-notice ${receiptNote.tone === "ok" ? "yp-notice-ok" : "yp-notice-cooling"}`}>
          <p>{receiptNote.text}</p>
        </div>
      ) : null}

      {view === "home" ? (
        <>
          <h1>要办点什么事？</h1>
          <p className="yp-hint">点一张大字卡就行。别的让孩子来办。</p>
          <p className="yp-hook">
            74.7% 的老人会用手机聊天，只有 9.6% 会挂号 —— 中间这一段，就是这个工具的位置。
          </p>

          <div className="yp-grid" style={{ marginTop: 16 }}>
            {KIND_SPECS.filter((k) => k.kind !== "转账").map((k) => (
              <BigCard
                key={k.kind}
                icon={k.icon}
                label={k.label}
                sub={k.sub}
                guide={k.kind === "挂号" ? "card-挂号" : undefined}
                onClick={() => pickKind(k.kind)}
              />
            ))}
          </div>

          <p className="yp-more">
            <button
              type="button"
              className="yp-text-button"
              onClick={() => setView("confirm")}
              aria-label="要办的事不止这四件，点这里说清楚"
            >
              要办的事不止这四件？点这里说清楚 →
            </button>
          </p>

          {created ? (
            <div className="yp-panel" style={{ marginTop: 20 }}>
              <h2>
                {created.task.kind === "转账"
                  ? "这笔钱要等孩子核验过，才转得出去。"
                  : "点好了。孩子那边收到了。"}
              </h2>
              <p>把这 6 位数字念给孩子，或者让他打开下面的链接。</p>
              <div className="yp-passcode" aria-label={`任务口令 ${created.code}`}>
                {formatPasscode(created.code)}
              </div>
              <p className="yp-link">{created.link}</p>
              <div className="yp-row" style={{ marginTop: 12 }}>
                <button type="button" className="yp-secondary" onClick={copyLink}>
                  {copied ? "已复制" : "复制链接"}
                </button>
                <span className="yp-hint">同设备不用念口令，孩子那边会自己收到。</span>
              </div>
            </div>
          ) : null}

          <div className="yp-panel" style={{ marginTop: 20 }}>
            <h2>我的请求</h2>
            {myRequests.length === 0 ? (
              <p className="yp-empty">暂时没有要办的事。</p>
            ) : (
              myRequests.map((task) => {
                const view = deadlineView(task, now);
                return (
                <div className="yp-item" key={task.id}>
                  <div className="yp-item-main">
                    <button
                      type="button"
                      className="yp-item-title yp-title-btn"
                      onClick={() => focusTask(task.id)}
                      aria-label={`定位到 ${task.title}`}
                    >
                      {task.title}
                    </button>
                    <div className="yp-item-sub">
                      {task.kind} · {task.to} · {formatWhen(task.at)}
                      {task.amount > 0 ? ` · ¥${task.amount}` : ""}
                    </div>
                    {view ? (
                      <>
                        <div className="yp-item-sub yp-deadline" style={{ color: view.color }}>
                          时限：{view.text}
                          {view.tag ? <span className="yp-tag">{view.tag}</span> : null}
                          {view.remaining ? (
                            <span className="yp-remaining">{view.remaining}</span>
                          ) : null}
                        </div>
                        {task.lateText || task.consequence ? (
                          <div className="yp-item-sub">
                            晚了会怎样：{task.lateText ?? task.consequence}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {task.state === "blocked" ? (
                      <div className="yp-notice yp-notice-blocked" style={{ marginTop: 10 }}>
                        <p>这笔被拦下了。请打个电话给孩子。</p>
                      </div>
                    ) : null}
                    {task.state === "cooling" ? (
                      <div className="yp-notice yp-notice-cooling" style={{ marginTop: 10 }}>
                        <p>要等一等。孩子确认了才算数。</p>
                      </div>
                    ) : null}
                    {task.state === "approved" ? (
                      <div className="yp-row" style={{ marginTop: 10 }}>
                        <button type="button" className="yp-secondary" onClick={() => markDone(task.id)}>
                          收到，已经办好了
                        </button>
                      </div>
                    ) : null}
                    {reasonRequest === task.id ? (
                      <div className="yp-notice yp-notice-cooling" style={{ marginTop: 10 }}>
                        <p className="yp-item-title">孩子问：为什么非要办这件事？</p>
                        <p className="yp-hint" style={{ marginTop: 6 }}>
                          选一个，或者按住说一句。孩子那边会记下来。
                        </p>
                        <div className="yp-row" style={{ marginTop: 10 }}>
                          {REASON_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className="yp-secondary"
                              onClick={() => replyReason(task.id, preset)}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        <VoiceButton hint="说一句就行。" onText={(text) => replyReason(task.id, text)} />
                      </div>
                    ) : null}
                    <details className="yp-details">
                      <summary>看记录</summary>
                      <ul className="yp-trace">
                        {[...task.trace]
                          .sort((a, b) => b.ts - a.ts)
                          .map((item, index) => (
                            <li key={`${item.ts}-${index}`}>
                              <time>{formatWhen(item.ts)}</time>
                              <div>
                                <b>{item.by}</b> · {item.action}
                                {item.note ? <p>{item.note}</p> : null}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </details>
                  </div>
                  <span className={`yp-badge yp-badge-${task.state}`}>
                    {
                      { pending: "待确认", approved: "已确认", rejected: "已拒绝", blocked: "已拦截", cooling: "冷静期", done: "已完成" }[
                        task.state
                      ]
                    }
                  </span>
                </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <h1>说清楚点</h1>
          <p className="yp-hint">下面三项，填好了就按那个大按钮。</p>

          <div className="yp-panel" style={{ marginTop: 20 }}>
            <p className="yp-hint" style={{ marginBottom: 14 }}>
              先点上面的类型，再填下面三行。
            </p>

            <div className="yp-field">
              <span>要做什么</span>
              <div className="yp-kinds">
                {KIND_SPECS.map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    className="yp-secondary"
                    aria-pressed={kind === k.kind}
                    onClick={() => pickKind(k.kind)}
                  >
                    {k.icon} {k.label}
                  </button>
                ))}
              </div>
              <div className="yp-input-row">
                <input
                  ref={(el) => {
                    fieldRefs.current.title = el;
                  }}
                  className={voiceField === "title" ? "yp-input-active" : ""}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPointerDown={() => setVoiceTarget("title")}
                  onFocus={() => setVoiceTarget("title")}
                  aria-label="要做什么"
                  placeholder="比如：明天上午去省医院复查"
                />
                <VoiceButton
                  variant="row"
                  onText={applyVoice}
                  onBeforeStart={() => setVoiceTarget("title")}
                  onError={setVoiceError}
                />
              </div>
            </div>

            <div className="yp-field">
              <span>给谁</span>
              <div className="yp-input-row">
                <input
                  ref={(el) => {
                    fieldRefs.current.to = el;
                  }}
                  className={voiceField === "to" ? "yp-input-active" : ""}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onPointerDown={() => setVoiceTarget("to")}
                  onFocus={() => setVoiceTarget("to")}
                  aria-label="给谁"
                  placeholder="比如：省医院"
                />
                <VoiceButton
                  variant="row"
                  onText={applyVoice}
                  onBeforeStart={() => setVoiceTarget("to")}
                  onError={setVoiceError}
                />
              </div>
            </div>

            <div className="yp-field">
              <span>多少钱</span>
              <div className="yp-input-row">
                <input
                  ref={(el) => {
                    fieldRefs.current.amount = el;
                  }}
                  className={voiceField === "amount" ? "yp-input-active" : ""}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  onPointerDown={() => setVoiceTarget("amount")}
                  onFocus={() => setVoiceTarget("amount")}
                  inputMode="numeric"
                  aria-label="多少钱"
                  placeholder="不花钱就填 0"
                />
                <VoiceButton
                  variant="row"
                  onText={applyVoice}
                  onBeforeStart={() => setVoiceTarget("amount")}
                  onError={setVoiceError}
                />
              </div>
            </div>

            <p className="yp-hint" style={{ marginBottom: 14 }}>
              {spec.consequence}。要办的话，{formatDeadline(deadlineForSpec(spec))}。
            </p>

            <div className="yp-voice-pill" role="status">
              <span aria-hidden="true">🎯</span> 现在会填到：【{FIELD_LABEL[voiceField]}】
            </div>

            <div className="yp-form-actions">
              <button
                type="button"
                className="yp-back-big"
                onClick={() => setView("home")}
                aria-label="返回，回到大字卡"
              >
                返回
              </button>
              <VoiceButton hint="先点一下要填的那一行，再点这个按钮说一句。" onText={applyVoice} />
            </div>
            {voiceError ? (
              <p className="yp-hint" style={{ color: "var(--yyt-danger)", marginTop: 8 }}>
                {voiceError}
              </p>
            ) : null}

            <button type="button" className="yp-big" onClick={submit} data-guide="send" aria-label="说好了，发出">
              说好了，发出
            </button>
          </div>
        </>
      )}

      <details className="yp-details" style={{ marginTop: 8 }}>
        <summary>说明</summary>
        <p className="yp-foot">当前为演示版，外部系统均为模拟数据。这里不连接医院、也不处理真钱。</p>
      </details>
    </>
  );

  return (
    <div className="yp">
      {split.active ? (
        <>
          <div className="yp-split-bar">
            <span>演示中：左边点一张大字卡，右边 1 秒后出现待办；再点上面的任务名，右边会高亮对应那条。</span>
            <button type="button" className="yp-secondary" onClick={exitSplit} aria-label="退出并排">
              退出并排
            </button>
          </div>
          <div className="yp-split-stage">
            <div className="yp-split">
              <div className="yp-split-main">{content}</div>
              <aside className="yp-split-side">
                <p className="yp-split-title">子女端（同一台设备的另一个窗口）</p>
                {split.frameFailed ? (
                  <div className="yp-split-fallback">
                    <p>右侧没加载出来</p>
                    <a
                      className="yp-secondary"
                      href={`${location.pathname}?role=child`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="在新标签页打开子女端"
                    >
                      在新标签页打开子女端
                    </a>
                  </div>
                ) : null}
                <iframe
                  ref={frameRef}
                  className="yp-split-frame"
                  title="子女端"
                  src={iframeSrc}
                  onLoad={handleFrameLoad}
                  onError={() => setSplit({ frameFailed: true })}
                />
              </aside>
            </div>
          </div>
        </>
      ) : (
        content
      )}
    </div>
  );
}
