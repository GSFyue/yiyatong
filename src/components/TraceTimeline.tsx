import type { TraceItem } from "../types";

export interface TraceEntry extends TraceItem {
  taskTitle?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TraceTimeline({ items, showTask }: { items: TraceEntry[]; showTask?: boolean }) {
  const sorted = [...items].sort((a, b) => b.ts - a.ts);
  if (sorted.length === 0) {
    return <p className="yyt-hint">还没有记录。</p>;
  }
  return (
    <ol className="yyt-trace">
      {sorted.map((item, index) => (
        <li key={`${item.ts}-${index}`}>
          <time dateTime={new Date(item.ts).toISOString()}>{formatTime(item.ts)}</time>
          <div>
            <b>{item.by}</b> · {item.action}
            {showTask && item.taskTitle ? <span className="yyt-hint">（{item.taskTitle}）</span> : null}
            {item.note ? <p>{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
