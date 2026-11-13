import { expect, test } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { handleOutput } from './handle-output.ts'

test('output of an unknown process is not found', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'hi' })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
  expect(events).toStrictEqual([])
})

test('output is forwarded as is', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', chunk: '\x1b[32mhello\x1b[0m\r\n' },
  )

  expect(result).toStrictEqual({ ok: true, becameReady: false })
  expect(events).toStrictEqual([{ type: 'output', name: 'web', chunk: '\x1b[32mhello\x1b[0m\r\n' }])
  expect(state.rows.get('web')?.status).toBe('running')
})

test('the readyText can match across chunks', () => {
  const events: ProcessEvent[] = []
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
          readyText: 'listening on port',
          showCommand: true,
          status: 'running',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const first = handleOutput({ emit: event => events.push(event) }, { state }, { name: 'db', chunk: 'listening on po' })
  const second = handleOutput({ emit: event => events.push(event) }, { state }, { name: 'db', chunk: 'rt 5432\r\n' })

  expect(first).toStrictEqual({ ok: true, becameReady: false })
  expect(second).toStrictEqual({ ok: true, becameReady: true })
  expect(events).toStrictEqual([
    { type: 'output', name: 'db', chunk: 'listening on po' },
    { type: 'output', name: 'db', chunk: 'rt 5432\r\n' },
    { type: 'status', name: 'db', status: 'ready' },
  ])
  expect(state.rows.get('db')?.status).toBe('ready')
  expect(state.readied.has('db')).toBe(true)
  expect(state.readyBuffers.has('db')).toBe(false)
})

test('colors and escape codes are ignored when matching the readyText', () => {
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
          readyText: 'ready in 120ms',
          showCommand: true,
          status: 'running',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', chunk: '\x1b[1mready\x1b[0m in \x1b[33m120\x1b[0mms' },
  )

  expect(result).toStrictEqual({ ok: true, becameReady: true })
})

test('the readyText is matched as plain text, not as a regex', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'api',
        {
          name: 'api',
          command: 'api',
          cwd: '/app',
          env: {},
          dependsOn: [],
          readyText: 'listening on port (3000)',
          showCommand: true,
          status: 'running',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput(
    { emit: event => events.push(event) },
    { state },
    { name: 'api', chunk: 'listening on port (3000)\r\n' },
  )

  expect(result).toStrictEqual({ ok: true, becameReady: true })
})

test('a process that is already ready does not become ready again', () => {
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
          readyText: 'ready',
          showCommand: true,
          status: 'ready',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(['web']),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'ready again' })

  expect(result).toStrictEqual({ ok: true, becameReady: false })
  expect(events).toStrictEqual([{ type: 'output', name: 'web', chunk: 'ready again' }])
})

test('without a readyText output never makes a process ready', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'ready' })

  expect(state.rows.get('web')?.status).toBe('running')
  expect(state.readyBuffers.has('web')).toBe(false)
})
