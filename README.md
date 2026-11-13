# procup

**processes up** — run your dev processes in one terminal, started in dependency order.

`procup` starts every process of your project, waits until each one is actually ready before starting the ones that depend on it, and shows them all side by side in a single terminal UI: one tab per process, live output, input, restart and stop.

```
 ● db              │   $ npm run dev
 ⠋ api             │
 ○ web             │   > api@1.0.0 dev
 ✓ migrate         │   > tsx watch src/server.ts
                   │
 ←/→        tabs   │   Server listening on port 3000
 enter     input   │
 s          stop   │
 r       restart   │
 h          help   │
```

## Install

```sh
npm install --global procup
```

Requires Node.js 22 or later, on macOS or Linux.

## Quick start

Create a `.procuprc` file (JSON) in your project:

```json
{
  "processes": {
    "db": {
      "command": "docker compose up postgres",
      "readyPattern": "ready to accept connections"
    },
    "migrate": {
      "command": "npm run migrate",
      "dependsOn": "db"
    },
    "api": {
      "command": "npm run dev",
      "cwd": "apps/api",
      "dependsOn": "migrate",
      "readyPattern": "listening on port (?<port>\\d+)"
    },
    "web": {
      "command": "npm run dev",
      "cwd": "apps/web",
      "dependsOn": "api",
      "env": { "API_URL": "http://localhost:$api.port" }
    }
  }
}
```

Then run:

```sh
procup
```

## How processes start

- A process with no `dependsOn` starts right away.
- A process with `dependsOn` waits until **all** its dependencies are ready.
- A dependency is ready when:
  - it has a `readyPattern` and that pattern appears in its output (a long-running server), or
  - it has no `readyPattern` and exits with code 0 (a one-shot task such as a migration).
- If a dependency fails, the processes that depend on it are skipped.
- On quit, processes stop in reverse: a process stops only after everything that depends on it has stopped.

## Configuration

`.procuprc` is read from the current directory (or from `--config <path>`).

### Processes

A process is either a command string or an object:

| Field          | Type                          | Description                                                     |
| -------------- | ----------------------------- | --------------------------------------------------------------- |
| `command`      | `string`                      | Shell command to run (required).                                |
| `cwd`          | `string`                      | Working directory, relative to the project.                     |
| `env`          | `object`                      | Extra environment variables (string values).                    |
| `envFile`      | `string \| string[] \| false` | `.env` file(s) to load, relative to `cwd`. Read on every start. |
| `dependsOn`    | `string \| string[]`          | Processes that must be ready first.                             |
| `readyPattern` | `string`                      | Regular expression that marks the process as ready.             |
| `showCommand`  | `boolean`                     | Print the command at the top of the pane. Default `true`.       |

```json
{ "processes": { "web": "npm run dev" } }
```

### Global options

`cwd`, `env`, `envFile` and `showCommand` can also be set at the top level. They apply to every process, and each process can override them.

### Passing values between processes

Groups captured by a dependency's `readyPattern` can be used in the `command` and `env` of the processes that depend on it: `$name.group` for named groups, `$name.1` for positional ones.

```json
{
  "processes": {
    "db": { "command": "./start-db.sh", "readyPattern": "port (?<port>\\d+)" },
    "api": { "command": "DB_PORT=$db.port npm run dev", "dependsOn": "db" }
  }
}
```

### Environment variables

Any string in the config can use variables from your environment:

| Syntax             | Result                                                             |
| ------------------ | ------------------------------------------------------------------ |
| `${NAME}`          | Value of `NAME`, or empty.                                         |
| `${NAME:-default}` | Value of `NAME`, or `default` when it is unset or empty.           |
| `${NAME:?message}` | Value of `NAME`, or stop with `message` when it is unset or empty. |

## Command line

| Flag                    | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `--config <path>`       | Use another config file.                                                 |
| `-e, --env-file <path>` | Load this `.env` file for every process (`false` to turn env files off). |

`procup` exits with code 1 if any process failed. `Ctrl+C` (or `SIGINT`/`SIGTERM`) stops everything cleanly; a second one quits immediately.

## Keys

| Key             | Action                                  |
| --------------- | --------------------------------------- |
| `←` `→` `1`–`9` | Switch process                          |
| `↑` `↓`         | Scroll                                  |
| `PgUp` `PgDn`   | Scroll a page                           |
| `g` `G`         | Top · bottom                            |
| `Enter`         | Input mode: keys go to the process      |
| `Esc`           | Leave input mode                        |
| `s`             | Stop · start the process                |
| `r`             | Restart the process                     |
| `h` `?`         | Help                                    |
| `Ctrl+C`        | Close help, leave input mode, then quit |

With the mouse: click a tab to switch, scroll with the wheel, drag the scrollbar, and drag over the output to copy it (`pbcopy` on macOS, `wl-copy` on Wayland, `xclip` on X11).

## Status icons

| Icon       | Meaning                                                 |
| ---------- | ------------------------------------------------------- |
| `○` gray   | pending: waiting for its dependencies                   |
| `⠋` yellow | starting, or waiting for its `readyPattern`             |
| `●` green  | running / ready                                         |
| `✓` green  | finished: a one-shot task that exited with 0            |
| `✖` red    | failed: the exit code is printed at the end of its pane |
| `⠋` gray   | stopping                                                |
| `■` gray   | stopped                                                 |
| `⊘` gray   | skipped: a dependency failed                            |

Colors follow your terminal theme. Set `NO_COLOR` to turn them off.

## Linux notes

- Prebuilt binaries cover glibc distributions on x64 and arm64. On Alpine (musl), `node-pty` is compiled on install and needs `python3`, `make` and `g++`.
- Copying with the mouse needs `wl-copy` (Wayland) or `xclip` (X11).

## Credits

Inspired by [numux](https://github.com/hyldmo/numux) and the `sst dev` terminal.

## License

[MIT](LICENSE)
