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

Restart `dsh web` and hard-refresh the browser. Click **包拆拆** in the session header to expand the project panel.

## Use

1. Expand the right **包拆拆** panel: pick/upload a video, choose 拆剧本 or 拆分镜.
2. **拆剧本** slices the timeline every N seconds (default 1s), extracts a beat per still with the open extract prompt, then merges overlapping beats with the open merge prompt. Edit both prompts in the panel; the source files are `prompts/script-extract.md` and `prompts/script-merge.md`.
3. **拆分镜** uses smart/scene cuts and shot style from the panel.
4. Command palette: `/bcc-script`, `/bcc-storyboard`.
5. Script pipeline: `bcc_shots cutMethod=interval` → `bcc_read_frames source=shots` until `remaining=0` → merge beats → `bcc_script_coverage` → `bcc_export`.
6. Storyboard pipeline: `bcc_shots` → `bcc_read_frames source=shots` → `bcc_export`.

## Tools

| Tool | Role |
|---|---|
| `bcc_probe` | Duration / resolution |
| `bcc_shots` | Cut detection (`smart` / `scene` / `interval`) + optional keyframes |
| `bcc_sample_script` | Optional dense stills (not used by default interval 拆剧本) |
| `bcc_set_cuts` | Explicit cut list (chat edits) |
| `bcc_read_frames` | Send stills to the vision model (`source=shots` or `script`) |
| `bcc_script_coverage` | Timeline-gap / volume check before export |
| `bcc_export` | script → docx/md/html; storyboard → xlsx/html |
| `bcc_master` | 山之音 methodology text |
| `bcc_project_list` / `bcc_project_open` | Workspace `.dsh-bcc/projects` |

Scripts are **image-only**: dialogue comes from burned-in captions. Unseen speech is written `【画面未见对白】`.

## License

MIT
