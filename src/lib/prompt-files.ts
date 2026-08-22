import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_SCRIPT_EXTRACT_PROMPT, DEFAULT_SCRIPT_MERGE_PROMPT } from './script-prompts.js'

export function promptsRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.resolve(here, '../../prompts'),
    path.resolve(here, '../prompts'),
    path.resolve(process.cwd(), 'prompts'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'script-extract.md'))) return dir
  }
  return candidates[0]
}

export function loadOpenPrompts(): { extract: string; merge: string } {
  const root = promptsRoot()
  const read = (name: string, fallback: string): string => {
    const file = path.join(root, name)
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '').trim()
    } catch {
      /* bundled fallback */
    }
    return fallback.trim()
  }
  return {
    extract: read('script-extract.md', DEFAULT_SCRIPT_EXTRACT_PROMPT),
    merge: read('script-merge.md', DEFAULT_SCRIPT_MERGE_PROMPT),
  }
}
