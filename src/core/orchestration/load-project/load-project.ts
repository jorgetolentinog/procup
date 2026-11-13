import type { OrchestrationState } from '../state.ts'

export type LoadProjectInput = { cwd: string; configPath?: string; envFile?: string | false }

type ProcessDefinition = {
  name: string
  command: string
  cwd: string
  env: Record<string, string>
  envFile?: string | string[] | false
  dependsOn: string[]
  readyText?: string
  showCommand: boolean
}

export type LoadProjectDeps = {
  config: {
    loadConfig(
      input: LoadProjectInput,
    ): { ok: true; configPath: string; processes: ProcessDefinition[] } | { ok: false; error: string; message: string }
  }
  process: {
    registerProcess(input: ProcessDefinition): { ok: true } | { ok: false; error: string }
  }
}

export type LoadProjectCtx = { state: OrchestrationState }

export type LoadProjectResult =
  | { ok: true; configPath: string; processes: string[] }
  | { ok: false; error: 'already_loaded'; message: string }
  | { ok: false; error: 'register_failed'; message: string }
  | { ok: false; error: string; message: string }

export function loadProject(deps: LoadProjectDeps, ctx: LoadProjectCtx, input: LoadProjectInput): LoadProjectResult {
  if (ctx.state.nodes.size > 0) return { ok: false, error: 'already_loaded', message: 'Project already loaded' }

  const config = deps.config.loadConfig(input)
  if (!config.ok) return config

  for (const p of config.processes) {
    const result = deps.process.registerProcess(p)
    if (!result.ok) return { ok: false, error: 'register_failed', message: `${p.name}: ${result.error}` }
  }

  for (const p of config.processes) {
    ctx.state.nodes.set(p.name, { name: p.name, dependsOn: p.dependsOn, state: 'waiting' })
  }

  return { ok: true, configPath: config.configPath, processes: config.processes.map(p => p.name) }
}
