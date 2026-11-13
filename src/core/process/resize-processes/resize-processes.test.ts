import { expect, test } from 'vitest'
import type { ProcessState } from '../state.ts'
import { resizeProcesses } from './resize-processes.ts'

test('every process and every screen gets the new size', () => {
  const resized: string[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map([
      [
        'web',
        {
          pid: 1,
          onData: () => true,
          onExit: () => true,
          write: () => true,
          resize: (cols, rows) => resized.push(`web ${cols}x${rows}`),
        },
      ],
      [
        'api',
        {
          pid: 2,
          onData: () => true,
          onExit: () => true,
          write: () => true,
          resize: (cols, rows) => resized.push(`api ${cols}x${rows}`),
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = resizeProcesses(
    { terminal: { resizeScreens: size => resized.push(`screens ${size.cols}x${size.rows}`) } },
    { state },
    { cols: 120, rows: 40 },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(state.size).toStrictEqual({ cols: 120, rows: 40 })
  expect(resized).toStrictEqual(['web 120x40', 'api 120x40', 'screens 120x40'])
})

test('sizes that are not positive whole numbers are rejected', () => {
  const resized: string[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map([
      ['web', { pid: 1, onData: () => true, onExit: () => true, write: () => true, resize: () => resized.push('web') }],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const results = [
    { cols: 0, rows: 24 },
    { cols: 80, rows: -1 },
    { cols: 80.5, rows: 24 },
    { cols: Number.NaN, rows: 24 },
  ].map(size => resizeProcesses({ terminal: { resizeScreens: () => resized.push('screens') } }, { state }, size))

  expect(results).toStrictEqual(Array.from({ length: 4 }, () => ({ ok: false, error: 'invalid_size' })))
  expect(state.size).toStrictEqual({ cols: 80, rows: 24 })
  expect(resized).toStrictEqual([])
})

test('a process that just died does not stop the others from resizing', () => {
  const resized: string[] = []
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map([
      [
        'dead',
        {
          pid: 1,
          onData: () => true,
          onExit: () => true,
          write: () => true,
          resize: () => {
            throw new Error('ioctl(2) failed, EBADF')
          },
        },
      ],
      [
        'web',
        {
          pid: 2,
          onData: () => true,
          onExit: () => true,
          write: () => true,
          resize: (cols: number, rows: number) => resized.push(`web ${cols}x${rows}`),
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  const result = resizeProcesses(
    { terminal: { resizeScreens: size => resized.push(`screens ${size.cols}x${size.rows}`) } },
    { state },
    { cols: 100, rows: 30 },
  )

  expect(result).toStrictEqual({ ok: true })
  expect(resized).toStrictEqual(['web 100x30', 'screens 100x30'])
})

test('any other resize error is not hidden', () => {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map([
      [
        'web',
        {
          pid: 1,
          onData: () => true,
          onExit: () => true,
          write: () => true,
          resize: () => {
            throw new Error('something else')
          },
        },
      ],
    ]),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }

  expect(() =>
    resizeProcesses({ terminal: { resizeScreens: () => true } }, { state }, { cols: 100, rows: 30 }),
  ).toThrow(/something else/)
})
