import type { OrchestrationState } from '../state.ts'

export type StartProjectDeps = {
  process: { spawnProcess(input: { name: string }): unknown }
}

export type StartProjectCtx = { state: OrchestrationState }

export type StartProjectResult =
  | { ok: true; started: string[] }
  | { ok: false; error: 'not_loaded' | 'already_started' }

export function startProject(deps: StartProjectDeps, ctx: StartProjectCtx): StartProjectResult {
  if (ctx.state.nodes.size === 0) return { ok: false, error: 'not_loaded' }
  if ([...ctx.state.nodes.values()].some(n => n.state !== 'waiting')) return { ok: false, error: 'already_started' }

  const started: string[] = []
  for (const node of ctx.state.nodes.values()) {
    if (node.dependsOn.length > 0) continue
    ctx.state.nodes.set(node.name, { ...node, state: 'started' })
    deps.process.spawnProcess({ name: node.name })
    started.push(node.name)
  }

  return { ok: true, started }
}
