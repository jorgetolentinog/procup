import { expect, test } from 'vitest'
import xtermHeadless from '@xterm/headless'
import { resizeScreens } from './resize-screens.ts'

test('a valid size is stored and applied to every screen', () => {
  const web = new xtermHeadless.Terminal({ cols: 80, rows: 24, allowProposedApi: true })
  const api = new xtermHeadless.Terminal({ cols: 80, rows: 24, allowProposedApi: true })
  const state = {
    size: { cols: 80, rows: 24 },
    scrollback: 1500,
    screens: new Map([
      ['web', web],
      ['api', api],
    ]),
  }

  const result = resizeScreens({ state }, { cols: 120, rows: 40 })

  expect(result).toStrictEqual({ ok: true })
  expect(state.size).toStrictEqual({ cols: 120, rows: 40 })
  expect([web.cols, web.rows, api.cols, api.rows]).toStrictEqual([120, 40, 120, 40])
})

test('an invalid size is rejected and nothing changes', () => {
  const web = new xtermHeadless.Terminal({ cols: 80, rows: 24, allowProposedApi: true })
  const state = { size: { cols: 80, rows: 24 }, scrollback: 1500, screens: new Map([['web', web]]) }
  const sizes = [
    { cols: 0, rows: 24 },
    { cols: 80, rows: 0 },
    { cols: -5, rows: 24 },
    { cols: 80.5, rows: 24 },
    { cols: Number.NaN, rows: 24 },
  ]

  const results = sizes.map(size => resizeScreens({ state }, size))

  expect(results).toStrictEqual(sizes.map(() => ({ ok: false, error: 'invalid_size' })))
  expect(state.size).toStrictEqual({ cols: 80, rows: 24 })
  expect([web.cols, web.rows]).toStrictEqual([80, 24])
})
