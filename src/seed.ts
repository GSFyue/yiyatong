import { deadlineForSpec, KIND_SPECS, type Task } from "./types";

/** 种子数据版本：字段结构变化时 +1，老数据会被补齐而不是被丢弃。 */
export const SEED_VERSION = 2;

const SEED_META: {
  id: string;
  kind: Task["kind"];
  title: string;
  to: string;
  amount: number;
  channel: string;
  state: Task["state"];
}[] = [
  {
    id: "seed-pending",
    kind: "挂号",
    title: "明天上午去省医院复查",
    to: "省医院",
    amount: 0,
    channel: "医院公众号",
    state: "pending",
  },
  {
    id: "seed-blocked",
    kind: "买东西",
    title: "买点菜和水果",
    to: "超市",
    amount: 800,
    channel: "微信支付",
    state: "blocked",
  },
  {
    id: "seed-done",
    kind: "缴费",
    title: "交上个月的住院费",
    to: "省医院",
    amount: 200,
    channel: "微信支付",
    state: "done",
  },
];

function specOf(kind: Task["kind"]) {
  return KIND_SPECS.find((k) => k.kind === kind) ?? KIND_SPECS[0];
}

/** 演示用种子数据：一条待确认、一条被单笔限额拦截、一条已完成。 */
export function seedTasks(now: number = Date.now()): Task[] {
  const hour = 60 * 60 * 1000;

  return SEED_META.map((meta, index) => {
    const spec = specOf(meta.kind);
    const at = now - (index === 0 ? 2 : index === 1 ? 1 : 26) * hour;
    const task: Task = {
      id: meta.id,
      kind: meta.kind,
      title: meta.title,
      from: "妈妈",
      to: meta.to,
      amount: meta.amount,
      channel: meta.channel,
      at,
      state: meta.state,
      consequence: spec.consequence,
      lateText: spec.lateText,
      deadlineTs: deadlineForSpec(spec, now),
      trace: [{ ts: at, by: "父母端", action: "发起" }],
    };

    if (meta.state === "blocked") {
      task.reason = "超过单笔限额 500 元，已拦截，请电话确认";
      task.trace.push({
        ts: at + 1000,
        by: "系统",
        action: "拦截",
        note: "超过单笔限额 500 元，已拦截，请电话确认",
      });
    }
    if (meta.state === "done") {
      task.trace.push({ ts: at + 60000, by: "子女端", action: "确认代办", note: "规则校验通过（R7）" });
      task.trace.push({ ts: at + 120000, by: "父母端", action: "完成" });
    }
    return task;
  });
}

/**
 * 给老种子补上「不办会怎样」和「时限」。
 * 只补缺失字段，不动任务状态、金额与留痕，老数据不会因为新字段报错。
 */
export function upgradeSeedTasks(tasks: Task[], now: number = Date.now()): Task[] {
  let changed = false;
  const next = tasks.map((task) => {
    const meta = SEED_META.find((m) => m.id === task.id);
    if (!meta) return task;
    if (task.consequence && task.deadlineTs) return task;
    const spec = specOf(meta.kind);
    changed = true;
    return {
      ...task,
      consequence: task.consequence ?? spec.consequence,
      lateText: task.lateText ?? spec.lateText,
      deadlineTs: task.deadlineTs ?? deadlineForSpec(spec, now),
    };
  });
  return changed ? next : tasks;
}
