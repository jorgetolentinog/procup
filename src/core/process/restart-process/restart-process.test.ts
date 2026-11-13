import { expect, test, vi } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { restartProcess } from './restart-process.ts'

test('an unknown process is not found', async () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: () => true,
    spawnProcess: () => ({ ok: true as const }),
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const result = await restartProcess(deps, { state }, { name: 'web' })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
  expect(deps.nodeProcess.kill).not.toHaveBeenCalled()
})

test('a pending, stopping or skipped process cannot be restarted', async () => {
  const statuses = ['pending', 'stopping', 'skipped'] as const
  await Promise.all(
    statuses.map(async status => {
      const spawned: string[] = []
      const state: ProcessState = {
        size: { cols: 80, rows: 24 },
        rows: new Map([
          ['web', { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status }],
        ]),
        ptys: new Map(),
        readyBuffers: new Map(),
        readied: new Set(),
        stopping: new Set(),
        restarting: new Set(),
      }
      const deps = {
        emit: () => true,
        spawnProcess: (input: { name: string }) => {
          spawned.push(input.name)
          return { ok: true as const }
        },
        nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
        nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
      }

      const result = await restartProcess(deps, { state }, { name: 'web' })

      expect(result).toStrictEqual({ ok: false, error: 'not_restartable' })
      expect(spawned).toStrictEqual([])
      expect(deps.nodeProcess.kill).not.toHaveBeenCalled()
    }),
  )
})

test('a dead process is spawned again right away without its last exit code', async () => {
  const events: ProcessEvent[] = []
  const seen: { status: string | undefined; exitCode: number | null | undefined; pid: number | undefined }[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'failed',
          exitCode: 1,
          pid: 5,
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: (event: ProcessEvent) => events.push(event),
    spawnProcess: (input: { name: string }) => {
      const row = state.rows.get(input.name)
      seen.push({ status: row?.status, exitCode: row?.exitCode, pid: row?.pid })
      return { ok: true as const }
    },
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const result = await restartProcess(deps, { state }, { name: 'web' })

  expect(result).toStrictEqual({ ok: true })
  expect(seen).toStrictEqual([{ status: 'stopped', exitCode: undefined, pid: undefined }])
  expect(events).toStrictEqual([])
  expect(deps.nodeProcess.kill).not.toHaveBeenCalled()
})

test('a running process is terminated, and spawned again once it exits, with no exit status', async () => {
  const exitListeners: (() => void)[] = []
  const events: ProcessEvent[] = []
  const spawned: string[] = []
  const cleared: unknown[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'running',
          pid: 4194305,
        },
      ],
    ]),
    ptys: new Map([
      [
        'web',
        {
          pid: 4194305,
          onData: () => true,
          onExit: listener => exitListeners.push(() => listener({ exitCode: 0, signal: 15 })),
          write: () => true,
          resize: () => true,
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: (event: ProcessEvent) => events.push(event),
    spawnProcess: (input: { name: string }) => {
      spawned.push(input.name)
      return { ok: true as const }
    },
    nodeTimers: { setTimeout: () => 'force-kill', clearTimeout: (handle: unknown) => cleared.push(handle) },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const restarted = restartProcess(deps, { state }, { name: 'web' })

  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([[-4194305, 'SIGTERM']])
  expect(state.rows.get('web')?.status).toBe('stopping')
  expect(state.restarting.has('web')).toBe(true)
  expect(spawned).toStrictEqual([])

  for (const exit of exitListeners) exit()
  const result = await restarted

  expect(result).toStrictEqual({ ok: true })
  expect(cleared).toStrictEqual(['force-kill'])
  expect(spawned).toStrictEqual(['web'])
  expect(state.restarting.has('web')).toBe(false)
  expect(events).toStrictEqual([{ type: 'status', name: 'web', status: 'stopping' }])
})

test('a process that ignores SIGTERM is killed after 2 seconds', async () => {
  const exitListeners: (() => void)[] = []
  const scheduled: { callback: () => void; ms: number }[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'running',
          pid: 4194305,
        },
      ],
    ]),
    ptys: new Map([
      [
        'web',
        {
          pid: 4194305,
          onData: () => true,
          onExit: listener => exitListeners.push(() => listener({ exitCode: 0, signal: 9 })),
          write: () => true,
          resize: () => true,
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: () => true,
    spawnProcess: () => ({ ok: true as const }),
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => scheduled.push({ callback, ms }),
      clearTimeout: () => true,
    },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const restarted = restartProcess(deps, { state }, { name: 'web' })

  expect(scheduled.map(timer => timer.ms)).toStrictEqual([2000])
  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([[-4194305, 'SIGTERM']])

  for (const timer of scheduled) timer.callback()
  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([
    [-4194305, 'SIGTERM'],
    [-4194305, 'SIGKILL'],
  ])

  for (const exit of exitListeners) exit()
  expect(await restarted).toStrictEqual({ ok: true })
})

test('a process group that is already gone is not an error', async () => {
  const exitListeners: (() => void)[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'running',
          pid: 4194305,
        },
      ],
    ]),
    ptys: new Map([
      [
        'web',
        {
          pid: 4194305,
          onData: () => true,
          onExit: listener => exitListeners.push(() => listener({ exitCode: 0 })),
          write: () => true,
          resize: () => true,
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: () => true,
    spawnProcess: () => ({ ok: true as const }),
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: {
      kill: () => {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
      },
    },
  }

  const restarted = restartProcess(deps, { state }, { name: 'web' })
  for (const exit of exitListeners) exit()

  expect(await restarted).toStrictEqual({ ok: true })
})

test('any other error while killing is not hidden', async () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'running',
          pid: 4194305,
        },
      ],
    ]),
    ptys: new Map([
      ['web', { pid: 4194305, onData: () => true, onExit: () => true, write: () => true, resize: () => true }],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const deps = {
    emit: () => true,
    spawnProcess: () => ({ ok: true as const }),
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: {
      kill: () => {
        throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' })
      },
    },
  }

  await expect(restartProcess(deps, { state }, { name: 'web' })).rejects.toThrow(/EPERM/)
})
