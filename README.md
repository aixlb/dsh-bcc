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

Restart `dsh web` and hard-refresh the browser. Open the command palette (`/`) and pick **拆剧本** (`bcc-script`) or **拆分镜** (`bcc-storyboard`).

## Use

1. Put a video in the workspace, or pick one from the command card (it uploads into `.dsh-bcc/uploads`).
2. Command palette:
   - **拆剧本** (`bcc-script`) — dense still sampling, then the session model writes a timestamped script.
   - **拆分镜** (`bcc-storyboard`) — configure master / shot style / cut method, then extract one keyframe per cut.
3. You can also type in chat: `拆这个视频的分镜` / `拆剧本` / `做风格指南`.
4. Script pipeline: `bcc_shots` → `bcc_sample_script` → `bcc_read_frames source=script` until `remaining=0` → `bcc_script_coverage` → `bcc_export`.
5. Storyboard pipeline: `bcc_shots` → `bcc_read_frames source=shots` → `bcc_export`.
6. Fine-tune cuts in chat: `切太碎了，min-gap 调到 0.5` or `00:12 再切一刀`.

## Tools

| Tool | Role |
|---|---|
| `bcc_probe` | Duration / resolution |
| `bcc_shots` | Cut detection + optional keyframes |
| `bcc_sample_script` | Dense stills inside each shot (script mode) |
| `bcc_set_cuts` | Explicit cut list (chat edits) |
| `bcc_read_frames` | Send stills to the vision model (`source=shots` or `script`) |
| `bcc_script_coverage` | Timeline-gap / volume check before export |
| `bcc_export` | script → docx/md/html; storyboard → xlsx/html |
| `bcc_master` | 山之音 methodology text |
| `bcc_project_list` / `bcc_project_open` | Workspace `.dsh-bcc/projects` |

Scripts are **image-only**: dialogue comes from burned-in captions. Unseen speech is written `【画面未见对白】`.

## License

MIT
