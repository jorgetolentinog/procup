import { type LoadProjectDeps, type LoadProjectInput, loadProject } from './load-project/load-project.ts'
import {
  type MarkProcessFailedDeps,
  type MarkProcessFailedInput,
  markProcessFailed,
} from './mark-process-failed/mark-process-failed.ts'
import {
  type MarkProcessReadyDeps,
  type MarkProcessReadyInput,
  markProcessReady,
} from './mark-process-ready/mark-process-ready.ts'
import { type MarkProcessStartedInput, markProcessStarted } from './mark-process-started/mark-process-started.ts'
import { type StartProjectDeps, startProject } from './start-project/start-project.ts'
import { type StopProjectDeps, stopProject } from './stop-project/stop-project.ts'
import type { OrchestrationState } from './state.ts'

export type CreateOrchestrationDeps = {
  config: LoadProjectDeps['config']
  process: LoadProjectDeps['process'] &
    StartProjectDeps['process'] &
    MarkProcessReadyDeps['process'] &
    MarkProcessFailedDeps['process'] &
    StopProjectDeps['process']
}

export function createOrchestration(deps: CreateOrchestrationDeps) {
  const state: OrchestrationState = { nodes: new Map(), stopping: false }

  return {
    loadProject: (input: LoadProjectInput) => loadProject(deps, { state }, input),
    startProject: () => startProject({ process: deps.process }, { state }),
    markProcessStarted: (input: MarkProcessStartedInput) => markProcessStarted({ state }, input),
    markProcessReady: (input: MarkProcessReadyInput) => markProcessReady({ process: deps.process }, { state }, input),
    markProcessFailed: (input: MarkProcessFailedInput) =>
      markProcessFailed({ process: deps.process }, { state }, input),
    stopProject: () => stopProject({ process: deps.process }, { state }),
  }
}
