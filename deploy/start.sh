#!/usr/bin/env bash
# 宝宝日志 NAS 裸机 启动 + 看门狗（无 root 方案）
# 配合 crontab 两条目使用：
#   @reboot     /home/YYC3/apps/baby-mochen/start.sh
#   */5 * * * * /home/YYC3/apps/baby-mochen/start.sh
# 逻辑：flock 防并发 → healthz 已通则幂等退出 → 否则以 .env 拉起 dist-server/boot.js
set -u

BASE="/home/YYC3/apps/baby-mochen"
NODE_BIN="/home/YYC3/apps/node/bin/node"
LOG="$BASE/app.log"

exec 9>/tmp/baby-mochen.lock
flock -n 9 || exit 0

# 配置必须就位（.env 权限 600，内含 DATABASE_URL 与 AUTH_LOCAL_SECRET）
if [ ! -f "$BASE/.env" ]; then
  echo "$(date '+%F %T') FATAL: $BASE/.env 不存在" >> "$LOG"
  exit 1
fi
set -a; . "$BASE/.env"; set +a
# 端口约定 3030 起；NAS 上 3000/3100 已被既有容器占用，故用 3030
PORT="${PORT:-3030}"

# 服务已活着就不动（看门狗幂等核心）
if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/healthz"; then
  exit 0
fi

cd "$BASE" || exit 1
nohup "$NODE_BIN" dist-server/boot.js >> "$LOG" 2>&1 &
echo "$(date '+%F %T') started pid $!" >> "$LOG"
