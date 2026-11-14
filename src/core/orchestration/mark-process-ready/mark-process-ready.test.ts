import { expect, test } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { markProcessReady } from './mark-process-ready.ts'

test('a ready process starts the dependents whose dependencies are all ready', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'waiting' as const }],
      ['web', { name: 'web', dependsOn: ['db', 'api'], autostart: true, state: 'waiting' as const }],
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
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'started' as const }],
      ['web', { name: 'web', dependsOn: ['db', 'api'], autostart: true, state: 'waiting' as const }],
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

test('while the project is stopping nothing new is started', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'waiting' as const }],
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

test('a process without autostart is not started when its dependencies are ready', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'started' as const }],
      ['studio', { name: 'studio', dependsOn: ['db'], autostart: false, state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, started: [] })
  expect(spawned).toStrictEqual([])
  expect(state.nodes.get('studio')?.state).toBe('waiting')
})

test('once a process without autostart is started by hand and ready, its dependents start', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['studio', { name: 'studio', dependsOn: [], autostart: false, state: 'waiting' as const }],
      ['seed', { name: 'seed', dependsOn: ['studio'], autostart: true, state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'studio' })

  expect(result).toStrictEqual({ ok: true, started: ['seed'] })
  expect(spawned).toStrictEqual(['seed'])
  expect([...state.nodes.values()].map(n => [n.name, n.state])).toStrictEqual([
    ['studio', 'ready'],
    ['seed', 'started'],
  ])
})

test('skipped processes start once their dependencies are ready again', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'skipped' as const }],
      ['web', { name: 'web', dependsOn: ['api'], autostart: true, state: 'skipped' as const }],
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
    ['web', 'skipped'],
  ])
})

test('a dependent that was already started, by hand or not, is not started again', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'started' as const }],
      ['web', { name: 'web', dependsOn: ['db'], autostart: true, state: 'ready' as const }],
      ['jobs', { name: 'jobs', dependsOn: ['db'], autostart: true, state: 'failed' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = markProcessReady(deps, { state }, { name: 'db' })

  expect(result).toStrictEqual({ ok: true, started: [] })
  expect(spawned).toStrictEqual([])
})
