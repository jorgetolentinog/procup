import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'

export type RegisterProcessInput = {
  name: string
  command: string
  cwd: string
  env?: Record<string, string>
  envFile?: string | string[] | false
  dependsOn?: string[]
  readyPattern?: RegExp
  showCommand?: boolean
}

export type RegisterProcessDeps = {
  emit: (event: ProcessEvent) => void
}

export type RegisterProcessCtx = { state: ProcessState }

export type RegisterProcessResult =
  | { ok: true }
  | {
      ok: false
      error: 'invalid_name' | 'invalid_command' | 'duplicate_name'
    }

export function registerProcess(
  deps: RegisterProcessDeps,
  ctx: RegisterProcessCtx,
  input: RegisterProcessInput,
): RegisterProcessResult {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'invalid_name' }
  if (!input.command.trim()) return { ok: false, error: 'invalid_command' }
  if (ctx.state.rows.has(name)) return { ok: false, error: 'duplicate_name' }

  ctx.state.rows.set(name, {
    name,
    command: input.command,
    cwd: input.cwd,
    env: input.env ?? {},
    envFile: input.envFile,
    dependsOn: input.dependsOn ?? [],
    readyPattern: input.readyPattern,
    showCommand: input.showCommand ?? true,
    status: 'pending',
  })

  deps.emit({ type: 'status', name, status: 'pending' })
  return { ok: true }
}
