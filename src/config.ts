import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_CUT_PARAMS, type CutParams } from './lib/types.js'

export interface PluginConfig {
  maxShots: number
  cut: CutParams
}

export const Config: Schema<PluginConfig> = Schema.object({
  maxShots: Schema.number().default(200).description('Maximum shots per video'),
  cut: Schema.object({
    method: Schema.union(['smart', 'scene']).default(DEFAULT_CUT_PARAMS.method),
    scene_threshold: Schema.number().default(DEFAULT_CUT_PARAMS.scene_threshold),
    smart_hard_min: Schema.number().default(DEFAULT_CUT_PARAMS.smart_hard_min),
    smart_hard_ratio: Schema.number().default(DEFAULT_CUT_PARAMS.smart_hard_ratio),
    smart_min_gap: Schema.number().default(DEFAULT_CUT_PARAMS.smart_min_gap),
  }).default(DEFAULT_CUT_PARAMS),
})
