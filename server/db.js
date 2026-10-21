// 数据访问层。平台只分配空库，建表是应用自己的事，
// 所以启动时先把 schema 补齐（CREATE TABLE IF NOT EXISTS）。
import mysql from "mysql2/promise";

let pool = null;
// schema 建成功才算「存储真的可用」。只看 DATABASE_URL 存在是不够的：
// 连接串配了但库连不上时，接口应该明确回落而不是抛 500。
let storageReady = false;

export function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasDatabase() {
  return storageReady;
}

export function getPool() {
  if (!pool) {
    if (!isConfigured()) throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

// 照片位图允许的类型。上传方声明的 Content-Type 不可信：写入前按这份白名单
// 校验，读取时也用它兜底，防止把 text/html 之类原样回传被浏览器当页面执行。
export const PHOTO_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// 一个家庭一行，整份状态存成 JSON。
// 记录条数不大（一天几十条），整份读写比拆表简单得多，
// 也天然避免多人同时改不同字段时的合并问题 —— 冲突用 revision 挡。
const SCHEMA = `
CREATE TABLE IF NOT EXISTS family_state (
  family_id   VARCHAR(64)  NOT NULL,
  revision    BIGINT       NOT NULL DEFAULT 0,
  payload     LONGTEXT     NOT NULL,
  updated_by  VARCHAR(64)  NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id)
)`;

// 照片位图单独一张表：BLOB 和状态分开，读状态时不会顺带把几 MB 图拖出来。
const PHOTO_SCHEMA = `
CREATE TABLE IF NOT EXISTS family_photo (
  family_id   VARCHAR(64)  NOT NULL,
  blob_id     VARCHAR(128) NOT NULL,
  mime        VARCHAR(64)  NOT NULL DEFAULT 'image/jpeg',
  bytes       LONGBLOB     NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id, blob_id)
)`;

// 自建账号表（server/local.js）：密码只存 scrypt 派生值 + 盐，绝不明文。
const USER_SCHEMA = `
CREATE TABLE IF NOT EXISTS auth_user (
  username     VARCHAR(40)   NOT NULL,
  family_id    VARCHAR(64)   NOT NULL,
  display_name VARCHAR(40)   NOT NULL DEFAULT '',
  pwd_salt     VARBINARY(16) NOT NULL,
  pwd_hash     VARBINARY(64) NOT NULL,
  enabled      TINYINT       NOT NULL DEFAULT 1,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username)
)`;

export async function ensureSchema() {
  const db = getPool();
  await db.query(SCHEMA);
  await db.query(PHOTO_SCHEMA);
  await db.query(USER_SCHEMA);
  storageReady = true;
}

export async function readState(familyId) {
  const [rows] = await getPool().query(
    "SELECT revision, payload, updated_by, updated_at FROM family_state WHERE family_id = ?",
    [familyId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    revision: Number(row.revision),
    payload: JSON.parse(row.payload),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// 乐观并发：调用方必须带上自己读到的 revision。
// 对不上说明别人先存了，返回 conflict 让前端先拉再合，避免互相覆盖。
export async function writeState(familyId, payload, expectedRevision, updatedBy) {
  const db = getPool();
  const text = JSON.stringify(payload);
  if (expectedRevision === 0) {
    try {
      await db.query(
        "INSERT INTO family_state (family_id, revision, payload, updated_by) VALUES (?, 1, ?, ?)",
        [familyId, text, updatedBy || null],
      );
      return { ok: true, revision: 1 };
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") {
        const current = await readState(familyId);
        return { ok: false, conflict: true, current };
      }
      throw error;
    }
  }
  const [result] = await db.query(
    "UPDATE family_state SET revision = revision + 1, payload = ?, updated_by = ? WHERE family_id = ? AND revision = ?",
    [text, updatedBy || null, familyId, expectedRevision],
  );
  if (result.affectedRows === 0) {
    const current = await readState(familyId);
    return { ok: false, conflict: true, current };
  }
  return { ok: true, revision: expectedRevision + 1 };
}

export async function putPhoto(familyId, blobId, mime, bytes) {
  await getPool().query(
    "REPLACE INTO family_photo (family_id, blob_id, mime, bytes) VALUES (?, ?, ?, ?)",
    [familyId, blobId, mime, bytes],
  );
}

export async function getPhoto(familyId, blobId) {
  const [rows] = await getPool().query(
    "SELECT mime, bytes FROM family_photo WHERE family_id = ? AND blob_id = ?",
    [familyId, blobId],
  );
  return rows.length ? rows[0] : null;
}

export async function deletePhoto(familyId, blobId) {
  await getPool().query("DELETE FROM family_photo WHERE family_id = ? AND blob_id = ?", [familyId, blobId]);
}
