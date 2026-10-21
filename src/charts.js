// 每一类记录对应一种图表形态与聚合方式。
//   session  睡眠区间图：把每段睡眠画在 24 小时轴上，仿健康 App 的分段柱
//   bar      每日合计柱：把当日同类记录的某个字段加总
//   count    每日次数柱：只数条数
//   line     折线：身长体重这类连续测量，取当日最后一次读数
//   stack    分类堆叠柱：按某个 choice 字段把每日次数拆成几段
//   marker   事件标记：疫苗用药这类稀疏事件，按天点在时间轴上
import { recordTypes, safeValues, typeById } from "./data.js";
import { dayKey } from "./format.js";

export const chartSpecs = {
  sleep: { kind: "session", metric: "minutes", unit: "分钟", title: "睡眠分布", titleEn: "Sleep pattern", note: "横轴是一天 24 小时，每段色块是一次睡眠；上方数字按天看是当日睡眠合计，按周、月看是有记录那几天的日均。", noteEn: "Each block is one stretch of sleep on a 24-hour axis. Day view shows that day's total, week and month show the daily average." },
  nursing: { kind: "bar", metric: "minutes", unit: "分钟", title: "亲喂时长", titleEn: "Nursing time", note: "每根柱是当天亲喂时长的合计；上方数字按天看是当日合计，按周、月看是日均。", noteEn: "Each bar is the nursing time logged that day. Day view shows the daily total, week and month show the daily average." },
  bottle: { kind: "bar", metric: "volume", unit: "毫升", title: "瓶喂奶量", titleEn: "Bottle volume", note: "每根柱是当天瓶喂奶量的合计；上方数字按天看是当日合计，按周、月看是日均。", noteEn: "Each bar is the milk taken from bottles that day. Day view shows the daily total, week and month show the daily average." },
  pumping: { kind: "bar", metric: "volume", unit: "毫升", title: "吸奶量", titleEn: "Pumped volume", note: "每根柱是当天吸出奶量的合计；上方数字按天看是当日合计，按周、月看是日均。", noteEn: "Each bar is the milk pumped that day. Day view shows the daily total, week and month show the daily average." },
  milkstock: { kind: "stack", metric: "volume", by: "action", unit: "毫升", title: "母乳库存进出", titleEn: "Milk stash", note: "每根柱按入库、取用、丢弃三段堆叠，柱高是当天进出的总奶量；上方数字按天看是当日合计，按周、月看是日均。", noteEn: "Each bar stacks milk stored, used and discarded, so its height is all movement that day. Day view shows the daily total, week and month show the daily average." },
  diaper: { kind: "stack", metric: null, by: "kind", unit: "次", title: "排便次数", titleEn: "Diapers", note: "每根柱按小便、大便两段堆叠，柱高是当天换尿布的总次数；上方数字按天看是当日次数，按周、月看是日均。", noteEn: "Each bar stacks wet and dirty changes, so its height is every change that day. Day view shows the daily count, week and month show the daily average." },
  solids: { kind: "count", metric: null, unit: "次", title: "辅食次数", titleEn: "Solids", note: "每根柱是当天吃辅食的次数；上方数字按天看是当日次数，按周、月看是日均。", noteEn: "Each bar is how many times solids were offered that day. Day view shows the daily count, week and month show the daily average." },
  supplement: { kind: "count", metric: null, unit: "次", title: "补剂次数", titleEn: "Supplements", note: "每根柱是当天补剂的服用次数；上方数字按天看是当日次数，按周、月看是日均。", noteEn: "Each bar is how many supplement doses were given that day. Day view shows the daily count, week and month show the daily average." },
  growth: { kind: "line", series: [
      { key: "weight", label: "体重", labelEn: "Weight", unit: "千克" },
      { key: "height", label: "身长", labelEn: "Length", unit: "厘米" },
      { key: "head", label: "头围", labelEn: "Head", unit: "厘米" },
    ], title: "身高体重", titleEn: "Growth", note: "每个点是一次测量，三条线分别跟着体重、身长、头围走；上方数字是最近一次体重读数。", noteEn: "Each dot is one measurement, and the lines follow weight, length and head over time. The number above is the latest weight." },
  temperature: { kind: "line", series: [{ key: "celsius", label: "体温", labelEn: "Temperature", unit: "℃" }], band: [36, 37.3], title: "体温", titleEn: "Temperature", note: "每个点是一次体温测量，灰带是 36–37.3℃ 的常见区间；上方数字是最近一次读数。", noteEn: "Each dot is one reading and the grey band marks the usual 36–37.3 ℃ range. The number above is the latest reading." },
  jaundice: { kind: "line", series: [{ key: "value", label: "经皮值", labelEn: "Reading", unit: "mg/dL" }], title: "黄疸", titleEn: "Jaundice", note: "每个点是一次经皮胆红素测量，横轴是日期、纵轴是测出的数值；上方数字是最近一次读数。", noteEn: "Each dot is one transcutaneous reading, placed on its date against the measured value. The number above is the latest reading." },
  medicine: { kind: "marker", unit: "次", title: "用药", titleEn: "Medicine", note: "每个标记是一次服药，横轴是日期、纵轴是当天的时刻；上方数字是这段时间的总次数。", noteEn: "Each mark is one dose, placed on its date and time of day. The number above is the total for this window." },
  vaccine: { kind: "marker", unit: "次", title: "疫苗", titleEn: "Vaccines", note: "每个标记是一次接种，横轴是日期、纵轴是当天的时刻；上方数字是这段时间的总次数。", noteEn: "Each mark is one shot, placed on its date and time of day. The number above is the total for this window." },
  note: { kind: "count", metric: null, unit: "条", title: "随手记", titleEn: "Notes", note: "每根柱是当天写下的随手记条数；上方数字按天看是当日条数，按周、月看是日均。", noteEn: "Each bar is how many notes were written that day. Day view shows the daily count, week and month show the daily average." },
};

export const rangeOptions = [
  { id: "day", name: "天", nameEn: "Day", days: 1 },
  { id: "week", name: "周", nameEn: "Week", days: 7 },
  { id: "month", name: "月", nameEn: "Month", days: 30 },
];

// 图表模块里记录类型的排列顺序：常看的排前面。
const chartTypeOrder = [
  "sleep", "nursing", "bottle", "diaper", "growth",
  "solids", "pumping", "milkstock", "temperature", "supplement",
  "jaundice", "medicine", "vaccine", "note",
];

export const chartTypes = chartTypeOrder.map((id) => typeById[id]).filter(Boolean);

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 返回该粒度覆盖的天列表。offset 是窗口偏移：0 表示最近一段（最后一天是今天），
// -1 表示再往前挪一整段，+1 往后。所以「天」粒度翻一页就是前后一天，
// 「周」翻一页是前后七天，「月」是前后三十天。
function bucketDays(rangeId, now = new Date(), offset = 0) {
  const option = rangeOptions.find((r) => r.id === rangeId) || rangeOptions[0];
  const days = [];
  const last = new Date(startOfDay(now).getTime() + offset * option.days * 86400000);
  for (let i = option.days - 1; i >= 0; i -= 1) {
    days.push(new Date(last.getTime() - i * 86400000));
  }
  return days;
}

// 窗口的说明文字，同时给出「还能不能往后翻」。
export function windowLabel(rangeId, offset, now = new Date(), lang = "zh") {
  const days = bucketDays(rangeId, now, offset);
  const first = days[0];
  const last = days[days.length - 1];
  const en = lang === "en";
  const md = (d) =>
    en
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  if (rangeId === "day") {
    if (offset === 0) return en ? "Today" : "今天";
    if (offset === -1) return en ? "Yesterday" : "昨天";
    if (en) return md(last);
    return `${last.getFullYear() === now.getFullYear() ? "" : `${last.getFullYear()} 年 `}${md(last)}`;
  }
  if (offset === 0) {
    if (en) return rangeId === "week" ? "Last 7 days" : "Last 30 days";
    return rangeId === "week" ? "最近七天" : "最近三十天";
  }
  return `${md(first)} – ${md(last)}`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 把一类记录按天聚合成图表要用的数据结构。
export function buildSeries(typeId, records, rangeId, now = new Date(), offset = 0) {
  const spec = chartSpecs[typeId];
  const type = typeById[typeId];
  if (!spec || !type) return null;

  const days = bucketDays(rangeId, now, offset);
  const keys = days.map((d) => dayKey(d.toISOString()));
  const keyIndex = new Map(keys.map((k, i) => [k, i]));
  // values 可能是 null 或整个字段缺失（老数据、别处写坏的数据）。在这里一次性
  // 规范化，下面所有 row.values.xxx 就都不用再各自防一遍。
  const rows = records
    .filter((r) => r.typeId === typeId && keyIndex.has(dayKey(r.at)))
    .map((r) => (r.values && typeof r.values === "object" ? r : { ...r, values: safeValues(r.values) }));

  // 今天在这一屏里的下标；翻到过去的窗口时为 -1，那一屏就没有紫色的“今日”。
  const todayIndex = keys.indexOf(dayKey(now.toISOString()));

  const base = { spec, type, days, keys, rows, rangeId, offset, todayIndex, empty: rows.length === 0 };

  if (spec.kind === "session") {
    // 每段睡眠可能跨过午夜，拆成当天和次日两段再画。
    const segments = days.map(() => []);
    let total = 0;
    for (const row of rows) {
      const minutes = Math.max(1, num(row.values.minutes));
      total += minutes;
      const start = new Date(row.at);
      let index = keyIndex.get(dayKey(row.at));
      let from = start.getHours() * 60 + start.getMinutes();
      let left = minutes;
      while (left > 0 && index !== undefined && index < days.length) {
        const span = Math.min(left, 1440 - from);
        segments[index].push({ from, to: from + span, id: row.id, memberId: row.memberId, minutes });
        left -= span;
        from = 0;
        index += 1;
      }
    }
    const dayTotals = segments.map((list) => list.reduce((sum, s) => sum + (s.to - s.from), 0));
    const active = dayTotals.filter((v) => v > 0);
    return {
      ...base,
      segments,
      dayTotals,
      total,
      average: active.length ? total / active.length : 0,
      headline: active.length ? total / active.length : 0,
      headlineLabel: rangeId === "day" ? "当日睡眠" : "日均睡眠",
      valueKind: "duration",
    };
  }

  if (spec.kind === "line") {
    const series = spec.series.map((s) => ({
      ...s,
      points: [],
    }));
    for (const row of rows.slice().sort((a, b) => new Date(a.at) - new Date(b.at))) {
      const index = keyIndex.get(dayKey(row.at));
      for (const s of series) {
        const value = Number(row.values[s.key]);
        if (Number.isFinite(value)) s.points.push({ index, value, at: row.at, memberId: row.memberId, id: row.id });
      }
    }
    const primary = series[0];
    const last = primary.points[primary.points.length - 1];
    return {
      ...base,
      series,
      headline: last ? last.value : 0,
      headlineLabel: `最近${primary.label}`,
      headlineUnit: primary.unit,
      valueKind: "reading",
      empty: series.every((s) => s.points.length === 0),
    };
  }

  if (spec.kind === "stack") {
    const buckets = new Map();
    const dayRows = days.map(() => []);
    for (const row of rows) {
      const label = row.values[spec.by] || "其他";
      if (!buckets.has(label)) buckets.set(label, days.map(() => 0));
      const index = keyIndex.get(dayKey(row.at));
      buckets.get(label)[index] += spec.metric ? num(row.values[spec.metric]) : 1;
      dayRows[index].push(row.id);
    }
    const stacks = [...buckets.entries()].map(([label, values]) => ({ label, values }));
    const dayTotals = days.map((_, i) => stacks.reduce((sum, s) => sum + s.values[i], 0));
    const total = dayTotals.reduce((a, b) => a + b, 0);
    const active = dayTotals.filter((v) => v > 0).length;
    return {
      ...base,
      stacks,
      dayRows,
      dayTotals,
      total,
      headline: rangeId === "day" ? total : active ? total / active : 0,
      headlineLabel: rangeId === "day" ? `当日${spec.unit === "次" ? "次数" : "总量"}` : "日均",
      headlineUnit: spec.unit,
      valueKind: "amount",
    };
  }

  if (spec.kind === "marker") {
    const marks = rows.map((row) => {
      const at = new Date(row.at);
      return {
        index: keyIndex.get(dayKey(row.at)),
        minute: at.getHours() * 60 + at.getMinutes(),
        id: row.id,
        memberId: row.memberId,
        label: type.summary(row.values),
        at: row.at,
      };
    });
    return {
      ...base,
      marks,
      total: marks.length,
      headline: marks.length,
      headlineLabel: "这段时间",
      headlineUnit: spec.unit,
      valueKind: "count",
    };
  }

  // bar / count
  const values = days.map(() => 0);
  const dayRows = days.map(() => []);
  for (const row of rows) {
    const index = keyIndex.get(dayKey(row.at));
    values[index] += spec.metric ? num(row.values[spec.metric]) : 1;
    dayRows[index].push(row.id);
  }
  const total = values.reduce((a, b) => a + b, 0);
  const active = values.filter((v) => v > 0).length;
  return {
    ...base,
    values,
    dayRows,
    total,
    headline: rangeId === "day" ? total : active ? total / active : 0,
    headlineLabel: rangeId === "day" ? "当日合计" : "日均",
    headlineUnit: spec.unit,
    valueKind: spec.kind === "bar" && spec.metric === "minutes" ? "duration" : "amount",
  };
}
