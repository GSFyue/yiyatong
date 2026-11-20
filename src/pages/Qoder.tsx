import "../styles/qoder.css";

interface Iteration {
  version: string;
  solved: string;
  why?: string;
  verified: string;
}

/** 每一份「改动说明」留下的记录，按版本顺序排列。 */
const ITERATIONS: Iteration[] = [
  {
    version: "v1.0",
    solved: "四页骨架：父母端、子女端、家庭看板、架构与边界；任务状态机；R1~R7 七条规则集中在一个文件里",
    verified: "手工跑通「父母发起 → 子女 1 秒内收到 → 确认代办 → 留痕」",
  },
  {
    version: "v1.1",
    solved: "补上「不办会怎样」和「时限」（错过复查要重新排到 12 月中）；加并排演示；父母端首屏给出「为什么做」",
    verified: "逐条比对 19 条验收清单",
  },
  {
    version: "v1.2",
    solved: "统一浅色皮肤，修掉并排演示左右留黑、标题被裁",
    verified: "1701×933 与 375px 两档截图各看一遍",
  },
  {
    version: "v1.3",
    solved: "父母端也换浅色；把「时限紧急度」抽成一个两端共用的函数",
    verified: "同一任务在两端显示的颜色、文案一致",
  },
  {
    version: "v1.4",
    solved: "语音识别填错栏位 —— 说到「给谁」却填进「要做什么」",
    verified: "点三行分别试，目标行高亮、填入位置正确",
  },
  {
    version: "v2.0",
    solved: "加「转账前核验」三步：用存好的号码回拨 / 金额复述 / 另一个家人确认",
    verified: "端到端跑：发起转账 → 子女端收到 0/3 → 逐项标记 → 才能放行",
  },
  {
    version: "v2.1",
    solved: "留痕说实话（冷静期内提前放行必须写明）；引用换成核实过的原文；核验面板上移进首屏",
    verified: "冷放行后展开留痕逐字核对；首屏不再有需要滚动才能看到的按钮",
  },
  {
    version: "v2.2",
    solved: "新增「Qoder 记录」页，把这次迭代过程摊开给评委看",
    why: "赛题明确要看「Qoder 使用深度」，把过程做成产品里的一页，比在帖子里写一百句更可信",
    verified:
      "新增 /qoder 路由 + 导航第 5 项；导航项在各页可点；该页与全站同一套浅色皮肤；375px 不横向滚动",
  },
  {
    version: "v2.3",
    solved: "把评委第一屏要看到的东西挪到第一屏",
    why: "现场演示只有 90 秒，核验面板在折叠线以下等于没做",
    verified:
      "1701×933 下核验面板三要素在首屏内；子女端补了数据钩子；父母端新增「说清楚点」文字链",
  },
  {
    version: "v2.4",
    solved:
      "导览第 4 步在待办为空时框错位置 —— 我们把任务全处理完再进导览，像评委那样用了一遍才发现",
    why: "导览是我们给评委演示的路径，框错一步，演示就断在那里",
    verified:
      "把待办清空后进导览，逐帧比对聚光灯与目标的位置，18 项全部 0px 偏差；改之前能稳定复现框停在上一页",
  },
  {
    version: "v2.6",
    solved:
      "深夜发起「买菜」，时限不再显示「已经晚了」，改成顺延到第二天 20:00，并在父母端和子女端同时显示实时倒计时「还剩 2 小时 14 分」",
    why:
      "「买菜要在 20:00 前」说的是每天的钟点，过了点应该顺延到明天，不该变成一条过期任务",
    verified:
      "把浏览器时间假到 23:35 发起一条买菜任务，验时限顺延到次日 20:00、父母端与子女端倒计时逐字相同；再等 65 秒，倒计时自动从「还剩 2 小时」变成「还剩 1 小时 59 分」",
  },
  {
    version: "v2.7",
    solved:
      "事情处理完以后，卡片上的倒计时不再继续走 —— 已确认 / 已完成 / 已拒绝 / 已拦截这四种状态只剩中性的「时限：明天 11:00 前」，倒计时与紧迫提示只在待确认和冷静期里出现",
    why: "倒计时的作用是提醒还没做的事。事情已经有了结果还继续倒计时，等于在一屏办完的事情上催人",
    verified:
      "造出已确认 / 已拒绝 / 已拦截 / 已完成四种状态各一条，确认这四种的时限行都没有倒计时、没有「快到点了」、颜色是灰的；待确认与冷静期两条的倒计时照旧，两端显示逐字相同；等待 30 秒以上倒计时数字会自动走",
  },
  {
    version: "v2.8",
    solved:
      "父母端表单里的「返回」不再是一行下划线小字，而是和上面那个按钮并排、同高 64 像素、26 号字、带描边的大按钮 —— 老人看得见、敢按、不会按错",
    why: "老人点错一张大字卡、或者填一半不想填了，需要退回去。三个东西里最难认的那个是它，看起来像说明文字不像按钮，老人就不敢按，卡在表单里出不来。而\"能自己把话说明白\"正是这个产品要解决的事",
    verified:
      "量测父母端表单底部三个按钮的盒模型：返回与语音按钮顶部坐标差不超过 2 像素、底边完全对齐、高度都是 64 像素、返回字号 26 像素、语音按钮字号 28 像素未变；375 像素窄屏下页面不横向滚动，两个按钮都在首屏内；点返回后 4 张大字卡重新出现",
  },
];

/** 表头单元格是 nowrap，说明文字太长会把整张表撑出容器；这几行允许折行 */
const WRAPPABLE = new Set(["v2.6", "v2.7", "v2.8"]);

/** 每一轮用 Qoder 官方 CLI 驱动 Agent 时留下的原始会话记录，指向 public/transcripts/ 下的静态文件 */
const TRANSCRIPTS: { file: string; version: string; desc: string; calls: string; note?: string }[] = [
  { file: "01-v2.2.html", version: "v2.2", desc: "新增「Qoder 记录」页", calls: "114 次工具调用" },
  { file: "02-v2.3.html", version: "v2.3", desc: "子女端首屏露出核验面板、数据钩子、文字链；迭代表补行", calls: "117 次工具调用" },
  { file: "03-v2.4.html", version: "v2.4", desc: "导览聚光灯错位修复（定位失败就清框）", calls: "50 次工具调用" },
  { file: "04-v2.5.html", version: "v2.5", desc: "迭代表补上 v2.4 行", calls: "35 次工具调用" },
  { file: "05-v2.6.html", version: "v2.6", desc: "迭代表补上 v2.6 行", calls: "48 次工具调用" },
  { file: "06-v2.7.html", version: "v2.7", desc: "倒计时只在还来得及做的时候走", calls: "73 次工具调用" },
  { file: "07-v2.8.html", version: "v2.8", desc: "「返回」按钮放大，与语音按钮并排同高", calls: "81 次工具调用" },
  { file: "08-publish.html", version: "发布上线", desc: "发布踩坑记录：CLI 拿不到 Sites 凭据，最后由桌面端会话完成部署", calls: "50 次工具调用", note: "这一份不是版本迭代，是我们自己走错路时留下的记录，也不藏。" },
];

const DEPLOY: { label: string; text: string; strong?: boolean }[] = [
  { label: "前端", text: "Qoder Sites 静态站点" },
  {
    label: "存储",
    text: "浏览器本地（localStorage）。没有数据库、没有后端，所以两台设备之间不是实时同步，靠 6 位口令链接过渡。",
  },
  { label: "语音", text: "浏览器原生 Web Speech API（语音播报 + 语音识别），不需要任何 API Key。" },
  { label: "规则判断", text: "没有用大模型。金额 / 时段 / 名单这类判断是确定性规则，可解释、可复现。" },
  { label: "Qoder 账号", text: "Breeze", strong: true },
];

export function Qoder() {
  return (
    <div className="yq">
      <h1 className="yyt-section-title yq-title">我们是怎么用 Qoder 做出来的</h1>
      <p className="yq-lead">
        这个产品的每一版代码和每一次部署，都由 Qoder 完成。
        <br />
        下面是完整记录。
      </p>

      <section className="yyt-panel yq-panel">
        <h2 className="yyt-section-title">迭代记录</h2>
        <div className="yq-table-wrap">
          <table className="yq-table">
            <thead>
              <tr>
                <th>版本</th>
                <th>这一版解决了什么</th>
                <th>怎么验的</th>
              </tr>
            </thead>
            <tbody>
              {ITERATIONS.map((item) => {
                const wrapStyle = WRAPPABLE.has(item.version)
                  ? { whiteSpace: "normal" }
                  : undefined;
                return (
                  <tr key={item.version}>
                    <td className="yq-version">{item.version}</td>
                    <td style={wrapStyle}>
                      {item.solved}
                      {item.why ? (
                        <div className="yq-why">
                          <b>为什么：</b>
                          {item.why}
                        </div>
                      ) : null}
                    </td>
                    <td style={wrapStyle}>{item.verified}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="yyt-panel yq-panel">
        <h2 className="yyt-section-title">每一轮的原始会话记录</h2>
        <p className="yq-flow">
          上面表格里每一版，我们都用 <b>Qoder 官方 CLI</b> 把一份《改动说明》交给 Qoder 的
          Agent 改。下面是那些会话的<b>原始记录</b>：Agent 每一次读文件、改代码、跑构建、用无头浏览器自测的输出都在里面，可以逐条回看。链接在新标签页打开。
        </p>
        <ul className="yq-transcripts">
          {TRANSCRIPTS.map((item) => (
            <li key={item.file}>
              <a href={"/transcripts/" + item.file} target="_blank" rel="noreferrer">
                <span className="yq-version">{item.version}</span>
                {" · "}
                <span className="yq-tr-desc">{item.desc}</span>
                {" · "}
                <span className="yq-tr-calls">{item.calls}</span>
              </a>
              {item.note ? <div className="yq-why">{item.note}</div> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="yyt-panel yq-panel">
        <h2 className="yyt-section-title">部署方式</h2>
        <dl className="yq-deploy">
          {DEPLOY.map((item) => (
            <div className="yq-deploy-row" key={item.label}>
              <dt>{item.label}：</dt>
              <dd className={item.strong ? "yq-strong" : undefined}>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="yyt-panel yq-panel">
        <h2 className="yyt-section-title">这次是怎么做的</h2>
        <p className="yq-flow">
          我们把每一版的改动写成一份「改动说明」，交给 Qoder 执行：Qoder 读说明 → 改代码 →
          我们直连发布站跑一遍验收（15 项自动检查）→ 不合格就再写一份说明 → 通过后由 Qoder 发布到 Qoder Sites。
        </p>
        <p className="yyt-hint">本页的迭代记录表，就是每一份改动说明留下的记录。</p>
      </section>
    </div>
  );
}
