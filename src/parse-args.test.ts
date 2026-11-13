import { expect, test } from 'vitest'
import { parseArgs } from './parse-args.ts'

test('without flags it uses the defaults', () => {
  const result = parseArgs({ argv: ['node', 'procup'] })

  expect(result).toStrictEqual({ ok: true, configPath: undefined, envFile: undefined })
})

test('--config points to another config file', () => {
  const result = parseArgs({ argv: ['node', 'procup', '--config', 'dev.json'] })

  expect(result).toStrictEqual({ ok: true, configPath: 'dev.json', envFile: undefined })
})

test('-e sets the env file', () => {
  const result = parseArgs({ argv: ['node', 'procup', '-e', '.env.local'] })

  expect(result).toStrictEqual({ ok: true, configPath: undefined, envFile: '.env.local' })
})

test('--env-file sets the env file', () => {
  const result = parseArgs({ argv: ['node', 'procup', '--env-file', '.env'] })

  expect(result).toStrictEqual({ ok: true, configPath: undefined, envFile: '.env' })
})

test('-e false turns the env file off', () => {
  const result = parseArgs({ argv: ['node', 'procup', '-e', 'false'] })

  expect(result).toStrictEqual({ ok: true, configPath: undefined, envFile: false })
})

test('a flag without its value fails', () => {
  const result = parseArgs({ argv: ['node', 'procup', '--config'] })

  expect(result).toStrictEqual({ ok: false, message: 'Missing value for --config' })
})

test('an unknown option fails', () => {
  const result = parseArgs({ argv: ['node', 'procup', '--nope'] })

  expect(result).toStrictEqual({ ok: false, message: 'Unknown option: --nope' })
})
