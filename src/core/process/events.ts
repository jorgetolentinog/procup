import type { ProcessStatus } from './state.ts'

export type ProcessEvent =
  | { type: 'output'; name: string; chunk: string }
  | { type: 'status'; name: string; status: ProcessStatus }
  | { type: 'exited'; name: string; exitCode: number | null }
