import { expect, test, vi } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { stopProcess } from './stop-process.ts'

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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  expect(await stopProcess(deps, { state }, { name: 'web' })).toStrictEqual({ ok: false, error: 'not_found' })
  expect(deps.nodeProcess.kill).not.toHaveBeenCalled()
})

test('a process that is not alive has nothing to stop', async () => {
  const kill = vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>()
  const statuses = ['pending', 'stopped', 'finished', 'stopping', 'skipped'] as const
  await Promise.all(
    statuses.map(async status => {
      const events: ProcessEvent[] = []
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
        emit: (event: ProcessEvent) => events.push(event),
        nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
        nodeProcess: { kill },
      }

      const result = await stopProcess(deps, { state }, { name: 'web' })

      expect(result).toStrictEqual({ ok: true })
      expect(state.rows.get('web')?.status).toBe(status)
      expect(events).toStrictEqual([])
    }),
  )
  expect(kill).not.toHaveBeenCalled()
})

test('a running process gets SIGTERM and ends as stopped once it exits', async () => {
  const exitListeners: (() => void)[] = []
  const events: ProcessEvent[] = []
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
    nodeTimers: { setTimeout: () => 'force-kill', clearTimeout: (handle: unknown) => cleared.push(handle) },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const stopped = stopProcess(deps, { state }, { name: 'web' })

  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([[-4194305, 'SIGTERM']])
  expect(state.rows.get('web')?.status).toBe('stopping')
  expect(state.stopping.has('web')).toBe(true)

  for (const exit of exitListeners) exit()

  expect(await stopped).toStrictEqual({ ok: true })
  expect(cleared).toStrictEqual(['force-kill'])
  expect(state.rows.get('web')?.status).toBe('stopped')
  expect(state.stopping.has('web')).toBe(false)
  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'stopping' },
    { type: 'status', name: 'web', status: 'stopped' },
  ])
})

test('when the exit already marked it stopped, it is not announced twice', async () => {
  const exitListeners: (() => void)[] = []
  const events: ProcessEvent[] = []
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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: () => true },
  }

  const stopped = stopProcess(deps, { state }, { name: 'web' })
  state.rows.set('web', {
    name: 'web',
    command: 'web',
    cwd: '/app',
    env: {},
    dependsOn: [],
    showCommand: true,
    status: 'stopped',
    pid: 4194305,
  })
  for (const exit of exitListeners) exit()
  await stopped

  expect(events).toStrictEqual([{ type: 'status', name: 'web', status: 'stopping' }])
})

test('a failed process is marked as stopped when stopped by hand', async () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'boom',
        {
          name: 'boom',
          command: 'boom',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'failed',
          exitCode: 3,
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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const result = await stopProcess(deps, { state }, { name: 'boom' })

  expect(result).toStrictEqual({ ok: true })
  expect(state.rows.get('boom')?.status).toBe('stopped')
  expect(events).toStrictEqual([{ type: 'status', name: 'boom', status: 'stopped' }])
  expect(deps.nodeProcess.kill).not.toHaveBeenCalled()
})

test('stopping the project keeps the status of a process that already died', async () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'boom',
        {
          name: 'boom',
          command: 'boom',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'failed',
          exitCode: 3,
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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const result = await stopProcess(deps, { state }, { name: 'boom', onlyIfAlive: true })

  expect(result).toStrictEqual({ ok: true })
  expect(state.rows.get('boom')?.status).toBe('failed')
  expect(events).toStrictEqual([])
})

test('a process that ignores SIGTERM is killed after 5 seconds', async () => {
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
    nodeTimers: {
      setTimeout: (callback: () => void, ms: number) => scheduled.push({ callback, ms }),
      clearTimeout: () => true,
    },
    nodeProcess: { kill: vi.fn<(pid: number, signal: 'SIGTERM' | 'SIGKILL') => unknown>() },
  }

  const stopped = stopProcess(deps, { state }, { name: 'web' })

  expect(scheduled.map(timer => timer.ms)).toStrictEqual([5000])
  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([[-4194305, 'SIGTERM']])

  for (const timer of scheduled) timer.callback()
  expect(deps.nodeProcess.kill.mock.calls).toStrictEqual([
    [-4194305, 'SIGTERM'],
    [-4194305, 'SIGKILL'],
  ])

  for (const exit of exitListeners) exit()
  expect(await stopped).toStrictEqual({ ok: true })
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
          status: 'ready',
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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: {
      kill: () => {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
      },
    },
  }

  const stopped = stopProcess(deps, { state }, { name: 'web' })
  for (const exit of exitListeners) exit()

  expect(await stopped).toStrictEqual({ ok: true })
  expect(state.rows.get('web')?.status).toBe('stopped')
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
    nodeTimers: { setTimeout: () => 0, clearTimeout: () => true },
    nodeProcess: {
      kill: () => {
        throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' })
      },
    },
  }

  await expect(stopProcess(deps, { state }, { name: 'web' })).rejects.toThrow(/EPERM/)
})
