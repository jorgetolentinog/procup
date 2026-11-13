import type { TerminalState, XtermCell } from '../state.ts'

export type ReadScreenInput = { name: string; start: number; count: number }

export type ReadScreenCtx = { state: TerminalState }

type StyledRun = { text: string; attrs: string; fg: string; bg: string }

export type ReadScreenResult = {
  ok: true
  total: number
  lines: StyledRun[][]
  cursor: { x: number; line: number } | null
}

export function readScreen(ctx: ReadScreenCtx, input: ReadScreenInput): ReadScreenResult {
  const screen = ctx.state.screens.get(input.name)
  if (!screen) return { ok: true, total: 0, lines: [], cursor: null }

  const buffer = screen.buffer.active
  const cell = buffer.getNullCell()

  const widthOf = (y: number): number => {
    const line = buffer.getLine(y)
    if (!line) return 0
    for (let x = ctx.state.size.cols - 1; x >= 0; x--) {
      if (!line.getCell(x, cell)) continue
      const chars = cell.getChars()
      if ((chars !== '' && chars !== ' ') || cell.isBgRGB() || cell.isBgPalette()) return x + cell.getWidth()
    }
    return 0
  }

  let end = buffer.length
  while (end > 0 && widthOf(end - 1) === 0) end--
  const first = Math.max(0, end - ctx.state.scrollback)
  const total = end - first

  const lines: StyledRun[][] = []
  const from = Math.max(0, input.start)
  const to = Math.min(total, input.start + input.count)
  for (let i = from; i < to; i++) {
    const y = first + i
    const line = buffer.getLine(y)
    const width = widthOf(y)
    const runs: StyledRun[] = []
    for (let x = 0; x < width; x++) {
      if (!line?.getCell(x, cell)) break
      if (cell.getWidth() === 0) continue

      const text = cell.getChars() || ' '
      const style = styleOf(cell)
      const last = runs.at(-1)
      if (last && last.attrs === style.attrs && last.fg === style.fg && last.bg === style.bg) last.text += text
      else runs.push({ text, ...style })
    }
    lines.push(runs)
  }

  const cursorLine = buffer.baseY + buffer.cursorY - first
  return { ok: true, total, lines, cursor: cursorLine >= 0 ? { x: buffer.cursorX, line: cursorLine } : null }
}

function styleOf(cell: XtermCell): { attrs: string; fg: string; bg: string } {
  const attrs: number[] = []
  if (cell.isBold()) attrs.push(1)
  if (cell.isDim()) attrs.push(2)
  if (cell.isItalic()) attrs.push(3)
  if (cell.isUnderline()) attrs.push(4)
  if (cell.isBlink()) attrs.push(5)
  if (cell.isInverse()) attrs.push(7)
  if (cell.isInvisible()) attrs.push(8)
  if (cell.isStrikethrough()) attrs.push(9)
  if (cell.isOverline()) attrs.push(53)

  let fg = ''
  if (cell.isFgRGB()) {
    const c = cell.getFgColor()
    fg = `38;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}`
  } else if (cell.isFgPalette()) {
    fg = paletteCode(cell.getFgColor(), 'fg')
  }

  let bg = ''
  if (cell.isBgRGB()) {
    const c = cell.getBgColor()
    bg = `48;2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}`
  } else if (cell.isBgPalette()) {
    bg = paletteCode(cell.getBgColor(), 'bg')
  }

  return { attrs: attrs.join(';'), fg, bg }
}

function paletteCode(index: number, layer: 'fg' | 'bg'): string {
  const [normal, bright, extended] = layer === 'fg' ? [30, 90, 38] : [40, 100, 48]
  if (index < 8) return `${normal + index}`
  if (index < 16) return `${bright + index - 8}`
  return `${extended};5;${index}`
}
