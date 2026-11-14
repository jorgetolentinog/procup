import { EventEmitter } from 'node:events'
import * as nodeFs from 'node:fs'
import * as nodeProcess from 'node:process'
import * as nodeTimers from 'node:timers'
import * as nodeUtil from 'node:util'
import xtermHeadless from '@xterm/headless'
import * as nodePty from 'node-pty'
import { createConfig } from './config/index.ts'
import { createOrchestration } from './orchestration/index.ts'
import { createProcess, type ProcessEvent } from './process/index.ts'
import { createTerminal } from './terminal/index.ts'

type EventOf<T extends ProcessEvent['type']> = Extract<ProcessEvent, { type: T }>

export type CreateProcupOptions = { cwd?: string; configPath?: string; envFile?: string | false }

export function createProcup(options: CreateProcupOptions = {}) {
  const events = new EventEmitter()
  const emit = (event: ProcessEvent) => events.emit(event.type, event)

  const terminal = createTerminal({ xtermHeadless })
  const processes = createProcess({ nodePty, nodeFs, nodeUtil, nodeProcess, nodeTimers, terminal, emit })
  const config = createConfig({ nodeFs, nodeProcess })
  const orchestration = createOrchestration({ config, process: processes })

  events.on('output', (event: EventOf<'output'>) => terminal.feedScreen({ name: event.name, chunk: event.chunk }))
  events.on('status', (event: EventOf<'status'>) => {
    if (event.status === 'starting') orchestration.markProcessStarted({ name: event.name })
    else if (event.status === 'ready' || event.status === 'finished')
      orchestration.markProcessReady({ name: event.name })
    else if (event.status === 'failed') orchestration.markProcessFailed({ name: event.name })
  })

  return {
    loadProject: () =>
      orchestration.loadProject({
        cwd: options.cwd ?? nodeProcess.cwd(),
        configPath: options.configPath,
        envFile: options.envFile,
      }),
    startProject: () => orchestration.startProject(),
    stopProject: () => orchestration.stopProject(),
    restartProcess: (name: string) => processes.restartProcess({ name }),
    startProcess: (name: string) => processes.startProcess({ name }),
    stopProcess: (name: string) => processes.stopProcess({ name }),
    writeProcess: (name: string, data: string) => processes.writeProcess({ name, data }),
    resizeProcesses: (cols: number, rows: number) => processes.resizeProcesses({ cols, rows }),
    listProcesses: () => processes.listProcesses(),
    readScreen: (name: string, start: number, count: number) => terminal.readScreen({ name, start, count }),
    on: <T extends ProcessEvent['type']>(type: T, listener: (event: EventOf<T>) => void) => {
      events.on(type, listener)
      return () => {
        events.off(type, listener)
      }
    },
  }
}
