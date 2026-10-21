// kimi 访客登录（OAuth 2.0 授权码）。
//
// 平台通过环境变量下发四样配置（全栈站开启平台登录后才有）：
//   APP_ID / APP_SECRET   本站的 OAuth 凭据；APP_SECRET 同时用来签本站会话
//   KIMI_AUTH_URL         授权、换 token、JWKS 的基址
//   KIMI_OPEN_URL         取用户资料的基址
//
// 流程（端点都在本站，前端只点一个「登录」）：
//   1. GET /api/auth/signin   → 302 到 {KIMI_AUTH_URL}/api/oauth/authorize
//   2. GET /api/oauth/callback → code 换 token → JWKS 验签 → 拉资料 →
//      自己签 30 天会话 JWT 放进 HttpOnly cookie，302 回首页
//
// 零第三方依赖：JWKS 验签用 Node 内置 crypto（RS256 / ES256 / ES384 / ES512），
// 本站会话是 HMAC-SHA256 签的 JWT。验签失败一律当未登录，不做放行兜底。
import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "node:crypto";

const APP_ID = process.env.APP_ID || "";
const APP_SECRET = process.env.APP_SECRET || "";

function trimSlash(value) {
  return (value || "").replace(/\/+$/, "");
}

const AUTH_URL = trimSlash(process.env.KIMI_AUTH_URL || process.env.kimi_AUTH_URL);
const OPEN_URL = trimSlash(process.env.KIMI_OPEN_URL || process.env.kimi_OPEN_URL);

export const COOKIE_NAME = "bgl_sid";
const SESSION_TTL_S = 30 * 24 * 3600;

export function kimiConfigured() {
  return Boolean(APP_ID && APP_SECRET && AUTH_URL && OPEN_URL);
}

/* ── base64url 与签名小工具 ──────────────────────────────────────────── */

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === "string" ? input : JSON.stringify(input));
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function hmac(data) {
  return createHmac("sha256", APP_SECRET).update(data).digest();
}

function signJwt(payload) {
  const data = `${b64urlJson({ alg: "HS256", typ: "JWT" })}.${b64urlJson(payload)}`;
  return `${data}.${b64url(hmac(data))}`;
}

function verifyJwt(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expect = hmac(data);
  const got = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expect.length !== got.length || !timingSafeEqual(expect, got)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object") return null;
  const exp = Number(claims.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  return claims;
}

/* ── 本站会话 cookie ─────────────────────────────────────────────────── */

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    if (pair.slice(0, idx).trim() === name) return pair.slice(idx + 1).trim();
  }
  return "";
}

export function verifySession(token) {
  const claims = verifyJwt(token);
  if (!claims || !claims.userId) return null;
  return claims;
}

// 本地 http 用 Lax；线上跨站回跳需要 None + Secure。
export function cookieHeader(token, req, { clear = false } = {}) {
  const host = String(req.headers.host || "");
  const localhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const parts = [
    `${COOKIE_NAME}=${clear ? "" : token}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${clear ? 0 : SESSION_TTL_S}`,
    localhost ? "SameSite=Lax" : "SameSite=None; Secure",
  ];
  return parts.join("; ");
}

/* ── 当前访问 origin：拼 redirect_uri 用 ─────────────────────────────── */

function originOf(req) {
  // 平台反代把公网域名放在 x-forwarded-host，host 头是内网地址；
  // proto 可能是逗号列表，含 https 即按 https（参考实现同款规则）。
  const protos = String(req.headers["x-forwarded-proto"] || "").split(",").map((s) => s.trim());
  const proto = protos.includes("https") ? "https" : "http";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function callbackUrl(req) {
  return `${originOf(req)}/api/oauth/callback`;
}

/* ── 第一步：授权地址 ────────────────────────────────────────────────── */

// state 里编码 redirect_uri（回调时还原、传给 token 交换），并带 HMAC 签名，
// 防止回调请求被伪造或篡改。
export function authorizeUrl(req) {
  const redirectUri = callbackUrl(req);
  const payload = b64url(redirectUri);
  const state = `${payload}.${b64url(hmac(payload)).slice(0, 24)}`;
  const url = new URL(`${AUTH_URL}/api/oauth/authorize`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);
  return url.toString();
}

function readState(state) {
  const idx = typeof state === "string" ? state.lastIndexOf(".") : -1;
  if (idx <= 0) return null;
  const payload = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  if (b64url(hmac(payload)).slice(0, 24) !== sig) return null;
  try {
    return Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
}

/* ── JWKS：拉取与验签 ────────────────────────────────────────────────── */

// 按 URL 拉一份 JWKS 并校验形状。不做缓存 —— 缓存节奏归调用方定：
// OAuth 回调与 Bearer 验签的刷新窗口不同。
export async function fetchJwks(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`jwks ${response.status}`);
  const body = await response.json();
  if (!body || !Array.isArray(body.keys)) throw new Error("jwks malformed");
  return body.keys;
}

let jwksCache = null;
let jwksAt = 0;

async function jwks() {
  // 缓存 10 分钟：每次回调都拉一遍会把登录拖慢，key 轮换窗口内短缓存足够。
  if (jwksCache && Date.now() - jwksAt < 10 * 60 * 1000) return jwksCache;
  jwksCache = await fetchJwks(`${AUTH_URL}/api/.well-known/jwks.json`);
  jwksAt = Date.now();
  return jwksCache;
}

// 通用 JWS 验签：签名算法由签发方决定，JWKS 里有什么 key 就验什么。
// OAuth 回调的 access_token 与 AUTH_JWKS_URL 的 Bearer JWT 都走这里。
// 平台当前用 ES256（EC key），RS256（RSA key）留作兜底。
export function verifyJws(token, keys) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) return null;
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    return null;
  }
  const digest = { RS256: "RSA-SHA256", ES256: "SHA256", ES384: "SHA384", ES512: "SHA512" }[header && header.alg];
  const kty = { RS256: "RSA", ES256: "EC", ES384: "EC", ES512: "EC" }[header && header.alg];
  if (!digest) return null;
  const key = keys.find((item) => item && item.kty === kty && (!header.kid || item.kid === header.kid));
  if (!key) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
  let ok = false;
  try {
    // JWS 的 EC 签名是 raw R||S（IEEE P1363），Node 默认要 DER，
    // 不指明编码的话 ES256 验签永远失败（实测踩出来的）。
    ok = cryptoVerify(digest, Buffer.from(data), { key: createPublicKey({ key, format: "jwk" }), dsaEncoding: "ieee-p1363" }, signature);
  } catch {
    return null;
  }
  if (!ok) return null;
  const exp = Number(payload && payload.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null;
  return payload;
}

/* ── 第二步：回调完成登录 ────────────────────────────────────────────── */

export async function completeCallback(code, state, req) {
  const redirectUri = readState(state);
  if (!redirectUri) throw new Error("bad state");
  const tokenResp = await fetch(`${AUTH_URL}/api/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code),
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResp.ok) throw new Error(`token exchange ${tokenResp.status}`);
  const { access_token: accessToken } = await tokenResp.json();
  const claims = verifyJws(accessToken, await jwks());
  // 用户字段以签发方为准：user_id 是平台现在的叫法，sub/union_id 是常见别名。
  const subject = claims && (claims.user_id || claims.sub || claims.union_id);
  if (!subject) throw new Error("access token invalid");

  // 资料拉不到不算失败：名字头像只是展示用，身份只认 user_id。
  let profile = {};
  try {
    const profResp = await fetch(`${OPEN_URL}/v1/users/me/profile`, {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    });
    if (profResp.ok) profile = await profResp.json();
  } catch {
    // 忽略，回落到空资料
  }

  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    userId: String(subject),
    name: typeof profile.name === "string" ? profile.name.slice(0, 40) : "",
    avatar: typeof profile.avatar_url === "string" ? profile.avatar_url.slice(0, 400) : "",
    iat: now,
    exp: now + SESSION_TTL_S,
  });
}
