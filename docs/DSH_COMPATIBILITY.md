# DSH 兼容与功能评估

核对日期：2026-10-18。插件版本：0.1.7。评估依据为官方发布 tag 的源码及 npm 实际发布版本。

| DSH 渠道 | 版本 | 本次验证 |
|---|---|---|
| npm `latest` | `0.2.0-rc.2`，2026-09-29 发布 | 类型、真实工具注册与执行、面板渲染、视频抽帧、构建和打包 |
| npm `next` / 最新 Release | `0.2.1-rc.2`，2026-10-17 发布 | 同上 |

两者均为候选版。本仓库开发依赖固定到 `0.2.1-rc.2`；CI 在 Node.js 22.19 和 24 上交叉验证两个版本。后续新版本仍需验证后再调整矩阵。

## 已修复的不兼容

| 问题 | 影响与修复 |
|---|---|
| 工具 peer 仍为 `^0.1.1-rc.1` | 范围不包含 DSH 0.2；更新范围，并声明新版优先读取的 `engines.dsh` |
| 从 `dsh-session` 导入 `JsonValue` | 新版类型检查失败；改用公共类型包 `dsh-util-values` |
| 手写宽松的命令、skill 和 Slot 类型 | 接口变化无法被发现；改用 DSH 公共类型，命令行 Slot 的 `order` 改为 `priority` |
| 浮动面板读取 `SessionListState.current` | 新版列表不再持有当前选择，面板始终不显示；面板挂到会话级 header Slot，并使用当前 Session 的 hooks |
| 直接操作聊天输入框 DOM | 输入框和提交行为变化会导致发送失败或发往已切换的会话；改用原会话 scope 的 `conversation.send()`，上传沿用原会话目录 |
| 全局猜测模型名称判断 Vision | 可能读不到真正的会话模型；按本次请求 header 的 provider/model 调用 `resolveModelInfo()`，检查 `inputModalities` |
| 目录默认 `process.cwd()` | 不同会话或切换目录后读写错位置；优先使用 `workingDirectory.get(session)`，旧宿主回退到 Session header，显式 `cwd` 继续有效 |
| 解构后调用 `attachments.saveImages()` | 丢失附件服务的接收者，实例方法可能失败；保持接收者调用，保留图片引用输出 |

## 新能力与本项目的取舍

| 能力 | 对包拆拆的价值 | 本次处理 |
|---|---|---|
| 会话工作目录 | 在不同素材目录、同一会话切目录时准确存放项目与导出 | 已接入；面板与工具一致 |
| 动态模型目录与图片能力声明 | 支持账号提供的新模型、自定义网关和第三方视觉模型 | 已接入；不依赖模型名中出现 vision，不替用户改模型 |
| 并行工具调用 | 多条参考片可以并行探测、读取互不依赖的帧和项目信息 | 已对只读工具声明 `isConcurrencySafe`；切镜、写项目与导出维持互斥 |
| Native / PTC 工具呈现 | 适配 DSH 的直接工具调用与 `run_code` SDK 模式 | 保留规范 JSON 输出和 `output.render` 图片块；DSH 的 PTC 调度会把读帧图片加入后续模型上下文，无需拼接 base64 |
| DeepSeek-V4.1-Flash-1017 | 可作为文字整理、剧本合并等环节的候选模型 | 官方仅说明模型接入，未保证所有账号图片能力；按实时目录判断，不能据版本号替换视觉模型 |
| DeepSeek Search / Fetch API | 给风格指南补充公开作品、导演与摄影资料 | 风格研究 skill 已补充按需使用宿主网页工具的指引；需要用户在 DSH 网页搜索设置开启。画面结论仍由视频时间戳佐证 |
| 原生侧栏文件预览与成品展示 | 导出后直接打开结果，按宿主支持的格式展示 | 可作为下一步界面改进。现有文件导出已可使用，不在本次增加第二套预览器 |
| Goal、定时任务与 Agent team | 可用于长片续跑、批量素材处理、分片研究 | 暂不自动开启；完整续跑需要持久化逐批进度，多个执行者同时改一个项目也需要写入协调 |

## 验证边界

回归测试通过真实 DSH `ToolRuntime` 注册和执行工具，检查图片块与附件引用、相对路径导出，并通过真实 `SlotCore` 注册和服务端渲染面板。视频烟测使用 ffmpeg 合成短片并实际抽帧。两个版本均执行 TypeScript 检查、测试与安装包预检。

这些检查不调用付费模型。账号登录、实际模型看图质量、联网搜索结果和浏览器完整会话操作仍需在用户实际 DSH 环境中验收。

## 官方依据

- [DSH 0.2.1-rc.2 发布说明](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)
- [DSH 0.2.0-rc.2 发布说明](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)
- [engines.dsh 兼容检查](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.zh.md)
- [工作目录迁移](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/docs/upgrade-guide/v0.2.1-alpha.1/working-directory/guide.zh.md)
- [模型与图片输入配置](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/docs/user/guide/providers.zh.md)
- [工具输出、并行与 PTC 接口](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/packages/core/tools/src/index.ts)
