import { evaluate, todayApprovedSum } from "./rules";
import { commitLimits, commitTasks, getLimits, getTasks } from "./sync";
import {
  ACT,
  VERIFY_LABEL,
  verifyComplete,
  verifyProgress,
  type Limits,
  type Task,
  type TaskKind,
  type TaskState,
  type VerifyStepKey,
} from "./types";

/** 唯一合法流转表。任何不在表里的流转都会被拒绝。 */
export const TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending: ["approved", "rejected", "blocked", "cooling"],
  cooling: ["approved", "rejected"],
  approved: ["done"],
  rejected: [],
  blocked: [],
  done: [],
};

function now(): number {
  return Date.now();
}

function nextId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 唯一的流转入口：校验合法性 → 追加一条留痕。
 * 重复流转与非法流转都原样返回任务，由调用方在界面上给出提示。
 */
export function applyTransition(
  task: Task,
  to: TaskState,
  by: Task["trace"][number]["by"],
  action: string,
  note?: string,
  reason?: string,
): Task {
  if (task.state === to) return task;
  const allowed = TRANSITIONS[task.state] ?? [];
  if (!allowed.includes(to)) return task;
  const next: Task = {
    ...task,
    state: to,
    reason: reason ?? (to === "approved" || to === "done" ? undefined : task.reason),
    trace: [...task.trace, { ts: now(), by, action, note }],
  };
  if (to === "cooling") {
    next.coolingUntil = now() + 30 * 60 * 1000;
  }
  if (to === "approved" || to === "rejected" || to === "done") {
    next.coolingUntil = undefined;
  }
  return next;
}

export interface NewTaskInput {
  kind: TaskKind;
  title: string;
  to: string;
  amount: number;
  channel: string;
  from?: string;
  consequence?: string;
  deadlineTs?: number;
  deadlineText?: string;
  lateText?: string;
}

/** 父母端发起。创建后立刻按规则引擎判定：硬拦截 → blocked，软规则 → cooling。 */
export function createTask(input: NewTaskInput): Task {
  const id = nextId();
  const next = commitTasks((draft) => {
    const at = now();
    const task: Task = {
      id,
      kind: input.kind,
      title: input.title,
      from: input.from ?? "妈妈",
      to: input.to,
      amount: input.amount,
      channel: input.channel,
      at,
      state: "pending",
      trace: [{ ts: at, by: "父母端", action: ACT.create }],
    };
    if (input.consequence) task.consequence = input.consequence;
    if (input.deadlineTs) task.deadlineTs = input.deadlineTs;
    if (input.deadlineText) task.deadlineText = input.deadlineText;
    if (input.lateText) task.lateText = input.lateText;
    const limits = getLimits();
    // 只有转账且有金额时才挂核验；先挂核验、再跑规则，所以被拦截的转账也带着核验
    if (input.kind === "转账" && input.amount > 0) {
      task.verification = {
        required: !limits.trustedList.includes(input.to),
        steps: [
          { key: "callback", done: false },
          { key: "passcode", done: false },
          { key: "restate", done: false },
          { key: "second", done: false },
        ],
      };
    }
    const verdict = evaluate({
      amount: task.amount,
      payee: task.to,
      limits,
      todaySum: todayApprovedSum(draft, at),
      now: at,
    });
    let settled = task;
    if (verdict.verdict === "blocked") {
      settled = applyTransition(task, "blocked", "系统", ACT.block, verdict.message, verdict.message);
    } else if (verdict.verdict === "cooling") {
      settled = applyTransition(task, "cooling", "系统", ACT.cooling, verdict.message, verdict.message);
    }
    draft.push(settled);
    return draft;
  });
  return next.find((t) => t.id === id) as Task;
}

function replaceTask(draft: Task[], id: string, next: Task): Task[] {
  const index = draft.findIndex((t) => t.id === id);
  if (index === -1) return draft;
  draft[index] = next;
  return draft;
}

/** 子女端「确认代办」。每次都重新跑规则，限额改过立刻生效。 */
export function approveTask(id: string): Task | null {
  let result: Task | null = null;
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    const at = now();
    const limits = getLimits();
    // 核验没做完就不允许确认代办；界面上按钮已置灰并写明还差几步
    if (task.verification && !verifyComplete(task, Boolean(limits.passcode))) {
      const missing = verifyProgress(task, Boolean(limits.passcode)).missing.length;
      result = null;
      return replaceTask(draft, id, {
        ...task,
        trace: [
          ...task.trace,
          { ts: now(), by: "系统", action: ACT.verifyPending, note: `还差 ${missing} 步核验没做完` },
        ],
      });
    }
    const verdict = evaluate({
      amount: task.amount,
      payee: task.to,
      limits,
      todaySum: todayApprovedSum(draft, at),
      now: at,
    });
    let next: Task;
    if (verdict.verdict === "pass") {
      next = applyTransition(task, "approved", "子女端", ACT.approve, "规则校验通过（R7）");
    } else if (verdict.verdict === "cooling" && task.verification && verifyComplete(task, Boolean(limits.passcode))) {
      // 转账类：核验已逐项完成，但冷静期没走完 —— 留痕必须写实话，不能写成「确认代办」
      const early = task.coolingUntil ? now() < task.coolingUntil : false;
      next = applyTransition(
        task,
        "approved",
        "子女端",
        ACT.release,
        early ? "冷静期内提前放行（核验已逐项完成）" : "冷静期结束，放行（核验已逐项完成）",
      );
    } else if (verdict.verdict === "cooling") {
      next = applyTransition(task, "cooling", "子女端", ACT.cooling, verdict.message, verdict.message);
    } else {
      next = applyTransition(task, "blocked", "系统", ACT.block, verdict.message, verdict.message);
    }
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

/** 子女端「拒绝」。带理由时理由写进留痕，父母能看到孩子为什么没接。 */
export function rejectTask(id: string, reason?: string): Task | null {
  let result: Task | null = null;
  const note = reason?.trim() || "孩子没有接这件事";
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    const next = applyTransition(task, "rejected", "子女端", ACT.reject, note, reason?.trim() || undefined);
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

export type PasscodeResult = { ok: boolean; task?: Task; error?: string };

/** 子女端「要求核对暗号」。暗号不对 → 直接拦截。 */
export function verifyPasscode(id: string, code: string): PasscodeResult {
  const limits = getLimits();
  if (!limits.passcode) return { ok: false, error: "还没设置暗号，先在设置里设一个。" };
  let result: PasscodeResult = { ok: false };
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    const at = now();
    const ok = code.trim() === limits.passcode;
    const verdict = evaluate({
      amount: task.amount,
      payee: task.to,
      limits,
      todaySum: todayApprovedSum(draft, at),
      now: at,
      passcodeChecked: true,
      passcodeOk: ok,
    });
    let next: Task;
    if (verdict.verdict === "blocked") {
      next = applyTransition(task, "blocked", "系统", ACT.passcodeFail, verdict.message, verdict.message);
    } else if (verdict.verdict === "cooling") {
      next = applyTransition(task, "cooling", "子女端", ACT.cooling, verdict.message, verdict.message);
    } else {
      next = applyTransition(task, "approved", "子女端", ACT.passcodeOk, "暗号核对通过");
    }
    result = { ok: true, task: next };
    return replaceTask(draft, id, next);
  });
  // 暗号核对通过 → 顺手把核验里的「暗号」这一步标掉
  if (result.ok && limits.passcode && code.trim() === limits.passcode) {
    markVerifyStep(id, "passcode");
  }
  return result;
}

/** 标记一个核验步骤完成，并往留痕里写一条「核验：…」。 */
export function markVerifyStep(id: string, key: VerifyStepKey, note?: string): Task | null {
  let result: Task | null = null;
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task || !task.verification) return draft;
    const step = task.verification.steps.find((s) => s.key === key);
    if (!step) return draft;
    if (step.done) {
      result = task;
      return draft;
    }
    const ts = now();
    const next: Task = {
      ...task,
      verification: {
        ...task.verification,
        steps: task.verification.steps.map((s) => (s.key === key ? { ...s, done: true, ts, note } : s)),
      },
      trace: [
        ...task.trace,
        { ts, by: "子女端", action: ACT.verify, note: `${VERIFY_LABEL[key]}${note ? "：" + note : ""}` },
      ],
    };
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

/** 冷静期放行。倒计时未走完时也允许放行，但留痕写明「冷静期内提前放行」。 */
export function releaseCooling(id: string): Task | null {
  let result: Task | null = null;
  const limits = getLimits();
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    // 转账类：核验没做完，不许靠「仍要确认」绕过；界面上按钮已置灰并写明还差几步
    if (task.verification && !verifyComplete(task, Boolean(limits.passcode))) {
      const missing = verifyProgress(task, Boolean(limits.passcode)).missing.length;
      return replaceTask(draft, id, {
        ...task,
        trace: [
          ...task.trace,
          { ts: now(), by: "系统", action: ACT.verifyPending, note: `还差 ${missing} 步核验没做完` },
        ],
      });
    }
    const early = task.coolingUntil ? now() < task.coolingUntil : false;
    // 核验类任务把「为什么能提前放行」一起写进留痕；普通任务文案不变
    const suffix = task.verification ? "（核验已逐项完成）" : "";
    const next = applyTransition(
      task,
      "approved",
      "子女端",
      ACT.release,
      `${early ? "冷静期内提前放行" : "冷静期结束，放行"}${suffix}`,
    );
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

/** 冷静期内撤回。 */
export function withdrawCooling(id: string): Task | null {
  let result: Task | null = null;
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    const next = applyTransition(task, "rejected", "子女端", ACT.withdraw, "冷静期内撤回", "冷静期内撤回");
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

/** 父母端收到语音回执后自动归档。 */
export function markDone(id: string): Task | null {
  let result: Task | null = null;
  commitTasks((draft) => {
    const task = draft.find((t) => t.id === id);
    if (!task) return draft;
    const next = applyTransition(task, "done", "父母端", ACT.done, "事情办完了");
    result = next;
    return replaceTask(draft, id, next);
  });
  return result;
}

export interface ReceiptPayload {
  id: string;
  state: TaskState;
  reason?: string;
  task?: Omit<Task, "trace" | "state" | "reason">;
}

/**
 * 父母端收到跨设备回执链接后套用状态变更。
 * 本机没有这条任务时（跨设备场景）先按回执内容建档，再套用状态。
 */
export function applyReceipt(payload: ReceiptPayload): Task | null {
  let result: Task | null = null;
  commitTasks((draft) => {
    let task = draft.find((t) => t.id === payload.id);
    if (!task) {
      if (!payload.task) return draft;
      task = {
        ...(payload.task as Task),
        id: payload.id,
        state: "pending",
        trace: [{ ts: now(), by: "父母端", action: ACT.create }],
      };
      draft.push(task);
    }
    const next = applyTransition(task, payload.state, "子女端", ACT.receipt, payload.reason, payload.reason);
    result = next;
    return replaceTask(draft, payload.id, next);
  });
  return result;
}

export function updateLimits(patch: Partial<Limits>): Limits {
  return commitLimits((draft) => ({ ...draft, ...patch }));
}

export function setPasscode(code: string | undefined): Limits {
  return commitLimits((draft) => ({ ...draft, passcode: code }));
}

export function toggleTrusted(name: string): Limits {
  return commitLimits((draft) => {
    const trusted = draft.trustedList.includes(name)
      ? draft.trustedList.filter((n) => n !== name)
      : [...draft.trustedList, name];
    return { ...draft, trustedList: trusted };
  });
}

export function getTask(id: string): Task | undefined {
  return getTasks().find((t) => t.id === id);
}
