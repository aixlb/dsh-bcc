import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { RECOMMENDED_MODEL, VISION_REQUIRED_MESSAGE } from '../lib/vision.js'

function skillsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(here, '../../skills'),
    path.resolve(here, '../skills'),
    path.resolve(process.cwd(), 'skills'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'bcc-storyboard', 'SKILL.md'))) return dir
  }
  return candidates[0]
}

function readSkill(name: string): string {
  const file = path.join(skillsRoot(), name, 'SKILL.md')
  return fs.readFileSync(file, 'utf-8')
}

function parseFrontmatter(raw: string): { description: string; content: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { description: '', content: raw }
  const desc = m[1].match(/^description:\s*(.*)$/m)?.[1]?.trim() ?? ''
  return { description: desc.replace(/^['"]|['"]$/g, ''), content: m[2].trim() }
}

export function registerSkills(ctx: Context): void {
  const skills = (ctx as Context & { skills?: { register: (s: Record<string, unknown>) => unknown } }).skills
  if (!skills?.register) return

  const items = [
    { name: 'bcc-storyboard', dir: 'bcc-storyboard', when: '用户要拆分镜、分镜表、storyboard、逐镜头' },
    { name: 'bcc-script', dir: 'bcc-script', when: '用户要拆剧本、台词、对白' },
    { name: 'bcc-research', dir: 'bcc-research', when: '用户要风格研究、风格指南、调性、多条视频参考' },
  ]

  for (const item of items) {
    const parsed = parseFrontmatter(readSkill(item.dir))
    skills.register({
      name: item.name,
      description: parsed.description || item.when,
      whenToUse: item.when,
      content: `${parsed.content}\n\n## 模型\n推荐会话模型：\`${RECOMMENDED_MODEL}\`。${VISION_REQUIRED_MESSAGE}`,
      source: 'runtime',
    })
  }
}
