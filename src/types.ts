export type TaskState = "pending" | "approved" | "rejected" | "blocked" | "cooling" | "done";
export type TaskKind = "挂号" | "缴费" | "打车" | "买东西" | "转账";
export type Role = "parent" | "child";
export type TraceActor = "父母端" | "子女端" | "系统";

export interface TraceItem {
  ts: number;
  by: TraceActor;
  action: string;
  note?: string;
}

/** `to` 存对象/收款方（省医院、超市、目的地），处理人恒为子女端。 */
export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  from: string;
  to: string;
  amount: number;
  channel: string;
  at: number;
  state: TaskState;
  reason?: string;
  trace: TraceItem[];
  coolingUntil?: number;
  /** 不办的后果 */
  consequence?: string;
  /** 时限（毫秒时间戳），剩余时间必须按真实时间算 */
  deadlineTs?: number;
  /** 覆盖自动生成的时限显示文案 */
  deadlineText?: string;
  /** 父母端看到的「晚了会怎样」文案 */
  lateText?: string;
  /** 转账前核验（只有转账类任务会挂上） */
  verification?: Verification;
}

export interface Limits {
  perTx: number;
  perDay: number;
  nightStart: number;
  nightEnd: number;
  passcode?: string;
  trustedList: string[];
}

export const DEFAULT_LIMITS: Limits = {
  perTx: 500,
  perDay: 1000,
  nightStart: 22,
  nightEnd: 6,
  trustedList: [],
};

export type Verdict = "pass" | "cooling" | "blocked";
export type RuleCode = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";

export interface RuleResult {
  verdict: Verdict;
  code: RuleCode;
  message: string;
}

export const ACT = {
  create: "发起",
  approve: "确认代办",
  reject: "拒绝",
  block: "拦截",
  cooling: "进入冷静期",
  release: "仍要确认",
  withdraw: "撤回",
  done: "完成",
  passcodeOk: "暗号核对通过",
  passcodeFail: "暗号核对失败",
  receipt: "收到回执",
  verify: "核验",
  verifyPending: "核验未完成",
} as const;

export const STATE_LABEL: Record<TaskState, string> = {
  pending: "待确认",
  approved: "已确认",
  rejected: "已拒绝",
  blocked: "已拦截",
  cooling: "冷静期",
  done: "已完成",
};

export const STATE_ORDER: TaskState[] = ["pending", "cooling", "approved", "blocked", "rejected", "done"];

export type DeadlineUrgency = "normal" | "soon" | "urgent" | "overdue";

/** 父母端四张大字卡的默认设定：去哪里、办什么、不办会怎样、什么时候之前。 */
export interface KindSpec {
  kind: TaskKind;
  icon: string;
  label: string;
  sub: string;
  to: string;
  channel: string;
  title: string;
  consequence: string;
  lateText: string;
  dayOffset?: number;
  hour?: number;
  minute?: number;
  /** 相对发起时刻的时限（小时）。转账这类「现在就要办」的事用它。 */
  relativeDeadlineHours?: number;
}

export const KIND_SPECS: KindSpec[] = [
  {
    kind: "挂号",
    icon: "🏥",
    label: "挂号",
    sub: "去医院挂号",
    to: "省医院",
    channel: "医院公众号",
    title: "明天上午去省医院复查",
    consequence: "复查错过这次要重新排队到 12 月中",
    lateText: "晚了就得重新排队，队排到 12 月中",
    dayOffset: 1,
    hour: 11,
    minute: 0,
  },
  {
    kind: "缴费",
    icon: "💳",
    label: "缴费",
    sub: "交住院费",
    to: "省医院",
    channel: "医院公众号",
    title: "交上个月的住院费",
    consequence: "住院费逾期，护士站会来催，12 月 3 日才能补缴",
    lateText: "晚了就得等 12 月 3 日才能补缴",
    dayOffset: 0,
    hour: 17,
    minute: 0,
  },
  {
    kind: "打车",
    icon: "🚕",
    label: "打车",
    sub: "出门叫车",
    to: "目的地",
    channel: "打车软件",
    title: "出门去一趟女儿家",
    consequence: "雨天打不到车，老人家也不敢在路上拦车",
    lateText: "晚了雨天更难打车，孩子也赶不回来",
    dayOffset: 0,
    hour: 18,
    minute: 0,
  },
  {
    kind: "买东西",
    icon: "🛒",
    label: "买东西",
    sub: "买菜买水果",
    to: "超市",
    channel: "微信支付",
    title: "买点菜和水果",
    consequence: "三天没买菜，糖尿病老人不能只吃主食",
    lateText: "晚了就得明天再跑一趟，三天没买菜可不行",
    dayOffset: 0,
    hour: 20,
    minute: 0,
  },
  {
    kind: "转账",
    icon: "💸",
    label: "转账",
    sub: "有人让我转钱",
    to: "张阿姨",
    channel: "微信转账",
    title: "有人打电话让我转钱",
    consequence: "钱一转出去就很难追回，这种电话十有八九是骗局",
    lateText: "转错了难追回，先别急着按确认",
    relativeDeadlineHours: 2,
  },
];

/** 按「第几天几点几分」算出真实时间戳，剩余时间必须基于它计算。 */
export function deadlineFrom(dayOffset: number, hour: number, minute: number, now: number = Date.now()): number {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  // 钟点已经过去就按天顺延，最多推 7 天：「买菜要在 20:00 前」过了点应是明天 20:00，而不是「已经晚了」
  let pushed = 0;
  while (d.getTime() <= now && pushed < 7) {
    d.setDate(d.getDate() + 1);
    pushed += 1;
  }
  return d.getTime();
}

/** 剩余 / 迟到多久的文案，两端共用这一个函数。 */
export function formatRemaining(ts: number, now: number = Date.now()): string {
  const diff = ts - now;
  const late = diff <= 0;
  const remain = Math.abs(diff);
  const prefix = late ? "已经晚了 " : "还剩 ";

  if (remain < 60 * 60000) {
    return `${prefix}${Math.max(1, Math.ceil(remain / 60000))} 分钟`;
  }
  if (remain < 24 * 3600000) {
    const hours = Math.floor(remain / 3600000);
    const minutes = Math.floor((remain % 3600000) / 60000);
    return minutes > 0 ? `${prefix}${hours} 小时 ${minutes} 分` : `${prefix}${hours} 小时`;
  }
  const days = Math.floor(remain / 86400000);
  const hours = Math.floor((remain % 86400000) / 3600000);
  return hours > 0 ? `${prefix}${days} 天 ${hours} 小时` : `${prefix}${days} 天`;
}

/** 取某类任务的默认时限：转账走「现在 + N 小时」，其余走墙上的钟点。 */
export function deadlineForSpec(spec: KindSpec, now: number = Date.now()): number {
  if (typeof spec.relativeDeadlineHours === "number") {
    return now + spec.relativeDeadlineHours * 3600 * 1000;
  }
  return deadlineFrom(spec.dayOffset ?? 0, spec.hour ?? 0, spec.minute ?? 0, now);
}
/** 时限显示：今天 / 明天 / 具体日期，都按真实时间算。 */
export function formatDeadline(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const todayStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((targetStart - todayStart) / 86400000);
  if (days === 0) return `今天 ${time} 前`;
  if (days === 1) return `明天 ${time} 前`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time} 前`;
}

/** 剩余不足 24 小时转橙，不足 6 小时转红，已过期单列。 */
export function deadlineUrgency(ts: number, now: number = Date.now()): DeadlineUrgency {
  const remain = ts - now;
  if (remain <= 0) return "overdue";
  if (remain < 6 * 3600 * 1000) return "urgent";
  if (remain < 24 * 3600 * 1000) return "soon";
  return "normal";
}

/* ================= 转账前核验 ================= */
export type VerifyStepKey = "callback" | "passcode" | "restate" | "second";

export interface VerifyStep {
  key: VerifyStepKey;
  done: boolean;
  ts?: number;
  note?: string;
}

export interface Verification {
  required: boolean;
  steps: VerifyStep[];
}

export const VERIFY_LABEL: Record<VerifyStepKey, string> = {
  callback: "用存好的号码回拨确认",
  passcode: "让爸妈说约定的暗号",
  restate: "让爸妈把金额和收款人念一遍",
  second: "家里另一个人也确认了",
};

export const VERIFY_HINT: Record<VerifyStepKey, string> = {
  callback: "不要按来电显示的号码回拨 —— 按通讯录里存的那个号。",
  passcode: "没有暗号就没法核对。去「设置」里和爸妈约定一个。",
  restate: "骗子能模仿脸和声音，但很难同时把金额和收款人都说对。",
  second: "多一个人知道，就多一道保险。",
};

/** 短标签，用于「还差 N 步：…」这类一行式提示。 */
export const VERIFY_SHORT: Record<VerifyStepKey, string> = {
  callback: "回拨",
  passcode: "暗号",
  restate: "金额复述",
  second: "第二个家人确认",
};

/** 必做步骤：有暗号就必做暗号核对，没暗号就改为要求第二个家人确认。 */
export function requiredVerifyKeys(task: Task, passcodeSet: boolean): VerifyStepKey[] {
  if (!task.verification || !task.verification.required) return [];
  return ["callback", "restate", passcodeSet ? "passcode" : "second"];
}

export function verifyProgress(
  task: Task,
  passcodeSet: boolean,
): { done: number; total: number; missing: VerifyStepKey[] } {
  const required = requiredVerifyKeys(task, passcodeSet);
  const steps = task.verification?.steps ?? [];
  const missing = required.filter((key) => !steps.find((s) => s.key === key)?.done);
  return { done: required.length - missing.length, total: required.length, missing };
}

export function verifyComplete(task: Task, passcodeSet: boolean): boolean {
  return verifyProgress(task, passcodeSet).missing.length === 0;
}

export const DEADLINE_COLOR: Record<DeadlineUrgency, string> = {
  overdue: "#b3402f",
  urgent: "#b3402f",
  soon: "#b45309",
  normal: "#5b6560",
};

export interface DeadlineView {
  text: string;
  urgency: DeadlineUrgency;
  color: string;
  tag?: string;
  alert?: string;
  /** 实时倒计时文案，两端逐字相同 */
  remaining?: string;
}

/** 只有「还来得及做」的任务才显示倒计时与紧迫色：待确认、冷静期。 */
const DEADLINE_LIVE_STATES: TaskState[] = ["pending", "cooling"];

/**
 * 时限的统一展示口径：父母端与子女端都调用这一个函数，
 * 颜色、文案、「快到点了」提示只有这一份实现。
 */
export function deadlineView(
  task: { deadlineTs?: number; deadlineText?: string; state?: TaskState },
  now: number = Date.now(),
): DeadlineView | null {
  if (!task.deadlineTs) return null;
  // 只有「还来得及做」的任务才显示倒计时与紧迫色；事情有了结果就不再催。
  // 没有 state 的调用方按「待办」处理，保持旧行为。
  const live =
    task.state === undefined || DEADLINE_LIVE_STATES.indexOf(task.state) !== -1;
  const urgency: DeadlineUrgency = live ? deadlineUrgency(task.deadlineTs, now) : "normal";
  return {
    text: task.deadlineText ?? formatDeadline(task.deadlineTs, now),
    urgency,
    color: DEADLINE_COLOR[urgency],
    remaining: live ? formatRemaining(task.deadlineTs, now) : undefined,
    tag: live
      ? urgency === "overdue"
        ? "已经晚了"
        : urgency === "urgent"
          ? "快到点了"
          : undefined
      : undefined,
    alert: live
      ? urgency === "overdue"
        ? "这件事已经晚了，先办还是先放一放？"
        : urgency === "urgent"
          ? "快到点了，先办还是先放一放？"
          : undefined
      : undefined,
  };
}
