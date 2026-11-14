import type { OrchestrationState } from '../state.ts'

export type MarkProcessStartedInput = { name: string }

export type MarkProcessStartedCtx = { state: OrchestrationState }

export type MarkProcessStartedResult = { ok: true } | { ok: false; error: 'not_found' }

export function markProcessStarted(
  ctx: MarkProcessStartedCtx,
  input: MarkProcessStartedInput,
): MarkProcessStartedResult {
  const node = ctx.state.nodes.get(input.name)
  if (!node) return { ok: false, error: 'not_found' }

  ctx.state.nodes.set(node.name, { ...node, state: 'started' })
  return { ok: true }
}
