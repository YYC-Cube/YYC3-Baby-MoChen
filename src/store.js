import { defaultBaby } from "./family.js";
import { tr } from "./i18n.js";
import { recordTypes } from "./data.js";
import { defaultMetrics } from "./metrics.js";

const KEY = "baby-growth-log/state/v1";

// 出厂状态（也是退出登录后的重置底）。个人专用版没有示例数据：
// 未登录时应用直接跳授权页，用户拿到的第一份数据就是自己记的。
// loadState 的兜底和退出登录后的重置共用同一份，避免两处各写一套。
function freshState() {
  return {
    records: [],
    photos: [],
    memberId: "mom",
    // 登录后的账号。null 就是未登录 —— 全站判断「是否登录」只看这一个字段。
    // { userId, name, email }。身份不在这里：见下面的 roles。
    account: null,
    // 账号 → 家庭身份。这份映射属于整个家庭、跟着家庭状态一起同步，
    // 不是某台设备的偏好：同一个人换台设备打开，身份必须还是那个，
    // 不该再被问一次「你是谁」。身份一经写入不再改动。
    roles: {},
    // 成员改过的显示名：成员 id → 新名字。身份本身不可变，名字可以改，
    // 所以改名不动 members 名单，只在这里覆盖显示。
    names: {},
    // 成员改过的身份描述（名字下面那行小字）：成员 id → 新描述。
    // 和名字一样只是显示层覆盖，不动名单。
    roleNotes: {},
    // 用户自己定义的家庭身份（onboarding 的「其他身份」、之后添加的），
    // 跟着家庭状态同步。内置名单见 family.js 的 members。
    extraMembers: [],
    baby: { ...defaultBaby },
    metrics: [...defaultMetrics],
    faces: {},
    // 出厂语言由编译期常量决定：中文版默认 zh，英文版默认 en。
    lang: __DEFAULT_LANG__,
    theme: "system",
    typeOrder: recordTypes.map((t) => t.id),
  };
}

// 账号对象只留这几个字段：其余会跟着家庭状态同步给别人，
// 凭证之类的东西不该进这条路。
function normalizeAccount(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = String(raw.userId || "").trim();
  if (!userId) return null;
  return {
    userId,
    name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "",
    email: typeof raw.email === "string" ? raw.email.slice(0, 120) : "",
  };
}

// 当前账号选定的家庭身份。没登录、或者登录了还没选，都是空字符串。
export function roleOf(state) {
  if (!state.account) return "";
  return (state.roles && state.roles[state.account.userId]) || "";
}

// 老存档里可能还带着早期示例数据的 demo 标记，登录时一律滤掉，
// 只留用户自己记的内容。判据是记录和照片上的 demo 标记，不会误伤真实记录。
export function stripDemo(state) {
  return {
    ...state,
    records: state.records.filter((row) => !row.demo),
    photos: state.photos.filter((row) => !row.demo),
  };
}

export function loadState() {
  const fallback = freshState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback();
    const parsed = normalizeSaved(JSON.parse(raw));
    return parsed || fallback();
  } catch {
    return fallback();
  }
}

// 把 localStorage 里读出来的一份存档整理成可用的状态。
// 主存档和按账号归档共用这一套校验，坏数据一律返回 null。
function normalizeSaved(parsed) {
  if (!parsed || !Array.isArray(parsed.records) || !Array.isArray(parsed.photos)) return null;
  const account = normalizeAccount(parsed.account);
  const roles = parsed.roles && typeof parsed.roles === "object" ? { ...parsed.roles } : {};
  return {
    records: parsed.records,
    photos: parsed.photos,
    // 登录状态下当前身份只能是账号自己选的那个，存过的值不作数：
    // 换了账号再打开这台设备时，视角必须跟着新账号走。
    memberId: (account && roles[account.userId]) || parsed.memberId || "mom",
    account,
    roles,
    names: parsed.names && typeof parsed.names === "object" ? { ...parsed.names } : {},
    roleNotes: parsed.roleNotes && typeof parsed.roleNotes === "object" ? { ...parsed.roleNotes } : {},
    // 自定义身份名单：只收形状对的，最多 12 个，坏数据直接丢。
    extraMembers: Array.isArray(parsed.extraMembers)
      ? parsed.extraMembers
          .filter((m) => m && typeof m.id === "string" && m.id && typeof m.name === "string" && m.name)
          .slice(0, 12)
          .map((m) => ({ id: m.id.slice(0, 40), name: m.name.slice(0, 20), custom: true }))
      : [],
    // 老数据没有 baby 字段，用出厂值补齐，新增字段也在这里兜底。
    baby: { ...defaultBaby, ...(parsed.baby || {}) },
    metrics: Array.isArray(parsed.metrics) && parsed.metrics.length ? parsed.metrics : [...defaultMetrics],
    // 照护者换过的头像：成员 id → IndexedDB 里的位图 id。位图本身不进
    // localStorage，这里只留一个指针，读不到位图时回落到出厂头像。
    faces: parsed.faces && typeof parsed.faces === "object" ? { ...parsed.faces } : {},
    lang: parsed.lang === "en" ? "en" : "zh",
    theme: ["light", "dark", "system"].includes(parsed.theme) ? parsed.theme : "system",
    // 存过的顺序可能缺少后来新增的类型，这里补齐并剔掉已删除的。
    typeOrder: mergeOrder(parsed.typeOrder),
  };
}

// 序列化成可存储的形态。主存档和按账号归档共用，保证两处字段一致。
function serializeState(state) {
  return JSON.stringify({
    records: state.records,
    photos: state.photos,
    memberId: state.memberId,
    account: state.account,
    roles: state.roles,
    names: state.names,
    roleNotes: state.roleNotes,
    extraMembers: state.extraMembers,
    baby: state.baby,
    metrics: state.metrics,
    faces: state.faces,
    lang: state.lang,
    theme: state.theme,
    typeOrder: state.typeOrder,
  });
}

// 按账号归档：退出登录时把这台设备上的数据存到对应账号名下。
// 重新登录时原样恢复（数据不丢）；归档按账号隔离，这台设备上
// 换一个人登录，拿到的是他自己那份（或空），看不到别人的。
const ARCHIVE_PREFIX = `${KEY}/archive/`;

export function archiveState(state) {
  const account = normalizeAccount(state && state.account);
  if (!account) return;
  try {
    // 带 demo 标记的历史内容不进归档：那不是这个账号的记录。
    localStorage.setItem(
      ARCHIVE_PREFIX + account.userId,
      serializeState({
        ...state,
        records: state.records.filter((row) => !row.demo),
        photos: state.photos.filter((row) => !row.demo),
      }),
    );
  } catch {
    // 归档失败不影响退出：服务端还有一份，重新登录会拉回来。
  }
}

export function archivedState(userId) {
  try {
    const raw = localStorage.getItem(ARCHIVE_PREFIX + userId);
    if (!raw) return null;
    return normalizeSaved(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, serializeState(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState(keep = {}) {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 清不掉也无所谓，调用方会用新的种子数据覆盖内存状态。
  }
  // 语言和主题是这台设备上的偏好，不属于任何账号，退出登录时留着。
  return { ...freshState(), ...keep };
}

// 登录后的起点：示例数据清空，宝宝资料回到未填状态，其余偏好保留。
// account 由调用方从会话里取，此刻可能还没选过身份。
export function signedInState(state, account) {
  const next = normalizeAccount(account);
  if (!next) return state;
  // 这个账号在这台设备上退出过：恢复它归档的那份，记录和照片原样回来。
  // 归档里没有才当新账号处理 —— 绝不用当前状态里的内容，那是上一个
  // 账号留下的，带过来就是把一个人的数据漏给另一个人。
  const archived = archivedState(next.userId);
  if (archived) {
    const keptRoles = archived.roles || {};
    return {
      ...archived,
      account: next,
      memberId: keptRoles[next.userId] || archived.memberId,
      // 语言和主题是这台设备的偏好，不跟着归档回滚。
      lang: state.lang,
      theme: state.theme,
    };
  }
  const roles = state.roles || {};
  // 当前状态还属于另一个账号（会话在别处直接换了人）：不能带着走，
  // 按新账号从零开始，服务端那份随后会拉下来。
  if (state.account && state.account.userId !== next.userId) {
    return {
      ...stripDemo(freshState()),
      lang: state.lang,
      theme: state.theme,
      account: next,
      memberId: roles[next.userId] || "mom",
    };
  }
  return {
    ...stripDemo(state),
    // 出生时间留空：这是「宝宝信息还没填」的判据，引导页会挡到填完为止。
    baby: { ...defaultBaby, name: "", portrait: "", note: "", birth: "" },
    account: next,
    memberId: (next && roles[next.userId]) || state.memberId,
  };
}

// 选定家庭身份。只在还没选过的时候生效 —— 身份一经确定不可更改，
// 这个约束放在状态层，任何入口都绕不过去。
export function withRole(state, roleId) {
  if (!state.account || roleOf(state)) return state;
  return {
    ...state,
    roles: { ...state.roles, [state.account.userId]: roleId },
    memberId: roleId,
  };
}

// 保存下来的顺序和当前的类型清单对齐：认识的按存的顺序排在前面，
// 新增的类型接在后面，已经删掉的丢弃。
function mergeOrder(saved) {
  const all = recordTypes.map((t) => t.id);
  if (!Array.isArray(saved)) return all;
  const known = new Set(all);
  const kept = saved.filter((id) => known.has(id));
  const seen = new Set(kept);
  return [...kept, ...all.filter((id) => !seen.has(id))];
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// 同步冲突时合并本地状态与服务端 payload。
// 原则：两边新录入的内容都不能丢，宁可保留稍旧的一份，也不整份覆盖。
//   - 记录 / 照片 / 自定义成员：按 id 取并集；同 id 取时间戳较新的一份（本地不早于远端时保留本地）
//   - 名字 / 备注 / 角色 / 头像：逐键合并，本地优先（本地刚改的不会被远端冲掉）
//   - 其余字段：本地优先，远端只补本地缺失的键
export function mergeSynced(local, remote) {
  if (!remote || typeof remote !== "object") return local;
  const byTime = (rows, remoteRows, stamp) => {
    const map = new Map();
    for (const row of Array.isArray(remoteRows) ? remoteRows : []) {
      if (row && row.id) map.set(row.id, row);
    }
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || !row.id) continue;
      const other = map.get(row.id);
      if (!other) {
        map.set(row.id, row);
        continue;
      }
      if ((Date.parse(stamp(row)) || 0) >= (Date.parse(stamp(other)) || 0)) map.set(row.id, row);
    }
    return [...map.values()];
  };
  const newestFirst = (rows) => rows.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  return {
    ...remote,
    ...local,
    records: newestFirst(byTime(local.records, remote.records, (row) => row.at)),
    photos: newestFirst(byTime(local.photos, remote.photos, (row) => row.at)),
    faces: { ...(remote.faces || {}), ...(local.faces || {}) },
    names: { ...(remote.names || {}), ...(local.names || {}) },
    roleNotes: { ...(remote.roleNotes || {}), ...(local.roleNotes || {}) },
    roles: { ...(remote.roles || {}), ...(local.roles || {}) },
    extraMembers: byTime(local.extraMembers, remote.extraMembers, () => ""),
  };
}
