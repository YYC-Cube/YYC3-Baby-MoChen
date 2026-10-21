// 真实登录的接入层。
//
// 这个应用自己不做账号体系：不存密码、不发 token、不管找回。
// 登录由外部的 auth 组件负责，这里只定义「怎么问它现在是谁」。
// 两种接法，探测顺序如下：
//
//   1. 注入式 —— 页面在挂载 React 之前把一个对象放到 window.BABY_LOG_AUTH 上。
//      静态部署（没有服务端）也能用这条，适合把 auth 组件的 SDK 直接引在
//      index.html 里。契约见下面的 AuthProvider。
//   2. 服务端会话 —— 全栈部署时由服务端解析请求里的凭证，
//      前端读 /api/auth/session 拿结果。凭证怎么校验是服务端的事
//      （server/auth.js），前端不碰 token。
//
// 两条都没有时应用停在未登录状态：示例数据照常展示，登录按钮会说明
// 「还没有接入登录组件」，而不是假装登录成功 —— 假装登录会让人以为
// 记的东西已经进了自己的账号。
//
// AuthProvider 契约（注入式要实现的全部内容）：
//   getSession(): Promise<User | null>     当前是谁，没登录给 null
//   signIn(): Promise<User | null>         触发登录流程（弹窗/跳转）
//   signOut(): Promise<void>               退出
//   subscribe(fn): () => void              会话变化时回调，返回取消订阅
// User: { userId: string, name?: string, email?: string, familyId?: string, avatar?: string }
// 其中 userId 是唯一必需字段：它决定「这是谁」，其余都只用于显示。


function injected() {
  const provider = typeof window !== "undefined" ? window.BABY_LOG_AUTH : null;
  return provider && typeof provider.getSession === "function" ? provider : null;
}

// 服务端返回的用户对象只信任这几个字段，其余一概不带进状态：
// 多余字段会被一起同步给家庭里的其他人，凭证之类的东西不该走这条路。
function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const userId = String(raw.userId || raw.id || raw.sub || "").trim();
  if (!userId) return null;
  return {
    userId,
    name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "",
    email: typeof raw.email === "string" ? raw.email.slice(0, 120) : "",
    familyId: typeof raw.familyId === "string" ? raw.familyId.slice(0, 64) : "",
    avatar: typeof raw.avatar === "string" ? raw.avatar.slice(0, 400) : "",
  };
}

let serverAvailable = null;
// 服务端给出的登录入口地址，读会话时一并拿到，点登录时直接用。
let serverSignInUrl = null;

// 服务端是否挂了 auth。静态产物里 __SHARED_BACKEND__ 是编译期的 false，
// 下面这些函数体连同接口地址一起被摇掉，产物里不会留下任何服务端痕迹 ——
// 静态站没有服务端，留着字符串只会让人以为它会去请求。
async function serverSession() {
  if (!__SHARED_BACKEND__) {
    serverAvailable = false;
    return null;
  }
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    if (!response.ok) {
      serverAvailable = false;
      return null;
    }
    const body = await response.json();
    // provider 字段说明服务端那边到底有没有配 auth 组件。
    // 没配的话「未登录」是常态，不该把登录按钮点亮。
    serverAvailable = Boolean(body && body.provider);
    serverSignInUrl = (body && body.signInUrl) || null;
    return normalizeUser(body && body.user);
  } catch {
    serverAvailable = false;
    return null;
  }
}

// 应用启动时问一次：现在有没有可用的登录方式、当前是谁。
export async function readSession() {
  const provider = injected();
  if (provider) {
    try {
      return { available: true, kind: "injected", user: normalizeUser(await provider.getSession()) };
    } catch {
      return { available: true, kind: "injected", user: null };
    }
  }
  const user = await serverSession();
  return { available: Boolean(serverAvailable), kind: "server", user };
}

// 触发登录。注入式由 provider 自己决定弹窗还是跳转；
// 服务端式跳到服务端给的登录入口（由接入的 auth 组件提供，
// 授权完成回到本站时带着会话凭证，应用启动时自然读到）。
export async function startSignIn() {
  const provider = injected();
  if (provider && typeof provider.signIn === "function") {
    return normalizeUser(await provider.signIn());
  }
  if (__SHARED_BACKEND__ && serverAvailable && serverSignInUrl) {
    // OAuth 要整页跳走（先去授权页，再由服务端回调把人送回来），
    // 不能用 fetch —— 授权页得让用户真的看见。
    window.location.assign(serverSignInUrl);
  }
  return null;
}

export async function endSignOut() {
  const provider = injected();
  if (provider && typeof provider.signOut === "function") {
    try {
      await provider.signOut();
    } catch {
      // provider 退出失败不影响本地回到未登录状态
    }
    return;
  }
  if (!__SHARED_BACKEND__ || !serverAvailable) return;
  try {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
  } catch {
    // 同上
  }
}

// 会话在应用之外变化时（另一个标签页退出、token 过期）要能跟上。
export function subscribeSession(handler) {
  const provider = injected();
  if (provider && typeof provider.subscribe === "function") {
    const off = provider.subscribe((raw) => handler(normalizeUser(raw)));
    return typeof off === "function" ? off : () => {};
  }
  return () => {};
}
