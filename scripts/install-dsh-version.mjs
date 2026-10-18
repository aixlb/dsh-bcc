import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const version = process.argv[2]
if (!/^0\.2\.\d+-rc\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: npm run compat:install -- 0.2.1-rc.2')
}
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const packages = Object.keys(pkg.devDependencies)
  .filter((name) => name.startsWith('@deepseek-ai/dsh-'))
  .map((name) => `${name}@${version}`)
// Keep the render-test React pair aligned while npm resolves the alternate DSH graph.
packages.push(`react@${pkg.devDependencies.react}`)
const result = spawnSync(process.execPath, [
  process.env.npm_execpath,
  'install', '--no-save', '--package-lock=false', '--ignore-scripts', ...packages,
], { stdio: 'inherit' })
if (result.error) throw result.error
process.exit(result.status ?? 1)
