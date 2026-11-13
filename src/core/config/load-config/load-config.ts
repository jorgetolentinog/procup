import type { Env, ExistsSync, ReadFileSync } from '../../../types/node.ts'
import { resolve } from 'node:path'

const CONFIG_FILE = '.procuprc'
const VAR_RE = /\$\{(?<name>[^}:]+)(?::(?<operator>[-?])(?<operand>[^}]*))?\}/g

export type LoadConfigInput = {
  cwd: string
  configPath?: string
  envFile?: string | false
}

export type LoadConfigDeps = {
  nodeFs: ExistsSync & ReadFileSync
  nodeProcess: Env
}

type Variables = Record<string, string | undefined>

type Globals = {
  cwd?: string
  showCommand?: boolean
  envFile?: string | string[] | false
  env?: Record<string, string>
}

type ProcessDefinition = {
  name: string
  command: string
  cwd: string
  env: Record<string, string>
  envFile?: string | string[] | false
  dependsOn: string[]
  readyText?: string
  showCommand: boolean
}

export type LoadConfigResult =
  | { ok: true; configPath: string; processes: ProcessDefinition[] }
  | { ok: false; error: 'config_error'; message: string }

export function loadConfig(deps: LoadConfigDeps, input: LoadConfigInput): LoadConfigResult {
  try {
    const { configPath, raw } = load(deps, input)
    const processes = validate(raw, input)
    checkCycles(processes)
    return { ok: true, configPath, processes }
  } catch (error) {
    return { ok: false, error: 'config_error', message: error instanceof Error ? error.message : String(error) }
  }
}

function load(deps: LoadConfigDeps, input: LoadConfigInput): { configPath: string; raw: unknown } {
  const path = resolve(input.cwd, input.configPath ?? CONFIG_FILE)
  if (!deps.nodeFs.existsSync(path)) {
    const named = input.configPath !== undefined && input.configPath !== ''
    throw new Error(named ? `Config file not found: ${path}` : `No procup config found. Create ${CONFIG_FILE}`)
  }
  try {
    return {
      configPath: path,
      raw: interpolate(JSON.parse(deps.nodeFs.readFileSync(path, 'utf-8')), deps.nodeProcess.env),
    }
  } catch (err) {
    throw new Error(`Failed to load ${path}: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
  }
}

function interpolate(value: unknown, env: Variables): unknown {
  if (typeof value === 'string') return interpolateText(value, env)
  if (Array.isArray(value)) return value.map(item => interpolate(item, env))
  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) result[k] = interpolate(v, env)
    return result
  }
  return value
}

function interpolateText(text: string, env: Variables): string {
  let result = ''
  let last = 0
  for (const match of text.matchAll(VAR_RE)) {
    const groups: Partial<Record<'name' | 'operator' | 'operand', string>> = match.groups ?? {}
    result += text.slice(last, match.index) + variableValue(groups, env)
    last = match.index + match[0].length
  }
  return result + text.slice(last)
}

function variableValue(groups: Partial<Record<'name' | 'operator' | 'operand', string>>, env: Variables): string {
  const { name = '', operator, operand } = groups
  const value = env[name]
  if (value !== undefined && value !== '') return value
  if (operator === '-') return operand ?? ''
  if (operator === '?') {
    throw new Error(operand !== undefined && operand !== '' ? operand : `Required variable ${name} is not set`)
  }
  return ''
}

function validate(raw: unknown, input: LoadConfigInput): ProcessDefinition[] {
  if (!isRecord(raw)) throw new Error('Config must be an object')
  if (!isRecord(raw.processes)) throw new Error('Config must have a "processes" object')
  const processes = raw.processes
  const names = Object.keys(processes)
  if (names.length === 0) throw new Error('Config must define at least one process')

  const globals = globalsOf(raw)
  return names.map(name => processOf({ name, value: processes[name], names }, globals, input))
}

function globalsOf(config: Record<string, unknown>): Globals {
  return {
    cwd: typeof config.cwd === 'string' ? config.cwd : undefined,
    showCommand: typeof config.showCommand === 'boolean' ? config.showCommand : undefined,
    envFile: envFileOf(config.envFile),
    env: isRecord(config.env) ? envOf(config.env, 'env.') : undefined,
  }
}

function processOf(
  entry: { name: string; value: unknown; names: string[] },
  globals: Globals,
  input: LoadConfigInput,
): ProcessDefinition {
  const { name } = entry
  const p = processRecordOf(name, entry.value)
  const command = commandOf(name, p.command)
  const dependsOn = dependsOnOf(name, p.dependsOn, entry.names)
  const readyText = readyTextOf(name, p)
  const processCwd = typeof p.cwd === 'string' ? p.cwd : undefined
  const processEnv = isRecord(p.env) ? envOf(p.env, `Process "${name}".env.`) : undefined

  return {
    name,
    command,
    cwd: resolve(input.cwd, processCwd ?? globals.cwd ?? '.'),
    env: { ...globals.env, ...processEnv },
    envFile: input.envFile ?? envFileOf(p.envFile) ?? globals.envFile,
    dependsOn,
    readyText,
    showCommand: typeof p.showCommand === 'boolean' ? p.showCommand : (globals.showCommand ?? true),
  }
}

function processRecordOf(name: string, value: unknown): Record<string, unknown> {
  const proc = typeof value === 'string' ? { command: value } : value
  if (!isRecord(proc)) throw new Error(`Process "${name}" must be an object or a command string`)
  return proc
}

function commandOf(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Process "${name}" must have a non-empty "command" string`)
  }
  return value
}

function dependsOnOf(name: string, value: unknown, names: string[]): string[] {
  if (value === undefined) return []
  const list: unknown = typeof value === 'string' ? [value] : value
  if (!Array.isArray(list)) throw new Error(`Process "${name}".dependsOn must be a string or array`)
  const dependsOn: string[] = []
  for (const dep of list) {
    if (typeof dep !== 'string') throw new Error(`Process "${name}".dependsOn entries must be strings`)
    if (!names.includes(dep)) throw new Error(`Process "${name}" depends on unknown process "${dep}"`)
    if (dep === name) throw new Error(`Process "${name}" cannot depend on itself`)
    dependsOn.push(dep)
  }
  return dependsOn
}

function readyTextOf(name: string, p: Record<string, unknown>): string | undefined {
  if (p.readyPattern !== undefined) {
    throw new Error(`Process "${name}".readyPattern was renamed to readyText (plain text, no regex)`)
  }
  if (p.readyText === undefined) return undefined
  if (typeof p.readyText !== 'string' || p.readyText === '') {
    throw new Error(`Process "${name}".readyText must be a non-empty string`)
  }
  return p.readyText
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function envOf(value: Record<string, unknown>, prefix: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string') throw new Error(`${prefix}${k} must be a string, got ${typeof v}`)
    env[k] = v
  }
  return env
}

function envFileOf(value: unknown): string | string[] | false | undefined {
  if (value === false) return false
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value
  return undefined
}

function checkCycles(processes: ProcessDefinition[]) {
  const byName = new Map(processes.map(p => [p.name, p]))
  const remaining = new Set(byName.keys())
  while (remaining.size > 0) {
    const tier = [...remaining].filter(n => (byName.get(n)?.dependsOn ?? []).every(d => !remaining.has(d)))
    if (tier.length === 0) {
      const path: string[] = []
      let current = remaining.values().next().value
      while (current !== undefined && !path.includes(current)) {
        path.push(current)
        current = (byName.get(current)?.dependsOn ?? []).find(d => remaining.has(d))
      }
      const cycle = current === undefined ? path : path.slice(path.indexOf(current))
      throw new Error(`Dependency cycle detected: ${cycle.join(' → ')} → ${cycle[0]}`)
    }
    for (const name of tier) remaining.delete(name)
  }
}
