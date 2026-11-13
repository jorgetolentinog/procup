import type { OrchestrationState } from '../state.ts'

export type MarkProcessFailedInput = { name: string }

export type MarkProcessFailedDeps = {
  process: { skipProcess(input: { name: string }): unknown }
}

export type MarkProcessFailedCtx = { state: OrchestrationState }

export type MarkProcessFailedResult = { ok: true; skipped: string[] } | { ok: false; error: 'not_found' }

export function markProcessFailed(
  deps: MarkProcessFailedDeps,
  ctx: MarkProcessFailedCtx,
  input: MarkProcessFailedInput,
): MarkProcessFailedResult {
  const node = ctx.state.nodes.get(input.name)
  if (!node) return { ok: false, error: 'not_found' }

  ctx.state.nodes.set(node.name, { ...node, state: 'failed' })

  const skipped: string[] = []
  let changed = true
  while (changed) {
    changed = false
    for (const [name, n] of ctx.state.nodes) {
      if (n.state !== 'waiting') continue
      const blocked = n.dependsOn.some(dep => {
        const state = ctx.state.nodes.get(dep)?.state
        return state === 'failed' || state === 'skipped'
      })
      if (!blocked) continue
      ctx.state.nodes.set(name, { ...n, state: 'skipped' })
      skipped.push(name)
      changed = true
    }
  }

  for (const name of skipped) deps.process.skipProcess({ name })
  return { ok: true, skipped }
}
