# ChatGPT Session Converter · Sub2API 模板增强版

**本页面开源**：[Anti2077/GPTSession2CPAandSub2API](https://github.com/Anti2077/GPTSession2CPAandSub2API)。

Forked from **gtxx3600**。在原版 [GPTSession2CPAandSub2API](https://github.com/gtxx3600/GPTSession2CPAandSub2API) 上增加可配置的 Sub2API 导出、账号模板提取及本地模板库。保留 CPA、Cockpit、9router、Codex、AxonHub、Codex-Manager 转换。遵循原项目 MIT 许可证。

纯静态页面，运行时不依赖后端、CDN、第三方脚本或网络请求。所有账号数据只在当前浏览器页面中处理。格式转换不会验证 token、刷新 token 或改变账号本身的权限。

## 使用

1. 打开 `docs/index.html`，或访问自行部署的站点。
2. 粘贴账号 JSON，选择一个或多个 JSON 文件，或拖入账号输入框。支持 ChatGPT session、Codex auth.json 及原版支持的输入，也可读取 Sub2API OpenAI OAuth 账号文件。
3. 选择 **sub2api** 输出格式，在配置区选择整批默认设置或单个账号覆盖。其他格式不应用这些设置。
4. 下载 JSON，通过 Sub2API 的账号数据导入功能导入。

### 从现有账号创建模板

点击 **从账号文件提取**，选择 Sub2API 的导出 JSON。文件有多个账号时选择一个作为参考，查看已提取／排除字段，然后点击 **应用提取的设置**。

模板入口与待转换账号入口独立。参考账号不会自动加入输出。

| 可复用设置 | 说明 |
| --- | --- |
| 并发、优先级、费用倍率 | 数值 `0` 与未设置不同；优先级数字越小越优先 |
| 账号过期策略 | 沿用新账号、无限期或指定时间；参考账号绝对到期时间不自动继承 |
| 代理及备用代理 | HTTP、HTTPS、SOCKS5、SOCKS5H、Hysteria2；包含认证、状态、有效期、到期提醒和备用策略 |
| 模型映射 | JSON 对象，例如 `{"source-model":"target-model"}` |
| Codex 指纹 | `off`、`device`、`session`、`full`；仅复制模式，由 Sub2API 为新账号生成种子 |
| OAuth WebSocket | `off`、`ctx_pool`、`passthrough`、`http_bridge` |
| 长上下文计费 | 可明确开启或关闭 |
| 额度管理 | 5 小时／7 天暂停阈值、暂停禁用开关、自动重置信用及阈值 |

高级功能以 Anti2077/sub2api 的 `Anti2077/custom` 为兼容基准；其他版本可能不支持部分模式。阈值在界面输入百分数，JSON 使用 0–1。

每个设置的“应用”复选框控制是否覆盖；布尔设置的“开启／关闭”控制实际值。合并顺序是 **新账号基础设置 → 整批设置 → 单账号覆盖**。恢复继承会清空当前编辑范围的覆盖设置。

模板只提取白名单内的运行设置，不复制姓名、邮箱、token、用户／账号／组织标识、订阅档位、备注、邮箱绑定、用量快照、错误状态或指纹种子。缺少的身份数据不会从参考账号补齐。真实 refresh token 和 id token 会从新账号输入保留到 Sub2API 输出；不会为 Sub2API 伪造刷新凭据。

账号顶层 `expires_at` 是调度有效期，`credentials.expires_at` 是凭据有效期，两者独立。有 refresh token 的普通 session 输入默认不因 access token 到期而暂停账号。

### 本地模板库与凭据

- 输入名称后点击 **保存为新模板**。也可以更新、复制、删除已有模板，或导入导出独立模板文件。
- 模板文件使用 `type: "sub2api-converter-template"`、`version: 1`，不能直接作为 Sub2API 账号文件导入。
- 原始账号文件、token 和转换输出不会写入 localStorage。只有手动保存的模板进入 `sub2api-converter.templates.v1`。
- 代理密码默认从保存／导出的模板移除，`proxy_key` 不保存在模板内。复用时需重新填写密码。
- 勾选“包含代理密码”后，代理密码会以**明文**写入本机存储或模板文件。账号导出 JSON 本身包含真实凭据，请自行妥善保存。
- 浏览器拒绝存储时仍可转换和使用模板文件。不同域名／浏览器的模板库互不共享。
- 普通账号输入中的代理关联不会自动从原文件复用；需要通过模板入口导入代理，或手动选择代理。

## 本地开发与测试

需要 Node.js 22 或更新版本；运行网页本身不需要 Node.js。

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run serve
```

`npm ci` 按锁文件安装开发依赖；`npm test` 运行原版转换回归和新增模板逻辑测试；浏览器测试验证真实页面交互。`npm run serve` 在 `http://127.0.0.1:4173` 提供静态页面，并模拟 Pages 安全响应头。截图位于忽略提交的 `test-results/`。

格式检查：`npm run format:check`。GitHub Actions 自动运行单元测试和浏览器测试。

## Cloudflare Pages

将自己的 fork 连接到 Cloudflare Pages，设置：

| 选项 | 值 |
| --- | --- |
| Framework preset | None |
| Production branch | main（先将功能分支合并） |
| Root directory | 留空（仓库根目录） |
| Build command | `exit 0` |
| Build output directory | `docs` |
| Environment variables | 无 |

`docs/` 包含全部运行资源，使用相对路径。无需 Worker、Functions、KV、数据库或服务端密钥。`docs/_headers` 禁止页面发起网络连接，并设置 CSP、禁止嵌入及 referrer 策略。

建议项目名称使用 `session-converter`（以 Cloudflare 实际允许创建的名称为准），子域名前缀使用 **`session`**，例如 `session.example.com`。

先在 Pages 项目的 **Custom domains** 中添加完整域名，再按提示配置 DNS：CNAME 名称填写 `session`，目标填写该项目实际分配的 `<project>.pages.dev`，不加协议和路径。不要只添加 DNS 记录而跳过 Pages 自定义域名绑定。

部署后验证首页、模板保存复用、账号导入与 JSON 下载。当前仓库提供的是可部署产物；不代表已建立 Cloudflare 项目、配置域名或发布生产环境。

## Sub2API 隔离导入验收

`tests/integration/compose.yml` 使用独立项目、临时数据库和禁止应用访问外网的内部网络。单独的 nginx 网关提供仅本机可用的 `http://127.0.0.1:18097` 浏览器入口。所有凭据均为虚构测试数据。需要本机已有兼容 Sub2API 镜像（默认 `sub2api-sync-20260920:local`），或通过 `SUB2API_TEST_IMAGE` 指定镜像。

```sh
docker compose -p converter-import-qa -f tests/integration/compose.yml up -d
node tests/integration/import.cjs
docker compose -p converter-import-qa -f tests/integration/compose.yml down
```

验收脚本只调用名为 `converter-import-qa-app-1` 的专属容器，不连接其他实例。它会导入两个虚构账号，再通过导出接口验证代理、档位、凭据、指纹种子和运行配置。

如果首次启动要求管理员确认合规承诺，脚本退出并提示，**不会自动接受承诺或绕过该门控**。需要测试实例管理员自行完成首次确认后再运行。关闭项目将丢弃临时数据库。

临时实例登录：`converter@example.test` / `Converter-Test-Only-2026!`。这些是仅供隔离验收的公开测试凭据，请勿用于实际部署。
