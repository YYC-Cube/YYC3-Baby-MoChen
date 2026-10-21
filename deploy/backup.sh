#!/usr/bin/env bash
# 数据库每日备份：mysqldump 单事务全库 → gzip → 本地轮转保留 → 可选 rsync 异地
# 兼容 MySQL 8.x 与 MariaDB 10.x（参数均取两者交集）
# 凭证：从本脚本同目录 .env 的 DATABASE_URL 解析，明文不落第二处
#
# 用法：BACKUP_DIR=/var/backups/baby-mochen ./backup.sh
# 定时：crontab -e
#   0 3 * * * /opt/baby-mochen/deploy/backup.sh >> /var/log/bgl-backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

BACKUP_DIR="${BACKUP_DIR:-/var/backups/baby-mochen}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
# 异地备份（可选）：user@host:/path 形式，需 SSH 免密；推荐落地 NAS（yyc3-45）
BACKUP_REMOTE="${BACKUP_REMOTE:-}"

# 从 DATABASE_URL 解析连接参数（mysql://user:pass@host:port/db）
URL_REGEX='^mysql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/(.+)$'
[[ "${DATABASE_URL:-}" =~ $URL_REGEX ]] || { echo "DATABASE_URL 未配置或格式不符" >&2; exit 1; }
DB_USER="${BASH_REMATCH[1]}"; DB_PASS="${BASH_REMATCH[2]}"
DB_HOST="${BASH_REMATCH[3]}"; DB_PORT="${BASH_REMATCH[4]}"; DB_NAME="${BASH_REMATCH[5]}"

STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
OUT="${BACKUP_DIR}/${DB_NAME}-${STAMP}.sql.gz"

MYSQL_PWD="${DB_PASS}" mysqldump \
  -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  --single-transaction --triggers \
  "${DB_NAME}" | gzip -9 > "${OUT}"
echo "[$(date '+%F %T')] dump → ${OUT} ($(du -h "${OUT}" | cut -f1))"

if [[ -n "${BACKUP_REMOTE}" ]]; then
  rsync -az "${OUT}" "${BACKUP_REMOTE}/"
  echo "[$(date '+%F %T')] rsync → ${BACKUP_REMOTE}"
fi

find "${BACKUP_DIR}" -name "${DB_NAME}-*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date '+%F %T')] rotated (retain ${RETAIN_DAYS}d)"
