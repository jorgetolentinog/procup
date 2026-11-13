import { expect, test } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { handleExit } from './handle-exit.ts'

test('an unknown process is not found', () => {
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

  const result = handleExit({ emit: event => events.push(event) }, { state }, { name: 'web', exitCode: 0, signal: 0 })

  expect(result).toStrictEqual({ ok: false, error: 'not_found' })
  expect(events).toStrictEqual([])
})

test('a one-shot task exiting with 0 becomes ready and then finished', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'migrate',
        {
          name: 'migrate',
          command: 'migrate',
          cwd: '/app',
          env: {},
          dependsOn: [],
          showCommand: true,
          status: 'running',
          pid: 42,
        },
      ],
    ]),
    ptys: new Map([
      ['migrate', { pid: 42, onData: () => true, onExit: () => true, write: () => true, resize: () => true }],
    ]),
    readyBuffers: new Map([['migrate', 'partial']]),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleExit(
    { emit: event => events.push(event) },
    { state },
    { name: 'migrate', exitCode: 0, signal: 0 },
  )

  expect(result).toStrictEqual({ ok: true, status: 'finished' })
  expect(events).toStrictEqual([
    { type: 'status', name: 'migrate', status: 'ready' },
    { type: 'status', name: 'migrate', status: 'finished' },
    { type: 'exited', name: 'migrate', exitCode: 0 },
  ])
  expect(state.rows.get('migrate')?.status).toBe('finished')
  expect(state.rows.get('migrate')?.exitCode).toBe(0)
  expect(state.rows.get('migrate')?.pid).toBe(undefined)
  expect(state.ptys.has('migrate')).toBe(false)
  expect(state.readyBuffers.has('migrate')).toBe(false)
  expect(state.readied.has('migrate')).toBe(true)
})

test('a process with readyText exiting with 0 finishes without becoming ready', () => {
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
          readyText: 'up',
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

  handleExit({ emit: event => events.push(event) }, { state }, { name: 'db', exitCode: 0, signal: 0 })

  expect(events).toStrictEqual([
    { type: 'status', name: 'db', status: 'finished' },
    { type: 'exited', name: 'db', exitCode: 0 },
  ])
})

test('a task that was already ready does not become ready twice', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'job',
        { name: 'job', command: 'job', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(['job']),
    stopping: new Set(),
    restarting: new Set(),
  }

  handleExit({ emit: event => events.push(event) }, { state }, { name: 'job', exitCode: 0, signal: 0 })

  expect(events.filter(event => event.type === 'status')).toStrictEqual([
    { type: 'status', name: 'job', status: 'finished' },
  ])
})

test('a non-zero exit fails and prints the exit code in the pane', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'boom',
        { name: 'boom', command: 'boom', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = handleExit({ emit: event => events.push(event) }, { state }, { name: 'boom', exitCode: 3, signal: 0 })

  expect(result).toStrictEqual({ ok: true, status: 'failed' })
  expect(events).toStrictEqual([
    { type: 'output', name: 'boom', chunk: '\r\n\x1b[31m[procup] exit 3\x1b[0m\r\n' },
    { type: 'status', name: 'boom', status: 'failed' },
    { type: 'exited', name: 'boom', exitCode: 3 },
  ])
  expect(state.rows.get('boom')?.exitCode).toBe(3)
})

test('exit 127 explains that the command was not found', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'typo',
        { name: 'typo', command: 'nope', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  handleExit({ emit: event => events.push(event) }, { state }, { name: 'typo', exitCode: 127, signal: 0 })

  expect(events.filter(event => event.type === 'output')).toStrictEqual([
    { type: 'output', name: 'typo', chunk: '\r\n\x1b[31m[procup] exit 127: command not found\x1b[0m\r\n' },
  ])
  expect(state.rows.get('typo')?.status).toBe('failed')
})

test('exit 126 explains that permission was denied', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'script',
        { name: 'script', command: './run', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  handleExit({ emit: event => events.push(event) }, { state }, { name: 'script', exitCode: 126, signal: 0 })

  expect(events.filter(event => event.type === 'output')).toStrictEqual([
    { type: 'output', name: 'script', chunk: '\r\n\x1b[31m[procup] exit 126: permission denied\x1b[0m\r\n' },
  ])
})

test('a process killed by a signal fails with no exit code and no exit line', () => {
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

  const result = handleExit({ emit: event => events.push(event) }, { state }, { name: 'web', exitCode: 0, signal: 9 })

  expect(result).toStrictEqual({ ok: true, status: 'failed' })
  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'failed' },
    { type: 'exited', name: 'web', exitCode: null },
  ])
  expect(state.rows.get('web')?.exitCode).toBe(null)
})

test('a process that was being stopped ends as stopped', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'stopping' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(['web']),
    restarting: new Set(),
  }

  const result = handleExit({ emit: event => events.push(event) }, { state }, { name: 'web', exitCode: 0, signal: 15 })

  expect(result).toStrictEqual({ ok: true, status: 'stopped' })
  expect(events).toStrictEqual([
    { type: 'status', name: 'web', status: 'stopped' },
    { type: 'exited', name: 'web', exitCode: null },
  ])
  expect(state.stopping.has('web')).toBe(false)
})

test('a process being restarted exits without a final status', () => {
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
          status: 'stopping',
          pid: 42,
        },
      ],
    ]),
    ptys: new Map([
      ['web', { pid: 42, onData: () => true, onExit: () => true, write: () => true, resize: () => true }],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(['web']),
  }

  const result = handleExit({ emit: event => events.push(event) }, { state }, { name: 'web', exitCode: 0, signal: 15 })

  expect(result).toStrictEqual({ ok: true, status: 'stopping' })
  expect(events).toStrictEqual([])
  expect(state.rows.get('web')?.status).toBe('stopping')
  expect(state.ptys.has('web')).toBe(false)
})
