// 上传的照片体积大，放 IndexedDB；照片的元数据和记录一起放 localStorage。
const DB_NAME = "baby-growth-log";
const STORE = "photo-blobs";

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no-indexeddb"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(mode, work) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = work(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(result && result.value !== undefined ? result.value : undefined);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export async function putBlob(id, blob) {
  try {
    await run("readwrite", (store) => store.put(blob, id));
    return true;
  } catch {
    return false;
  }
}

export async function loadBlobs(ids) {
  const out = new Map();
  if (!ids.length) return out;
  try {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) out.set(id, request.result);
        };
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return out;
  }
  return out;
}

export async function dropBlob(id) {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // 删不掉也不影响界面，元数据已经移除。
  }
}
