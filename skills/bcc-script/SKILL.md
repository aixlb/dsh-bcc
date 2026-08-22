---
name: bcc-script
description: 包拆拆拆剧本。按设定时间间隔切镜看图，先写节拍再按开源合并提示词合成剧本。禁止只看前几张就交稿。
---

# 拆剧本（间隔切镜 → 提取 → 合并）

用户要「拆剧本 / 台词 / 对白」时使用。当前模型是看图的 Vision，**听不到对白**。

**推荐模型**：`deepseek-v4-flash-vision-exp`。不能看图就停下来让用户切换。不要改默认模型。

## 默认流程（interval）

按用户给的间隔（默认 **1 秒**）把时间轴切成均匀镜头，每镜一张带时间戳的定格。先逐帧写成「节拍」，再按**合并提示词**把内容重复的相邻节拍合成一场。

开源提示词（可被用户覆盖）：

- `prompts/script-extract.md` 单段提取
- `prompts/script-merge.md` 节拍合并

用户消息里如果出现「提取提示词 / 合并提示词」标题，**以用户那份为准**，不要改回默认。

## 质量铁律

1. 完整性 > 文采。宁可朴素，不可概括成「众人交谈」。
2. 时间轴从 `00:00` 到片尾。
3. 大约 1 分钟 ≥ 300 字。明显偏短 = 漏看。
4. 没字幕就写 `【画面未见对白】`，不编造。
5. `remaining > 0` 禁止导出、禁止说写完了。

## 顺序

### 1. 间隔切镜

```
bcc_shots  cutMethod=interval  intervalSec=<用户指定，默认1>  frames=true  maxShots=<用户指定，默认1200>
```

不要 `bcc_sample_script`。

### 2. 分批提取

```
bcc_read_frames  source=shots  from=1  count=6
```

每批用**提取提示词**把该时间戳写成节拍，追加进 `节拍.md`。`remaining>0` 立刻 `from=nextFrom`。

### 3. 合并

读完 `remaining=0` 后，把 `节拍.md` 全文按**合并提示词**合成 `剧本.md`：相邻重复内容合并成一场，时间戳取第一拍，不丢只出现一次的细节。

### 4. 自查

`bcc_script_coverage --from 剧本.md --projectId …`

`complete=false` 按 gaps 补看对应 interval 帧，补进 md 再合并一次。

### 5. 导出

`bcc_export` kind=`script`。

## 剧本 md 格式

```
[00:00] 1-1 办公室 日/内
△ 镜头从电脑摇到主角，他皱眉点开邮件
【字幕】方案被退回
张三：这个方案怎么又被退了？

[00:15] 1-2 会议室 日/内
△ 投影仪亮起
【画面未见对白】
```
