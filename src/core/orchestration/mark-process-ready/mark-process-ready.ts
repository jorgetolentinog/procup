import type { OrchestrationState } from '../state.ts'

export type MarkProcessReadyInput = { name: string }

export type MarkProcessReadyDeps = {
  process: { spawnProcess(input: { name: string }): unknown }
}

export type MarkProcessReadyCtx = { state: OrchestrationState }

export type MarkProcessReadyResult = { ok: true; started: string[] } | { ok: false; error: 'not_found' }

export function markProcessReady(
  deps: MarkProcessReadyDeps,
  ctx: MarkProcessReadyCtx,
  input: MarkProcessReadyInput,
): MarkProcessReadyResult {
  const node = ctx.state.nodes.get(input.name)
  if (!node) return { ok: false, error: 'not_found' }

  ctx.state.nodes.set(node.name, { ...node, state: 'ready' })
  if (ctx.state.stopping) return { ok: true, started: [] }

  const started: string[] = []
  for (const [name, n] of ctx.state.nodes) {
    if ((n.state !== 'waiting' && n.state !== 'skipped') || !n.autostart) continue
    if (!n.dependsOn.every(dep => ctx.state.nodes.get(dep)?.state === 'ready')) continue

    ctx.state.nodes.set(name, { ...n, state: 'started' })
    deps.process.spawnProcess({ name })
    started.push(name)
  }

  return { ok: true, started }
}
