import { expect, test } from 'vitest'
import xtermHeadless from '@xterm/headless'
import { readScreen } from './read-screen.ts'

test('a process without output has an empty screen', () => {
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map() }

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result).toStrictEqual({ ok: true, total: 0, lines: [], cursor: null })
})

test('trailing empty lines and trailing spaces are not content', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('one\r\ntwo   \r\n\r\n', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result.total).toBe(2)
  expect(result.lines.map(line => line.map(run => run.text).join(''))).toStrictEqual(['one', 'two'])
})

test('empty lines between content are kept', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('a\r\n\r\nb', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result.total).toBe(3)
  expect(result.lines.map(line => line.map(run => run.text).join(''))).toStrictEqual(['a', '', 'b'])
})

test('start and count read a window of the content', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('line-1\r\nline-2\r\nline-3\r\nline-4\r\nline-5', resolve))

  const result = readScreen({ state }, { name: 'web', start: 1, count: 2 })

  expect(result.total).toBe(5)
  expect(result.lines.map(line => line.map(run => run.text).join(''))).toStrictEqual(['line-2', 'line-3'])
})

test('only the last scrollback lines are kept', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, scrollback: 100, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 3, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('line-1\r\nline-2\r\nline-3\r\nline-4\r\nline-5', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result.total).toBe(3)
  expect(result.lines.map(line => line.map(run => run.text).join(''))).toStrictEqual(['line-3', 'line-4', 'line-5'])
})

test('colors become SGR runs: 16, bright, 256, RGB and background', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 80, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 80, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  const output =
    '\x1b[1;31mbold red\x1b[0m plain \x1b[38;5;214morange\x1b[0m \x1b[38;2;1;2;3mrgb\x1b[0m \x1b[92mbright\x1b[0m \x1b[44mbg\x1b[0m'
  await new Promise<void>(resolve => screen.write(output, resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 1 })

  expect(result.lines).toStrictEqual([
    [
      { text: 'bold red', attrs: '1', fg: '31', bg: '' },
      { text: ' plain ', attrs: '', fg: '', bg: '' },
      { text: 'orange', attrs: '', fg: '38;5;214', bg: '' },
      { text: ' ', attrs: '', fg: '', bg: '' },
      { text: 'rgb', attrs: '', fg: '38;2;1;2;3', bg: '' },
      { text: ' ', attrs: '', fg: '', bg: '' },
      { text: 'bright', attrs: '', fg: '92', bg: '' },
      { text: ' ', attrs: '', fg: '', bg: '' },
      { text: 'bg', attrs: '', fg: '', bg: '44' },
    ],
  ])
})

test('text attributes become SGR runs', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 80, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 80, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve =>
    screen.write('\x1b[2md\x1b[0m\x1b[3mi\x1b[0m\x1b[4mu\x1b[0m\x1b[7mv\x1b[0m\x1b[9ms\x1b[0m', resolve),
  )

  const result = readScreen({ state }, { name: 'web', start: 0, count: 1 })

  expect(result.lines[0]?.map(run => [run.text, run.attrs])).toStrictEqual([
    ['d', '2'],
    ['i', '3'],
    ['u', '4'],
    ['v', '7'],
    ['s', '9'],
  ])
})

test('a colored background counts as content even without text', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('\x1b[41m   \x1b[0m', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 1 })

  expect(result.total).toBe(1)
  expect(result.lines).toStrictEqual([[{ text: '   ', attrs: '', fg: '', bg: '41' }]])
})

test('a wide character appears once', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('你好 ok', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 1 })

  expect(result.lines).toStrictEqual([[{ text: '你好 ok', attrs: '', fg: '', bg: '' }]])
})

test('the cursor is reported relative to the content', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1500, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('first\r\n> abc', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result.cursor).toStrictEqual({ x: 5, line: 1 })
})

test('a cursor above the kept lines is not reported', async () => {
  const screen = new xtermHeadless.Terminal({ cols: 40, rows: 10, allowProposedApi: true })
  const state = { size: { cols: 40, rows: 10 }, scrollback: 1, screens: new Map([['web', screen]]) }
  await new Promise<void>(resolve => screen.write('a\r\nb\r\nc\x1b[1;1H', resolve))

  const result = readScreen({ state }, { name: 'web', start: 0, count: 10 })

  expect(result.total).toBe(1)
  expect(result.lines.map(line => line.map(run => run.text).join(''))).toStrictEqual(['c'])
  expect(result.cursor).toBe(null)
})
