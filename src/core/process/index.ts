import { type HandleExitInput, handleExit } from './handle-exit/handle-exit.ts'
import { type HandleOutputInput, handleOutput } from './handle-output/handle-output.ts'
import { listProcesses } from './list-processes/list-processes.ts'
import { type RegisterProcessInput, registerProcess } from './register-process/register-process.ts'
import {
  type ResizeProcessesDeps,
  type ResizeProcessesInput,
  resizeProcesses,
} from './resize-processes/resize-processes.ts'
import { type RestartProcessInput, restartProcess } from './restart-process/restart-process.ts'
import { type SkipProcessInput, skipProcess } from './skip-process/skip-process.ts'
import { type SpawnProcessDeps, type SpawnProcessInput, spawnProcess } from './spawn-process/spawn-process.ts'
import { type StartProcessInput, startProcess } from './start-process/start-process.ts'
import { type StopProcessDeps, type StopProcessInput, stopProcess } from './stop-process/stop-process.ts'
import { type WriteProcessInput, writeProcess } from './write-process/write-process.ts'
import type { ProcessEvent } from './events.ts'
import type { ProcessState } from './state.ts'

export type { ProcessEvent } from './events.ts'

export type CreateProcessDeps = {
  nodePty: SpawnProcessDeps['nodePty']
  nodeFs: SpawnProcessDeps['nodeFs']
  nodeUtil: SpawnProcessDeps['nodeUtil']
  nodeProcess: SpawnProcessDeps['nodeProcess'] & StopProcessDeps['nodeProcess']
  nodeTimers: StopProcessDeps['nodeTimers']
  terminal: ResizeProcessesDeps['terminal']
  emit: (event: ProcessEvent) => void
}

export function createProcess(deps: CreateProcessDeps) {
  const state: ProcessState = {
    size: { cols: 80, rows: 24 },
    rows: new Map(),
    ptys: new Map(),
    readyBuffers: new Map(),
    readied: new Set(),
    readyCaptures: new Map(),
    stopping: new Set(),
    restarting: new Set(),
  }
  const { emit } = deps

  const output = (input: HandleOutputInput) => handleOutput({ emit }, { state }, input)
  const exit = (input: HandleExitInput) => handleExit({ emit }, { state }, input)
  const spawn = (input: SpawnProcessInput) =>
    spawnProcess(
      {
        nodePty: deps.nodePty,
        nodeFs: deps.nodeFs,
        nodeUtil: deps.nodeUtil,
        nodeProcess: deps.nodeProcess,
        emit,
        handleOutput: output,
        handleExit: exit,
      },
      { state },
      input,
    )

  return {
    registerProcess: (input: RegisterProcessInput) => registerProcess({ emit }, { state }, input),
    spawnProcess: spawn,
    startProcess: (input: StartProcessInput) => startProcess({ spawnProcess: spawn }, { state }, input),
    stopProcess: (input: StopProcessInput) =>
      stopProcess({ emit, nodeTimers: deps.nodeTimers, nodeProcess: deps.nodeProcess }, { state }, input),
    restartProcess: (input: RestartProcessInput) =>
      restartProcess(
        { emit, spawnProcess: spawn, nodeTimers: deps.nodeTimers, nodeProcess: deps.nodeProcess },
        { state },
        input,
      ),
    skipProcess: (input: SkipProcessInput) => skipProcess({ emit }, { state }, input),
    writeProcess: (input: WriteProcessInput) => writeProcess({ state }, input),
    resizeProcesses: (input: ResizeProcessesInput) => resizeProcesses({ terminal: deps.terminal }, { state }, input),
    listProcesses: () => listProcesses({ state }),
  }
}
