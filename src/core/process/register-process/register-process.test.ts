import { expect, test } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { registerProcess } from './register-process.ts'

test('a registered process starts as pending with the defaults', () => {
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

  const result = registerProcess(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', command: 'npm run dev', cwd: '/app' },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(state.rows.get('web')).toStrictEqual({
    name: 'web',
    command: 'npm run dev',
    cwd: '/app',
    env: {},
    envFile: undefined,
    dependsOn: [],
    readyPattern: undefined,
    showCommand: true,
    status: 'pending',
  })
  expect(events).toStrictEqual([{ type: 'status', name: 'web', status: 'pending' }])
})

test('the given options are kept', () => {
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
  const readyPattern = /listening/

  registerProcess(
    { emit: event => events.push(event) },
    { state },
    {
      name: 'api',
      command: 'npm start',
      cwd: '/app/api',
      env: { PORT: '3000' },
      envFile: ['.env', '.env.local'],
      dependsOn: ['db'],
      readyPattern,
      showCommand: false,
    },
  )

  expect(state.rows.get('api')).toStrictEqual({
    name: 'api',
    command: 'npm start',
    cwd: '/app/api',
    env: { PORT: '3000' },
    envFile: ['.env', '.env.local'],
    dependsOn: ['db'],
    readyPattern,
    showCommand: false,
    status: 'pending',
  })
})

test('the name is trimmed', () => {
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

  registerProcess({ emit: event => events.push(event) }, { state }, { name: '  web ', command: 'web', cwd: '/app' })

  expect([...state.rows.keys()]).toStrictEqual(['web'])
})

test('a blank name is rejected', () => {
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

  const result = registerProcess(
    { emit: event => events.push(event) },
    { state },
    { name: '  ', command: 'web', cwd: '/app' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'invalid_name' })
  expect(state.rows.size).toBe(0)
  expect(events).toStrictEqual([])
})

test('a blank command is rejected', () => {
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

  const result = registerProcess(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', command: ' ', cwd: '/app' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'invalid_command' })
  expect(state.rows.size).toBe(0)
})

test('a name can be registered only once', () => {
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

  registerProcess({ emit: event => events.push(event) }, { state }, { name: 'web', command: 'first', cwd: '/app' })
  const result = registerProcess(
    { emit: event => events.push(event) },
    { state },
    { name: 'web', command: 'second', cwd: '/app' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'duplicate_name' })
  expect(state.rows.get('web')?.command).toBe('first')
  expect(events.length).toBe(1)
})
