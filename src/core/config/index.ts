import { type LoadConfigDeps, type LoadConfigInput, loadConfig } from './load-config/load-config.ts'

export type CreateConfigDeps = LoadConfigDeps

export function createConfig(deps: CreateConfigDeps) {
  return {
    loadConfig: (input: LoadConfigInput) => loadConfig(deps, input),
  }
}
