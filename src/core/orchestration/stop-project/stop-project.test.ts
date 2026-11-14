import { expect, test, vi } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { stopProject } from './stop-project.ts'

test('it stops dependents before their dependencies', async () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['cache', { name: 'cache', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db', 'cache'], autostart: true, state: 'ready' as const }],
      ['web', { name: 'web', dependsOn: ['api'], autostart: true, state: 'started' as const }],
    ]),
    stopping: false,
  }
  const stopped: string[] = []
  const deps = {
    process: {
      stopProcess: (input: { name: string }) => {
        stopped.push(input.name)
        return Promise.resolve()
      },
    },
  }

  const result = await stopProject(deps, { state })

  expect(result).toStrictEqual({ ok: true })
  expect(stopped).toStrictEqual(['web', 'api', 'db', 'cache'])
})

test('a dependency waits until its dependent has stopped', async () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'ready' as const }],
    ]),
    stopping: false,
  }
  const events: string[] = []
  const pending: (() => void)[] = []
  const deps = {
    process: {
      stopProcess: (input: { name: string }) => {
        events.push(`stop ${input.name}`)
        return new Promise<void>(resolve => {
          pending.push(() => {
            events.push(`stopped ${input.name}`)
            resolve()
          })
        })
      },
    },
  }

  const stopping = stopProject(deps, { state })
  await Promise.resolve()
  expect(events).toStrictEqual(['stop api'])

  pending.shift()?.()
  await new Promise(resolve => setImmediate(resolve))
  expect(events).toStrictEqual(['stop api', 'stopped api', 'stop db'])

  pending.shift()?.()
  await stopping
  expect(events).toStrictEqual(['stop api', 'stopped api', 'stop db', 'stopped db'])
})

test('a process that fails to stop does not block the rest', async () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'failed' as const }],
    ]),
    stopping: false,
  }
  const stopProcess = vi
    .fn<(input: { name: string }) => Promise<unknown>>()
    .mockRejectedValueOnce(new Error('already gone'))
    .mockResolvedValueOnce({ ok: true })
  const deps = { process: { stopProcess } }

  const result = await stopProject(deps, { state })

  expect(result).toStrictEqual({ ok: true })
  expect(stopProcess.mock.calls.map(([input]) => input.name)).toStrictEqual(['api', 'db'])
})

test('only live processes are stopped, keeping the state of the dead ones', async () => {
  const state: OrchestrationState = {
    nodes: new Map([['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }]]),
    stopping: false,
  }
  const received: unknown[] = []
  const deps = {
    process: {
      stopProcess: (input: unknown) => {
        received.push(input)
        return Promise.resolve()
      },
    },
  }

  await stopProject(deps, { state })

  expect(received).toStrictEqual([{ name: 'db', onlyIfAlive: true }])
})

test('the project is flagged as stopping before any process is stopped', async () => {
  const state: OrchestrationState = {
    nodes: new Map([['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }]]),
    stopping: false,
  }
  const seen: boolean[] = []
  const deps = {
    process: {
      stopProcess: () => {
        seen.push(state.stopping)
        return Promise.resolve()
      },
    },
  }

  await stopProject(deps, { state })

  expect(seen).toStrictEqual([true])
  expect(state.stopping).toBe(true)
})

test('an empty project stops at once', async () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const deps = { process: { stopProcess: () => Promise.resolve() } }

  const result = await stopProject(deps, { state })

  expect(result).toStrictEqual({ ok: true })
  expect(state.stopping).toBe(true)
})

test('independent processes do not wait for each other', async () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['cache', { name: 'cache', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'ready' as const }],
    ]),
    stopping: false,
  }
  const started: string[] = []
  const release: (() => void)[] = []
  const deps = {
    process: {
      stopProcess: (input: { name: string }) => {
        started.push(input.name)
        return new Promise<void>(resolve => release.push(resolve))
      },
    },
  }

  const stopping = stopProject(deps, { state })
  await new Promise(resolve => setImmediate(resolve))
  expect(started.toSorted()).toStrictEqual(['api', 'cache'])

  for (const done of release.splice(0)) done()
  await new Promise(resolve => setImmediate(resolve))
  expect(started.toSorted()).toStrictEqual(['api', 'cache', 'db'])

  for (const done of release.splice(0)) done()
  await stopping
})

test('a dependency shared by several dependents waits for all of them', async () => {
  const state: OrchestrationState = {
    nodes: new Map([
      ['db', { name: 'db', dependsOn: [], autostart: true, state: 'ready' as const }],
      ['api', { name: 'api', dependsOn: ['db'], autostart: true, state: 'ready' as const }],
      ['worker', { name: 'worker', dependsOn: ['db'], autostart: true, state: 'ready' as const }],
    ]),
    stopping: false,
  }
  const started: string[] = []
  const release = new Map<string, () => void>()
  const deps = {
    process: {
      stopProcess: (input: { name: string }) => {
        started.push(input.name)
        return new Promise<void>(resolve => release.set(input.name, resolve))
      },
    },
  }

  const stopping = stopProject(deps, { state })
  await new Promise(resolve => setImmediate(resolve))
  release.get('api')?.()
  await new Promise(resolve => setImmediate(resolve))
  expect(started.includes('db')).toBe(false)

  release.get('worker')?.()
  await new Promise(resolve => setImmediate(resolve))
  expect(started.includes('db')).toBe(true)

  release.get('db')?.()
  await stopping
})
