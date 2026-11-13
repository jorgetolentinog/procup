import { expect, test } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { startProject } from './start-project.ts'

test('it spawns only the processes without dependencies', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'waiting' as const }],
      ['cache', { name: 'cache', dependsOn: [], state: 'waiting' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = startProject(deps, { state })

  expect(result).toStrictEqual({ ok: true, started: ['db', 'cache'] })
  expect(spawned).toStrictEqual(['db', 'cache'])
  expect([...state.nodes.values()].map(n => [n.name, n.state])).toStrictEqual([
    ['db', 'started'],
    ['cache', 'started'],
    ['api', 'waiting'],
  ])
})

test('a node is marked started before its process is spawned', () => {
  const state: OrchestrationState = {
    nodes: new Map([['db', { name: 'db', dependsOn: [], state: 'waiting' as const }]]),
    stopping: false,
  }
  const seen: unknown[] = []
  const deps = {
    process: {
      spawnProcess: (input: { name: string }) => seen.push({ ...state.nodes.get(input.name) }),
    },
  }

  startProject(deps, { state })

  expect(seen).toStrictEqual([{ name: 'db', dependsOn: [], state: 'started' }])
})

test('without a loaded project there is nothing to start', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = startProject(deps, { state })

  expect(result).toStrictEqual({ ok: false, error: 'not_loaded' })
  expect(spawned).toStrictEqual([])
})

test('starting twice is refused', () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], state: 'started' as const }],
      ['api', { name: 'api', dependsOn: ['db'], state: 'waiting' as const }],
    ]),
    stopping: false,
  }
  const spawned: string[] = []
  const deps = { process: { spawnProcess: (input: { name: string }) => spawned.push(input.name) } }

  const result = startProject(deps, { state })

  expect(result).toStrictEqual({ ok: false, error: 'already_started' })
  expect(spawned).toStrictEqual([])
})
