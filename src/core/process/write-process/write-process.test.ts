import { expect, test } from 'vitest'
import type { ProcessState } from '../state.ts'
import { writeProcess } from './write-process.ts'

test('the data reaches the running process', () => {
  const written: string[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'repl',
        { name: 'repl', command: 'node', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'running' },
      ],
    ]),
    ptys: new Map([
      [
        'repl',
        { pid: 1, onData: () => true, onExit: () => true, write: data => written.push(data), resize: () => true },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = writeProcess({ state }, { name: 'repl', data: '1 + 1\r' })

  expect(result).toStrictEqual({ ok: true })
  expect(written).toStrictEqual(['1 + 1\r'])
})

test('a process that is not running cannot receive data', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'repl',
        { name: 'repl', command: 'node', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'stopped' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  expect(writeProcess({ state }, { name: 'repl', data: 'x' })).toStrictEqual({ ok: false, error: 'not_running' })
})

test('an unknown process is not found', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  expect(writeProcess({ state }, { name: 'repl', data: 'x' })).toStrictEqual({ ok: false, error: 'not_found' })
})
