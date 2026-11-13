import * as nodeFs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadConfig } from './load-config.ts'

test('without .procuprc it asks to create one', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: 'No procup config found. Create .procuprc',
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('--config to a missing file names the path', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd, configPath: 'dev.json' })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: `Config file not found: ${join(cwd, 'dev.json')}`,
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('--config reads another file relative to the project', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(join(cwd, 'dev.json'), JSON.stringify({ processes: { web: 'npm run dev' } }))

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd, configPath: 'dev.json' })

    expect(result).toMatchObject({ ok: true, configPath: join(cwd, 'dev.json'), processes: [{ name: 'web' }] })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('invalid JSON names the file', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(join(cwd, '.procuprc'), '{ nope')

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: expect.stringContaining(`Failed to load ${join(cwd, '.procuprc')}: `),
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('a command string is a process with the defaults', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(join(cwd, '.procuprc'), JSON.stringify({ processes: { web: 'npm run dev' } }))

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: true,
      configPath: join(cwd, '.procuprc'),
      processes: [
        {
          name: 'web',
          command: 'npm run dev',
          cwd,
          env: {},
          envFile: undefined,
          dependsOn: [],
          readyPattern: undefined,
          showCommand: true,
        },
      ],
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('globals apply to every process', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({
        cwd: 'apps',
        env: { MODE: 'dev' },
        envFile: '.env',
        showCommand: false,
        processes: { web: 'npm run dev' },
      }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: true,
      configPath: join(cwd, '.procuprc'),
      processes: [
        {
          name: 'web',
          command: 'npm run dev',
          cwd: join(cwd, 'apps'),
          env: { MODE: 'dev' },
          envFile: '.env',
          dependsOn: [],
          readyPattern: undefined,
          showCommand: false,
        },
      ],
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('a process overrides the globals and merges the env', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({
        cwd: 'apps',
        env: { MODE: 'dev', SHARED: 'yes' },
        envFile: '.env',
        showCommand: false,
        processes: {
          api: { command: 'npm start', cwd: 'services/api', env: { MODE: 'api' }, envFile: false, showCommand: true },
        },
      }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: true,
      configPath: join(cwd, '.procuprc'),
      processes: [
        {
          name: 'api',
          command: 'npm start',
          cwd: join(cwd, 'services/api'),
          env: { MODE: 'api', SHARED: 'yes' },
          envFile: false,
          dependsOn: [],
          readyPattern: undefined,
          showCommand: true,
        },
      ],
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('the env file given on the command line wins over the config', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({ envFile: '.env', processes: { web: { command: 'npm run dev', envFile: '.env.web' } } }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd, envFile: false })

    expect(result).toMatchObject({ ok: true, processes: [{ name: 'web', envFile: false }] })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('${VAR} takes the environment, a default, or nothing', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({
        processes: {
          web: 'echo ${NAME} ${EMPTY:-fallback} [${EMPTY}] ${UNSET:-unset} [${UNSET}]',
        },
      }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: { NAME: 'world', EMPTY: '' } } }, { cwd })

    expect(result).toMatchObject({ ok: true, processes: [{ command: 'echo world fallback [] unset []' }] })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('${VAR:?message} fails with the message when the variable is empty', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({ processes: { web: 'echo ${REQUIRED:?set it first}' } }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: { REQUIRED: '' } } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: `Failed to load ${join(cwd, '.procuprc')}: set it first`,
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('${VAR:?message} fails with the message when the variable is not set', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({ processes: { web: 'echo ${REQUIRED:?set it first}' } }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: `Failed to load ${join(cwd, '.procuprc')}: set it first`,
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('${VAR:?} without a message names the missing variable', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(join(cwd, '.procuprc'), JSON.stringify({ processes: { web: 'echo ${REQUIRED:?}' } }))

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: `Failed to load ${join(cwd, '.procuprc')}: Required variable REQUIRED is not set`,
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('dependsOn accepts a name or a list', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({
        processes: {
          db: 'db',
          api: { command: 'api', dependsOn: 'db' },
          web: { command: 'web', dependsOn: ['db', 'api'] },
        },
      }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toMatchObject({
      ok: true,
      processes: [
        { name: 'db', dependsOn: [] },
        { name: 'api', dependsOn: ['db'] },
        { name: 'web', dependsOn: ['db', 'api'] },
      ],
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('readyPattern becomes a regular expression with its groups', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({ processes: { db: { command: 'db', readyPattern: 'port (?<port>\\d+)' } } }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toMatchObject({ ok: true, processes: [{ name: 'db', readyPattern: /port (?<port>\d+)/ }] })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('invalid configs explain what is wrong', () => {
  const cases: [unknown, string][] = [
    [[], 'Config must have a "processes" object'],
    [{}, 'Config must have a "processes" object'],
    [{ processes: {} }, 'Config must define at least one process'],
    [{ processes: { web: 3 } }, 'Process "web" must be an object or a command string'],
    [{ processes: { web: { command: ' ' } } }, 'Process "web" must have a non-empty "command" string'],
    [{ processes: { web: { command: 'x', dependsOn: 'db' } } }, 'Process "web" depends on unknown process "db"'],
    [{ processes: { web: { command: 'x', dependsOn: 'web' } } }, 'Process "web" cannot depend on itself'],
    [{ processes: { web: { command: 'x', dependsOn: 3 } } }, 'Process "web".dependsOn must be a string or array'],
    [{ processes: { web: { command: 'x', dependsOn: [3] } } }, 'Process "web".dependsOn entries must be strings'],
    [
      { processes: { web: { command: 'x', readyPattern: '(' } } },
      'Process "web".readyPattern is not a valid regex: "("',
    ],
    [{ env: { PORT: 3000 }, processes: { web: 'x' } }, 'env.PORT must be a string, got number'],
    [
      { processes: { web: { command: 'x', env: { PORT: 3000 } } } },
      'Process "web".env.PORT must be a string, got number',
    ],
  ]
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    for (const [rc, message] of cases) {
      nodeFs.writeFileSync(join(cwd, '.procuprc'), JSON.stringify(rc))

      const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

      expect(result).toStrictEqual({ ok: false, error: 'config_error', message })
    }
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('a dependency cycle is reported with its path', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({ processes: { a: { command: 'a', dependsOn: 'b' }, b: { command: 'b', dependsOn: 'a' } } }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({ ok: false, error: 'config_error', message: 'Dependency cycle detected: a → b → a' })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})

test('a longer cycle names every process in it', () => {
  const cwd = nodeFs.mkdtempSync(join(tmpdir(), 'procup-load-config-'))
  try {
    nodeFs.writeFileSync(
      join(cwd, '.procuprc'),
      JSON.stringify({
        processes: {
          root: 'root',
          a: { command: 'a', dependsOn: ['root', 'c'] },
          b: { command: 'b', dependsOn: 'a' },
          c: { command: 'c', dependsOn: 'b' },
        },
      }),
    )

    const result = loadConfig({ nodeFs, nodeProcess: { env: {} } }, { cwd })

    expect(result).toStrictEqual({
      ok: false,
      error: 'config_error',
      message: 'Dependency cycle detected: a → c → b → a',
    })
  } finally {
    nodeFs.rmSync(cwd, { recursive: true, force: true })
  }
})
