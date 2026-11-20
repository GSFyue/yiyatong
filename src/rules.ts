import { ACT, type Limits, type RuleResult, type Task } from "./types";

export const COOLING_MS = 30 * 60 * 1000;

export interface RuleContext {
  amount: number;
  payee: string;
  limits: Limits;
  todaySum: number;
  now: number;
  passcodeChecked?: boolean;
  passcodeOk?: boolean;
}

function isSameDay(a: number, b: number): boolean {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function approvedAt(task: Task): number {
  const marks = task.trace.filter(
    (t) => t.action === ACT.approve || t.action === ACT.release || t.action === ACT.passcodeOk,
  );
  return marks.length ? marks[marks.length - 1].ts : task.at;
}

/** 当日已被确认（approved / done）的金额合计。 */
export function todayApprovedSum(tasks: Task[], now: number): number {
  return tasks.reduce((sum, task) => {
    if (task.state !== "approved" && task.state !== "done") return sum;
    if (!isSameDay(approvedAt(task), now)) return sum;
    return sum + task.amount;
  }, 0);
}

/**
 * 规则引擎 —— 全项目唯一判定处。
 * 优先级：R1/R2（硬拦截） > R6 > R3/R4/R5（冷静期） > R7（放行）。
 */
export function evaluate(ctx: RuleContext): RuleResult {
  const { amount, payee, limits, todaySum, now } = ctx;

  if (amount > limits.perTx) {
    return {
      verdict: "blocked",
      code: "R1",
      message: `超过单笔限额 ${limits.perTx} 元，已拦截，请电话确认`,
    };
  }

  if (todaySum + amount > limits.perDay) {
    return {
      verdict: "blocked",
      code: "R2",
      message: `超过当日累计限额 ${limits.perDay} 元，已拦截`,
    };
  }

  if (ctx.passcodeChecked && !ctx.passcodeOk) {
    return { verdict: "blocked", code: "R6", message: "暗号核对失败，已拦截" };
  }

  if (amount >= limits.perTx * 0.6 && amount < limits.perTx) {
    return {
      verdict: "cooling",
      code: "R3",
      message: "金额接近限额，进入 30 分钟冷静期",
    };
  }

  const hour = new Date(now).getHours();
  if ((hour >= limits.nightStart || hour < limits.nightEnd) && amount > 0) {
    return { verdict: "cooling", code: "R4", message: "夜间时段大额操作，进入冷静期" };
  }

  if (amount > 0 && !limits.trustedList.includes(payee)) {
    return { verdict: "cooling", code: "R5", message: "首次向该对象转账，需二次确认" };
  }

  return { verdict: "pass", code: "R7", message: "" };
}
