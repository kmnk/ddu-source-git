# CLAUDE.md — Project Context for Claude Code

## Project Overview

`ddu-source-git` is a [ddu.vim](https://github.com/Shougo/ddu.vim) plugin that provides Git-related sources and kinds for Vim/Neovim. It is written in TypeScript and runs on the Deno runtime via [denops.vim](https://github.com/vim-denops/denops.vim).

The repository is designed to grow: `git_branch` is the first implementation, and additional Git sources/kinds (e.g. for commits, stashes, tags, remotes, etc.) will be added under the same `denops/` workspace.

## Requirements and Dependencies

### Required (must be installed by the user)

- [Deno](https://deno.land/) — TypeScript runtime
- `git` — available in `$PATH`
- [denops.vim](https://github.com/vim-denops/denops.vim) — Deno–Vim/Neovim bridge
- [ddu.vim](https://github.com/Shougo/ddu.vim) — ddu framework

### TypeScript dependencies (auto-resolved by Deno via `deno.json` import maps)

| Package | Version | Used by |
|---------|---------|---------|
| [`@denops/std`](https://jsr.io/@denops/std) | `~8.0.0` | all packages |
| [`@shougo/ddu-vim`](https://jsr.io/@shougo/ddu-vim) | `~11.0.0` | source, kind |
| [`@shougo/ddu-kind-word`](https://jsr.io/@shougo/ddu-kind-word) | `~1.0.0` | `@ddu-kinds/git_branch` (yank action) |

## Architecture

```
denops/
  @ddu-git-utils/
    echo.ts               — shared utilities (echoLog / echoErr), reused by all sources/kinds
  @ddu-sources/
    git_branch/           — (current) Source: runs `git branch`, returns branch items
      main.ts
    <future>/             — placeholder for upcoming sources (commits, stashes, tags, …)
  @ddu-kinds/
    git_branch/           — (current) Kind: defines actions on branch items
      main.ts
    <future>/             — placeholder for upcoming kinds
```

Each Git concept (branch, commit, stash, tag, …) gets its own source/kind pair under `@ddu-sources/<name>` and `@ddu-kinds/<name>`, registered as a workspace member in `deno.jsonc`.

### Key interfaces (current implementation)

- **Source** (`@ddu-sources/git_branch`): implements ddu.vim `BaseSource`. Calls `git branch` and maps output into `DduItem[]`.
- **Kind** (`@ddu-kinds/git_branch`): implements ddu.vim `BaseKind`. Defines actions: `switch`, `delete`, `rebase`, `move`, `copy`, `create`, `yank`.
- **Utils** (`@ddu-git-utils/echo.ts`): provides `echoLog` and `echoErr` wrappers around `denops.cmd("echo ...")`. Shared across all sources and kinds.

## Development Commands

From `deno.jsonc`:

| Task | Command | Description |
|------|---------|-------------|
| `check` | `deno check denops/**/*.ts` | Type-check all TypeScript |
| `lint` | `deno lint denops` | Lint source files |
| `lint-fix` | `deno lint --fix denops` | Auto-fix lint issues |
| `fmt` | `deno fmt denops` | Format source files |
| `test` | `deno test -A --doc --parallel --shuffle denops/**/*.ts` | Run all tests |
| `test:publish` | `deno publish --dry-run --allow-dirty --set-version 0.0.0` | Dry-run publish check |
| `update` | `deno outdated --recursive` | Check for outdated deps |
| `upgrade` | `deno outdated --recursive --update` | Update all deps |

Run tasks with: `deno task <name>`

## Coding Conventions

- All source code is TypeScript targeting the **Deno runtime** (no Node.js).
- Follow **denops.vim** patterns: use the `Dispatcher` interface, `denops.cmd()`, `denops.eval()`.
- Follow **ddu.vim** source/kind interfaces from `@shougo/ddu-vim`.
- Use `echoLog` / `echoErr` from `denops/@ddu-git-utils/echo.ts` for all user-visible messages.
- Workspace is defined in `deno.jsonc` — each package under `denops/` has its own `deno.json`.

## CI

GitHub Actions runs on push/PR to `main`:
- `deno task check`
- `deno task lint`
- `deno task fmt --check`
- `deno task test`

## Notes

- This project is developed with **Claude Code** assistance.
- Keep changes minimal and focused; avoid over-engineering.
