// 服务端的会话解析。
//
// 这个应用不实现账号体系（不存密码、不管找回），只消费外部 auth 的结果。
// 三种接法，按顺序探测，一个都没配就是「没有接入登录」：
//
//   kimi 访客登录   平台下发 APP_ID / APP_SECRET / KIMI_AUTH_URL / KIMI_OPEN_URL
//                   时自动启用，走标准 OAuth 授权码流程，实现在 server/kimi.js。
//
//   AUTH_HEADER_USER  反向代理/网关校验完凭证后，把用户信息塞进请求头
//                     （如 oauth2-proxy 的 X-Forwarded-User）。填头名即可启用。
//   AUTH_JWKS_URL     前端带 Bearer JWT，服务端从该地址拉 JWKS 验签
//                     （RS256 / ES256 / ES384 / ES512，公钥缓存 10 分钟）。
//
// 另外两个：
//   AUTH_SIGNIN_URL   登录入口地址，前端点「登录」时跳过去
//   AUTH_FAMILY_CLAIM 用哪个字段当家庭 id（默认 family_id），
//                     用于把一家人的数据放进同一行
//
// 会话解析失败一律当作未登录，绝不放行：宁可让人重新登录，
// 也不能把别人家的记录发出去。
import { COOKIE_NAME, fetchJwks, kimiConfigured, readCookie, verifyJws, verifySession } from "./kimi.js";
import { fromLocal, localConfigured } from "./local.js";

const HEADER_USER = process.env.AUTH_HEADER_USER || "";
const HEADER_NAME = process.env.AUTH_HEADER_NAME || "";
const HEADER_EMAIL = process.env.AUTH_HEADER_EMAIL || "";
const HEADER_FAMILY = process.env.AUTH_HEADER_FAMILY || "";
const JWKS_URL = process.env.AUTH_JWKS_URL || "";
const SIGNIN_URL = process.env.AUTH_SIGNIN_URL || "";
const FAMILY_CLAIM = process.env.AUTH_FAMILY_CLAIM || "family_id";

export function authConfigured() {
  return Boolean(kimiConfigured() || HEADER_USER || JWKS_URL || localConfigured());
}

// 前端要知道「有没有登录入口」，据此决定登录按钮是可点还是给出说明。
// kimi 访客登录的入口固定是本站的 /api/auth/signin（它再 302 去授权页），
// 这样前端不需要知道 APP_ID 和授权地址，凭据始终留在服务端。
// 自建账号的入口是本站的 /api/auth/local（服务端渲染的登录表单）。
export function authInfo() {
  if (kimiConfigured()) return { provider: "kimi", signInUrl: "/api/auth/signin" };
  if (localConfigured()) return { provider: "local", signInUrl: "/api/auth/local" };
  if (HEADER_USER) return { provider: "header", signInUrl: SIGNIN_URL || null };
  if (JWKS_URL) return { provider: "jwt", signInUrl: SIGNIN_URL || null };
  return { provider: null, signInUrl: null };
}

// kimi 会话：cookie 里那个由本站签发的 JWT。
function fromKimi(req) {
  if (!kimiConfigured()) return null;
  const claims = verifySession(readCookie(req, COOKIE_NAME));
  if (!claims) return null;
  return {
    userId: String(claims.userId),
    name: typeof claims.name === "string" ? claims.name : "",
    email: "",
    avatar: typeof claims.avatar === "string" ? claims.avatar : "",
    // 访客登录不带家庭概念：每个账号先落到自己的家庭，
    // 由 familyOfSession 统一推导，这里不编造一个 id。
    familyId: "",
  };
}

function pick(headers, name) {
  if (!name) return "";
  const value = headers[name.toLowerCase()];
  return typeof value === "string" ? value.trim() : "";
}

function fromHeaders(headers) {
  const userId = pick(headers, HEADER_USER);
  if (!userId) return null;
  return {
    userId,
    name: pick(headers, HEADER_NAME),
    email: pick(headers, HEADER_EMAIL),
    familyId: pick(headers, HEADER_FAMILY),
  };
}

function decodeSegment(segment) {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

// JWT 分支：三段结构、签名、exp 过期都由 verifyToken / verifyJws 把关，
// 这里只负责取出身份字段。
async function fromBearer(headers) {
  const raw = pick(headers, "authorization");
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let claims;
  try {
    claims = decodeSegment(parts[1]);
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object") return null;
  if (!(await verifyToken(token))) return null;
  const userId = String(claims.sub || claims.user_id || "").trim();
  if (!userId) return null;
  return {
    userId,
    name: typeof claims.name === "string" ? claims.name : "",
    email: typeof claims.email === "string" ? claims.email : "",
    familyId: typeof claims[FAMILY_CLAIM] === "string" ? claims[FAMILY_CLAIM] : "",
  };
}

let jwksKeys = null;
let jwksAt = 0;

// 验签：从 AUTH_JWKS_URL 拉公钥，验 Bearer JWT 签名
//（RS256 / ES256 / ES384 / ES512，实现见 kimi.js 的 verifyJws，含 exp 校验）。
// 公钥缓存 10 分钟；拉不到 JWKS 或验不过一律 false —— 未验签的 token
// 等于没有鉴权，放行比不登录更危险。
async function verifyToken(token) {
  try {
    if (!jwksKeys || Date.now() - jwksAt >= 10 * 60 * 1000) {
      jwksKeys = await fetchJwks(JWKS_URL);
      jwksAt = Date.now();
    }
  } catch (error) {
    console.error("jwt jwks fetch failed:", error.message);
    jwksKeys = null;
    return false;
  }
  return Boolean(verifyJws(token, jwksKeys));
}

export async function sessionOf(req) {
  if (!authConfigured()) return null;
  const byKimi = fromKimi(req);
  if (byKimi) return byKimi;
  const byLocal = fromLocal(req);
  if (byLocal) return byLocal;
  const headers = req.headers || {};
  const byHeader = fromHeaders(headers);
  if (byHeader) return byHeader;
  return fromBearer(headers);
}

// 数据存哪一行：登录用户给的家庭 id 优先，其次用「个人家庭」（每人一行），
// 未登录则是公用的演示家庭。这样未登录看到的示例数据和真实数据永不同库。
export function familyOfSession(session, fallback) {
  if (!session) return fallback;
  const wanted = (session.familyId || `u-${session.userId}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return wanted || fallback;
}
