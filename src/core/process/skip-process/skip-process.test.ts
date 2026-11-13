import { expect, test } from 'vitest'
import type { ProcessEvent } from '../events.ts'
import type { ProcessState } from '../state.ts'
import { skipProcess } from './skip-process.ts'

test('a pending process is skipped', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'api',
        { name: 'api', command: 'api', cwd: '/app', env: {}, dependsOn: ['db'], showCommand: true, status: 'pending' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = skipProcess({ emit: event => events.push(event) }, { state }, { name: 'api' })

  expect(result).toStrictEqual({ ok: true })
  expect(state.rows.get('api')?.status).toBe('skipped')
  expect(events).toStrictEqual([{ type: 'status', name: 'api', status: 'skipped' }])
})

test('a process that already started is not skipped', () => {
  const events: ProcessEvent[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'api',
        { name: 'api', command: 'api', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = skipProcess({ emit: event => events.push(event) }, { state }, { name: 'api' })

  expect(result).toStrictEqual({ ok: false, error: 'already_started' })
  expect(state.rows.get('api')?.status).toBe('running')
  expect(events).toStrictEqual([])
})

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

  expect(skipProcess({ emit: event => events.push(event) }, { state }, { name: 'api' })).toStrictEqual({
    ok: false,
    error: 'not_found',
  })
})
