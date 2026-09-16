# 项目约定

本项目开发 DeepSeek Harness 的 Cordis 插件，不是 Codex 插件，也不是 DeepSeek API 客户端。

- 开始开发前阅读 README.md 和 docs/plugin-development.md。
- 插件放在 packages/<name>，遵循 TypeScript ESM、命名导出 apply、Config schema、inject、effect 生命周期机制。
- 使用官方文档和匹配宿主版本的源码核对 API；.reference 是只读用途的参考 checkout，不改写或打包进本项目。
- 新增宿主 API 依赖前核对 npm 发布版本与上游源码差异。
- 不把 API key、.env、DSH profile、node_modules 或构建产物提交到版本库。
- 修改后运行 npm run check；涉及交付配置时再运行 npm run pack:starter。
- 项目 npm scripts 使用本地 Node；全局 Node 当前低于 DSH 最低要求。
- 未验证完整宿主时明确说明，不将 Cordis 测试表述为 DSH 端到端验证。
