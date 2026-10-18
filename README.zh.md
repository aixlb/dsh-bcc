# dsh-bcc · 包拆拆（DeepSeek Harness 插件）

[English](./README.md) | 简体中文

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里把视频拆成 **剧本 / 分镜表 / 风格指南**。

插件只做切镜、抽帧、导出。**分析走当前会话已经配好的模型**，没有包拆拆自己的 API Key 设置。

## 项目关系

包拆拆由两个公开的 MIT 仓库维护：

| 仓库 | 用途 |
|---|---|
| [bcc](https://github.com/aixlb/bcc) | 桌面应用、`bcc` CLI、共用的 `bcc-core` 和 `bcc` Agent skill |
| [dsh-bcc](https://github.com/aixlb/dsh-bcc) | 本仓库，独立安装的 DeepSeek Harness 插件，包含工具、网页面板和 DSH skills |

在 DSH 里使用包拆拆，安装本仓库即可。桌面版和 CLI 从 `bcc` 获取；插件运行无需安装它们。插件保留本地视频处理模块，GitHub 安装无需另行检出主仓库，也不依赖私有包。

推荐模型：**`deepseek-v4-flash-vision-exp`**。当前模型不能看图时，会提示你在 DSH 模型选择器里切换；**不会强制改默认模型**。

## 安装

```bash
npx @deepseek-ai/dsh plugin --profile web add github:aixlb/dsh-bcc
```

装进 `web` profile 后重启 `dsh web`，浏览器硬刷新。点会话标题右侧的 **包拆拆** 展开项目面板：视频地址、切镜方式、分镜类型、大师都在这里配，和原版包拆拆切分镜工作台同一套参数。

把 GitHub 仓库 topic 设为 `dsh-plugin` 即可被社区市场收录。

## 使用

- **拆剧本**：按设定间隔（默认 1 秒）`bcc_shots cutMethod=interval` → `bcc_read_frames source=shots` 循环到 `remaining=0`，先写成节拍，再按开源「合并提示词」合成剧本 → `bcc_script_coverage` → `bcc_export`。提取/合并提示词在右侧面板可改，源文件是 `prompts/script-extract.md`、`prompts/script-merge.md`。
- **拆分镜**：右侧面板配大师 / 分镜类型 / 切割方式，再 `bcc_shots` → `bcc_read_frames source=shots` → `bcc_export`。
- 也可以直接在对话里说「拆分镜 / 拆剧本 / 风格指南」。聊天可改切镜：`切太碎了`、`00:12 再切一刀`。

拆剧本没有音频：台词以画面字幕为准，看不见就写 `【画面未见对白】`。

## 兼容性

安装地址继续使用 `github:aixlb/dsh-bcc`，命令和工具保留原来的 `bcc` 名称。现有工作区中的 `.dsh-bcc/projects` 项目、上传的视频和面板偏好设置继续使用。插件不会迁移桌面版或 CLI 的项目，也不会修改当前会话模型。

## 开发

使用 Node.js 22.19 及以上的 22.x 版本，或 Node.js 24 及以上版本。运行视频烟测时，请将 ffmpeg 和 ffprobe 加入 `PATH`，也可以设置 `BCC_FFMPEG_PATH`、`BCC_FFPROBE_PATH`。实际使用时，插件支持查找或首次按需下载这两个程序。

```bash
npm ci
npm run check
```

`check` 执行 TypeScript 检查、测试和安装包预检。`npm run build` 在 `lib/` 生成服务端和浏览器入口；`npm pack` 生成包含提示词、DSH skills 和 Cordis 配置的安装包。从 GitHub 安装时，`prepare` 也会自动构建插件。

| 目录 | 用途 |
|---|---|
| `src/lib/` | 视频处理、导出、提示词加载和模型能力检查 |
| `src/tools/`、`src/commands.ts`、`src/skills/` | DSH 工具、命令和 skill 注册 |
| `src/client/`、`src/http/` | DSH 网页面板和工作区接口 |
| `src/store/` | 现有 `.dsh-bcc` 项目存储 |
| `skills/`、`prompts/` | 随插件分发的 DSH 指令和可编辑剧本提示词 |

视频处理行为可与主仓库中的 `bcc-core` 协调更新，DSH 会话模型接入和工作区集成在本仓库维护。

## 许可

[MIT](./LICENSE)。内置山之音方法论的原作者归属与上游许可证见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
