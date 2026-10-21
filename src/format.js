// 时间格式化。这里所有入口都可能收到坏值：localStorage 里的老数据、
// 手输的日期、EXIF 里读出来的怪字符串。坏值不能让页面崩——
// Date 无效时 toISOString() 会直接抛 RangeError，一抛整棵组件树就白屏了。
// 所以统一先过 safeDate，拿不到有效日期就退回一个中性显示。
function safeDate(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// 完整时间戳，用于「写入时间」「拍摄时间」这类落款。
// 无效日期返回破折号，而不是让 toLocaleString 打出 "Invalid Date"。
export function stampLabel(value, lang = "zh") {
  const d = safeDate(value);
  if (!d) return "—";
  return d.toLocaleString(lang === "en" ? "en-US" : "zh-CN", { hour12: false });
}

export function isValidDate(value) {
  return safeDate(value) !== null;
}

export function clock(iso) {
  const d = safeDate(iso);
  if (!d) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayKey(iso) {
  const d = safeDate(iso);
  if (!d) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKey(iso) {
  const d = safeDate(iso);
  if (!d) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key, lang = "zh") {
  if (key === "unknown") return lang === "en" ? "Undated" : "日期不详";
  const [y, m] = key.split("-");
  if (lang === "en") {
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }
  return `${y} 年 ${Number(m)} 月`;
}

export function dayLabel(iso, now = new Date(), lang = "zh") {
  const when = safeDate(iso);
  if (!when) return lang === "en" ? "Undated" : "日期不详";
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86400000).toISOString());
  const key = dayKey(iso);
  const en = lang === "en";
  if (key === today) return en ? "Today" : "今天";
  if (key === yesterday) return en ? "Yesterday" : "昨天";
  const d = when;
  if (en) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// 「距上次喂养」这类间隔，精度随间隔本身递减：
//   不足 10 小时 —— 精确到分钟，夜里判断该不该喂差的就是那几十分钟
//   10 小时到 1 天 —— 只到小时，这时候分钟已经不影响判断
//   超过 1 天 —— 只到天
export function sinceLabel(iso, now = new Date(), lang = "zh") {
  const when = safeDate(iso);
  if (!when) return lang === "en" ? "unknown" : "时间不详";
  const diff = Math.max(0, now - when);
  const minutes = Math.floor(diff / 60000);
  const en = lang === "en";
  // 单位用字母，两种语言共用。中文只给时长，不带「前」——「距上次喂养」
  // 这个标签已经表明了是往回数的间隔，再写个「前」是同一件事说两遍。
  // 英文保留 ago：「Since last feed / 4 h」少了 ago 会读成半截话。
  if (minutes < 1) return en ? "just now" : "刚刚";
  if (minutes < 60) return en ? `${minutes} m ago` : `${minutes} m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 10) {
    const restMin = minutes % 60;
    const span = restMin ? `${hours} h ${restMin} m` : `${hours} h`;
    return en ? `${span} ago` : span;
  }
  if (hours < 24) return en ? `${hours} h ago` : `${hours} h`;

  const days = Math.floor(hours / 24);
  return en ? `${days} d ago` : `${days} d`;
}

export function stopwatch(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// <input type="datetime-local"> 需要本地时区的 "YYYY-MM-DDTHH:mm"。
export function toLocalInput(iso) {
  // 坏日期退回「现在」：编辑框里必须有个能改的值，
  // 空字符串会让 <input type="datetime-local"> 变成不可用状态。
  const d = safeDate(iso, new Date());
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function startOfDay(date) {
  const d = safeDate(date, new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameDay(a, b) {
  const x = safeDate(a);
  const y = safeDate(b);
  if (!x || !y) return false;
  return dayKey(x.toISOString()) === dayKey(y.toISOString());
}

// 完整日期，用于日期条中间那行标题。
export function fullDayLabel(date, now = new Date(), lang = "zh") {
  const d = safeDate(date);
  if (!d) return lang === "en" ? "Undated" : "日期不详";
  const today = startOfDay(now);
  const diff = Math.round((startOfDay(d) - today) / 86400000);
  const en = lang === "en";
  if (diff === 0) return en ? "Today" : "今天";
  if (diff === -1) return en ? "Yesterday" : "昨天";
  if (diff === -2) return en ? "2 days ago" : "前天";
  if (en) {
    const opts = { weekday: "short", month: "short", day: "numeric" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString("en-US", opts);
  }
  const weekday = "日一二三四五六"[d.getDay()];
  const year = d.getFullYear() === now.getFullYear() ? "" : `${d.getFullYear()} 年 `;
  return `${year}${d.getMonth() + 1} 月 ${d.getDate()} 日 周${weekday}`;
}

// 生成某个月的日历格子：补齐前后空档，凑满整周。
export function monthGrid(anchor) {
  const base = safeDate(anchor, new Date());
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start.getTime() + i * 86400000);
    cells.push({ date: day, outside: day.getMonth() !== base.getMonth() });
    if (i >= 34 && day.getMonth() !== base.getMonth() && day.getDay() === 6) break;
  }
  return cells;
}
