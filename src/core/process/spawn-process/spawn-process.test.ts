import { expect, test, vi } from 'vitest'
import { parseEnv } from 'node:util'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState, PtyHandle } from '../state.ts'
import { spawnProcess } from './spawn-process.ts'

test('an unknown process is not found', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: { spawn: () => expect.unreachable('should not spawn') },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: () => true,
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
})

test('a process that is alive or skipped cannot be spawned', () => {
  for (const status of ['starting', 'running', 'ready', 'stopping', 'skipped'] as const) {
    const events: ProcessEvent[] = []
    const state: ProcessState = {
      size: { cols: 80, rows: 24 },
      rows: new Map([
        ['web', { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status }],
      ]),
      ptys: new Map(),
      readyBuffers: new Map(),
      readied: new Set(),
      readyCaptures: new Map(),
      stopping: new Set(),
      restarting: new Set(),
    }

    const result = spawnProcess(
      {
        nodePty: { spawn: () => expect.unreachable('should not spawn') },
        nodeFs: { readFileSync: () => '' },
        nodeUtil: { parseEnv },
        nodeProcess: { env: { PATH: '/usr/bin' } },
        emit: event => events.push(event),
        handleOutput: () => true,
        handleExit: () => true,
      },
      { state },
      { name: 'web' },
    )

    expect(result).toStrictEqual({ ok: false, error: 'not_startable' })
    expect(events).toStrictEqual([])
  }
})

test('the command runs in a shell with the process cwd, terminal size and env', () => {
  const events: ProcessEvent[] = []
  const spawned: {
    file: string
    args: string[]
    cwd: string
    cols: number
    rows: number
    env: Record<string, string | undefined>
  }[] = []
  const pty: PtyHandle = { pid: 77, onData: () => true, onExit: () => true, write: () => true, resize: () => true }
  const state: ProcessState = {
    size: { cols: 120, rows: 40 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'npm run dev',
          cwd: '/app/web',
          env: { PORT: '3000' },
          dependsOn: [],
          showCommand: true,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: {
        spawn: (file, args, options) => {
          spawned.push({ file, args, cwd: options.cwd, cols: options.cols, rows: options.rows, env: options.env })
          return pty
        },
      },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: event => events.push(event),
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(spawned.map(call => [call.file, call.args, call.cwd, call.cols, call.rows])).toStrictEqual([
    ['sh', ['-c', 'npm run dev'], '/app/web', 120, 40],
  ])
  expect(spawned.map(call => [call.env.PORT, call.env.TERM, call.env.PATH])).toStrictEqual([
    ['3000', 'xterm-256color', '/usr/bin'],
  ])
  expect(state.rows.get('web')?.status).toBe('running')
  expect(state.rows.get('web')?.pid).toBe(77)
  expect(state.ptys.get('web')).toBe(pty)
  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'starting' },
    { type: 'output', name: 'web', chunk: '\x1b[2m$ npm run dev\x1b[0m\r\n\r\n' },
    { type: 'status', name: 'web', status: 'running' },
  ])
})

test('with showCommand off the command line is not printed', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'npm run dev',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: false,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  spawnProcess(
    {
      nodePty: {
        spawn: () => ({ pid: 1, onData: () => true, onExit: () => true, write: () => true, resize: () => true }),
      },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: event => events.push(event),
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'starting' },
    { type: 'status', name: 'web', status: 'running' },
  ])
})

test('a stopped, finished or failed process starts over with a clean readiness', () => {
  for (const status of ['stopped', 'finished', 'failed'] as const) {
    const state: ProcessState = {
      size: { cols: 80, rows: 24 },
      rows: new Map([
        [
          'db',
          {
            name: 'db',
            command: 'db',
            cwd: '/app',
            env: {},
            dependsOn: [],
            readyPattern: /up/,
            showCommand: false,
            status,
            exitCode: 1,
          },
        ],
      ]),
      ptys: new Map(),
      readyBuffers: new Map([['db', 'old output']]),
      readied: new Set(['db']),
      readyCaptures: new Map(),
      stopping: new Set(['db']),
      restarting: new Set(),
    }

    const result = spawnProcess(
      {
        nodePty: {
          spawn: () => ({ pid: 1, onData: () => true, onExit: () => true, write: () => true, resize: () => true }),
        },
        nodeFs: { readFileSync: () => '' },
        nodeUtil: { parseEnv },
        nodeProcess: { env: { PATH: '/usr/bin' } },
        emit: () => true,
        handleOutput: () => true,
        handleExit: () => true,
      },
      { state },
      { name: 'db' },
    )

    expect(result).toStrictEqual({ ok: true })
    expect(state.rows.get('db')?.status).toBe('running')
    expect(state.rows.get('db')?.exitCode).toBe(undefined)
    expect(state.readyBuffers.has('db')).toBe(false)
    expect(state.readied.has('db')).toBe(false)
    expect(state.stopping.has('db')).toBe(false)
  }
})

test('the output and the exit of the process are handed over', () => {
  const dataListeners: ((chunk: string) => void)[] = []
  const exitListeners: ((event: { exitCode: number; signal?: number }) => void)[] = []
  const outputs: { name: string; chunk: string }[] = []
  const exits: { name: string; exitCode: number; signal: number }[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: false, status: 'pending' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  spawnProcess(
    {
      nodePty: {
        spawn: () => ({
          pid: 1,
          onData: listener => dataListeners.push(listener),
          onExit: listener => exitListeners.push(listener),
          write: () => true,
          resize: () => true,
        }),
      },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: () => true,
      handleOutput: input => outputs.push(input),
      handleExit: input => exits.push(input),
    },
    { state },
    { name: 'web' },
  )
  for (const listener of dataListeners) listener('hello')
  for (const listener of exitListeners) listener({ exitCode: 1 })
  for (const listener of exitListeners) listener({ exitCode: 0, signal: 15 })

  expect(outputs).toStrictEqual([{ name: 'web', chunk: 'hello' }])
  expect(exits).toStrictEqual([
    { name: 'web', exitCode: 1, signal: 0 },
    { name: 'web', exitCode: 0, signal: 15 },
  ])
})

test('$dependency.group is replaced in the command and env with what the dependency captured', () => {
  const spawned: { command: string | undefined; env: Record<string, string | undefined> }[] = []
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'api',
        {
          name: 'api',
          command: 'start --db $db.port --missing $db.nope --other $cache.port',
          cwd: '/app',
          env: { DATABASE_URL: 'postgres://localhost:$db.port/app', PLAIN: 'value' },
          dependsOn: ['db'],
          showCommand: true,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map<string, Record<string, string>>([
      ['db', { port: '5432', 1: '5432' }],
      ['cache', { port: '6379' }],
    ]),
    stopping: new Set(),
    restarting: new Set(),
  }

  spawnProcess(
    {
      nodePty: {
        spawn: (_file, args, options) => {
          spawned.push({ command: args[1], env: options.env })
          return { pid: 1, onData: () => true, onExit: () => true, write: () => true, resize: () => true }
        },
      },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: event => events.push(event),
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'api' },
  )

  expect(spawned.map(call => [call.command, call.env.DATABASE_URL, call.env.PLAIN])).toStrictEqual([
    ['start --db 5432 --missing $db.nope --other $cache.port', 'postgres://localhost:5432/app', 'value'],
  ])
  expect(state.rows.get('api')?.command).toBe('start --db $db.port --missing $db.nope --other $cache.port')
  expect(state.rows.get('api')?.commandOverride).toBe('start --db 5432 --missing $db.nope --other $cache.port')
  expect(events[1]).toStrictEqual({
    type: 'output',
    name: 'api',
    chunk: '\x1b[2m$ start --db 5432 --missing $db.nope --other $cache.port\x1b[0m\r\n\r\n',
  })
})

test('env files are read from the process cwd in order and the process env wins', () => {
  const spawned: Record<string, string | undefined>[] = []
  const readFileSync = vi
    .fn<(path: string, encoding: 'utf-8') => string>()
    .mockReturnValueOnce('A=from-env\nB=from-env\nPORT=1')
    .mockReturnValueOnce('B=from-local')
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        {
          name: 'web',
          command: 'web',
          cwd: '/app/web',
          env: { PORT: '3000' },
          envFile: ['.env', '.env.local'],
          dependsOn: [],
          showCommand: false,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: {
        spawn: (_file, _args, options) => {
          spawned.push(options.env)
          return { pid: 1, onData: () => true, onExit: () => true, write: () => true, resize: () => true }
        },
      },
      nodeFs: { readFileSync },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: () => true,
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(readFileSync.mock.calls).toStrictEqual([
    ['/app/web/.env', 'utf-8'],
    ['/app/web/.env.local', 'utf-8'],
  ])
  expect(spawned.map(env => [env.A, env.B, env.PORT])).toStrictEqual([['from-env', 'from-local', '3000']])
})

test('a missing env file fails the start and says which file', () => {
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
          envFile: '.env',
          dependsOn: [],
          showCommand: true,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: { spawn: () => expect.unreachable('should not spawn') },
      nodeFs: {
        readFileSync: () => {
          throw Object.assign(new Error("ENOENT: no such file or directory, open '/app/.env'"), { code: 'ENOENT' })
        },
      },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: event => events.push(event),
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'spawn_failed', message: 'envFile not found: /app/.env' })
  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'starting' },
    {
      type: 'output',
      name: 'web',
      chunk: '\r\n\x1b[31m[procup] failed to start: envFile not found: /app/.env\x1b[0m\r\n',
    },
    { type: 'status', name: 'web', status: 'failed' },
    { type: 'exited', name: 'web', exitCode: null },
  ])
  expect(state.rows.get('web')?.status).toBe('failed')
  expect(state.rows.get('web')?.exitCode).toBe(null)
  expect(state.ptys.has('web')).toBe(false)
})

test('an env file that cannot be read fails the start with the reason', () => {
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
          envFile: '.env',
          dependsOn: [],
          showCommand: true,
          status: 'pending',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: { spawn: () => expect.unreachable('should not spawn') },
      nodeFs: {
        readFileSync: () => {
          throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
        },
      },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: () => true,
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({
    ok: false,
    error: 'spawn_failed',
    message: 'Failed to read envFile "/app/.env": EACCES: permission denied',
  })
})

test('a shell that cannot be spawned fails the start', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/missing', env: {}, dependsOn: [], showCommand: true, status: 'pending' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = spawnProcess(
    {
      nodePty: {
        spawn: () => {
          throw new Error('posix_spawnp failed.')
        },
      },
      nodeFs: { readFileSync: () => '' },
      nodeUtil: { parseEnv },
      nodeProcess: { env: { PATH: '/usr/bin' } },
      emit: event => events.push(event),
      handleOutput: () => true,
      handleExit: () => true,
    },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'spawn_failed', message: 'posix_spawnp failed.' })
  expect(events.at(-2)).toStrictEqual({ type: 'status', name: 'web', status: 'failed' })
})
