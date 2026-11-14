import { expect, test } from 'vitest'
import type { ProcessState } from '../state.ts'
import { startProcess } from './start-process.ts'

test('a process that is not alive is spawned without its last exit code', () => {
  for (const status of ['pending', 'stopped', 'finished', 'failed', 'skipped'] as const) {
    const spawned: { name: string; exitCode: number | null | undefined }[] = []
    const state: ProcessState = {
      size: { cols: 80, rows: 24 },
      rows: new Map([
        [
          'web',
          { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status, exitCode: 1 },
        ],
      ]),
      ptys: new Map(),
      readyBuffers: new Map(),
      readied: new Set(),
      stopping: new Set(),
      restarting: new Set(),
    }

    const result = startProcess(
      {
        spawnProcess: input => {
          spawned.push({ name: input.name, exitCode: state.rows.get(input.name)?.exitCode })
          return { ok: true }
        },
      },
      { state },
      { name: 'web' },
    )

    expect(result).toStrictEqual({ ok: true })
    expect(spawned).toStrictEqual([{ name: 'web', exitCode: undefined }])
  }
})

test('a process that is alive cannot be started', () => {
  for (const status of ['starting', 'running', 'ready', 'stopping'] as const) {
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

    const result = startProcess(
      {
        spawnProcess: input => {
          spawned.push(input.name)
          return { ok: true }
        },
      },
      { state },
      { name: 'web' },
    )

    expect(result).toStrictEqual({ ok: false, error: 'not_startable' })
    expect(spawned).toStrictEqual([])
  }
})

test('a spawn failure is returned as is', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map([
      [
        'web',
        { name: 'web', command: 'web', cwd: '/app', env: {}, dependsOn: [], showCommand: true, status: 'failed' },
      ],
    ]),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = startProcess(
    { spawnProcess: () => ({ ok: false, error: 'spawn_failed', message: 'envFile not found: /app/.env' }) },
    { state },
    { name: 'web' },
  )

  expect(result).toStrictEqual({ ok: false, error: 'spawn_failed', message: 'envFile not found: /app/.env' })
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

  expect(startProcess({ spawnProcess: () => ({ ok: true }) }, { state }, { name: 'web' })).toStrictEqual({
    ok: false,
    error: 'not_found',
  })
})
