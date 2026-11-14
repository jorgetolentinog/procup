import { expect, test } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { markProcessStarted } from './mark-process-started.ts'

test('a process that starts is marked started, however it was started', () => {
  for (const before of ['waiting', 'skipped', 'ready', 'failed'] as const) {
    const state: OrchestrationState = {
      nodes: new Map([['api', { name: 'api', dependsOn: ['db'], autostart: true, state: before }]]),
      stopping: false,
    }

    const result = markProcessStarted({ state }, { name: 'api' })

    expect(result).toStrictEqual({ ok: true })
    expect(state.nodes.get('api')?.state).toBe('started')
  }
})

test('an unknown process is reported', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }

  const result = markProcessStarted({ state }, { name: 'ghost' })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
})
