// 家庭账号管理 CLI（配合 server/local.js 的自建账号体系）。
//
// 用法：
//   node scripts/user.mjs add <用户名> <家庭ID> [显示名]   # 密码走 BGL_USER_PWD 环境变量
//   node scripts/user.mjs passwd <用户名>                  # 同上
//   node scripts/user.mjs list
//   node scripts/user.mjs enable|disable|rm <用户名>
//
// 密码不进命令行参数（会被 shell 历史记录），统一从环境变量读：
//   BGL_USER_PWD='...' node scripts/user.mjs add mama mochen 妈妈
//
// 前置：DATABASE_URL 已配置且库可达（ensureSchema 的建表逻辑在服务端
// 启动时执行过；本脚本只读写，不建表 —— 表不存在时先启动一次服务）。
import { getPool } from "../server/db.js";
import { hashPassword } from "../server/local.js";

const [, , command, ...args] = process.argv;

function die(message) {
  console.error(`错误: ${message}`);
  console.error("用法: node scripts/user.mjs <add|passwd|list|enable|disable|rm> ...");
  console.error("密码统一走环境变量 BGL_USER_PWD，避免留在 shell 历史里。");
  process.exit(1);
}

function readPassword() {
  const pwd = process.env.BGL_USER_PWD || "";
  if (pwd.length < 8) die("BGL_USER_PWD 未设置或不足 8 位（至少 8 位）");
  return pwd;
}

async function main() {
  const db = getPool();

  if (command === "add") {
    const [username, familyId, displayName = ""] = args;
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(username || "")) die("用户名限 1-40 位字母数字_-");
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(familyId || "")) die("家庭ID限 1-64 位字母数字_-");
    const { salt, hash } = hashPassword(readPassword());
    await db.query(
      `REPLACE INTO auth_user (username, family_id, display_name, pwd_salt, pwd_hash, enabled)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username, familyId, displayName.slice(0, 40), salt, hash],
    );
    console.log(`已创建/重置账号: ${username}（家庭 ${familyId}）`);
    return;
  }

  if (command === "passwd") {
    const [username] = args;
    if (!username) die("缺少用户名");
    const { salt, hash } = hashPassword(readPassword());
    const [result] = await db.query(
      "UPDATE auth_user SET pwd_salt = ?, pwd_hash = ? WHERE username = ?",
      [salt, hash, username],
    );
    if (!result.affectedRows) die(`账号不存在: ${username}`);
    console.log(`已更新密码: ${username}`);
    return;
  }

  if (command === "list") {
    const [rows] = await db.query(
      "SELECT username, family_id, display_name, enabled, created_at FROM auth_user ORDER BY created_at",
    );
    if (!rows.length) {
      console.log("（还没有账号，用 add 命令创建）");
      return;
    }
    for (const row of rows) {
      console.log(
        `${row.enabled ? "✓" : "✗"} ${row.username.padEnd(16)} 家庭=${row.family_id.padEnd(16)} ${row.display_name || "-"} （${row.created_at.toISOString?.() || row.created_at}）`,
      );
    }
    return;
  }

  if (command === "enable" || command === "disable") {
    const [username] = args;
    if (!username) die("缺少用户名");
    const [result] = await db.query(
      "UPDATE auth_user SET enabled = ? WHERE username = ?",
      [command === "enable" ? 1 : 0, username],
    );
    if (!result.affectedRows) die(`账号不存在: ${username}`);
    console.log(`已${command === "enable" ? "启用" : "停用"}: ${username}`);
    return;
  }

  if (command === "rm") {
    const [username] = args;
    if (!username) die("缺少用户名");
    const [result] = await db.query("DELETE FROM auth_user WHERE username = ?", [username]);
    if (!result.affectedRows) die(`账号不存在: ${username}`);
    console.log(`已删除: ${username}（该家庭的数据不受影响）`);
    return;
  }

  die(`未知命令: ${command || "（空）"}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("失败:", error.message);
    process.exit(1);
  });
