import { expect, test } from 'vitest'
import xtermHeadless from '@xterm/headless'
import { feedScreen } from './feed-screen.ts'

test('the first chunk of a process creates its screen with the current size and scrollback', async () => {
  const created: {
    options: { cols: number; rows: number; scrollback: number; allowProposedApi: boolean }
    screen: xtermHeadless.Terminal
  }[] = []
  const Terminal = class extends xtermHeadless.Terminal {
    constructor(options: { cols: number; rows: number; scrollback: number; allowProposedApi: boolean }) {
      super(options)
      created.push({ options, screen: this })
    }
  }
  const state = { size: { cols: 60, rows: 12 }, scrollback: 1500, screens: new Map() }

  const result = feedScreen({ xtermHeadless: { Terminal } }, { state }, { name: 'web', chunk: 'hello' })

  expect(result).toStrictEqual({ ok: true, created: true })
  expect(created.map(c => c.options)).toStrictEqual([{ cols: 60, rows: 12, scrollback: 1500, allowProposedApi: true }])
  expect(state.screens.get('web')).toBe(created[0]?.screen)
  await new Promise<void>(resolve => created[0]?.screen.write('', resolve))
  expect(created[0]?.screen.buffer.active.getLine(0)?.translateToString(true)).toBe('hello')
})

test('later chunks go to the same screen, in order', async () => {
  const created: xtermHeadless.Terminal[] = []
  const Terminal = class extends xtermHeadless.Terminal {
    constructor(options: { cols: number; rows: number; scrollback: number; allowProposedApi: boolean }) {
      super(options)
      created.push(this)
    }
  }
  const state = { size: { cols: 60, rows: 12 }, scrollback: 1500, screens: new Map() }

  const first = feedScreen({ xtermHeadless: { Terminal } }, { state }, { name: 'web', chunk: 'one ' })
  const second = feedScreen({ xtermHeadless: { Terminal } }, { state }, { name: 'web', chunk: 'two' })

  expect(first.created).toBe(true)
  expect(second.created).toBe(false)
  expect(created.length).toBe(1)
  await new Promise<void>(resolve => created[0]?.write('', resolve))
  expect(created[0]?.buffer.active.getLine(0)?.translateToString(true)).toBe('one two')
})

test('each process gets its own screen', () => {
  const state = { size: { cols: 60, rows: 12 }, scrollback: 1500, screens: new Map() }

  feedScreen({ xtermHeadless }, { state }, { name: 'web', chunk: 'a' })
  feedScreen({ xtermHeadless }, { state }, { name: 'api', chunk: 'b' })

  expect([...state.screens.keys()]).toStrictEqual(['web', 'api'])
  expect(state.screens.get('web')).not.toBe(state.screens.get('api'))
})
