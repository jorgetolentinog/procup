export type ExistsSync = { existsSync(path: string): boolean }
export type ReadFileSync = { readFileSync(path: string, encoding: 'utf-8'): string }
export type Env = { env: Record<string, string | undefined> }
export type Kill = { kill(pid: number, signal: 'SIGTERM' | 'SIGKILL'): unknown }
export type SetTimeout = { setTimeout(callback: () => void, ms: number): unknown }
export type ClearTimeout = { clearTimeout(handle: unknown): void }
export type SetInterval = { setInterval(callback: () => void, ms: number): unknown }
export type ClearInterval = { clearInterval(handle: unknown): void }
export type Platform = { platform: string }
