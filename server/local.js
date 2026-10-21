// 自建账号登录（路线①：彻底自建，不依赖任何外部平台）。
//
// 账号、密码、会话全部闭环在本应用里：
//   账号存储   MySQL auth_user 表（ensureSchema 启动自动建表）
//   密码散列   Node 内置 scrypt（N=16384, r=8, p=1，64 字节派生 + 16 字节盐）
//   会话凭证   HS256 签名的 JWT，HttpOnly cookie（bgl_lid），30 天有效
//
// 环境变量：
//   AUTH_LOCAL_SECRET   会话签名密钥（openssl rand -hex 32）。设置即启用，
//                       不设置则整个模块不参与 —— 与 kimi/header/jwt 三种
//                       接法互斥共存，谁配了用谁。
//
// 账号管理走 scripts/user.mjs（add/passwd/list/enable/disable/rm），
// 服务端刻意不开放注册：家庭应用的账号就该由管理员来发。
// 验不过一律当未登录，宁可让人重输，也不能把别人家的记录递出去。
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { getPool } from "./db.js";

const SECRET = process.env.AUTH_LOCAL_SECRET || "";
export const LOCAL_COOKIE = "bgl_lid";
const SESSION_TTL_S = 30 * 24 * 3600;

export function localConfigured() {
  return Boolean(SECRET);
}

/* ── base64url 与 JWT（HS256）────────────────────────────────────────── */

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmac(data) {
  return createHmac("sha256", SECRET).update(data).digest();
}

function signJwt(payload) {
  const head = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${head}.${body}.${b64url(hmac(`${head}.${body}`))}`;
}

function verifyJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expect = hmac(`${parts[0]}.${parts[1]}`);
  const got = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object" || !claims.userId) return null;
  const exp = Number(claims.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  return claims;
}

/* ── 会话 cookie ─────────────────────────────────────────────────────── */

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    if (pair.slice(0, idx).trim() === name) return pair.slice(idx + 1).trim();
  }
  return "";
}

function isSecure(req) {
  const protos = String(req.headers["x-forwarded-proto"] || "").split(",").map((s) => s.trim());
  return Boolean(req.socket && req.socket.encrypted) || protos.includes("https");
}

// 与 kimi 会话同一套策略：本地 http 用 Lax，HTTPS（含反代终结）才 None+Secure。
export function localCookieHeader(token, req, { clear = false } = {}) {
  return [
    `${LOCAL_COOKIE}=${clear ? "" : token}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${clear ? 0 : SESSION_TTL_S}`,
    isSecure(req) ? "SameSite=None; Secure" : "SameSite=Lax",
  ].join("; ");
}

// 给 auth.js 的会话解析用：验不过返回 null，绝不放行。
export function fromLocal(req) {
  if (!localConfigured()) return null;
  const claims = verifyJwt(readCookie(req, LOCAL_COOKIE));
  if (!claims) return null;
  return {
    userId: String(claims.userId),
    name: typeof claims.name === "string" ? claims.name : "",
    email: "",
    avatar: "",
    familyId: typeof claims.familyId === "string" ? claims.familyId : "",
  };
}

/* ── 密码散列（scripts/user.mjs 也复用这两个函数）─────────────────────── */

export function hashPassword(password) {
  const salt = randomBytes(16);
  return { salt, hash: scryptSync(String(password), salt, 64) };
}

export function verifyPassword(password, salt, expected) {
  try {
    const got = scryptSync(String(password), salt, 64);
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

/* ── 登录尝试限速：同 IP 连续失败 8 次，锁 15 分钟 ─────────────────────── */

const LOCK_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MAX_FAILS = 8;
// ip → { count, at }：at 是窗口起点，count 是窗口内失败次数
const fails = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of fails) if (now - rec.at > LOCK_WINDOW_MS) fails.delete(ip);
}, LOCK_WINDOW_MS).unref();

function clientIp(req) {
  // 只取直连地址：X-Forwarded-For 首段客户端可伪造，拿它当限速键等于没限。
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

export function isLocked(req) {
  const rec = fails.get(clientIp(req));
  return Boolean(rec && rec.count >= LOCK_MAX_FAILS && Date.now() - rec.at <= LOCK_WINDOW_MS);
}

function noteFail(req) {
  const ip = clientIp(req);
  const rec = fails.get(ip);
  if (!rec || Date.now() - rec.at > LOCK_WINDOW_MS) {
    fails.set(ip, { count: 1, at: Date.now() });
    return;
  }
  rec.count += 1;
}

function clearFails(req) {
  fails.delete(clientIp(req));
}

/* ── 账号校验 ────────────────────────────────────────────────────────── */

// 查库验密码。账号不存在也跑一次假散列，让两种情况的耗时接近，
// 不给「这个用户名存不存在」留计时侧信道。
async function authenticate(username, password) {
  const [rows] = await getPool().query(
    "SELECT username, family_id, display_name, pwd_salt, pwd_hash, enabled FROM auth_user WHERE username = ?",
    [username],
  );
  const row = rows[0];
  const salt = row ? row.pwd_salt : Buffer.alloc(16);
  const expected = row ? row.pwd_hash : Buffer.alloc(64);
  const ok = row && row.enabled === 1 && verifyPassword(password, salt, expected);
  if (!ok) {
    scryptSync(password, salt, 64);
    return null;
  }
  return { username: row.username, familyId: row.family_id, displayName: row.display_name };
}

/* ── 登录表单（服务端渲染，零外部资源，静态产物缺失也能登录）─────────── */

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function signInPage(message = "") {
  const note = message
    ? `<p class="note ${message === "ok-signed-out" ? "" : "bad"}">${esc(message)}</p>`
    : "";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>登录 · 宝宝成长日志</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#faf7f2;
         font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:#3d3229; }
  .card { width:min(22rem,90vw); background:#fff; border:1px solid #eee3d6; border-radius:16px;
          padding:2rem; box-shadow:0 8px 24px rgba(93,64,28,.08); }
  h1 { font-size:1.15rem; margin:0 0 .25rem; }
  p.sub { margin:0 0 1.25rem; font-size:.85rem; color:#8a7a68; }
  label { display:block; font-size:.8rem; color:#8a7a68; margin:.75rem 0 .25rem; }
  input { width:100%; box-sizing:border-box; padding:.55rem .7rem; font-size:1rem;
          border:1px solid #e2d5c3; border-radius:10px; background:#fffdf9; color:inherit; }
  input:focus { outline:2px solid #e8b04b; outline-offset:1px; }
  button { width:100%; margin-top:1.25rem; padding:.65rem; font-size:1rem; border:0;
           border-radius:10px; background:#e8b04b; color:#3d2c12; font-weight:600; cursor:pointer; }
  button:hover { background:#dda63e; }
  .note { font-size:.85rem; margin:0 0 1rem; padding:.5rem .7rem; border-radius:8px; }
  .note.bad { background:#fdecec; color:#a33; }
</style>
</head>
<body>
<form class="card" method="post" action="/api/auth/local">
  <h1>宝宝成长日志</h1>
  <p class="sub">家人账号登录 · 账号由管理员发放</p>
  ${note}
  <label for="username">用户名</label>
  <input id="username" name="username" autocomplete="username" required autofocus>
  <label for="password">密码</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">登 录</button>
</form>
</body>
</html>`;
}

/* ── 登录处理：返回描述，由 index.js 组装响应 ─────────────────────────── */

function originAllowed(req) {
  // 浏览器跨站表单 POST 一定带 Origin：在就校验同源，挡 login CSRF。
  // 无 Origin（curl、同源某些老浏览器）放行 —— 本就没有匿名可 CSRF 的价值。
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// 返回 { ok, cookie } | { ok:false, reason:"locked"|"csrf"|"bad" }
export async function handleSignIn(req) {
  if (isLocked(req)) return { ok: false, reason: "locked" };
  if (!originAllowed(req)) return { ok: false, reason: "csrf" };
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 4 * 1024) return { ok: false, reason: "bad" };
    chunks.push(chunk);
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  const username = String(form.get("username") || "").trim().slice(0, 40);
  const password = String(form.get("password") || "");
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(username) || !password) {
    // 格式不对连库都不用查，但同样记一次失败，防爆破字典试格式
    noteFail(req);
    return { ok: false, reason: "bad" };
  }
  let user;
  try {
    user = await authenticate(username, password);
  } catch (error) {
    // 库暂时不可用不该被当成「密码错误」记进锁账本
    console.error("local sign-in db error:", error.message);
    return { ok: false, reason: "storage" };
  }
  if (!user) {
    noteFail(req);
    return { ok: false, reason: "bad" };
  }
  clearFails(req);
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({
    userId: user.username,
    name: user.displayName,
    familyId: user.familyId,
    iat: now,
    exp: now + SESSION_TTL_S,
  });
  return { ok: true, cookie: localCookieHeader(token, req) };
}
