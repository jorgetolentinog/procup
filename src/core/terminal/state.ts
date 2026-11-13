export type XtermCell = {
  getWidth(): number
  getChars(): string
  getFgColor(): number
  getBgColor(): number
  isFgRGB(): boolean
  isBgRGB(): boolean
  isFgPalette(): boolean
  isBgPalette(): boolean
  isBold(): number
  isDim(): number
  isItalic(): number
  isUnderline(): number
  isBlink(): number
  isInverse(): number
  isInvisible(): number
  isStrikethrough(): number
  isOverline(): number
}

export type XtermTerminal = {
  readonly buffer: {
    readonly active: {
      readonly length: number
      readonly baseY: number
      readonly cursorX: number
      readonly cursorY: number
      getLine(y: number): { getCell(x: number, cell?: XtermCell): XtermCell | undefined } | undefined
      getNullCell(): XtermCell
    }
  }
  write(data: string): void
  resize(cols: number, rows: number): void
}

export type TerminalState = {
  size: { cols: number; rows: number }
  scrollback: number
  screens: Map<string, XtermTerminal>
}
