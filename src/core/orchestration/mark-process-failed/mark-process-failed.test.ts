import { expect, test } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { markProcessFailed } from './mark-process-failed.ts'

test('a failure skips its waiting dependents down the chain', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
      ['web', { name: 'web', dependsOn: ['api'], state: 'waiting' as const }],
      ['docs', { name: 'docs', dependsOn: [], state: 'started' as const }],
    ]),
    stopping: false,
  }
  const skipped: string[] = []
  const deps = { process: { skipProcess: (input: { name: string }) => skipped.push(input.name) } }

  const result = markProcessFailed(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, skipped: ['api', 'web'] })
  expect(skipped).toStrictEqual(['api', 'web'])
  expect([...state.nodes.values()].map(n => [n.name, n.state])).toStrictEqual([
    ['db', 'failed'],
    ['api', 'skipped'],
    ['web', 'skipped'],
    ['docs', 'started'],
  ])
})

test('a dependent declared before its dependency is skipped too', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['web', { name: 'web', dependsOn: ['api'], state: 'waiting' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
    ]),
    stopping: false,
  }
  const deps = { process: { skipProcess: () => true } }

  const result = markProcessFailed(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, skipped: ['api', 'web'] })
  expect(state.nodes.get('web')?.state).toBe('skipped')
})

test('a dependent that already started is not skipped', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'started' as const }],
    ]),
    stopping: false,
  }
  const skipped: string[] = []
  const deps = { process: { skipProcess: (input: { name: string }) => skipped.push(input.name) } }

  const result = markProcessFailed(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, skipped: [] })
  expect(skipped).toStrictEqual([])
  expect(state.nodes.get('db')?.state).toBe('failed')
  expect(state.nodes.get('api')?.state).toBe('started')
})

test('processes are skipped in the graph before the process module hears about it', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
      ['web', { name: 'web', dependsOn: ['api'], state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const seen: string[] = []
  const deps = {
    process: {
      skipProcess: () => seen.push([...state.nodes.values()].map(n => n.state).join(',')),
    },
  }

  markProcessFailed(deps, { state }, { name: 'db' })

  expect(seen).toStrictEqual(['failed,skipped,skipped', 'failed,skipped,skipped'])
})

test('an unknown process is reported', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const deps = { process: { skipProcess: () => true } }

  const result = markProcessFailed(deps, { state }, { name: 'ghost' })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
})
