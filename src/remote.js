// 服务端共享存储的客户端。
//
// 这一版有两种运行形态：
//   静态站 —— 没有服务端，状态留在本机 localStorage / IndexedDB，各人看各人的；
//   全栈站 —— 有服务端和数据库，同一个家庭的人看到同一份数据。
// 两种形态跑的是同一套前端代码，靠这里探一次 /healthz 来决定走哪条路。
// 探测失败一律当作「没有服务端」，页面照常可用，不会因为接口挂了而白屏。

const FAMILY_KEY = "baby-growth-log/family/v1";

let ready = null;

export function familyId() {
  try {
    const saved = localStorage.getItem(FAMILY_KEY);
    if (saved) return saved;
  } catch {
    // 读不到就用默认家庭
  }
  return "demo";
}

function withFamily(path) {
  return `${path}${path.includes("?") ? "&" : "?"}family=${encodeURIComponent(familyId())}`;
}

// 只探一次，结果缓存下来：每次读写都探一遍会让本地形态平白多出一堆 404。
export function probe() {
  // 静态产物里这个常量是 false，整个函数体会被摇掉，不会发出任何请求。
  if (!__SHARED_BACKEND__) return Promise.resolve(false);
  if (ready) return ready;
  ready = (async () => {
    try {
      const response = await fetch("/healthz", { cache: "no-store" });
      if (!response.ok) return false;
      const body = await response.json();
      return Boolean(body && body.db);
    } catch {
      return false;
    }
  })();
  return ready;
}

export async function pullState() {
  // 与 probe 同款编译期守卫：静态产物里直接抛错，调用方 catch 后走本地回落，
  // 后面的请求代码会被整体摇掉，静态包里不会出现任何 /api 地址。
  if (!__SHARED_BACKEND__) throw new Error("pull failed: 0");
  const response = await fetch(withFamily("/api/state"), { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error(`pull failed: ${response.status}`);
  return response.json();
}

// 服务端接了登录、而这边还没登录时，写接口会一直回 401。
// 这种情况下再推就是每改一次多打一个 401，所以认一次就不再写了 ——
// 未登录本来也只是在看示例数据，没有需要同步出去的东西。
let writeDenied = false;

// 返回 { ok, revision } 或 { conflict, current }，冲突时调用方决定怎么合。
export async function pushState(payload, revision, memberId) {
  // 静态产物里没有远端可写，直接按「写被拒」返回，调用方本来就在本地落盘。
  if (!__SHARED_BACKEND__) return { ok: false, denied: true };
  if (writeDenied) return { ok: false, denied: true };
  const response = await fetch(withFamily("/api/state"), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ payload, revision, memberId }),
  });
  if (response.status === 401) {
    writeDenied = true;
    return { ok: false, denied: true };
  }
  if (response.status === 409) {
    const body = await response.json();
    return { ok: false, conflict: true, current: body.current };
  }
  if (!response.ok) throw new Error(`push failed: ${response.status}`);
  const body = await response.json();
  return { ok: true, revision: body.revision };
}

// 登录状态变了要重新试：刚才拒绝的是「没登录的我」。
export function resetWriteGate() {
  writeDenied = false;
}

export async function putPhotoBlob(blobId, blob) {
  // 静态产物里照片只存本地 IndexedDB，这里直接按上传失败返回。
  if (!__SHARED_BACKEND__) return false;
  const response = await fetch(withFamily(`/api/photo/${encodeURIComponent(blobId)}`), {
    method: "PUT",
    headers: { "content-type": blob.type || "image/jpeg" },
    credentials: "include",
    body: blob,
  });
  return response.ok;
}

export function photoUrl(blobId) {
  // 静态产物里没有远端照片可展示，返回空串即可；调用点都在 shared 守卫之下，走不到这里。
  if (!__SHARED_BACKEND__) return "";
  return withFamily(`/api/photo/${encodeURIComponent(blobId)}`);
}

export async function dropPhotoBlob(blobId) {
  // 静态产物里没有远端照片可删，直接返回。
  if (!__SHARED_BACKEND__) return;
  try {
    await fetch(withFamily(`/api/photo/${encodeURIComponent(blobId)}`), {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // 删不掉不影响界面，元数据已经移除
  }
}
