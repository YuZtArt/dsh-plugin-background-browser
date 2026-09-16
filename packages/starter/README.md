# dsh-plugin-starter

DeepSeek Harness 的最小 TypeScript 服务插件。加载后注册 `ctx.dshStarter`，提供 `greet(who)` 方法；配置项 `greeting` 默认是 `Hello`。这是开发骨架，不会自动向模型注册工具或添加 UI。

消费方声明 `export const inject = ['dshStarter']` 后，在 `apply(ctx)` 中调用 `ctx.dshStarter.greet('DeepSeek')`。

从工作区根目录执行 `npm run check`，然后 `npm run pack:starter`。通过 `dsh plugin --profile plugin-dev add <打包文件的绝对路径>` 安装，再用 `dsh --profile plugin-dev --dump-config` 检查组合配置。

发布前修改包名和 patch 中的模块名，并移除 `private: true`。完整开发说明见工作区 `docs/plugin-development.md`。
