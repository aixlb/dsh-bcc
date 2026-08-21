---
name: bcc-script
description: 包拆拆拆剧本。按镜头抽关键帧看图，写出带时间戳的剧本并导出 docx/md/html。无音频，台词以画面字幕为准。
---

# 拆剧本（无音频）

用户要「拆剧本 / 台词 / 对白」时使用。当前默认模型是看图的 Vision 模型，**听不到对白**。

**推荐模型**：`deepseek-v4-flash-vision-exp`。不能看图就停下来让用户切换。不要改默认模型。

## 限制（必须遵守）

- 没有烧录字幕时，不得编造台词。写 `【画面未见对白】`。
- 完整性 > 文采；场景时间轴从 0 到片尾连续。
- 体量参考：对白可见的视频大约 1 分钟 300–600 字；明显偏短要补看关键帧。

## 流程

1. `bcc_probe` + `bcc_shots`（建议 `frames=true`）校准镜头边界。
2. `bcc_read_frames` 分批看关键帧（含烧录字幕 OCR）。
3. 写剧本 md：每个场景 `[HH:MM:SS] 编号 地点 时间`，`△` 画面，`人名：台词`。
4. `bcc_export` kind=`script`。

可选 `bcc_master` kind=`script`。
