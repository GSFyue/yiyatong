import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearAll } from "../sync";
import { SOURCES } from "../stats";

const DONE: string[] = [
  "页面：父母端 / 子女端 / 家庭看板 / 架构与边界 / Qoder 记录（hash 路由，刷新不丢状态）",
  "完整状态机：发起 → 待确认 → 已确认 / 已拒绝 / 已拦截 / 冷静期 → 已留痕，非法流转被拒绝，并在界面上给出提示",
  "规则引擎 R1~R7 集中在 src/rules.ts，界面里没有零散判断；子女确认时重新跑一遍，限额改完立刻生效",
  "同源跨标签页实时同步：BroadcastChannel + storage 事件 + 1 秒轮询兜底，两端 1 秒内可见",
  "中文语音播报（speechSynthesis，zh-CN / rate 0.9）与语音输入（SpeechRecognition，失败降级为大按钮）",
  "语音按当前聚焦的那一行写入，每行还有一个独立麦克风按钮，说错了也不会填错行",
  "留痕时间线：每次流转都追加一条记录，父母端与子女端都能看到",
  "转账前核验三步：① 用存好的号码回拨 ② 向对方复述金额 ③ 由另一个家人确认（暗号核对通过后会自动打勾，不单列一步），每一步都逐项留痕",
  "冷静期未走完时，三步核验全部完成就可以提前放行；放行这件事一定写进留痕，同一个动作只有一种说法",
  "冷静期倒计时：风险条里的剩余时间按真实时钟每秒刷新，撤回与提前放行都在这条上",
  "留痕如实记录：冷静期内提前放行写的是「冷静期内提前放行」，不写成「确认代办」",
  "留痕里能追到规则编号：放行记「规则校验通过（R7）」，拦截与冷静期记的是那条规则的原文（R1~R6）",
  "可信收款方名单：名单里的人，首次转账也不再进冷静期",
  "跨设备降级：6 位数字口令 + 编码链接 + 回执链接",
  "家庭看板：真实统计数据漏斗图 + 家庭记录（由真实任务算出）",
  "并排演示：父母端在左、子女端在右，同一台设备两栏看联动",
  "隐私：数据只存在浏览器本地，一键清除真的能清空",
];

const NOT_DONE: string[] = [
  "不做人脸 / 声音鉴定，不做换脸检测 —— 理由见下面「为什么不做换脸识别」一节",
  "不连接医院、支付、挂号等真实系统，全程是模拟数据，界面上标注「模拟数据」",
  "不跨设备实时同步 —— 免费版站点只能本地存储，跨设备靠 6 位口令 / 回执链接",
  "不做生物识别与活体检测 —— 暗号只能防「预先准备好的冒充」，防不住实时伪造",
  "不用大模型做放行判断 —— 金额、时段、名单这类判断都是 src/rules.ts 里的确定性规则，可解释、可复现，现场能逐条推演",
  "不做注册登录与账号体系 —— 这一版没有身份，只有「父母端 / 子女端」两种角色",
  "没有引入任何需要 API Key 的第三方服务 —— 语音用浏览器原生能力",
  "不做医疗诊断建议 —— 界面不出现任何诊断结论",
];

export function Arch() {
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearAll();
    setConfirming(false);
    setCleared(true);
  };

  return (
    <div>
      <h1 className="yyt-section-title" style={{ fontSize: 24 }}>
        我们做到了什么，没做到什么
      </h1>
      <p className="yyt-hint">这一页把边界写清楚，是为了让人知道它能做什么、不能做什么。</p>

      <section className="yyt-panel" style={{ marginTop: 20 }}>
        <h2 className="yyt-section-title">同步方案对照</h2>
        <table className="yyt-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>方案</th>
              <th>状态</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>A. 同源双标签页实时同步</b>
                <br />
                BroadcastChannel + storage 事件
              </td>
              <td>
                <span className="yyt-badge yyt-badge-approved">已实现</span>
              </td>
              <td>同一台电脑、同一个浏览器、同一个网址下开两个标签页，一秒内互相可见。要求同源，这是设计取舍。</td>
            </tr>
            <tr>
              <td>
                <b>B. Supabase / Cloudflare Workers KV 真跨端</b>
              </td>
              <td>
                <span className="yyt-badge yyt-badge-blocked">未实现</span>
              </td>
              <td>
                本期时间预算只够做静态版；而且需要注册第三方账号、申请密钥，评审现场演示时反而更容易卡住。
                这一版刻意没有假装做到。
              </td>
            </tr>
            <tr>
              <td>
                <b>C. 任务口令 + 编码链接</b>
              </td>
              <td>
                <span className="yyt-badge yyt-badge-cooling">已实现（降级）</span>
              </td>
              <td>
                父母端给一条 6 位数字口令加一条带编码的链接，另一台设备打开就能看到同一件事；子女端处理完再发一条回执链接，父母点一下就生效。
              </td>
            </tr>
          </tbody>
        </table>
        <p className="yyt-hint" style={{ marginTop: 12 }}>
          同设备实时同步，跨设备走口令与链接。我们没有假装跨设备也能实时。
        </p>
      </section>

      <section className="yyt-panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <div>
            <h2 className="yyt-section-title">已实现</h2>
            <ul className="yyt-list">
              {DONE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="yyt-section-title">未实现（含原因）</h2>
            <ul className="yyt-list">
              {NOT_DONE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">关于反诈，我们做的是拦截，不是鉴定</h2>
        <p>
          我们不声称能识别 AI 换脸 —— 那做不到。我们做的是在转账前多一道核验、多一道限额、多一条留痕。
          规则由家人自己定，命中就拦下，并且留下可以回看的记录。
        </p>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">为什么不做换脸识别</h2>
        <ul className="yyt-list" style={{ marginTop: 10 }}>
          <li>做不到可靠：换脸是生成技术，检测是另一场军备竞赛，误判一次就是把真事判成假事。</li>
          <li>误判成本不对称：把真事判成假事，老人会失去对工具的信任；把假事判成真事，钱已经没了。</li>
          <li>
            真正的护栏不是识别，是流程：限额、冷静期、回拨到存好的号码、只有家里人知道的暗号、多一个人确认。
          </li>
        </ul>
        <p style={{ marginTop: 12, fontWeight: 600 }}>所以我们做的是拦截，不是鉴定。</p>
        <p className="yyt-hint" style={{ marginTop: 12 }}>
          依据一：《人民法院报》（2026-04-01，人民网社会·法治频道转载）《警惕涉老诈骗》：
          「一方面可以帮助长辈设置每日或每笔支付限额和风险提示，一旦出现大额转账、异常交易，能够及时收到提醒、暂停交易，从技术层面防范财产损失。」
          同一篇还提到：「在日常沟通中，坚决摒弃“你又被骗了！”“这都是假的，别买了！”等否定性和指责性表述，这类话语会激起老人的羞耻感和逆反心理，关闭沟通的大门。」
          同篇数据：全国共立案侦办养老诈骗刑事案件 41090 起、破案 39294 起，打掉犯罪团伙 4735 个，抓获犯罪嫌疑人 6.6 万余人，追赃挽损 308 亿余元。
          {" "}
          <a
            className="yyt-link"
            href="http://society.people.com.cn/n1/2026/0401/c1008-40692985.html"
            target="_blank"
            rel="noreferrer"
          >
            查看原文
          </a>
        </p>
        <p className="yyt-hint" style={{ marginTop: 6 }}>
          依据二：最高人民检察院网站刊发的《人民检察》专题文章指出：
          「随着技术普及，许多手机应用或在线工具都能一键生成换脸内容，技术使用门槛大幅降低。」
          同一篇还提到：「或者通过换脸技术伪造身份实施电信诈骗，威胁个人财产安全。」
          {" "}
          <a
            className="yyt-link"
            href="https://www.spp.gov.cn/spp/llyj/202506/t20250620_698776.shtml"
            target="_blank"
            rel="noreferrer"
          >
            查看原文
          </a>
        </p>
      </section>

      <section className="yyt-panel">
        <h2 className="yyt-section-title">隐私说明</h2>
        <ul className="yyt-list">
          <li>
            <b>数据存在哪里：</b>只存在这台设备的浏览器 localStorage 里（键名以 <code>yyt:</code> 开头）。
          </li>
          <li>
            <b>是否上传：</b>否。没有服务器、没有数据库、没有任何统计上报。
          </li>
          <li>
            <b>拍摄 / 录音：</b>这一版不使用摄像头。语音输入由浏览器原生能力完成，识别内容不会离开这台设备。
          </li>
          <li>
            <b>我们不采集：</b>姓名、身份证、手机号、位置、通讯录，一样都不采集。
          </li>
        </ul>
        <div className="yyt-row" style={{ marginTop: 14 }}>
          <Button variant="destructive" onClick={clear} aria-label="清除本机数据">
            {confirming ? "再点一次，真的会清空" : "清除本机数据"}
          </Button>
          {confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(false)} aria-label="取消清除">
              算了
            </Button>
          ) : null}
          {cleared ? <span className="yyt-hint">已经清空了。刷新页面也不会回来。</span> : null}
        </div>
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

      <p style={{ marginTop: 16 }}>
        这一版能让人看见流程，但还不能替代真实的支付与挂号系统。我们把它定位成原型，而不是产品。
      </p>
    </div>
  );
}
