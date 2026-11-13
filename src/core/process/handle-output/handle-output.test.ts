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
    readyCaptures: new Map(),
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
    readyCaptures: new Map(),
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

test('the readyPattern can match across chunks', () => {
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
          readyPattern: /listening on port/,
          showCommand: true,
          status: 'running',
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

test('colors and escape codes are ignored when matching the readyPattern', () => {
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
          readyPattern: /ready in \d+ms/,
          showCommand: true,
          status: 'running',
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

  const result = handleOutput(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', chunk: '\x1b[1mready\x1b[0m in \x1b[33m120\x1b[0mms' },
  )

  expect(result).toStrictEqual({ ok: true, becameReady: true })
})

test('named and positional captures are kept for the dependents', () => {
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
          readyPattern: /port (?<port>\d+) on (\w+)( with tls)?/,
          showCommand: true,
          status: 'running',
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

  handleOutput(
    { emit: event => events.push(event) },
    { state },
    { name: 'db', chunk: 'listening on port 5432 on localhost' },
  )

  expect(state.readyCaptures.get('db')).toStrictEqual({ port: '5432', 1: '5432', 2: 'localhost' })
})

test('a readyPattern without groups stores no captures', () => {
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
          readyPattern: /ready/,
          showCommand: true,
          status: 'running',
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

  handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'ready' })

  expect(state.readyCaptures.has('web')).toBe(false)
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
          readyPattern: /ready/,
          showCommand: true,
          status: 'ready',
        },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(['web']),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'ready again' })

  expect(result).toStrictEqual({ ok: true, becameReady: false })
  expect(events).toStrictEqual([{ type: 'output', name: 'web', chunk: 'ready again' }])
})

test('without a readyPattern output never makes a process ready', () => {
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
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  handleOutput({ emit: event => events.push(event) }, { state }, { name: 'web', chunk: 'ready' })

  expect(state.rows.get('web')?.status).toBe('running')
  expect(state.readyBuffers.has('web')).toBe(false)
})
