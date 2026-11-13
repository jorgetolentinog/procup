import { expect, test, vi } from 'vitest'
import type { OrchestrationState } from '../state.ts'
import { loadProject } from './load-project.ts'

test('it registers every process and leaves them waiting in the graph', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const registered: string[] = []
  const deps = {
    config: {
      loadConfig: () => ({
        ok: true as const,
        configPath: '/project/.procuprc',
        processes: [
          { name: 'db', command: 'db', cwd: '/project', env: {}, dependsOn: [], showCommand: true },
          { name: 'api', command: 'api', cwd: '/project', env: {}, dependsOn: ['db'], showCommand: true },
        ],
      }),
    },
    process: {
      registerProcess: (input: { name: string }) => {
        registered.push(input.name)
        return { ok: true as const }
      },
    },
  }

  const result = loadProject(deps, { state }, { cwd: '/project' })

  expect(result).toStrictEqual({ ok: true, configPath: '/project/.procuprc', processes: ['db', 'api'] })
  expect(registered).toStrictEqual(['db', 'api'])
  expect([...state.nodes.values()]).toStrictEqual([
    { name: 'db', dependsOn: [], state: 'waiting' },
    { name: 'api', dependsOn: ['db'], state: 'waiting' },
  ])
})

test('it passes the cwd, config path and env file to the config', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const received: unknown[] = []
  const deps = {
    config: {
      loadConfig: (input: unknown) => {
        received.push(input)
        return { ok: true as const, configPath: '/project/dev.json', processes: [] }
      },
    },
    process: { registerProcess: () => ({ ok: true as const }) },
  }

  loadProject(deps, { state }, { cwd: '/project', configPath: 'dev.json', envFile: false })

  expect(received).toStrictEqual([{ cwd: '/project', configPath: 'dev.json', envFile: false }])
})

test('a config error is returned as is and nothing is registered', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const registered: string[] = []
  const deps = {
    config: {
      loadConfig: () => ({
        ok: false as const,
        error: 'config_error',
        message: 'No procup config found. Create .procuprc',
      }),
    },
    process: {
      registerProcess: (input: { name: string }) => {
        registered.push(input.name)
        return { ok: true as const }
      },
    },
  }

  const result = loadProject(deps, { state }, { cwd: '/project' })

  expect(result).toStrictEqual({
    ok: false,
    error: 'config_error',
    message: 'No procup config found. Create .procuprc',
  })
  expect(registered).toStrictEqual([])
  expect(state.nodes.size).toBe(0)
})

test('a process that cannot be registered stops the load and names it', () => {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }
  const deps = {
    config: {
      loadConfig: () => ({
        ok: true as const,
        configPath: '/project/.procuprc',
        processes: [
          { name: 'db', command: 'db', cwd: '/project', env: {}, dependsOn: [], showCommand: true },
          { name: 'db', command: 'db', cwd: '/project', env: {}, dependsOn: [], showCommand: true },
        ],
      }),
    },
    process: {
      registerProcess: vi
        .fn<() => { ok: true } | { ok: false; error: string }>()
        .mockReturnValueOnce({ ok: true })
        .mockReturnValueOnce({ ok: false, error: 'duplicate_name' }),
    },
  }

  const result = loadProject(deps, { state }, { cwd: '/project' })

  expect(result).toStrictEqual({ ok: false, error: 'register_failed', message: 'db: duplicate_name' })
  expect(state.nodes.size).toBe(0)
})

test('loading twice is refused', () => {
  const state: OrchestrationState = {
    nodes: new Map([['db', { name: 'db', dependsOn: [], state: 'waiting' as const }]]),
    stopping: false,
  }
  let configReads = 0
  const deps = {
    config: {
      loadConfig: () => {
        configReads++
        return { ok: true as const, configPath: '/project/.procuprc', processes: [] }
      },
    },
    process: { registerProcess: () => ({ ok: true as const }) },
  }

  const result = loadProject(deps, { state }, { cwd: '/project' })

  expect(result).toStrictEqual({ ok: false, error: 'already_loaded', message: 'Project already loaded' })
  expect(configReads).toBe(0)
})
