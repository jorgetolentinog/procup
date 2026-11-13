#!/usr/bin/env node
import * as nodeChildProcess from 'node:child_process'
import { writeSync } from 'node:fs'
import * as nodeProcess from 'node:process'
import * as nodeTimers from 'node:timers'
import { createProcup } from './core/index.ts'
import { parseArgs } from './parse-args.ts'
import { createTui } from './tui/index.ts'

function main(): void {
  const warnings: (Error & { code?: string })[] = []
  process.removeAllListeners('warning')
  process.on('warning', warning => warnings.push(warning))
  process.on('exit', () => {
    for (const w of warnings)
      writeSync(
        2,
        `(node:${process.pid}) ${w.code === undefined || w.code === '' ? '' : `[${w.code}] `}${w.name}: ${w.message}\n`,
      )
  })

  const args = parseArgs({ argv: process.argv })
  if (!args.ok) {
    console.error(args.message)
    process.exit(1)
  }

  const procup = createProcup({ configPath: args.configPath, envFile: args.envFile })

  const loaded = procup.loadProject()
  if (!loaded.ok) {
    console.error(loaded.message)
    process.exit(1)
  }

  const quit = async () => {
    const result = await tui.shutdownTui()
    process.exit(result.exitCode)
  }

  const tui = createTui({
    procup,
    stdout: process.stdout,
    stdin: process.stdin,
    nodeChildProcess,
    nodeProcess,
    nodeTimers,
    quit: () => void quit(),
  })

  procup.on('output', () => tui.scheduleFrame())
  procup.on('status', () => tui.scheduleFrame())
  process.stdin.on('data', (data: string) => tui.handleKey({ data }))
  process.stdout.on('resize', () => tui.handleResize())

  let signalled = false
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (signalled) process.exit(1)
      signalled = true
      void quit()
    })
  }

  const crash = (label: string) => (reason: unknown) => {
    void tui.shutdownTui().finally(() => {
      console.error(`procup: ${label}: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`)
      process.exit(1)
    })
  }
  process.on('uncaughtException', crash('unexpected error'))
  process.on('unhandledRejection', crash('unhandled rejection'))

  tui.startTui()
}

main()
