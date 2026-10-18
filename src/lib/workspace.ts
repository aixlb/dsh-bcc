import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { Session } from '@deepseek-ai/dsh-session'

// Optional since this service was introduced after the 0.2.0 release line.
interface WorkingDirectoryReader {
  get(session: Session): string
}

/** Use the calling session's current directory, including working_directory changes. */
export function workspaceOf(ctx: Context, args: { cwd?: string }, exec: Pick<ToolExecution, 'agent'>): string {
  const session = exec.agent?.session
  const directories = ctx.get('workingDirectory') as WorkingDirectoryReader | undefined
  const current = session ? directories?.get(session) ?? session.header.cwd : undefined
  const base = current || process.cwd()
  return path.resolve(base, args.cwd || '.')
}

export function resolveWorkspacePath(cwd: string, file: string): string {
  return path.resolve(cwd, file)
}
