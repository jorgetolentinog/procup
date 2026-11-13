import type { OrchestrationState } from '../state.ts'

export type StopProjectDeps = {
  process: {
    stopProcess(input: { name: string; onlyIfAlive: true }): Promise<unknown>
  }
}

export type StopProjectCtx = { state: OrchestrationState }

export type StopProjectResult = { ok: true }

export async function stopProject(deps: StopProjectDeps, ctx: StopProjectCtx): Promise<StopProjectResult> {
  ctx.state.stopping = true

  const nodes = [...ctx.state.nodes.values()]
  const stops = new Map<string, Promise<unknown>>()
  const stop = (name: string): Promise<unknown> => {
    const pending =
      stops.get(name) ??
      Promise.allSettled(nodes.filter(node => node.dependsOn.includes(name)).map(node => stop(node.name))).then(() =>
        deps.process.stopProcess({ name, onlyIfAlive: true }),
      )
    stops.set(name, pending)
    return pending
  }

  await Promise.allSettled(nodes.map(node => stop(node.name)))
  return { ok: true }
}
