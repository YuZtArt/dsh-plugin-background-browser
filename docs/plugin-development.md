# 插件开发指南

资料核对日期：2026-09-16。

## 官方来源与版本

- [官方仓库](https://github.com/deepseek-ai/deepseek-harness)
- [官方文档站](https://deepseek-harness.github.io/deepseek-harness/)
- [第一个插件](https://github.com/deepseek-ai/deepseek-harness/blob/0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/docs/user/develop/basic/index.zh.md)
- [插件配置](https://github.com/deepseek-ai/deepseek-harness/blob/0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/docs/user/develop/basic/config.zh.md)
- [打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/docs/user/develop/basic/publish.zh.md)
- [注册模型工具](https://github.com/deepseek-ai/deepseek-harness/blob/0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/docs/user/develop/basic/tool.zh.md)
- [Cordis 教程](https://github.com/deepseek-ai/deepseek-harness/tree/0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/docs/cordis-tutorial)

本地参考源码位于 `.reference/deepseek-harness`，commit 为 `0d1f50007f9bca3f52b06e1c3074fa14d5fb0720`。该目录只是参考，不是本项目的构建依赖，也不纳入 Git。

当前目标宿主是用户实际使用的 **DSH 0.1.5-rc.2**。上面的源码快照是 0.1.6-alpha.1，只作架构参考；rc.2 发布包接口保存在 `.reference/rc2`。插件与测试的 DSH 依赖均锁定 rc.2，Cordis 为 4.0.2，Schemastery 为 3.18.2。不要直接套用 alpha 的 browser-use-runtime、异步 agent/created 或较新的提示词字段。

## 核心约定

1. 插件是 ES module，命名导出 `apply(ctx, config)`；可导出 `name` 作为诊断名称。
2. `Config` 同时导出 TypeScript 类型和 Schemastery schema，声明默认值及校验。
3. 消费服务先声明 `inject = ['服务名']`。启动顺序由依赖决定，不能依靠 YAML 行顺序。
4. 对外提供服务使用 Cordis `Service`，通过模块声明合并扩展 `Context`；自有服务名加辨识前缀。
5. 定时器、连接等外部资源由 `ctx.effect()` 返回清理函数管理，支持卸载和热替换。
6. bundle 是 npm 包中的 `dsh.bundle.patch` 加 patch 文件；profile 是用户运行组合，不是插件自身。
7. patch 内的 `id` 标识配置行，`name` 是可解析的包名或模块路径；二者职责不同。
8. patch 替换整行 `config`，不是深度合并；覆盖时保留该行所有需要的字段。

## 当前示例与扩展

`packages/starter/src/index.ts` 提供 `dshStarter` 服务。消费插件可以这样使用：

```ts
import type { Context } from '@deepseek-ai/cordis'
import 'dsh-plugin-starter'

export const inject = ['dshStarter']

export function apply(ctx: Context) {
  console.log(ctx.dshStarter.greet('DeepSeek'))
}
```

新增插件时在 `packages/<name>` 创建独立包，使用 starter 的目录结构，修改 npm 包名、插件名、patch id 和服务名。根目录 npm workspaces 会自动包含它；运行 `npm install` 更新链接及锁文件。

添加模型可调用工具时，阅读工具教程及与宿主匹配版本的 `@deepseek-ai/dsh-tools` 类型，声明 `inject = ['tools']` 后注册。starter 只依赖 Cordis；后台浏览器包使用匹配 `0.1.5-rc.2` 的 DSH API。

## 后台浏览器实现

见 [浏览器插件说明](../packages/browser/README.md)。插件通过 rc.2 的 MCP client、Scope 与提示词组装接口管理浏览器会话，固定使用隐藏、隔离的 Chromium Headless Shell；不修改参考源码。使用公开 Playwright API 启动会话浏览器，通过 CDP 交给 MCP 操作，沿用官方 MCP 环境变量清理方式。

`npm run test:browser` 通过真实 DSH Agent/Session/Tools 调用浏览器，在本地测试站点验证操作、截图、会话隔离与清理，不需要真实模型。默认 `npm run check` 不下载或启动浏览器。

## 本地加载与交付

推荐先构建、打包、安装到独立开发 profile：

```powershell
npm run check
npm run pack:starter
dsh plugin --profile plugin-dev add C:/path/to/dsh-plugins/dsh-plugin-starter-0.1.0.tgz
dsh --profile plugin-dev --dump-config
```

持续开发可将目录链接进 profile（先构建）：

```powershell
dsh plugin --profile plugin-dev add C:/path/to/dsh-plugins/packages/starter
npm run dev
```

`--dump-config` 中应包含 starter 的 bundle 层和 `dshplugins-starter` 行。独立 profile 初建默认包含 base，不等于完整 Web 应用；Web 调试需要按对应版本的 CLI 文档选择 Web 模板或组合。

已有 Web 环境也可以通过 `dsh web --patch <overlay.yml>` 加载本地产物。overlay 中模块应写绝对路径，例如 `C:/path/to/dsh-plugins/packages/starter/dist/index.js`；相对路径不会以 patch 文件目录为解析基准。

npm tarball 包含预构建 `dist/` 和 patch，不要求消费者编译。当前未配置 Git 源码安装的 `prepare`：如需支持 Git 安装，应提供独立可用的构建配置和构建依赖，并遵守官方文档描述的 pnpm 构建授权机制。

## 验证范围

`npm run check` 验证真实 Cordis 激活、schema 默认配置、卸载清理及 manifest/patch 的模块解析；`npm run pack:starter` 验证发布文件集合。完整 DSH 加载与模型交互应在选定宿主版本和实际功能后进行，不应将框架测试等同于完整宿主端到端测试。

## 桌面客户端与右侧栏（浏览器 0.2.1）

核对 [桌面客户端源码](https://github.com/dsh-tauri-desk/deepseek-harness-desktop/tree/b2e859442fbf1acabcccbe6f48d9714231102fb5) 后，采用其嵌入的 DSH Web 原生插件接口。右侧栏、slots、renderer 和 webserver 类型均核对 npm 已发布的 0.1.5-rc.2，而非套用 alpha 源码。

包通过 `exports["./client"]` 暴露构建后的客户端，`dsh.client` 声明 web 平台和右侧栏插件依赖。客户端用 `window.__ModuleLoader__.load` 包装，React 由宿主提供；注册 `sidebarRightTabs` 类型及 `sidebar.right.pane.tab` keyed 槽位，按注入的 session ID 读取画面。HTTP 路由通过可选 `webServer` 注入注册，生命周期随插件卸载；CLI 无 Web 服务时仍可使用后台浏览器。

预览读取同一会话浏览器的 JPEG 截图，不另建网页会话。测试覆盖真实 rc.2 服务、MCP/CDP 浏览器操作、HTTP 预览与浏览器中挂载的客户端组件；未验证完整 Tauri 应用、其可选替代侧栏或真实模型自主调用。桌面安装须使用实际 active profile，详见浏览器 README。

### 安装后多副本与 Electron（0.2.1）

`dsh-scope` rc.2 的 scope tag 使用模块私有 Symbol。插件自行 `createScope(ctx, agent)` 时，独立安装产生的另一份 scope 模块可能不被宿主工具注册器识别。使用宿主 `agent.ctx` 下的子 fiber 继承作用域，同时让插件卸载回收该 fiber。MCP client 声明为精确 rc.2 peer dependency，不私有携带一份宿主集成层。

用户实测宿主为 Desktop 2.0.10 的 Electron-as-node，早先 Tauri checkout 只保留为历史架构参考。`process.execPath` 在该环境指向桌面 exe，MCP 显式 env 必须包含 `ELECTRON_RUN_AS_NODE=1`；rc.2 MCP transport 在 scrub 后合并显式 env，已核对发布包实现。

### 客户端发现导出（0.2.2）

双端插件必须导出 `./package.json`，以支持 rc.2 client-modules 在无 loader internal resolver 环境中的 manifest 查找路径。该发现失败会静默跳过客户端，单测直接挂载客户端组件无法覆盖，需单独验证包级解析。
