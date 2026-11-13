import { expect, test } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { markProcessReady } from './mark-process-ready.ts'

test('a ready process starts the dependents whose dependencies are all ready', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
      ['web', { name: 'web', dependsOn: ['db', 'api'], state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, started: ['api'] })
  expect(spawned).toStrictEqual(['api'])
  expect([...state.nodes.values()].map(n => [n.name, n.state])).toStrictEqual([
    ['db', 'ready'],
    ['api', 'started'],
    ['web', 'waiting'],
  ])
})

test('a dependent with several dependencies starts when the last one is ready', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'started' as const }],
      ['web', { name: 'web', dependsOn: ['db', 'api'], state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'api' })

  expect(result).toStrictEqual({ ok: true, started: ['web'] })
  expect(spawned).toStrictEqual(['web'])
  expect(state.nodes.get('web')?.state).toBe('started')
})

test('processes that are not waiting are not started again', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'failed' as const }],
      ['web', { name: 'web', dependsOn: ['db'], state: 'skipped' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, started: [] })
  expect(spawned).toStrictEqual([])
})

test('while the project is stopping nothing new is started', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
    ]),
    stopping: true,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, started: [] })
  expect(spawned).toStrictEqual([])
  expect(state.nodes.get('db')?.state).toBe('ready')
  expect(state.nodes.get('api')?.state).toBe('waiting')
})

test('an unknown process is reported', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const deps = { process: { spawnProcess: () => true } }

  const result = markProcessReady(deps, { state }, { name: 'ghost' })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
})
