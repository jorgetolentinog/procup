import type { TuiState } from '../state.ts'

export type HandleKeyInput = { data: string }

export type HandleKeyDeps = {
  procup: {
    listProcesses(): { name: string; status: string }[]
    restartProcess(name: string): unknown
    startProcess(name: string): unknown
    stopProcess(name: string): unknown
    writeProcess(name: string, data: string): unknown
    readScreen(name: string, start: number, count: number): { total: number }
  }
  handleMouse: (input: { code: number; x: number; y: number; final: 'M' | 'm' }) => unknown
  scheduleFrame: () => unknown
  quit: () => unknown
}

export type HandleKeyCtx = { state: TuiState }

type Key = { name: string; sequence: string; shift: boolean; ctrl: boolean }

type Command = { key: Key; name: string }

const ESCAPE = '\x1b'
const MOUSE = /^\[<(\d+);(\d+);(\d+)([Mm])$/
const STARTABLE = new Set(['stopped', 'finished', 'failed'])

const NAMED: Record<string, string> = { '\r': 'return', '\n': 'linefeed', '\t': 'tab', '\x7f': 'backspace' }

const SEQUENCES: Record<string, [name: string, shift: boolean]> = {
  '\x1b[A': ['up', false],
  '\x1bOA': ['up', false],
  '\x1b[B': ['down', false],
  '\x1bOB': ['down', false],
  '\x1b[C': ['right', false],
  '\x1bOC': ['right', false],
  '\x1b[D': ['left', false],
  '\x1bOD': ['left', false],
  '\x1b[1;2A': ['up', true],
  '\x1b[1;2B': ['down', true],
  '\x1b[1;2C': ['right', true],
  '\x1b[1;2D': ['left', true],
  '\x1b[5~': ['pageup', false],
  '\x1b[6~': ['pagedown', false],
  '\x1b[2~': ['insert', false],
  '\x1b[3~': ['delete', false],
  '\x1b[Z': ['tab', true],
}

export function handleKey(deps: HandleKeyDeps, ctx: HandleKeyCtx, input: HandleKeyInput): { ok: true; keys: number } {
  if (ctx.state.destroyed) return { ok: true, keys: 0 }

  const keys = parseKeys(input.data, deps.handleMouse)
  for (const key of keys) dispatch(deps, ctx, key)
  return { ok: true, keys: keys.length }
}

function parseKeys(data: string, handleMouse: HandleKeyDeps['handleMouse']): Key[] {
  const keys: Key[] = []
  const pushSequence = (sequence: string) => {
    const mouse = MOUSE.exec(sequence.slice(1))
    if (mouse === null) keys.push(sequenceKey(sequence))
    else handleMouse(mouseInput(mouse))
  }

  let pending = ''
  for (const char of data) {
    if (pending === '') {
      if (char === ESCAPE) pending = char
      else keys.push(plainKey(char))
    } else if (pending === ESCAPE && char !== '[' && char !== 'O') {
      keys.push({ name: char.toLowerCase(), sequence: pending + char, shift: false, ctrl: false })
      pending = ''
    } else {
      pending += char
      if (endsSequence(pending, char)) {
        pushSequence(pending)
        pending = ''
      }
    }
  }
  if (pending === ESCAPE) keys.push({ name: 'escape', sequence: pending, shift: false, ctrl: false })
  else if (pending !== '') pushSequence(pending)
  return keys
}

function endsSequence(pending: string, char: string): boolean {
  const code = char.charCodeAt(0)
  return pending.length > 2 && code >= 0x40 && code <= 0x7e
}

function mouseInput(match: RegExpExecArray): { code: number; x: number; y: number; final: 'M' | 'm' } {
  return { code: Number(match[1]), x: Number(match[2]), y: Number(match[3]), final: match[4] === 'M' ? 'M' : 'm' }
}

function sequenceKey(sequence: string): Key {
  const known = SEQUENCES[sequence]
  return { name: known?.[0] ?? 'unknown', sequence, shift: known?.[1] ?? false, ctrl: false }
}

function plainKey(char: string): Key {
  const named = NAMED[char]
  if (named !== undefined) return { name: named, sequence: char, shift: false, ctrl: false }
  const code = char.charCodeAt(0)
  if (code >= 1 && code <= 26) return { name: String.fromCharCode(code + 96), sequence: char, shift: false, ctrl: true }
  const lower = char.toLowerCase()
  return { name: lower, sequence: char, shift: char !== lower, ctrl: false }
}

function dispatch(deps: HandleKeyDeps, ctx: HandleKeyCtx, key: Key): void {
  const { state } = ctx
  if (key.ctrl && key.name === 'c') {
    cancel(deps, state)
    return
  }
  if (state.helpVisible) {
    closeHelp(deps, state, key)
    return
  }
  const name = state.names[state.active]
  if (name === undefined) return
  if (state.inputMode) {
    typeIntoProcess(deps, state, { key, name })
    return
  }
  if (runCommand(deps, ctx, { key, name })) deps.scheduleFrame()
}

function cancel(deps: HandleKeyDeps, state: TuiState): void {
  if (state.helpVisible) state.helpVisible = false
  else if (state.inputMode) state.inputMode = false
  else deps.quit()
  deps.scheduleFrame()
}

function closeHelp(deps: HandleKeyDeps, state: TuiState, key: Key): void {
  if (key.name !== 'escape' && key.sequence !== '?' && key.name !== 'h') return
  state.helpVisible = false
  deps.scheduleFrame()
}

function typeIntoProcess(deps: HandleKeyDeps, state: TuiState, command: Command): void {
  if (command.key.name !== 'escape') {
    deps.procup.writeProcess(command.name, command.key.sequence)
    return
  }
  state.inputMode = false
  deps.scheduleFrame()
}

function runCommand(deps: HandleKeyDeps, ctx: HandleKeyCtx, command: Command): boolean {
  return changeView(ctx.state, command.key) || scroll(deps, ctx, command) || controlProcess(deps, command)
}

function changeView(state: TuiState, key: Key): boolean {
  if (key.sequence === '?' || key.name === 'h') {
    state.helpVisible = !state.helpVisible
    return true
  }
  if (key.name === 'return') {
    state.inputMode = true
    return true
  }
  if (/^[1-9]$/.test(key.name)) {
    const index = Number(key.name) - 1
    if (index < state.names.length) switchTo(state, index)
    return true
  }
  if (key.name === 'left' || key.name === 'right') {
    const count = state.names.length
    const step = key.name === 'right' ? 1 : count - 1
    switchTo(state, (state.active + step) % count)
    return true
  }
  return false
}

function switchTo(state: TuiState, index: number): void {
  state.active = index
  state.inputMode = false
}

function scroll(deps: HandleKeyDeps, ctx: HandleKeyCtx, command: Command): boolean {
  const target = scrollTarget(ctx.state, command)
  if (target === null) return false
  const max = Math.max(0, deps.procup.readScreen(command.name, 0, 0).total - ctx.state.paneRows)
  const entry = ctx.state.scroll.get(command.name) ?? { top: 0, manual: false, total: -1, rows: -1 }
  entry.top = Math.round(Math.min(Math.max(0, target), max))
  entry.manual = max > 1 && entry.top < max
  ctx.state.scroll.set(command.name, entry)
  return true
}

function scrollTarget(state: TuiState, command: Command): number | null {
  const { key } = command
  if (key.name === 'g') return key.shift ? Number.POSITIVE_INFINITY : 0
  const top = state.scroll.get(command.name)?.top ?? 0
  const page = state.termRows - 2
  if (key.name === 'up') return top - 1
  if (key.name === 'down') return top + 1
  if (key.name === 'pageup') return top - page
  if (key.name === 'pagedown') return top + page
  return null
}

function controlProcess(deps: HandleKeyDeps, command: Command): boolean {
  const { key, name } = command
  if (key.name === 'r' && !key.shift) {
    deps.procup.restartProcess(name)
    return true
  }
  if (key.name !== 's') return false
  const status = deps.procup.listProcesses().find(p => p.name === name)?.status
  if (status !== undefined && STARTABLE.has(status)) deps.procup.startProcess(name)
  else deps.procup.stopProcess(name)
  return true
}
