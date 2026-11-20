import { useMemo } from "react";
import { useTasks } from "../hooks/useStore";
import { FUNNEL, SOURCES, STATS } from "../stats";

export function Board() {
  const tasks = useTasks();

  const record = useMemo(() => {
    const started = tasks.length;
    const confirmed = tasks.filter((t) => t.state === "approved" || t.state === "done").length;
    const blocked = tasks.filter((t) => t.state === "blocked").length;
    const cooling = tasks.filter((t) => t.state === "cooling").length;
    const amount = tasks.reduce((sum, t) => sum + t.amount, 0);
    return { started, confirmed, blocked, cooling, amount };
  }, [tasks]);

  return (
    <div>
      <h1 className="yyt-section-title" style={{ fontSize: 24 }}>
        老人不是不想用手机，是过不了这几道门
      </h1>
      <p className="yyt-hint">下面这些是公开的权威统计，不是我们自己编的数。</p>

      <section className="yyt-panel" style={{ marginTop: 20 }} data-guide="funnel">
        <h2 className="yyt-section-title">同龄人能做到哪一步</h2>
        <div className="yyt-funnel" style={{ marginTop: 16 }}>
          {FUNNEL.map((row) => (
            <div className="yyt-funnel-row" key={row.name}>
              <div className="yyt-funnel-head">
                <span className="yyt-funnel-name">{row.name}</span>
                <span className="yyt-funnel-value">{row.value}%</span>
              </div>
              <div className="yyt-funnel-track">
                <div className="yyt-funnel-fill" style={{ width: `${row.value}%` }} />
              </div>
              <span className="yyt-funnel-source">来源：{row.source.org}，{row.source.report}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">还有几个数字</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 14 }}>
          {STATS.map((stat) => (
            <div key={stat.label} className="yyt-tri-item">
              <span className="yyt-tri-label">{stat.label}</span>
              <span className="yyt-tri-value yyt-tri-money">{stat.value}</span>
              <span className="yyt-hint">{stat.note}</span>
              <span className="yyt-funnel-source">来源：{stat.source.org}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">家庭记录</h2>
        <p className="yyt-hint">这一页的数字来自这台设备上真实发生过的操作，不是写死的。</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 14 }}>
          {[
            { label: "发起", value: record.started },
            { label: "已确认", value: record.confirmed },
            { label: "已拦截", value: record.blocked },
            { label: "冷静期", value: record.cooling },
          ].map((item) => (
            <div key={item.label} className="yyt-tri-item">
              <span className="yyt-tri-label">{item.label}</span>
              <span className="yyt-tri-value">{item.value}</span>
            </div>
          ))}
          <div className="yyt-tri-item">
            <span className="yyt-tri-label">涉及金额</span>
            <span className="yyt-tri-value">¥{record.amount}</span>
          </div>
        </div>
        <p className="yyt-hint" style={{ marginTop: 12 }}>
          <span className="yyt-chip">模拟数据</span> 金额与任务均为演示用途，没有接入任何真实支付。
        </p>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">数据来源</h2>
        <ul className="yyt-list" style={{ marginTop: 10 }}>
          {SOURCES.map((source) => (
            <li key={source.report}>
              {source.org} · {source.report}
              {source.url ? (
                <>
                  {" — "}
                  <a className="yyt-link" href={source.url} target="_blank" rel="noreferrer">
                    查看原文
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <p style={{ marginTop: 16 }}>这 74.7% 和 9.6% 之间的差，就是这个产品存在的理由。</p>
    </div>
  );
}
