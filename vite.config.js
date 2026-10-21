import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 同一套前端代码要出两种形态的产物：
//   静态站   —— 没有服务端，共享存储整段代码不该存在，更不该去请求 /healthz
//   全栈站   —— 有服务端，才需要探测并接管存储
// 用编译期常量区分，静态产物里这段会被直接摇掉，线上不会出现多余的 404。
export default defineConfig({
  // index.html 的 lang / 标题 / 描述跟着语言版本走：
  // 英文站不该顶着一个中文 <title>。
  plugins: [
    react(),
    {
      name: 'lang-html',
      transformIndexHtml(html) {
        if (process.env.DEFAULT_LANG !== 'en') return html;
        return html
          .replace('lang="zh-CN"', 'lang="en"')
          .replace('<title>宝宝成长日志</title>', '<title>Baby Log</title>')
          .replace('宝宝日常记录、成长相册与家庭共享', 'Baby daily records, growth album and family sharing');
      },
    },
  ],
  define: {
    __SHARED_BACKEND__: JSON.stringify(process.env.BUILD_TARGET === 'fullstack'),
    // 中英文分站发布：同一套代码出两个产物，各自默认一种语言。
    // 用户仍可在设置里切换，这里只决定第一次打开时的语言。
    __DEFAULT_LANG__: JSON.stringify(process.env.DEFAULT_LANG === 'en' ? 'en' : 'zh'),
  },
})
