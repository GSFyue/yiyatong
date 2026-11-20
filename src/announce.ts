import { getUrl } from "./router";
import { getTasks, subscribe } from "./sync";
import { ACT } from "./types";
import { speak } from "./voice";

const seen = new Set<string>();

const SPEECH: Record<string, string> = {
  [ACT.create]: "点好了。孩子那边收到了。",
  [ACT.approve]: "孩子已经帮你办好了。",
  [ACT.passcodeOk]: "孩子已经帮你办好了。",
  [ACT.block]: "这笔被拦下了，请打个电话给孩子确认。",
  [ACT.passcodeFail]: "暗号不对，这笔被拦下了，请打个电话给孩子确认。",
  [ACT.cooling]: "要等一等才能确认。",
  [ACT.release]: "孩子还是帮你办了。",
  [ACT.withdraw]: "孩子取消了这件事。",
  [ACT.reject]: "孩子没有接这件事。",
  [ACT.done]: "事情办完了。",
  [ACT.verifyPending]: "还差几步核验没做完，先核对完再确认。",
};

const ROUTE_LABEL: Record<string, string> = {
  parent: "父母端",
  child: "子女端",
  board: "家庭看板",
  arch: "架构与边界",
};

function traceKey(taskId: string, ts: number, action: string): string {
  return `${taskId}:${ts}:${action}`;
}

/** 两端窗口的标题同步：有待办/冷静期时前缀 ●，否则 ○。 */
export function updateTitle(): void {
  const { route } = getUrl();
  const tasks = getTasks();
  const busy = tasks.some((t) => t.state === "pending" || t.state === "cooling");
  const label = ROUTE_LABEL[route] ?? "一按就通";
  document.title = `${busy ? "● " : "○ "}一按就通 · ${label}`;
}

/**
 * 播报与标题联动的唯一入口（模块级单例）。
 * 通过留痕差分判断「发生了什么」，避免两个标签页重复播报或漏播。
 */
export function startAnnouncer(): void {
  getTasks().forEach((task) => task.trace.forEach((t) => seen.add(traceKey(task.id, t.ts, t.action))));

  subscribe(() => {
    const tasks = getTasks();
    const fresh: string[] = [];
    tasks.forEach((task) => {
      task.trace.forEach((item) => {
        const key = traceKey(task.id, item.ts, item.action);
        if (seen.has(key)) return;
        seen.add(key);
        fresh.push(item.action);
      });
    });
    if (getUrl().role === "parent") {
      fresh.forEach((action) => {
        const text = SPEECH[action];
        if (text) speak(text);
      });
    }
    updateTitle();
  });
}
