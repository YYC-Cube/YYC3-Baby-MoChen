# YYC3-Baby-MoChen 全栈镜像
# 服务端 dist-server/boot.js 为 esbuild 自包含单文件（mysql2 已内联），
# 前端静态产物 dist/ 由 boot.js 自动发现 —— 镜像内无需 npm install。
# 构建前置：项目根已执行 npm run build（产出 dist/）+ npm run build:server（产出 dist-server/）
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY dist-server/boot.js ./dist-server/boot.js
COPY dist/ ./dist/

EXPOSE 3000
USER node
CMD ["node", "dist-server/boot.js"]
