export type ProcessStatus =
  | 'pending'
  | 'starting'
  | 'running'
  | 'ready'
  | 'stopping'
  | 'stopped'
  | 'finished'
  | 'failed'
  | 'skipped'

export type PtyHandle = {
  pid: number
  onData(listener: (chunk: string) => void): void
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
}

export type ProcessRow = {
  name: string
  command: string
  cwd: string
  env: Record<string, string>
  envFile?: string | string[] | false
  dependsOn: string[]
  readyText?: string
  showCommand: boolean
  status: ProcessStatus
  pid?: number
  exitCode?: number | null
}

export type ProcessState = {
  size: { cols: number; rows: number }
  rows: Map<string, ProcessRow>
  ptys: Map<string, PtyHandle>
  readyBuffers: Map<string, string>
  readied: Set<string>
  stopping: Set<string>
  restarting: Set<string>
}
