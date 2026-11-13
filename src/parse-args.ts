export type ParseArgsInput = { argv: string[] }

export type ParseArgsResult =
  | { ok: true; configPath?: string; envFile?: string | false }
  | { ok: false; message: string }

export function parseArgs(input: ParseArgsInput): ParseArgsResult {
  const args = input.argv.slice(2).values()
  let configPath: string | undefined
  let envFile: string | false | undefined

  for (const arg of args) {
    if (arg === '--config' || arg === '-e' || arg === '--env-file') {
      const value = args.next().value
      if (value === undefined) return { ok: false, message: `Missing value for ${arg}` }

      if (arg === '--config') {
        configPath = value
      } else {
        envFile = value === 'false' ? false : value
      }
      continue
    }
    return { ok: false, message: `Unknown option: ${arg}` }
  }

  return { ok: true, configPath, envFile }
}
