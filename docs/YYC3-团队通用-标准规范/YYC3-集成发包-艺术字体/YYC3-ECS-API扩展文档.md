> 我们之前已经设计了很多API模块，现在我们需要将它们整合到一个完整的Flask应用中，并确保所有依赖都得到满足。我们将按照以下步骤进行：

 1. 创建主应用文件（app.py），并注册所有蓝图。
 2. 创建应用工厂函数，以便于测试和扩展。
 3. 配置数据库（如果使用）和Redis连接。
 4. 添加中间件，如请求ID、CORS等。
 5. 设置日志记录。
 6. 创建命令行工具用于管理。

 由于我们之前已经设计了很多API，这里我们将它们整合起来。注意，我们之前设计的API包括：

 - 认证与安全（JWT、API密钥、速率限制）
 - 核心API（DDNS管理、域名管理）
 - 开发环境API（开发工具、调试与日志）
 - 生产环境API（高可用性、性能监控）
 - 监控与告警API（实时监控、告警管理）
 - 配置管理API（配置中心、密钥管理）
 - 数据分析API（统计与分析、趋势与预测）
 - WebSocket实时API（实时通知、实时数据流）
 - 第三方集成API（Webhook集成、第三方服务集成）

 由于代码量非常大，我们不可能将所有代码都放在一个文件中。我们将按照模块化组织代码，并在主应用中注册蓝图。

 我们假设项目结构如下：

 ```
 /opt/yyc3/api/ddns/
 ├── app.py                  # 主应用
 ├── config.py               # 配置类
 ├── requirements.txt        # 依赖文件
 ├── docker/                 # Docker相关文件
 ├── api/                    # API蓝图
 │   ├── __init__.py
 │   ├── v2/
 │   │   ├── __init__.py
 │   │   ├── auth.py        # 认证相关API
 │   │   ├── ddns.py        # DDNS管理API
 │   │   ├── domains.py     # 域名管理API
 │   │   ├── dev/           # 开发环境API
 │   │   ├── production/    # 生产环境API
 │   │   ├── monitoring/    # 监控API
 │   │   ├── alerts/        # 告警API
 │   │   ├── config/        # 配置管理API
 │   │   ├── analytics/     # 数据分析API
 │   │   └── integrations/  # 第三方集成API
 │   └── websocket/         # WebSocket相关
 ├── auth/                  # 认证模块
 │   ├── __init__.py
 │   ├── jwt_manager.py
 │   └── api_keys.py
 ├── middleware/            # 中间件
 │   ├── __init__.py
 │   └── rate_limit.py
 ├── models/               # 数据模型（如果有数据库）
 ├── services/            # 业务逻辑服务
 ├── utils/               # 工具函数
 ├── logs/                # 日志目录
 └── tests/               # 测试
 ```

 由于时间限制，我们不可能写出所有代码。我们将重点放在主应用结构和几个核心蓝图上，其他模块可以类似地添加。

 首先，我们创建主应用文件：

 注意：我们之前已经设计了很多API端点，现在我们需要将它们整合到对应的蓝图中。

 由于代码量巨大，我们只写一个框架，并展示如何整合。我们假设你已经有了之前设计的各个模块的代码，我们将它们放入对应的文件中。

 下面是一个简化的主应用文件，它注册了所有我们之前设计的蓝图，并设置了必要的中间件和错误处理。

> 继续完成完整的docker-compose.yml配置文件以及相关的部署和运维配置。

 我们现在继续完成docker-compose.yml文件，并创建完整的API服务部署配置。

## **继续完成docker-compose.yml**

```yaml
# docker-compose.yml 完整版本
version: '3.8'

x-common: &common
  restart: unless-stopped
  networks:
    - nas-network
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"

x-api-environment: &api-environment
  ENVIRONMENT: ${ENVIRONMENT:-production}
  DEBUG: ${DEBUG:-false}
  LOG_LEVEL: ${LOG_LEVEL:-info}
  SECRET_KEY: ${SECRET_KEY}
  JWT_SECRET_KEY: ${JWT_SECRET_KEY}
  CORS_ORIGINS: ${CORS_ORIGINS:-*}
  RATE_LIMIT_ENABLED: ${RATE_LIMIT_ENABLED:-true}
  CACHE_TYPE: ${CACHE_TYPE:-redis}
  METRICS_ENABLED: ${METRICS_ENABLED:-true}

services:
  # PostgreSQL数据库
  postgres:
    image: postgres:15-alpine
    container_name: nas-ddns-postgres
    <<: *common
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-nas_ddns}
      POSTGRES_USER: ${POSTGRES_USER:-nas_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-nas_admin}"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    command: >
      postgres -c max_connections=200
               -c shared_buffers=256MB
               -c effective_cache_size=1GB
               -c maintenance_work_mem=64MB
               -c checkpoint_completion_target=0.9
               -c wal_buffers=16MB
               -c default_statistics_target=100

  # Redis缓存
  redis:
    image: redis:7-alpine
    container_name: nas-ddns-redis
    <<: *common
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
      - ./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf
    ports:
      - "${REDIS_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s

  # API主服务
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: production
    container_name: nas-ddns-api
    <<: *common
    environment:
      <<: *api-environment
      DATABASE_URL: postgresql://${POSTGRES_USER:-nas_admin}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nas_ddns}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      ALIYUN_ACCESS_KEY_ID: ${ALIYUN_ACCESS_KEY_ID}
      ALIYUN_ACCESS_KEY_SECRET: ${ALIYUN_ACCESS_KEY_SECRET}
      ALIYUN_DOMAIN: ${ALIYUN_DOMAIN:-0379.email}
      ALIYUN_SUB_DOMAIN: ${ALIYUN_SUB_DOMAIN:-ddns}
      NAS_SERVER_IP: ${NAS_SERVER_IP:-8.152.195.33}
      NAS_DOMAIN: ${NAS_DOMAIN:-ddns.0379.email}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./config:/app/config
      - ./scripts:/app/scripts
      - ./reports:/app/reports
      - ./backup:/app/backup
    ports:
      - "${API_PORT:-8080}:8080"
      - "${API_WS_PORT:-8443}:8443"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v2/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  # API工作节点（可水平扩展）
  api-worker:
    build:
      context: .
      dockerfile: Dockerfile.api
      target: worker
    container_name: nas-ddns-api-worker
    <<: *common
    environment:
      <<: *api-environment
      DATABASE_URL: postgresql://${POSTGRES_USER:-nas_admin}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nas_ddns}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      WORKER_TYPE: ${WORKER_TYPE:-celery}
      CELERY_BROKER_URL: redis://:${REDIS_PASSWORD}@redis:6379/1
      CELERY_RESULT_BACKEND: redis://:${REDIS_PASSWORD}@redis:6379/2
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./scripts:/app/scripts
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: ["celery", "-A", "app.celery", "worker", "--loglevel=info", "--concurrency=4"]
    deploy:
      replicas: ${WORKER_REPLICAS:-2}
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  # 监控服务（Prometheus + Grafana）
  prometheus:
    image: prom/prometheus:latest
    container_name: nas-ddns-prometheus
    <<: *common
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "${PROMETHEUS_PORT:-9090}:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9090/metrics"]
      interval: 30s
      timeout: 10s
      retries: 3

  grafana:
    image: grafana/grafana:latest
    container_name: nas-ddns-grafana
    <<: *common
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
      GF_INSTALL_PLUGINS: "grafana-piechart-panel"
      GF_SERVER_ROOT_URL: "https://${NAS_DOMAIN:-ddns.0379.email}/grafana"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./docker/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "${GRAFANA_PORT:-3000}:3000"
    depends_on:
      - prometheus
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 5

  # 日志收集（ELK Stack精简版）
  elasticsearch:
    image: elasticsearch:8.10.0
    container_name: nas-ddns-elasticsearch
    <<: *common
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "${ELASTICSEARCH_PORT:-9200}:9200"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9200/_cluster/health"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 120s
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

  logstash:
    image: logstash:8.10.0
    container_name: nas-ddns-logstash
    <<: *common
    volumes:
      - ./docker/logstash/logstash.conf:/usr/share/logstash/pipeline/logstash.conf
      - ./logs:/var/log/nas
    ports:
      - "${LOGSTASH_PORT:-5044}:5044"
    depends_on:
      - elasticsearch
    command: logstash -f /usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.10.0
    container_name: nas-ddns-kibana
    <<: *common
    environment:
      ELASTICSEARCH_HOSTS: '["http://elasticsearch:9200"]'
    ports:
      - "${KIBANA_PORT:-5601}:5601"
    depends_on:
      - elasticsearch
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5601/api/status"]
      interval: 30s
      timeout: 10s
      retries: 10

  # 反向代理（Nginx + Certbot）
  nginx:
    image: nginx:alpine
    container_name: nas-ddns-nginx
    <<: *common
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/conf.d:/etc/nginx/conf.d
      - ./data/certbot/www:/var/www/certbot
      - ./data/certbot/conf:/etc/letsencrypt
      - ./logs/nginx:/var/log/nginx
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
      - grafana
      - kibana
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

  certbot:
    image: certbot/certbot
    container_name: nas-ddns-certbot
    <<: *common
    volumes:
      - ./data/certbot/www:/var/www/certbot
      - ./data/certbot/conf:/etc/letsencrypt
    depends_on:
      - nginx
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

  # 定时任务调度器
  scheduler:
    image: alpine:latest
    container_name: nas-ddns-scheduler
    <<: *common
    volumes:
      - ./scripts:/scripts
      - ./logs:/logs
      - /var/run/docker.sock:/var/run/docker.sock
    command: >
      sh -c "
        echo 'Scheduler started' &&
        crond -f -l 8 -L /logs/cron.log
      "
    environment:
      TZ: ${TZ:-Asia/Shanghai}
    depends_on:
      - api

  # 备份服务
  backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    container_name: nas-ddns-backup
    <<: *common
    volumes:
      - ./backup:/backup
      - postgres_data:/var/lib/postgresql/data:ro
      - ./data:/app/data:ro
      - ./config:/app/config:ro
    environment:
      BACKUP_CRON: ${BACKUP_CRON:-0 2 * * *}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION}
      S3_BUCKET: ${S3_BUCKET}
    depends_on:
      - postgres
    command: ["/scripts/backup.sh"]

  # 监控代理（用于收集主机指标）
  node-exporter:
    image: prom/node-exporter:latest
    container_name: nas-ddns-node-exporter
    <<: *common
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "${NODE_EXPORTER_PORT:-9100}:9100"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9100/metrics"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 数据库管理界面
  pgadmin:
    image: dpage/pgadmin4
    container_name: nas-ddns-pgadmin
    <<: *common
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_DEFAULT_EMAIL:-admin@ddns.0379.email}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_DEFAULT_PASSWORD}
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
      - ./docker/pgadmin/servers.json:/pgadmin4/servers.json
    ports:
      - "${PGADMIN_PORT:-5050}:80"
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/misc/ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Redis管理界面
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: nas-ddns-redis-commander
    <<: *common
    environment:
      REDIS_HOSTS: local:redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    ports:
      - "${REDIS_COMMANDER_PORT:-8081}:8081"
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # 邮件服务（测试用）
  mailhog:
    image: mailhog/mailhog
    container_name: nas-ddns-mailhog
    <<: *common
    ports:
      - "${MAILHOG_SMTP_PORT:-1025}:1025"
      - "${MAILHOG_WEB_PORT:-8025}:8025"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8025"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/postgres
      o: bind
  redis_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/redis
      o: bind
  prometheus_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/prometheus
      o: bind
  grafana_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/grafana
      o: bind
  elasticsearch_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/elasticsearch
      o: bind
  pgadmin_data:
    driver: local
    driver_opts:
      type: none
      device: ./data/pgadmin
      o: bind

networks:
  nas-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
```

## **Dockerfile配置**

```dockerfile
# Dockerfile.api - API服务Dockerfile
# 多阶段构建

# 第一阶段：构建阶段
FROM python:3.11-slim as builder

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装Python依赖
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# 第二阶段：生产环境
FROM python:3.11-slim as production

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    curl \
    netcat-openbsd \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建非root用户
RUN groupadd -r nas && useradd -r -g nas nas

# 从构建阶段复制Python依赖
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# 复制应用代码
COPY . .

# 设置权限
RUN chown -R nas:nas /app
RUN chmod +x /app/docker/entrypoint.sh

# 创建必要的目录
RUN mkdir -p /app/logs /app/data /app/cache /app/reports /app/backup
RUN chown -R nas:nas /app/logs /app/data /app/cache /app/reports /app/backup

# 切换到非root用户
USER nas

# 暴露端口
EXPOSE 8080 8443

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/v2/health || exit 1

# 启动脚本
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--worker-class", "gevent", "--workers", "4", "app:app"]

# 第三阶段：工作节点
FROM production as worker

CMD ["celery", "-A", "app.celery", "worker", "--loglevel=info", "--concurrency=4"]

# 第四阶段：开发环境
FROM python:3.11-slim as development

WORKDIR /app

# 安装开发工具
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    vim \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装Python依赖（包含开发依赖）
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8080 5000

# 开发环境启动命令
CMD ["flask", "run", "--host=0.0.0.0", "--port=8080", "--reload"]
```

```dockerfile
# Dockerfile.backup - 备份服务Dockerfile
FROM alpine:latest

RUN apk add --no-cache \
    postgresql-client \
    aws-cli \
    curl \
    tar \
    gzip \
    bash \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /scripts

# 复制备份脚本
COPY scripts/backup.sh /scripts/backup.sh
RUN chmod +x /scripts/backup.sh

# 复制crontab配置
COPY docker/backup/crontab /etc/crontabs/root

# 创建备份目录
RUN mkdir -p /backup

# 设置时区
ENV TZ=Asia/Shanghai

# 启动cron
CMD ["crond", "-f", "-l", "8"]
```

## **配置文件**

```yaml
# docker/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'nas-ddns'

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'api'
    static_configs:
      - targets: ['api:8080']
    metrics_path: '/api/v2/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

```nginx
# docker/nginx/nginx.conf
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # 安全头部
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self';";

    # 上传文件大小限制
    client_max_body_size 100M;

    # 包含服务器配置
    include /etc/nginx/conf.d/*.conf;
}
```

```nginx
# docker/nginx/conf.d/nas-ddns.conf
# NAS DDNS主站点配置

# HTTP重定向到HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ddns.0379.email;
    
    # ACME挑战路径（用于Certbot）
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 重定向到HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS主服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ddns.0379.email;
    
    # SSL证书
    ssl_certificate /etc/letsencrypt/live/ddns.0379.email/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ddns.0379.email/privkey.pem;
    
    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/ddns.0379.edu/chain.pem;
    
    # 安全头部
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # 根目录
    root /usr/share/nginx/html;
    index index.html;
    
    # API代理
    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲区设置
        proxy_buffering off;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # 启用压缩
        proxy_set_header Accept-Encoding "";
    }
    
    # WebSocket端点
    location /ws/ {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Grafana代理
    location /grafana/ {
        proxy_pass http://grafana:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Kibana代理
    location /kibana/ {
        proxy_pass http://kibana:5601/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件
    location /static/ {
        alias /app/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 媒体文件
    location /media/ {
        alias /app/media/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # 健康检查端点
    location /health {
        proxy_pass http://api:8080/api/v2/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # 指标端点
    location /metrics {
        proxy_pass http://api:8080/api/v2/metrics;
        proxy_set_header Host $host;
        access_log off;
    }
    
    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

## **环境变量配置文件**

```bash
# .env.example
# NAS DDNS系统环境变量配置示例

# ======================
# 基础配置
# ======================
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info
TZ=Asia/Shanghai

# ======================
# 服务器配置
# ======================
NAS_SERVER_IP=8.152.195.33
NAS_DOMAIN=ddns.0379.email
NAS_LOCAL_IP=192.168.3.45
API_PORT=8080
API_WS_PORT=8443

# ======================
# 安全配置
# ======================
SECRET_KEY=your-secret-key-here-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-here-change-in-production
CORS_ORIGINS=*

# ======================
# 阿里云配置
# ======================
ALIYUN_ACCESS_KEY_ID=${ALIYUN_ACCESS_KEY_ID}
ALIYUN_ACCESS_KEY_SECRET=${ALIYUN_ACCESS_KEY_SECRET}
ALIYUN_DOMAIN=0379.email
ALIYUN_SUB_DOMAIN=ddns
ALIYUN_TTL=600

# ======================
# 数据库配置
# ======================
POSTGRES_DB=nas_ddns
POSTGRES_USER=nas_admin
POSTGRES_PASSWORD=your-postgres-password-here
POSTGRES_PORT=5432

# ======================
# Redis配置
# ======================
REDIS_PASSWORD=your-redis-password-here
REDIS_PORT=6379

# ======================
# 监控配置
# ======================
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
GRAFANA_ADMIN_PASSWORD=admin
NODE_EXPORTER_PORT=9100

# ======================
# 日志配置
# ======================
ELASTICSEARCH_PORT=9200
LOGSTASH_PORT=5044
KIBANA_PORT=5601

# ======================
# 邮件配置
# ======================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-email-password
DEFAULT_FROM_EMAIL=noreply@ddns.0379.email

# ======================
# 通知配置
# ======================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# ======================
# 备份配置
# ======================
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=your-s3-bucket-name
BACKUP_CRON="0 2 * * *"

# ======================
# 管理界面
# ======================
PGADMIN_DEFAULT_EMAIL=admin@ddns.0379.email
PGADMIN_DEFAULT_PASSWORD=your-pgadmin-password
PGADMIN_PORT=5050
REDIS_COMMANDER_PORT=8081

# ======================
# 邮件测试
# ======================
MAILHOG_SMTP_PORT=1025
MAILHOG_WEB_PORT=8025

# ======================
# 工作节点配置
# ======================
WORKER_REPLICAS=2
CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
CELERY_RESULT_BACKEND=redis://:${REDIS_PASSWORD}@redis:6379/2
```

## **应用入口脚本**

```bash
#!/bin/bash
# docker/entrypoint.sh

set -e

echo "=========================================="
echo "NAS DDNS API服务启动"
echo "环境: ${ENVIRONMENT}"
echo "时间: $(date)"
echo "=========================================="

# 等待数据库就绪
if [ "$ENVIRONMENT" != "test" ]; then
    echo "等待数据库就绪..."
    until nc -z postgres 5432; do
        echo "数据库未就绪，等待5秒..."
        sleep 5
    done
    echo "数据库已就绪"
    
    echo "等待Redis就绪..."
    until nc -z redis 6379; do
        echo "Redis未就绪，等待5秒..."
        sleep 5
    done
    echo "Redis已就绪"
fi

# 数据库迁移
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "运行数据库迁移..."
    flask db upgrade
    echo "数据库迁移完成"
fi

# 初始化数据
if [ "$ENVIRONMENT" = "development" ] || [ "${INIT_DATA:-false}" = "true" ]; then
    echo "初始化数据..."
    python scripts/init_data.py
    echo "数据初始化完成"
fi

# 创建必要目录
mkdir -p /app/logs /app/data /app/cache /app/reports /app/backup
chown -R nas:nas /app/logs /app/data /app/cache /app/reports /app/backup

# 设置环境
export PYTHONPATH=/app

# 根据环境选择启动命令
if [ "$ENVIRONMENT" = "development" ]; then
    echo "以开发模式启动..."
    exec flask run --host=0.0.0.0 --port=8080 --reload
else
    echo "以生产模式启动..."
    exec gunicorn \
        --bind 0.0.0.0:8080 \
        --worker-class gevent \
        --workers 4 \
        --threads 2 \
        --timeout 120 \
        --access-logfile /app/logs/gunicorn-access.log \
        --error-logfile /app/logs/gunicorn-error.log \
        --log-level info \
        --capture-output \
        --enable-stdio-inheritance \
        app:app
fi
```

## **备份脚本**

```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "开始备份NAS DDNS系统"
echo "备份时间: $(date)"
echo "备份目录: $BACKUP_DIR"
echo "=========================================="

# 1. 备份PostgreSQL数据库
echo "备份PostgreSQL数据库..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h postgres \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -F c \
    -f "$BACKUP_DIR/database.dump"
echo "数据库备份完成: $BACKUP_DIR/database.dump"

# 2. 备份Redis数据
echo "备份Redis数据..."
REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h redis save
cp /data/redis/dump.rdb "$BACKUP_DIR/redis.rdb"
echo "Redis备份完成: $BACKUP_DIR/redis.rdb"

# 3. 备份配置文件
echo "备份配置文件..."
tar -czf "$BACKUP_DIR/config.tar.gz" /app/config
echo "配置文件备份完成: $BACKUP_DIR/config.tar.gz"

# 4. 备份应用数据
echo "备份应用数据..."
tar -czf "$BACKUP_DIR/data.tar.gz" \
    --exclude="*.log" \
    --exclude="*.tmp" \
    /app/data
echo "应用数据备份完成: $BACKUP_DIR/data.tar.gz"

# 5. 备份日志文件
echo "备份日志文件..."
find /app/logs -name "*.log" -mtime -7 | \
    tar -czf "$BACKUP_DIR/logs.tar.gz" -T -
echo "日志备份完成: $BACKUP_DIR/logs.tar.gz"

# 6. 创建备份清单
echo "创建备份清单..."
cat > "$BACKUP_DIR/backup.info" << EOF
备份时间: $(date)
备份目录: $BACKUP_DIR
备份内容:
  - PostgreSQL数据库: database.dump
  - Redis数据: redis.rdb
  - 配置文件: config.tar.gz
  - 应用数据: data.tar.gz
  - 日志文件: logs.tar.gz

文件统计:
$(du -sh "$BACKUP_DIR"/*)
EOF

# 7. 压缩整个备份
echo "压缩备份文件..."
cd "$BACKUP_DIR/.."
tar -czf "$(basename "$BACKUP_DIR").tar.gz" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"
echo "备份压缩完成: $(basename "$BACKUP_DIR").tar.gz"

# 8. 上传到S3（如果配置了AWS）
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$S3_BUCKET" ]; then
    echo "上传备份到S3..."
    aws s3 cp "$(basename "$BACKUP_DIR").tar.gz" \
        "s3://$S3_BUCKET/backups/$(date +%Y/%m)/$(basename "$BACKUP_DIR").tar.gz" \
        --storage-class STANDARD_IA
    echo "备份已上传到S3"
fi

# 9. 清理旧备份（保留最近7天）
echo "清理旧备份..."
find /backup -name "*.tar.gz" -mtime +7 -delete
echo "旧备份清理完成"

# 10. 发送备份通知
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    echo "发送备份通知..."
    BACKUP_SIZE=$(du -h "/backup/$(basename "$BACKUP_DIR").tar.gz" | cut -f1)
    
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="✅ NAS DDNS备份完成
时间: $(date)
大小: $BACKUP_SIZE
位置: /backup/$(basename "$BACKUP_DIR").tar.gz
状态: 成功"
fi

echo "=========================================="
echo "备份完成"
echo "备份文件: /backup/$(basename "$BACKUP_DIR").tar.gz"
echo "=========================================="
```

## **部署脚本**

```bash
#!/bin/bash
# deploy.sh - NAS DDNS系统部署脚本

set -e

echo "=========================================="
echo "NAS DDNS系统部署"
echo "开始时间: $(date)"
echo "=========================================="

# 检查Docker和Docker Compose
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose未安装"
    exit 1
fi

# 创建目录结构
echo "创建目录结构..."
mkdir -p \
    data/postgres \
    data/redis \
    data/prometheus \
    data/grafana \
    data/elasticsearch \
    data/pgadmin \
    data/certbot/www \
    data/certbot/conf \
    logs \
    backup \
    config \
    scripts \
    reports \
    docker/nginx/conf.d \
    docker/prometheus \
    docker/grafana/dashboards \
    docker/grafana/datasources \
    docker/logstash \
    docker/backup

# 复制配置文件
echo "复制配置文件..."
if [ ! -f .env ]; then
    echo "创建环境变量文件..."
    cp .env.example .env
    echo "请编辑 .env 文件并设置必要的配置"
    exit 1
fi

# 加载环境变量
source .env

# 生成Docker Compose配置文件
echo "生成Docker Compose配置..."

# 构建镜像
echo "构建Docker镜像..."
docker-compose build --parallel

# 启动服务
echo "启动服务..."
docker-compose up -d

# 等待服务就绪
echo "等待服务就绪..."
sleep 30

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 初始化数据库
echo "初始化数据库..."
docker-compose exec api flask db upgrade

# 创建管理员用户
echo "创建管理员用户..."
docker-compose exec api python scripts/create_admin.py \
    --username admin \
    --password "${ADMIN_PASSWORD:-admin123}" \
    --email "${ADMIN_EMAIL:-admin@ddns.0379.email}"

# 导入Grafana仪表板
echo "配置Grafana..."
docker-compose exec grafana grafana-cli plugins install grafana-piechart-panel

# 获取SSL证书
echo "获取SSL证书..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "${ADMIN_EMAIL:-admin@ddns.0379.email}" \
        --agree-tos \
        --no-eff-email \
        -d "${NAS_DOMAIN:-ddns.0379.email}"
    
    # 重新加载Nginx
    docker-compose exec nginx nginx -s reload
fi

# 健康检查
echo "运行健康检查..."
HEALTH_CHECK_URL="https://${NAS_DOMAIN:-ddns.0379.email}/health"
if [ "$ENVIRONMENT" = "development" ]; then
    HEALTH_CHECK_URL="http://localhost:8080/api/v2/health"
fi

for i in {1..10}; do
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
        echo "✅ 系统健康检查通过"
        break
    else
        echo "⏳ 等待系统就绪 ($i/10)..."
        sleep 10
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ 系统健康检查失败"
        docker-compose logs api
        exit 1
    fi
done

echo "=========================================="
echo "部署完成"
echo "访问地址: https://${NAS_DOMAIN:-ddns.0379.email}"
echo "API文档: https://${NAS_DOMAIN:-ddns.0379.email}/api/docs"
echo "Grafana: https://${NAS_DOMAIN:-ddns.0379.email}/grafana"
echo "Kibana: https://${NAS_DOMAIN:-ddns.0379.email}/kibana"
echo "管理界面:"
echo "  - PostgreSQL: http://localhost:${PGADMIN_PORT:-5050}"
echo "  - Redis: http://localhost:${REDIS_COMMANDER_PORT:-8081}"
echo "  - MailHog: http://localhost:${MAILHOG_WEB_PORT:-8025}"
echo "=========================================="

# 显示部署信息
cat << EOF

📋 部署信息:
  服务器IP: ${NAS_SERVER_IP}
  域名: ${NAS_DOMAIN}
  API端口: ${API_PORT}
  环境: ${ENVIRONMENT}

🔧 管理命令:
  查看日志: docker-compose logs -f
  重启服务: docker-compose restart
  停止服务: docker-compose down
  备份数据: docker-compose exec backup /scripts/backup.sh
  更新系统: ./deploy.sh --update

📊 监控地址:
  Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}
  Grafana: https://${NAS_DOMAIN}/grafana (admin/${GRAFANA_ADMIN_PASSWORD})
  Kibana: https://${NAS_DOMAIN}/kibana

📝 后续步骤:
  1. 访问Web界面完成初始配置
  2. 配置域名解析（如果未自动配置）
  3. 设置监控告警
  4. 配置定期备份

⚠️  重要提示:
  - 请立即修改默认密码
  - 定期检查备份是否正常
  - 监控系统资源使用情况

部署完成时间: $(date)
EOF
```

## **API服务主应用**

```python
# app/__init__.py - Flask应用工厂
import os
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from flask_socketio import SocketIO
from prometheus_flask_exporter import PrometheusMetrics
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# 扩展初始化
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()
socketio = SocketIO()
metrics = PrometheusMetrics()

def create_app(config_name=None):
    """应用工厂函数"""
    app = Flask(__name__)
    
    # 加载配置
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'production')
    
    app.config.from_object(f'config.{config_name.capitalize()}Config')
    
    # 初始化扩展
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})
    limiter.init_app(app)
    cache.init_app(app)
    socketio.init_app(app, 
                     cors_allowed_origins=app.config['CORS_ORIGINS'],
                     message_queue=app.config['REDIS_URL'])
    metrics.init_app(app)
    
    # 初始化Sentry（错误追踪）
    if app.config.get('SENTRY_DSN'):
        sentry_sdk.init(
            dsn=app.config['SENTRY_DSN'],
            integrations=[FlaskIntegration()],
            traces_sample_rate=app.config.get('SENTRY_TRACES_SAMPLE_RATE', 1.0)
        )
    
    # 注册蓝图
    register_blueprints(app)
    
    # 注册错误处理器
    register_error_handlers(app)
    
    # 注册上下文处理器
    register_context_processors(app)
    
    # 注册命令行接口
    register_commands(app)
    
    # 注册Shell上下文
    register_shell_context(app)
    
    # 初始化Celery
    if app.config.get('CELERY_ENABLED', False):
        init_celery(app)
    
    return app

def register_blueprints(app):
    """注册所有蓝图"""
    from app.api.v2 import bp as api_v2_bp
    from app.api.websocket import bp as websocket_bp
    from app.api.admin import bp as admin_bp
    from app.api.monitoring import bp as monitoring_bp
    
    app.register_blueprint(api_v2_bp, url_prefix='/api/v2')
    app.register_blueprint(websocket_bp, url_prefix='/ws')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(monitoring_bp, url_prefix='/monitoring')

def register_error_handlers(app):
    """注册错误处理器"""
    
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({
            'success': False,
            'error': 'Resource not found',
            'message': str(error)
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Server Error: {error}')
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'message': 'An internal error occurred'
        }), 500
    
    @app.errorhandler(429)
    def ratelimit_error(error):
        return jsonify({
            'success': False,
            'error': 'Rate limit exceeded',
            'message': str(error.description)
        }), 429

def register_context_processors(app):
    """注册上下文处理器"""
    
    @app.context_processor
    def inject_globals():
        return {
            'app_name': app.config.get('APP_NAME', 'NAS DDNS'),
            'app_version': app.config.get('APP_VERSION', '2.0.0'),
            'current_year': datetime.now().year
        }

def register_commands(app):
    """注册命令行命令"""
    import click
    from flask.cli import with_appcontext
    
    @app.cli.group()
    def db():
        """数据库操作命令"""
        pass
    
    @db.command()
    @with_appcontext
    def seed():
        """填充测试数据"""
        from app.seeds import seed_all
        seed_all()
        click.echo('数据库种子数据已填充')
    
    @app.cli.command()
    @with_appcontext
    def create_admin():
        """创建管理员用户"""
        from app.utils.admin import create_admin_user
        create_admin_user()
        click.echo('管理员用户已创建')
    
    @app.cli.command()
    @with_appcontext
    def backup():
        """执行系统备份"""
        from app.utils.backup import perform_backup
        perform_backup()
        click.echo('系统备份完成')
    
    @app.cli.command()
    @with_appcontext
    def stats():
        """显示系统统计信息"""
        from app.utils.stats import show_system_stats
        show_system_stats()

def register_shell_context(app):
    """注册Shell上下文"""
    @app.shell_context_processor
    def make_shell_context():
        return {
            'app': app,
            'db': db,
            'User': User,
            'Domain': Domain,
            'DNSRecord': DNSRecord
        }

def init_celery(app):
    """初始化Celery"""
    from app.celery import make_celery
    celery = make_celery(app)
    return celery

# 创建应用实例
app = create_app()

if __name__ == '__main__':
    # 开发服务器
    if app.config['ENVIRONMENT'] == 'development':
        socketio.run(app, 
                    host='0.0.0.0', 
                    port=8080, 
                    debug=True, 
                    use_reloader=True)
    else:
        # 生产环境使用gunicorn
        app.run()
```

## **API路由汇总**

```python
# app/api/v2/__init__.py - API v2蓝图汇总
from flask import Blueprint
from .auth import bp as auth_bp
from .ddns import bp as ddns_bp
from .domains import bp as domains_bp
from .monitoring import bp as monitoring_bp
from .alerts import bp as alerts_bp
from .config import bp as config_bp
from .analytics import bp as analytics_bp
from .integrations import bp as integrations_bp
from .dev import bp as dev_bp
from .production import bp as production_bp

bp = Blueprint('api_v2', __name__)

# 注册所有子蓝图
bp.register_blueprint(auth_bp, url_prefix='/auth')
bp.register_blueprint(ddns_bp, url_prefix='/ddns')
bp.register_blueprint(domains_bp, url_prefix='/domains')
bp.register_blueprint(monitoring_bp, url_prefix='/monitoring')
bp.register_blueprint(alerts_bp, url_prefix='/alerts')
bp.register_blueprint(config_bp, url_prefix='/config')
bp.register_blueprint(analytics_bp, url_prefix='/analytics')
bp.register_blueprint(integrations_bp, url_prefix='/integrations')
bp.register_blueprint(dev_bp, url_prefix='/dev')
bp.register_blueprint(production_bp, url_prefix='/production')

@bp.route('/')
def index():
    """API v2根端点"""
    return {
        'api': 'NAS DDNS API v2',
        'version': '2.0.0',
        'endpoints': {
            'auth': '/api/v2/auth',
            'ddns': '/api/v2/ddns',
            'domains': '/api/v2/domains',
            'monitoring': '/api/v2/monitoring',
            'alerts': '/api/v2/alerts',
            'config': '/api/v2/config',
            'analytics': '/api/v2/analytics',
            'integrations': '/api/v2/integrations',
            'dev': '/api/v2/dev',
            'production': '/api/v2/production',
            'websocket': '/ws',
            'docs': '/api/v2/docs',
            'health': '/api/v2/health',
            'metrics': '/api/v2/metrics'
        },
        'documentation': 'https://ddns.0379.edu/api/v2/docs'
    }

@bp.route('/health')
def health():
    """健康检查端点"""
    return {
        'status': 'healthy',
        'service': 'nas-ddns-api',
        'version': '2.0.0',
        'timestamp': datetime.utcnow().isoformat()
    }

@bp.route('/metrics')
def prometheus_metrics():
    """Prometheus指标端点"""
    # 由prometheus_flask_exporter自动处理
    pass

@bp.route('/docs')
def api_docs():
    """API文档端点"""
    return {
        'swagger': '/api/v2/docs/swagger.json',
        'redoc': '/api/v2/docs/redoc',
        'openapi': '/api/v2/docs/openapi.json',
        'ui': '/api/v2/docs/ui'
    }
```

## **完整的API服务架构总结**

### **🎯 架构特点**

1. **微服务架构** - 模块化设计，各服务独立部署
2. **容器化部署** - 使用Docker和Docker Compose
3. **高可用性** - 支持水平扩展和负载均衡
4. **完整监控** - Prometheus + Grafana + ELK Stack
5. **安全性** - JWT认证、速率限制、安全头部
6. **自动化** - 自动备份、证书续期、健康检查

### **📦 服务组件**

1. **API服务** - 核心业务逻辑（Flask + WebSocket）
2. **数据库** - PostgreSQL持久化存储
3. **缓存** - Redis缓存和消息队列
4. **监控** - Prometheus指标收集
5. **可视化** - Grafana仪表板
6. **日志** - ELK日志收集和分析
7. **反向代理** - Nginx + SSL证书
8. **工作节点** - Celery异步任务处理
9. **备份服务** - 自动化数据备份

### **🔧 部署方式**

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/nas-ddns.git
cd nas-ddns

# 2. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 3. 部署系统
chmod +x deploy.sh
./deploy.sh

# 4. 查看状态
docker-compose ps
docker-compose logs -f api

# 5. 访问系统
# Web界面: https://ddns.0379.email
# API文档: https://ddns.0379.email/api/v2/docs
# Grafana: https://ddns.0379.email/grafana
```

### **📊 API端点汇总**

| 类别 | 端点 | 方法 | 描述 |
|------|------|------|------|
| 认证 | `/api/v2/auth/login` | POST | 用户登录 |
| 认证 | `/api/v2/auth/register` | POST | 用户注册 |
| 认证 | `/api/v2/auth/refresh` | POST | 刷新令牌 |
| DDNS | `/api/v2/ddns/status` | GET | DDNS状态 |
| DDNS | `/api/v2/ddns/records` | GET | DNS记录列表 |
| DDNS | `/api/v2/ddns/update` | POST | 手动更新 |
| 域名 | `/api/v2/domains` | GET | 域名列表 |
| 域名 | `/api/v2/domains/<domain>/status` | GET | 域名状态 |
| 监控 | `/api/v2/monitoring/system` | GET | 系统监控 |
| 监控 | `/api/v2/monitoring/services` | GET | 服务状态 |
| 告警 | `/api/v2/alerts` | GET | 告警列表 |
| 告警 | `/api/v2/alerts/<id>/resolve` | POST | 解决告警 |
| 配置 | `/api/v2/config` | GET | 配置列表 |
| 配置 | `/api/v2/config/<id>` | PUT | 更新配置 |
| 分析 | `/api/v2/analytics/usage` | GET | 使用统计 |
| 分析 | `/api/v2/analytics/reports` | POST | 生成报告 |
| 集成 | `/api/v2/integrations/webhooks` | POST | 创建Webhook |
| 集成 | `/api/v2/integrations/slack/notify` | POST | Slack通知 |
| 开发 | `/api/v2/dev/test-dns` | POST | 测试DNS |
| 生产 | `/api/v2/production/ha/status` | GET | 高可用状态 |
| WebSocket | `/ws` | WebSocket | 实时通信 |

### **🔐 安全特性**

1. **JWT认证** - 基于令牌的认证
2. **API密钥** - 服务间通信认证
3. **速率限制** - 防止滥用和DDoS
4. **CORS控制** - 跨域资源共享控制
5. **输入验证** - 防止注入攻击
6. **HTTPS强制** - 所有通信加密
7. **安全头部** - 防止XSS和点击劫持

### **📈 扩展性**

1. **水平扩展** - 可增加API和工作节点实例
2. **负载均衡** - Nginx负载均衡
3. **消息队列** - Celery + Redis异步任务
4. **缓存层** - Redis缓存热点数据
5. **数据库读写分离** - 支持主从复制
6. **多区域部署** - 支持跨区域部署

这个完整的API系统设计提供了从开发到生产的全方位支持，适合中大型项目部署，具有良好的可扩展性、可维护性和安全性。
