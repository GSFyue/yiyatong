export interface Source {
  org: string;
  report: string;
  url?: string;
}

export interface FunnelRow {
  name: string;
  value: number;
  source: Source;
}

export interface StatCard {
  value: string;
  label: string;
  note: string;
  source: Source;
}

const SURVEY: Source = {
  org: "中国老龄协会",
  report: "《第五次中国城乡老年人生活状况抽样调查基本数据公报》",
  url: "http://www.crca.cn/index.php/19-life.html",
};

const FRAUD: Source = {
  org: "国家市场监督管理总局（全国打击整治养老诈骗专项行动办公室通报）",
  report: "《且看不法分子坑人的「三十六计」》",
  url: "https://www.samr.gov.cn/zt/ndzt/2022n/djzzylzpscjgzxd/xwbd/art/2023/art_dcf2be07a3b043a9b19228efabbe6621.html",
};

const COURT: Source = {
  org: "信用中国（转引公安部、最高人民法院战果通报）",
  report: "《信用信息详情 · 信用中国官网》",
  url: "https://www.creditchina.gov.cn/toutiaxinwen/202301/t20230130_309689.html",
};

const AGING: Source = {
  org: "民政部、全国老龄办（中国老龄协会转载解读）",
  report: "《2025年度国家老龄事业发展公报》",
  url: "http://www.crca.cn/index.php/13-agednews/1324-2025-9.html",
};

const MEDICAL: Source = {
  org: "中国老龄协会",
  report: "《老年人就医时空大数据分析报告》",
  url: "https://www.sohu.com/a/1016665806_121123704",
};

/** 漏斗：老人不是不想用手机，是过不了这几道门。 */
export const FUNNEL: FunnelRow[] = [
  { name: "会用手机网络聊天", value: 74.7, source: SURVEY },
  { name: "会使用手机支付", value: 18.1, source: SURVEY },
  { name: "会预约挂号就诊", value: 9.6, source: SURVEY },
  { name: "会使用网约车软件", value: 7.1, source: SURVEY },
];

export const STATS: StatCard[] = [
  {
    value: "40.4%",
    label: "不会使用智能手机",
    note: "四成老人连智能手机都用不了，谈不上「点一下代办」。",
    source: SURVEY,
  },
  {
    value: "23.0%",
    label: "没有智能手机",
    note: "他们要办的事，只能靠身边的人。",
    source: SURVEY,
  },
  {
    value: "14.2%",
    label: "老人独居比例",
    note: "农村是 16.3%，独居老人的代办需求更迫切。",
    source: SURVEY,
  },
  {
    value: "41090 起",
    label: "养老诈骗专项行动立案",
    note: "破案 39294 起，抓获 6.6 万余人，追赃 308 亿余元。",
    source: FRAUD,
  },
  {
    value: "0.6%",
    label: "长期护理保险实际享受待遇比例",
    note: "参保 30854.76 万人，实际享受待遇 192.91 万人。",
    source: AGING,
  },
  {
    value: "679.9 万人次",
    label: "老年人跨省异地就医",
    note: "占全部老年人就医的 5.9%，跨城看病已经常态化。",
    source: MEDICAL,
  },
];

export const COURT_SOURCE = COURT;

export const SOURCES: Source[] = [SURVEY, FRAUD, COURT, AGING, MEDICAL];
