import type { Env, ReadFileSync } from '../../../types/node.ts'
import { resolve } from 'node:path'
import type { ProcessEvent } from '../events.ts'
import type { ProcessRow, ProcessState, PtyHandle } from '../state.ts'

export type SpawnProcessInput = { name: string }

export type SpawnProcessDeps = {
  nodePty: {
    spawn(
      file: string,
      args: string[],
      options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string | undefined> },
    ): PtyHandle
  }
  nodeFs: ReadFileSync
  nodeUtil: { parseEnv(content: string): Record<string, string | undefined> }
  nodeProcess: Env
  emit: (event: ProcessEvent) => void
  handleOutput: (input: { name: string; chunk: string }) => unknown
  handleExit: (input: { name: string; exitCode: number; signal: number }) => unknown
}

export type SpawnProcessCtx = { state: ProcessState }

export type SpawnProcessResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'not_startable' }
  | { ok: false; error: 'spawn_failed'; message: string }

export function spawnProcess(
  deps: SpawnProcessDeps,
  ctx: SpawnProcessCtx,
  input: SpawnProcessInput,
): SpawnProcessResult {
  let row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }
  if (row.status !== 'pending' && row.status !== 'stopped' && row.status !== 'finished' && row.status !== 'failed') {
    return { ok: false, error: 'not_startable' }
  }

  row = expandCaptures(row, capturesOf(ctx, row))
  const command = row.commandOverride ?? row.command

  ctx.state.rows.set(row.name, { ...row, status: 'starting' })
  deps.emit({ type: 'status', name: row.name, status: 'starting' })

  let pty: PtyHandle
  try {
    const envFromFile = readEnvFiles(deps, row)

    pty = deps.nodePty.spawn('sh', ['-c', command], {
      name: 'xterm-256color',
      cols: ctx.state.size.cols,
      rows: ctx.state.size.rows,
      cwd: row.cwd,
      env: {
        ...deps.nodeProcess.env,
        TERM: 'xterm-256color',
        ...envFromFile,
        ...(row.envOverride ?? row.env),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.state.rows.set(row.name, { ...row, status: 'failed', pid: undefined, exitCode: null })
    deps.emit({ type: 'output', name: row.name, chunk: `\r\n\x1b[31m[procup] failed to start: ${message}\x1b[0m\r\n` })
    deps.emit({ type: 'status', name: row.name, status: 'failed' })
    deps.emit({ type: 'exited', name: row.name, exitCode: null })
    return { ok: false, error: 'spawn_failed', message }
  }

  pty.onData(chunk => deps.handleOutput({ name: row.name, chunk }))
  pty.onExit(({ exitCode, signal }) => deps.handleExit({ name: row.name, exitCode, signal: signal ?? 0 }))

  ctx.state.rows.set(row.name, { ...row, status: 'running', pid: pty.pid, exitCode: undefined })
  ctx.state.ptys.set(row.name, pty)
  ctx.state.readyBuffers.delete(row.name)
  ctx.state.readied.delete(row.name)
  ctx.state.stopping.delete(row.name)

  if (row.showCommand) {
    deps.emit({ type: 'output', name: row.name, chunk: `\x1b[2m$ ${command}\x1b[0m\r\n\r\n` })
  }
  deps.emit({ type: 'status', name: row.name, status: 'running' })

  return { ok: true }
}

function capturesOf(ctx: SpawnProcessCtx, row: ProcessRow): Map<string, Record<string, string>> {
  const captures = new Map<string, Record<string, string>>()
  for (const dep of row.dependsOn) {
    const c = ctx.state.readyCaptures.get(dep)
    if (c) captures.set(dep, c)
  }
  return captures
}

function expandCaptures(row: ProcessRow, captures: Map<string, Record<string, string>>): ProcessRow {
  if (captures.size === 0) return row
  const names = [...captures.keys()].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const refPattern = new RegExp(`\\$(${names})\\.(\\w+)`, 'g')
  const replacer = (match: string, dep: string, key: string) => captures.get(dep)?.[key] ?? match
  const command = row.command.replace(refPattern, replacer)
  const env: Record<string, string> = {}
  let envChanged = false
  for (const [k, v] of Object.entries(row.env)) {
    env[k] = v.replace(refPattern, replacer)
    if (env[k] !== v) envChanged = true
  }
  return {
    ...row,
    commandOverride: command !== row.command ? command : row.commandOverride,
    envOverride: envChanged ? env : row.envOverride,
  }
}

function envFilesOf(envFile: ProcessRow['envFile']): string[] {
  if (envFile === undefined || envFile === false) return []
  return Array.isArray(envFile) ? envFile : [envFile]
}

function readEnvFiles(deps: SpawnProcessDeps, row: ProcessRow): Record<string, string | undefined> {
  const envFromFile: Record<string, string | undefined> = {}
  for (const file of envFilesOf(row.envFile)) {
    Object.assign(envFromFile, deps.nodeUtil.parseEnv(readEnvFile(deps, resolve(row.cwd, file))))
  }
  return envFromFile
}

function readEnvFile(deps: SpawnProcessDeps, path: string): string {
  try {
    return deps.nodeFs.readFileSync(path, 'utf-8')
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new Error(`envFile not found: ${path}`, { cause: err })
    }
    throw new Error(`Failed to read envFile "${path}": ${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    })
  }
}
