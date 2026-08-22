---
name: bcc-storyboard
description: 包拆拆拆分镜。把视频切成镜头、抽关键帧、逐镜看图写出分镜表并导出 xlsx/html。
---

# 拆分镜

用户要「分镜 / 分镜表 / storyboard / 逐镜头」时使用。分析由当前 DSH 会话模型完成，本插件不调用外部 API Key。

**推荐模型**：`deepseek-v4-flash-vision-exp`。若当前模型不能看图，立刻停下来告诉用户去 DSH 模型选择器切换；不要假装完成，也不要改用户的默认模型。

## 流程

1. `bcc_probe` 了解时长。
2. `bcc_shots`（`frames=true`）切镜并抽关键帧。用户在 `/bcc-storyboard` 命令卡片里配的切割参数要原样传给本工具。
3. 用户说切太碎 → 再调 `bcc_shots`，把 `minGap` 调大；切太粗 → `minGap`/`hardMin` 调小。指定秒数加切/删切 → `bcc_set_cuts`。
4. 用 `bcc_read_frames source=shots` **分批**（每次 4–8 镜）看关键帧，写 `分镜.json`。镜数必须等于 shots 输出。`remaining>0` 时继续读，不要只看前几镜。
5. `bcc_export` kind=`storyboard`。

可选：`bcc_master` id=`shanzhiyin` kind=`storyboard` 作分析框架，忽略其中的交互流程规则。

## 分镜 JSON

每镜：`number, shotType`（特写/近景/中景/全景/大全景/远景）, `angle`, `cameraMove`, `description`（七行：风格限定/景别/视角构图/主体描述/背景设定/细节修饰/光影色调）, `dialogue`, `sound`, `startSec`, `endSec`, `frame`。
