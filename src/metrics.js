// 今日概览里可选的小卡片。每一项自己算出当天的值，
// 用户可以像编辑桌面小组件那样增删、决定摆哪几个。
import { formatDuration, safeValues, trValue } from "./data.js";

function sum(records, typeId, key) {
  return records
    .filter((r) => r.typeId === typeId)
    .reduce((total, r) => total + (Number(safeValues(r.values)[key]) || 0), 0);
}

function count(records, ...typeIds) {
  return records.filter((r) => typeIds.includes(r.typeId)).length;
}

// 取当天最后一条该类记录（records 是按时间倒序的）。
function latest(records, typeId) {
  return records.find((r) => r.typeId === typeId);
}

export const metricCatalog = [
  {
    id: "feeds",
    name: "喂养次数", nameEn: "Feedings",
    hint: "亲喂加瓶喂", hintEn: "Nursing plus bottle",
    value: (rows, lang) => `${count(rows, "nursing", "bottle")} ${trValue("次", lang)}`,
  },
  {
    id: "bottleVolume",
    name: "瓶喂总量", nameEn: "Bottle total",
    hint: "当天瓶喂累计", hintEn: "Bottles that day",
    value: (rows, lang) => `${sum(rows, "bottle", "volume")} ${trValue("毫升", lang)}`,
  },
  {
    id: "nursingMinutes",
    name: "亲喂时长", nameEn: "Nursing time",
    hint: "当天亲喂累计", hintEn: "Nursing that day",
    value: (rows) => formatDuration(sum(rows, "nursing", "minutes")),
  },
  {
    id: "sleepTotal",
    name: "睡眠总时长", nameEn: "Sleep total",
    hint: "当天所有睡眠记录相加", hintEn: "All sleep records added up",
    value: (rows) => formatDuration(sum(rows, "sleep", "minutes")),
  },
  {
    id: "sleepСount",
    name: "睡眠段数", nameEn: "Naps",
    hint: "当天睡了几觉", hintEn: "How many stretches",
    value: (rows, lang) => `${count(rows, "sleep")} ${trValue("段", lang)}`,
  },
  {
    id: "diapers",
    name: "换尿布", nameEn: "Diapers",
    hint: "当天次数", hintEn: "Changes that day",
    value: (rows, lang) => `${count(rows, "diaper")} ${trValue("次", lang)}`,
  },
  {
    id: "poop",
    name: "大便次数", nameEn: "Dirty diapers",
    hint: "尿布记录里的大便", hintEn: "Dirty ones only",
    value: (rows, lang) =>
      `${rows.filter((r) => r.typeId === "diaper" && (safeValues(r.values).kind === "大便" || safeValues(r.values).kind === "两者都有")).length} ${trValue("次", lang)}`,
  },
  {
    id: "solids",
    name: "辅食次数", nameEn: "Solids",
    hint: "当天次数", hintEn: "Times that day",
    value: (rows, lang) => `${count(rows, "solids")} ${trValue("次", lang)}`,
  },
  {
    id: "pumpingVolume",
    name: "吸奶总量", nameEn: "Pumped",
    hint: "当天吸奶累计", hintEn: "Pumping that day",
    value: (rows, lang) => `${sum(rows, "pumping", "volume")} ${trValue("毫升", lang)}`,
  },
  {
    id: "temperature",
    name: "最近体温", nameEn: "Temperature",
    hint: "当天最后一次测量", hintEn: "Last reading that day",
    value: (rows, lang) => {
      const row = latest(rows, "temperature");
      return row && safeValues(row.values).celsius ? `${row.values.celsius} ${trValue("℃", lang)}` : lang === "en" ? "—" : "未测";
    },
  },
  {
    id: "weight",
    name: "最近体重", nameEn: "Weight",
    hint: "当天的身高体重记录", hintEn: "From the growth record",
    value: (rows, lang) => {
      const row = latest(rows, "growth");
      return row && safeValues(row.values).weight ? `${row.values.weight} ${trValue("千克", lang)}` : lang === "en" ? "—" : "未测";
    },
  },
  {
    id: "height",
    name: "最近身长", nameEn: "Length",
    hint: "当天的身高体重记录", hintEn: "From the growth record",
    value: (rows, lang) => {
      const row = latest(rows, "growth");
      return row && safeValues(row.values).height ? `${row.values.height} ${trValue("厘米", lang)}` : lang === "en" ? "—" : "未测";
    },
  },
  {
    id: "medicine",
    name: "用药次数", nameEn: "Medicine",
    hint: "当天次数", hintEn: "Times that day",
    value: (rows, lang) => `${count(rows, "medicine")} ${trValue("次", lang)}`,
  },
  {
    id: "notes",
    name: "随手记", nameEn: "Notes",
    hint: "当天条数", hintEn: "Notes that day",
    value: (rows, lang) => `${count(rows, "note")} ${trValue("条", lang)}`,
  },
];

export const metricById = Object.fromEntries(metricCatalog.map((m) => [m.id, m]));

// 默认摆四个，正好两行两列或者一行四列，不会出现落单的一个。
export const defaultMetrics = ["feeds", "bottleVolume", "sleepTotal", "diapers"];

// 只允许这几种数量，保证换行后每一行都是满的，不会出现 3+1 那种落单。
//   2 -> 一行两个      3 -> 一行三个
//   4 -> 两行各两个    6 -> 两行各三个
const allowedCounts = [2, 3, 4, 6];
export const maxMetrics = 6;
export const minMetrics = 2;

export function columnsFor(total) {
  if (total <= 1) return 1;
  if (total === 3 || total === 6) return 3;
  return 2;
}

// 选够偶数或三的倍数才算合法，5 个这种会落单的不放行。
export function isAllowedCount(total) {
  return allowedCounts.includes(total);
}
