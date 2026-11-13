export type ContentPos = { line: number; col: number }

export type PaneScroll = { top: number; manual: boolean; total: number; rows: number }

type Selection = { name: string; anchor: ContentPos; focus: ContentPos; dragging: boolean }

type AutoScroll = { timer: unknown; y: number }

export type TuiState = {
  names: string[]
  noColor: boolean
  active: number
  inputMode: boolean
  helpVisible: boolean
  width: number
  height: number
  sidebarWidth: number
  paneX: number
  paneRows: number
  termCols: number
  termRows: number
  scroll: Map<string, PaneScroll>
  selection: Selection | null
  pressedButtons: Set<number>
  pointer: { x: number; y: number }
  scrollbarDrag: { offset: number } | null
  autoScroll: AutoScroll | null
  tempMessage: string | null
  tempTimer: unknown
  prevLines: string[]
  frameTimer: unknown
  resizeTimer: unknown
  spinning: boolean
  spinFrame: number
  spinTimer: unknown
  destroyed: boolean
}
