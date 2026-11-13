import { stripVTControlCharacters } from 'node:util'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'

const READY_BUFFER_SIZE = 65_536

export type HandleOutputInput = { name: string; chunk: string }

export type HandleOutputDeps = {
  emit: (event: ProcessEvent) => void
}

export type HandleOutputCtx = { state: ProcessState }

export type HandleOutputResult = { ok: true; becameReady: boolean } | { ok: false; error: 'not_found' }

export function handleOutput(
  deps: HandleOutputDeps,
  ctx: HandleOutputCtx,
  input: HandleOutputInput,
): HandleOutputResult {
  const row = ctx.state.rows.get(input.name)
  if (!row) return { ok: false, error: 'not_found' }

  let becameReady = false

  if (row.readyText !== undefined && !ctx.state.readied.has(row.name)) {
    const buffer = ((ctx.state.readyBuffers.get(row.name) ?? '') + input.chunk).slice(-READY_BUFFER_SIZE)
    const clean = stripVTControlCharacters(buffer)

    if (clean.includes(row.readyText)) {
      ctx.state.readied.add(row.name)
      ctx.state.readyBuffers.delete(row.name)
      ctx.state.rows.set(row.name, { ...row, status: 'ready' })
      becameReady = true
    } else {
      ctx.state.readyBuffers.set(row.name, buffer)
    }
  }

  deps.emit({ type: 'output', name: row.name, chunk: input.chunk })
  if (becameReady) deps.emit({ type: 'status', name: row.name, status: 'ready' })

  return { ok: true, becameReady }
}
