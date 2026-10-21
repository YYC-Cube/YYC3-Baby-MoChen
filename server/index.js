// 全栈形态的服务端：托管前端静态产物 + 一组家庭共享同步接口。
// 只用 Node 内置的 http/fs，加一个纯 JS 的 mysql2，满足平台「自包含、
// 不做 npm install、监听 3000」的运行契约。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { authConfigured, authInfo, familyOfSession, sessionOf } from "./auth.js";
import {
  deletePhoto,
  ensureSchema,
  getPhoto,
  hasDatabase,
  isConfigured,
  putPhoto,
  readState,
  writeState
} from "./db.js";
import { authorizeUrl, completeCallback, cookieHeader, kimiConfigured } from "./kimi.js";

const PORT = Number(process.env.PORT) || 3000;

// 简陋但够用的限流：写（PUT/POST/DELETE）每分钟 60 次、读 300 次。
// 键优先用会话 userId —— X-Forwarded-For 首段是客户端可伪造的，
// 按 IP 限既会被绕过、也可能把共用出口的一家人误伤成一个人。
// 内存桶，重启清零 —— 防的是脚本刷库，不是精确计量。
const writeBudget = (() => {
  const buckets = new Map();
  const WINDOW_MS = 60 * 1000;
  setInterval(() => buckets.clear(), WINDOW_MS).unref();
  function key(req, session) {
    if (session && session.userId) return `u:${session.userId}`;
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return `ip:${fwd || req.socket.remoteAddress || "unknown"}`;
  }
  return {
    allow(req, session) {
      const write = req.method !== "GET" && req.method !== "HEAD";
      const limit = write ? 60 : 300;
      const id = `${key(req, session)}:${write ? "w" : "r"}`;
      const used = (buckets.get(id) || 0) + 1;
      buckets.set(id, used);
      return used <= limit;
    },
  };
})();

// 打包后 boot.js 在 dist-server/，前端产物在同级的 dist/。
// 两种目录布局都试一遍，本地直接 node server/index.js 也跑得起来。
const HERE = resolve(fileURLToPath(new URL(".", import.meta.url)));
const STATIC_CANDIDATES = [
  process.env.STATIC_DIR && resolve(process.env.STATIC_DIR),
  resolve(HERE, "../dist"),
  resolve(HERE, "./dist"),
].filter(Boolean);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

let staticRoot = null;
async function findStaticRoot() {
  if (staticRoot) return staticRoot;
  for (const dir of STATIC_CANDIDATES) {
    try {
      const info = await stat(join(dir, "index.html"));
      if (info.isFile()) {
        staticRoot = dir;
        return staticRoot;
      }
    } catch {
      // 试下一个候选目录
    }
  }
  return null;
}

function send(res, status, body, headers = {}) {
  // API 与照片字节都走这里：统一 nosniff，防止把用户上传内容嗅探成可执行类型。
  res.writeHead(status, { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers });
  res.end(body);
}

// 不打算读的请求体必须排空。直接回应而不消费上行数据，客户端那边
// 会一直卡在「还没发完」上（写满 TCP 窗口后就再也发不动了），
// 表现是浏览器里这个请求永远 pending。拒绝得越早，越要记得排空。
function drain(req) {
  req.resume();
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { "content-type": "application/json; charset=utf-8" });
}

// 要顺带下发 set-cookie 之类响应头时用这个。
async function readBody(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error("payload-too-large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// 家庭标识。接了真实 auth 时以会话为准：家庭 id 跟着账号走，
// 前端说自己是谁一概不听，否则改个 query 就能读到别人家的记录。
// 没接 auth（纯演示部署）时才退回前端带的值，默认公用的演示家庭。
function familyOf(url, session) {
  const raw = (url.searchParams.get("family") || "demo").trim();
  const fallback = /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : "demo";
  if (!authConfigured()) return fallback;
  // 登录了走账号自己的家庭，没登录只能看演示家庭那一行。
  return familyOfSession(session, "demo");
}

async function handleApi(req, res, url) {
  const session = await sessionOf(req);

  // 会话查询不碰数据库，没配库时也要能答，否则前端连「有没有登录」都问不到。
  if (url.pathname === "/api/auth/session" && req.method === "GET") {
    return sendJson(res, 200, { ...authInfo(), user: session });
  }
  // 登录入口：跳到授权页。放在服务端做，前端就不必知道 APP_ID 和
  // 授权地址，凭据一直留在这一侧。
  if (url.pathname === "/api/auth/signin" && req.method === "GET") {
    if (!kimiConfigured()) return sendJson(res, 404, { error: "sign-in-unavailable" });
    return send(res, 302, "", { location: authorizeUrl(req) });
  }

  // 授权后的回调：换 token、验签、拉资料，成功就把会话 cookie 种下并回首页。
  if (url.pathname === "/api/oauth/callback" && req.method === "GET") {
    if (!kimiConfigured()) return sendJson(res, 404, { error: "sign-in-unavailable" });
    // 用户在授权页点了拒绝：这不是错误，安静地回首页即可。
    if (url.searchParams.get("error")) return send(res, 302, "", { location: "/" });
    const code = url.searchParams.get("code");
    if (!code) return sendJson(res, 400, { error: "missing-code" });
    try {
      const token = await completeCallback(code, url.searchParams.get("state"), req);
      return send(res, 302, "", {
        // signin=ok 告诉前端「会话刚种下，正在生效」：它会等会话问到再渲染，
        // 而不是先把落地页或未登录的样子闪一遍。
        location: "/?signin=ok",
        "set-cookie": cookieHeader(token, req),
      });
    } catch (error) {
      console.error("oauth callback failed:", error.message);
      // 失败也回首页：停在一个 JSON 错误页上，用户除了后退没有别的出路。
      // 首页会显示成未登录，再点一次登录就是重试。
      // why 带上失败发生在哪一步（state/token-状态码/jwks/verify/network），
      // 前端 toast 出来，排障不用猜。
      const msg = String((error && error.message) || "");
      const why = msg.startsWith("bad state") ? "state"
        : msg.startsWith("token exchange") ? `token-${msg.slice("token exchange".length).trim()}`
          : msg.startsWith("jwks") ? "jwks"
            : msg.startsWith("access token invalid") ? "verify"
              : "network";
      return send(res, 302, "", { location: `/?signin=failed&why=${encodeURIComponent(why)}` });
    }
  }

  // 退出：清掉本站的会话 cookie。auth 组件那边的登录态由它自己管，
  // 这里只负责让本站忘记这个人。
  if (url.pathname === "/api/auth/signout" && req.method === "POST") {
    drain(req);
    const headers = kimiConfigured() ? { "set-cookie": cookieHeader("", req, { clear: true }) } : {};
    return send(res, 200, JSON.stringify({ ok: true }), { "content-type": "application/json; charset=utf-8", ...headers });
  }

  if (!hasDatabase()) {
    // 没配库时明确告诉前端「服务端存储不可用」，前端会退回本地存储，
    // 而不是把错误当成「数据为空」渲染成一个空相册。
    drain(req);
    return sendJson(res, 503, { error: "storage-unavailable" });
  }
  // 接了 auth 之后，数据接口只认会话：没登录连读都不行。
  // 「体验」走的是纯前端演示，本来就不碰这些接口，所以这里没有
  // 需要向未登录者开放的内容 —— 开一条缝就是把别人家的记录递出去。
  if (authConfigured() && !session) {
    drain(req);
    return sendJson(res, 401, { error: "sign-in-required" });
  }
  if (!writeBudget.allow(req, session)) {
    drain(req);
    return sendJson(res, 429, { error: "too-many-requests" });
  }
  const family = familyOf(url, session);

  if (url.pathname === "/api/state" && req.method === "GET") {
    const row = await readState(family);
    if (!row) return sendJson(res, 200, { revision: 0, payload: null });
    return sendJson(res, 200, row);
  }

  if (url.pathname === "/api/state" && req.method === "PUT") {
    const body = JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString("utf8"));
    const revision = Number(body.revision);
    if (!Number.isInteger(revision) || revision < 0) {
      return sendJson(res, 400, { error: "bad-revision" });
    }
    // 记在谁名下同样以会话为准，前端报上来的 memberId 只在没接 auth 时可信。
    const author = session ? session.userId : body.memberId;
    const result = await writeState(family, body.payload, revision, author);
    if (!result.ok) return sendJson(res, 409, { error: "conflict", current: result.current });
    return sendJson(res, 200, { revision: result.revision });
  }

  const photoMatch = url.pathname.match(/^\/api\/photo\/([A-Za-z0-9_.-]{1,128})$/);
  if (photoMatch) {
    const blobId = photoMatch[1];
    if (req.method === "GET") {
      const row = await getPhoto(family, blobId);
      if (!row) return send(res, 404, "not found");
      // 白名单兜底：白名单外的存量 mime 一律按二进制流下发
      //（配合 nosniff 只能下载不能执行），杜绝把 text/html 原样回传被浏览器当页面渲染。
      const mime = PHOTO_MIME.has(row.mime) ? row.mime : "application/octet-stream";
      // 位图内容不会变，可以让浏览器长期缓存。
      return send(res, 200, row.bytes, {
        "content-type": mime,
        "cache-control": "public, max-age=31536000, immutable",
      });
    }
    if (req.method === "PUT") {
      // 上传方声明的 Content-Type 不可信：入库前按白名单校验，
      // 拒得越早越要排空请求体，否则客户端会卡在上行写满的 TCP 窗口上。
      const mime = String(req.headers["content-type"] || "image/jpeg").split(";")[0].trim().toLowerCase();
      if (!PHOTO_MIME.has(mime)) {
        drain(req);
        return sendJson(res, 415, { error: "unsupported-media-type" });
      }
      const bytes = await readBody(req, 12 * 1024 * 1024);
      await putPhoto(family, blobId, mime, bytes);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      await deletePhoto(family, blobId);
      return sendJson(res, 200, { ok: true });
    }
  }

  drain(req);
  return sendJson(res, 404, { error: "not-found" });
}

async function serveStatic(req, res, url) {
  const root = await findStaticRoot();
  if (!root) return send(res, 500, "static assets are missing");

  let wanted;
  try {
    wanted = decodeURIComponent(url.pathname);
  } catch {
    // 畸形的百分号编码是客户端的错，不该记成服务端 500。
    return send(res, 400, "bad request");
  }
  // 路径穿越防护：拼接后必须仍在站点根目录之内。
  const target = resolve(join(root, normalize(wanted)));
  const inside = target === root || target.startsWith(root + sep);
  let filePath = inside ? target : root;

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // 单页应用：认不出的路径回 index.html 交给前端路由；
    // 但带扩展名的请求明显是在要一个真实文件，缺了就老实报 404，
    // 免得图片加载失败时拿到一份 HTML。
    if (extname(filePath)) return send(res, 404, "not found");
    filePath = join(root, "index.html");
  }

  const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
  // 带哈希的构建产物可以长缓存，index.html 必须每次校验，否则发版后打不开新版本。
  const cache = filePath.endsWith("index.html")
    ? "no-cache"
    : "public, max-age=31536000, immutable";
  res.writeHead(200, { "content-type": type, "cache-control": cache });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/healthz") return sendJson(res, 200, { ok: true, db: hasDatabase() });
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed");
    return await serveStatic(req, res, url);
  } catch (error) {
    if (error && error.message === "payload-too-large") return sendJson(res, 413, { error: "too-large" });
    console.error("request failed:", error);
    return sendJson(res, 500, { error: "internal" });
  }
});

async function main() {
  if (isConfigured()) {
    try {
      await ensureSchema();
      console.log("database ready");
    } catch (error) {
      // 建表失败不拦启动：静态页面照样要能打开，接口会自己报 503。
      console.error("schema init failed:", error.message);
    }
  } else {
    console.warn("DATABASE_URL not set — running without shared storage");
  }
  if (isConfigured() && !hasDatabase()) {
    console.warn("shared storage is unavailable — the app will fall back to per-device storage");
  }
  console.log(
    authConfigured()
      ? `auth ready (${authInfo().provider})`
      : "AUTH_HEADER_USER / AUTH_JWKS_URL not set — running without sign-in",
  );
  server.listen(PORT, () => console.log(`listening on ${PORT}`));
}

main();
