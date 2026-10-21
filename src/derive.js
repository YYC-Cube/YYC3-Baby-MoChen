// 所有派生数据集中在这里算，各视图只消费结果，不再各自 filter 一遍 records。
// 这样「某处更新了、某处没更新」在结构上就不可能发生：
// 同一个 records 数组进来，所有口径出自同一次计算。
import { dayKey } from "./format.js";

// records 必须按时间倒序。写入时已经排过，这里再兜一次底：
// 顺序错了「最近一条」就会取错，而这个错很难在界面上看出来。
export function normalizeRecords(rows) {
  return [...rows].sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function normalizePhotos(rows) {
  return [...rows].sort((a, b) => new Date(b.at) - new Date(a.at));
}

// 按天分组，供时间线、概览、日历标记共用。
export function groupByDay(records) {
  const map = new Map();
  for (const record of records) {
    const key = dayKey(record.at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  }
  return map;
}

// 每类记录的最近一条。records 已倒序，第一次遇到就是最新的。
export function latestByType(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.typeId)) map.set(record.typeId, record);
  }
  return map;
}

export function countsByType(records) {
  const map = new Map();
  for (const record of records) {
    map.set(record.typeId, (map.get(record.typeId) || 0) + 1);
  }
  return map;
}

export function countsByMember(records) {
  const map = new Map();
  for (const record of records) {
    map.set(record.memberId, (map.get(record.memberId) || 0) + 1);
  }
  return map;
}

// 一次算出全站要用的所有口径。App 只调这一个函数，往下传结果。
export function derive(records, photos) {
  const sortedRecords = normalizeRecords(records);
  const sortedPhotos = normalizePhotos(photos);
  return {
    records: sortedRecords,
    photos: sortedPhotos,
    byDay: groupByDay(sortedRecords),
    latest: latestByType(sortedRecords),
    typeCounts: countsByType(sortedRecords),
    memberCounts: countsByMember(sortedRecords),
    recordTotal: sortedRecords.length,
    photoTotal: sortedPhotos.length,
  };
}

// 某一天的记录。key 用 dayKey 算，和分组时用的是同一个函数。
//
// 日期读不出来的记录会被 dayKey 归到 "unknown" 这一格。它们不属于任何一天，
// 但也不能就此消失——数据还在，界面上却永远翻不到，等于丢了。
// 所以把它们并进「今天」一起显示：用户看得见，点开就能把日期改回来。
export function recordsOnDay(byDay, date, now = new Date()) {
  const rows = byDay.get(dayKey(new Date(date).toISOString())) || [];
  const orphans = byDay.get("unknown");
  if (!orphans || !orphans.length) return rows;
  const isToday = dayKey(new Date(date).toISOString()) === dayKey(now.toISOString());
  return isToday ? [...orphans, ...rows] : rows;
}
