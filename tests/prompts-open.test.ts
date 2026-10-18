import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { DEFAULT_SCRIPT_EXTRACT_PROMPT, DEFAULT_SCRIPT_MERGE_PROMPT } from '../src/lib/script-prompts.js'
import { parseFrontmatter } from '../src/skills/register.js'

function readPrompt(name: string): string {
  return readFileSync(path.join(process.cwd(), 'prompts', name), 'utf-8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
}

test('open-source prompt files stay in sync with the bundled defaults', () => {
  assert.equal(readPrompt('script-extract.md'), DEFAULT_SCRIPT_EXTRACT_PROMPT.replace(/\r\n/g, '\n').trim())
  assert.equal(readPrompt('script-merge.md'), DEFAULT_SCRIPT_MERGE_PROMPT.replace(/\r\n/g, '\n').trim())
})

test('DSH skill metadata works with LF and Windows CRLF checkouts', () => {
  const skill = '---\nname: bcc-script\ndescription: "拆剧本"\n---\n\n# 拆剧本\n'
  const expected = { description: '拆剧本', content: '# 拆剧本' }
  assert.deepEqual(parseFrontmatter(skill), expected)
  assert.deepEqual(parseFrontmatter(`\uFEFF${skill.replace(/\n/g, '\r\n')}`), expected)
})
