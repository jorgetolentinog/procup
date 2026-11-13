import { expect, test } from 'vitest'
import type { ProcessState } from '../state.ts'
import { listProcesses } from './list-processes.ts'

test('it lists the processes in the order they were registered', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      ['db', { name: 'db', command: 'db', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'ready' }],
      [
        'api',
        { name: 'api', command: 'api', cwd: '/app', env: {}, dependsOn: ['db'], showCommand: true, status: 'pending' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const processes = listProcesses({ state })

  expect(processes.map(p => [p.name, p.status])).toStrictEqual([
    ['db', 'ready'],
    ['api', 'pending'],
  ])
})

test('changing the listed processes does not change the state', () => {
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

  const listed = listProcesses({ state })
  for (const row of listed) row.status = 'failed'

  expect(listed).toHaveLength(1)
  expect(state.rows.get('web')?.status).toBe('running')
})

test('without processes the list is empty', () => {
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

  expect(listProcesses({ state })).toStrictEqual([])
})
