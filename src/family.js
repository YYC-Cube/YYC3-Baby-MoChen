// 一个家庭的角色名单。这是固定的角色表，不是账号表 —— 鉴权由外部 auth 组件负责
// （src/auth.js），账号和角色的对应关系存在 state.roles 里。
// 名字可以被改（state.names 覆盖显示名），角色本身不变。
export const members = [
  { id: "mom", name: "妈妈", nameEn: "Mum", role: "主要照护", roleEn: "Primary carer", initials: "妈", tone: "lilac", joined: "2025-11-02", face: "/assets/avatar-mom.png" },
  { id: "dad", name: "爸爸", nameEn: "Dad", role: "主要照顾", roleEn: "Main caregiver", initials: "爸", tone: "slate", joined: "2025-11-02", face: "/assets/avatar-dad.png" },
  { id: "grandma", name: "外婆", nameEn: "Grandma", role: "白天帮手", roleEn: "Daytime help", initials: "婆", tone: "clay", joined: "2025-12-18", face: "/assets/avatar-grandma.png" },
  { id: "sitter", name: "育儿嫂", nameEn: "Nanny", role: "工作日 9-18 点", roleEn: "Weekdays 9-18", initials: "嫂", tone: "sage", joined: "2026-01-06", face: "/assets/avatar-sitter.png" },
];

// 成员的出厂名字和身份说明在当前语言下的说法。用户改过的名字（state.names）
// 是用户自己输入的，不分语言，由 usePerson 直接覆盖在这之上。
export function memberName(member, lang) {
  if (!member) return "";
  return lang === "en" && member.nameEn ? member.nameEn : member.name;
}

export function memberRole(member, lang) {
  if (!member) return "";
  return lang === "en" && member.roleEn ? member.roleEn : member.role;
}

export const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

// 自定义身份：内置名单（妈妈/爸爸…）之外，用户自己定义的角色，
// 存在 state.extraMembers 里、跟着家庭状态同步。onboarding 的「其他身份」
// 和之后「添加身份」都落成这里的一条。
export function allMembers(extra) {
  return [...members, ...(Array.isArray(extra) ? extra : [])];
}

// 成员名单按模式分：演示/未登录时给完整的四口之家（示例数据里有外婆和
// 育儿嫂的记录，名单不全署名就成了无名氏）；真实使用时只有妈妈/爸爸打底，
// 其余身份由用户自己定义（extraMembers）。
// 注意这只是「名单」的口径：memberById 始终能查到全部内置成员，
// 历史记录的署名显示不受名单过滤影响。
export function rosterMembers(extra, signedIn) {
  const base = signedIn ? members.filter((m) => m.id === "mom" || m.id === "dad") : members;
  return [...base, ...(Array.isArray(extra) ? extra : [])];
}

// 按 id 找成员：先内置名单，再自定义名单。找不到给 null，调用方负责跳过。
export function findMember(id, extra) {
  if (memberById[id]) return memberById[id];
  if (!Array.isArray(extra)) return null;
  return extra.find((m) => m && m.id === id) || null;
}

// 宝宝资料的出厂值。运行时这份资料存在应用状态里、可以在今日页改，
// 这里只作为初始值和重置时的回退。种子数据仍按出生日期算月龄，所以它要稳定。
// 个人专用版的出厂宝宝资料：主人预先提供的真实信息。
// 首次登录的引导页会用这份值预填，之后随时可以在今日页头卡改。
export const defaultBaby = {
  name: "郭沫辰",
  nameEn: "郭沫辰",
  // 头像留空：头像占位会回落到名字首字，不用别人的示例照片。
  portrait: "",
  birth: "2026-10-02T01:02:00",
  gender: "男孩",
  birthWeight: 4.08,
  birthHeight: 51,
  birthHead: "",
  bloodType: "未记录",
  note: "",
};

// 当前语言下的宝宝名字。规则同成员名：出厂示例名可以随语言换，
// 用户改过的名字一律原样。
export function babyName(baby, lang) {
  if (!baby) return "";
  return lang === "en" && baby.name === defaultBaby.name ? defaultBaby.nameEn : baby.name;
}

// 种子数据和相册占位在模块初始化时就要用到出生日期，保留一个常量入口。
export const baby = defaultBaby;

// 出生日期可以被改到任何一天，包括改到今天、甚至改到某条记录之后。
// 这些情况下老老实实算出来的月龄会是负数，直接渲染就成了「-3 个月 29 天」。
// 记录本身不该因此丢失，所以这里只负责把「算不出正常月龄」这件事表达清楚：
//   valid=false  —— 日期本身无效（空、乱码、NaN）
//   before=true  —— 这个时间点早于出生，属于「出生前」
// 具体显示成什么由 ageLabel 决定，各处不再自己拼字符串。
function parseDate(value) {
  // null 要显式挡掉：new Date(null) 不是 Invalid Date，而是 1970-01-01，
  // 会让「没填出生日期」悄悄变成 680 个月大。
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function monthAge(birthISO, now = new Date()) {
  const birth = parseDate(birthISO);
  const at = parseDate(now);
  if (!birth || !at) return { months: 0, days: 0, valid: false, before: false };
  if (at < birth) {
    // 早于出生：把差值按正数算出来，方便需要的地方显示「出生前 12 天」。
    const days = Math.floor((birth - at) / 86400000);
    return { months: 0, days, valid: true, before: true };
  }
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth());
  let anchor = new Date(birth);
  anchor.setMonth(birth.getMonth() + months);
  if (anchor > at) {
    months -= 1;
    anchor = new Date(birth);
    anchor.setMonth(birth.getMonth() + months);
  }
  const days = Math.floor((at - anchor) / 86400000);
  return { months: Math.max(0, months), days: Math.max(0, days), valid: true, before: false };
}

export function dayAge(birthISO, now = new Date()) {
  const birth = parseDate(birthISO);
  const at = parseDate(now);
  if (!birth || !at) return 0;
  // 「出生第几天」按日历天数、出生当天就是第 1 天：
  // 不是毫秒差向下取整 —— 那个算法出生当天会显示「第 0 天」。
  const start = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const end = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

// 月龄的统一写法。出生前、出生当天、日期无效这三种情况在五处都要显示，
// 各写各的必然写出五种说法，所以收在这里。
export function ageLabel(birthISO, at, t) {
  const age = monthAge(birthISO, at);
  if (!age.valid) return "—";
  if (age.before) return t.birthPre;
  if (age.months === 0 && age.days === 0) return t.birthDay;
  return `${age.months} ${t.months} ${age.days} ${t.days}`;
}

// 星座：按出生日期（公历）自动推算。资料面板和头卡共用这一份，
// 各自写各自的迟早对不上号。边界用「月日合成数字」判断，比一串
// Date 比较便宜，也不用处理跨年 —— 摩羯座的尾巴放在表尾自然接住 1 月。
const ZODIAC_SIGNS = [
  { until: 218, zh: "水瓶座", en: "Aquarius" },
  { until: 320, zh: "双鱼座", en: "Pisces" },
  { until: 419, zh: "白羊座", en: "Aries" },
  { until: 520, zh: "金牛座", en: "Taurus" },
  { until: 621, zh: "双子座", en: "Gemini" },
  { until: 722, zh: "巨蟹座", en: "Cancer" },
  { until: 822, zh: "狮子座", en: "Leo" },
  { until: 922, zh: "处女座", en: "Virgo" },
  { until: 1023, zh: "天秤座", en: "Libra" },
  { until: 1122, zh: "天蝎座", en: "Scorpio" },
  { until: 1221, zh: "射手座", en: "Sagittarius" },
  { until: 1231, zh: "摩羯座", en: "Capricorn" },
];

export function zodiacOf(birthISO, lang) {
  const d = parseDate(birthISO);
  if (!d) return "";
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  const hit = ZODIAC_SIGNS.find((s) => md <= s.until);
  return hit ? (lang === "en" ? hit.en : hit.zh) : "";
}

// 生肖按农历新年切换，不能只看公历年。这里用 2016–2036 的春节日期表，
// 表内日期是准的；表外的日期退回按公历年粗算（误差最多一两个月，
// 反正出生日期填进表内是这个应用的正常使用范围）。
const CNY = {
  2016: "02-08", 2017: "01-28", 2018: "02-16", 2019: "02-05", 2020: "01-25",
  2021: "02-12", 2022: "02-01", 2023: "01-22", 2024: "02-10", 2025: "01-29",
  2026: "02-17", 2027: "02-06", 2028: "01-26", 2029: "02-13", 2030: "02-03",
  2031: "01-23", 2032: "02-11", 2033: "01-31", 2034: "02-19", 2035: "02-08",
  2036: "01-28",
};
const ANIMALS_ZH = ["猴", "鸡", "狗", "猪", "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊"];
const ANIMALS_EN = ["Monkey", "Rooster", "Dog", "Pig", "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat"];

export function animalOf(birthISO, lang) {
  const d = parseDate(birthISO);
  if (!d) return "";
  let year = d.getFullYear();
  const cny = CNY[year];
  if (cny) {
    const [m, day] = cny.split("-").map(Number);
    // 春节之前出生还属上一年的生肖。
    if (d < new Date(year, m - 1, day)) year -= 1;
  }
  const idx = (((year - 2016) % 12) + 12) % 12;
  return lang === "en" ? ANIMALS_EN[idx] : ANIMALS_ZH[idx];
}

// 出生日期是否晚于某些既有记录 —— 保存资料前用它给出提醒。
export function entriesBefore(birthISO, records, photos) {
  const birth = parseDate(birthISO);
  if (!birth) return { records: 0, photos: 0, total: 0 };
  const count = (rows) => rows.filter((row) => {
    const at = parseDate(row.at);
    return at && at < birth;
  }).length;
  const r = count(records || []);
  const p = count(photos || []);
  return { records: r, photos: p, total: r + p };
}
