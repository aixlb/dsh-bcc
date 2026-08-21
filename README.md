# dsh-bcc · 包拆拆 for DeepSeek Harness

English | [简体中文](./README.zh.md)

Turn a video into a **script**, **storyboard**, or **style guide** inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

The plugin owns ffmpeg cut detection, keyframes, and export (docx / xlsx / html). **Analysis uses whatever model the current DSH session already has.** There is no Gemini/Kimi settings page and no bundled API key.

Recommended model: **`deepseek-v4-flash-vision-exp`**. If the current model cannot see images, the plugin **prompts you to switch** in the DSH model picker. It never rewrites your default model.

## Install

```bash
npx @deepseek-ai/dsh plugin --profile web add github:aixlb/dsh-bcc
```

Local checkout:

```bash
npx @deepseek-ai/dsh plugin --profile web add ./dsh-bcc
```

Restart `dsh web` and hard-refresh the browser. Open the **包拆拆** conversation view (sidebar footer or the tab next to Trajectory).

## Use

1. Put a video in the workspace.
2. In chat: `拆这个视频的分镜` / `拆剧本` / `做风格指南`.
3. The agent calls `bcc_shots` → `bcc_read_frames` (batches of keyframes) → `bcc_export`.
4. Fine-tune cuts in chat: `切太碎了，min-gap 调到 0.5` or `00:12 再切一刀`.

Workbench: project list | video + timeline | process (current shot thumbnail).

## Tools

| Tool | Role |
|---|---|
| `bcc_probe` | Duration / resolution |
| `bcc_shots` | Cut detection + optional keyframes |
| `bcc_set_cuts` | Explicit cut list (chat edits) |
| `bcc_read_frames` | Send keyframes to the vision model |
| `bcc_export` | script → docx/md/html; storyboard → xlsx/html |
| `bcc_master` | 山之音 methodology text |
| `bcc_project_list` / `bcc_project_open` | Workspace `.dsh-bcc/projects` |

Scripts are **image-only**: dialogue comes from burned-in captions. Unseen speech is written `【画面未见对白】`.

## License

MIT
