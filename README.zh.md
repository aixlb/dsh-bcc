# dsh-bcc · 包拆拆（DeepSeek Harness 插件）

[English](./README.md) | 简体中文

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 里把视频拆成 **剧本 / 分镜表 / 风格指南**。

插件只做切镜、抽帧、导出。**分析走当前会话已经配好的模型**，没有包拆拆自己的 API Key 设置。

推荐模型：**`deepseek-v4-flash-vision-exp`**。当前模型不能看图时，会提示你在 DSH 模型选择器里切换；**不会强制改默认模型**。

## 安装

```bash
npx @deepseek-ai/dsh plugin --profile web add github:aixlb/dsh-bcc
```

装进 `web` profile 后重启 `dsh web`，浏览器硬刷新。在命令面板（`/`）里选 **拆剧本**（`bcc-script`）或 **拆分镜**（`bcc-storyboard`），选视频即可开始。

把 GitHub 仓库 topic 设为 `dsh-plugin` 即可被社区市场收录。

## 使用

- **拆剧本**：`bcc_shots` → `bcc_sample_script`（镜内加密集采样）→ `bcc_read_frames source=script` 循环到 `remaining=0` → `bcc_script_coverage` → `bcc_export`。
- **拆分镜**：命令卡片里可配大师 / 分镜类型 / 切割方式，再 `bcc_shots` → `bcc_read_frames source=shots` → `bcc_export`。
- 也可以直接在对话里说「拆分镜 / 拆剧本 / 风格指南」。聊天可改切镜：`切太碎了`、`00:12 再切一刀`。

拆剧本没有音频：台词以画面字幕为准，看不见就写 `【画面未见对白】`。

## 许可

MIT
