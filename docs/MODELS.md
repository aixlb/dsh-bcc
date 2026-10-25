# 模型配置与后续维护

模型资料核对日期：2026-10-25。

| 模型 | 官方 API 模型 ID | 官方依据 |
|---|---|---|
| Gemini 4 Argon | `gemini-4-argon` | [Google 模型说明](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon) |
| DeepSeek V4.1 Flash 1017 | `deepseek-flash` | [DeepSeek API 说明](https://api-docs.deepseek.com/) |
| Kimi K3.1 Pro | `kimi-k3.1-pro` | [Kimi 模型列表](https://platform.kimi.com/docs/models) |

DSH 插件使用宿主当前会话的模型和凭据。在 DSH 的模型设置中选择相应供应商、填 Key 并添加模型，确认图片输入能力包含 `image`，然后在目标会话选择它。若 DSH 自带目录尚未列出新模型，可使用宿主的自定义模型配置；具体字段见 [DSH 供应商与模型指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.2/docs/user/guide/providers.zh.md)。仅改显示名不等于启用图片输入。

DeepSeek 使用官方 `deepseek-flash` 别名，当前对应 V4.1-Flash-1017，之后可能随官方更新。旧 `deepseek-v4-flash-vision-exp` 的原模型已退役，其请求由当前模型承接，新配置使用 `deepseek-flash`。官方建议 1017 搭配 DSH `0.2.1-rc.1` 及以上版本，见 [发布说明](https://api-docs.deepseek.com/zh-cn/news/news261017/)。插件已在 `0.2.1-rc.2` 进行兼容验证。

三种模型在插件内均接收抽出的关键帧，适用于剧本、分镜和风格分析；插件不上传整段视频或音频。台词以可见字幕或用户提供的文本为依据。

新增模型通常只修改 DSH 的模型配置，无需改插件源码。插件不使用模型名白名单，按本次工具调用实际路由的 `inputModalities` 检查图片能力。第三方网关若改写模型 ID，也沿用这个判断。

仓库的 [src/lib/model-catalog.json](../src/lib/model-catalog.json) 只维护切换提示中的模型名称与 ID，不控制调用、不保存 Key、不限制其他模型。维护提示只需改这个 JSON 后重新构建；模型接口协议由 DSH 的供应商适配负责。

回归测试在真实 DSH 工具运行时中分别使用三个模型 ID，验证声明支持 `image` 时输出图片引用、纯文字模型被提示切换。测试不调用付费模型，实际账号的模型权限和看图质量需在该账号下确认。
