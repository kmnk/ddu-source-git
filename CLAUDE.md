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
    echo.ts               — Vim output utilities (echoLog / echoErr)
    git.ts                — git command runner (runGit), shared across kinds
  @ddu-sources/
    git_branch/           — Source: runs `git branch`, returns branch items
      main.ts
    git_status/           — Source: runs `git status --porcelain`, returns changed file items
      main.ts
    git_log/              — Source: runs `git log --graph`, returns commit items
      main.ts
    git_log_files/        — Source: runs `git show --name-status`, returns changed file items for a commit
      main.ts
    git_stash/            — Source: runs `git stash list`, returns stash items
      main.ts
    git_tag/              — Source: runs `git tag -l`, returns tag items
      main.ts
    git_reflog/           — Source: runs `git reflog`, returns reflog items
      main.ts
    git_config/           — Source: runs `git config --list`, returns config entries
      main.ts
    git_remote/           — Source: runs `git remote -v`, returns remote items
      main.ts
  @ddu-kinds/
    git_branch/           — Kind: defines actions on branch items
      main.ts
    git_status/           — Kind: defines actions on changed file items
      main.ts
    git_log/              — Kind: defines actions on commit items
      main.ts
    git_log_files/        — Kind: defines actions on commit-file items
      main.ts
    git_stash/            — Kind: defines actions on stash items (pop, apply, drop, branch, yank)
      main.ts
    git_tag/              — Kind: defines actions on tag items (checkout, createBranch, delete, diff, yank)
      main.ts
    git_reflog/           — Kind: defines actions on reflog items (reset, resetHard, createBranch, yank)
      main.ts
    git_config/           — Kind: defines actions on config entries (set, unset, edit, yank)
      main.ts
    git_remote/           — Kind: defines actions on remote items (fetch, fetchPrune, yank)
      main.ts
```

Each Git concept gets its own source/kind pair under `@ddu-sources/<name>` and `@ddu-kinds/<name>`, registered as a workspace member in `deno.jsonc`.

### Key interfaces

- **Source** (`@ddu-sources/git_branch`): implements ddu.vim `BaseSource`. Calls `git branch` and maps output into `DduItem[]`.
- **Kind** (`@ddu-kinds/git_branch`): implements ddu.vim `BaseKind`. Defines actions: `switch`, `create`, `delete`, `deleteForce`, `rebase`, `rebaseInteractive`, `move`, `copy`, `merge`, `push`, `pushForce`, `fetch`, `yank`. Params: `remote` (default: `"origin"`).
- **Source** (`@ddu-sources/git_status`): implements ddu.vim `BaseSource`. Calls `git status --porcelain` and maps each line into `DduItem[]` with XY highlight.
- **Kind** (`@ddu-kinds/git_status`): implements ddu.vim `BaseKind`. Defines actions: `diff`, `diffCached`, `add`, `restore`, `restoreStaged`, `commit`, `commitAmend`, `open`, `tabopen`, `delete`, `yank`.
- **Source** (`@ddu-sources/git_log`): implements ddu.vim `BaseSource`. Calls `git log --graph` and maps each line into `DduItem[]` with graph/hash highlights.
- **Kind** (`@ddu-kinds/git_log`): implements ddu.vim `BaseKind`. Defines actions: `reset`, `resetHard`, `createBranch`, `cherryPick`, `revert`, `tag`, `diff`, `files`, `yank`. Provides a commit summary previewer.
- **Source** (`@ddu-sources/git_log_files`): implements ddu.vim `BaseSource`. Calls `git show --name-status` for a given hash and maps each changed file into `DduItem[]`.
- **Kind** (`@ddu-kinds/git_log_files`): implements ddu.vim `BaseKind`. Defines actions: `open`, `tabopen`, `yank`.
- **Source** (`@ddu-sources/git_stash`): implements ddu.vim `BaseSource`. Calls `git stash list` and maps each stash into `DduItem[]`.
- **Kind** (`@ddu-kinds/git_stash`): implements ddu.vim `BaseKind`. Defines actions: `pop`, `apply`, `drop`, `branch`, `yank`. Provides a diff previewer via `git stash show -p`.
- **Source** (`@ddu-sources/git_tag`): implements ddu.vim `BaseSource`. Calls `git tag -l --sort=-version:refname` and maps each tag into `DduItem[]`.
- **Kind** (`@ddu-kinds/git_tag`): implements ddu.vim `BaseKind`. Defines actions: `checkout`, `createBranch`, `delete`, `diff`, `yank`. Provides a previewer via `git show --no-patch`.
- **Source** (`@ddu-sources/git_reflog`): implements ddu.vim `BaseSource`. Calls `git reflog` and maps each entry into `DduItem[]` with hash/ref highlights.
- **Kind** (`@ddu-kinds/git_reflog`): implements ddu.vim `BaseKind`. Defines actions: `reset`, `resetHard`, `createBranch`, `yank`. Provides a commit info previewer.
- **Source** (`@ddu-sources/git_config`): implements ddu.vim `BaseSource`. Calls `git config --list --show-scope --show-origin` and maps each entry into `DduItem[]`. Supports `scopes` param to filter by scope.
- **Kind** (`@ddu-kinds/git_config`): implements ddu.vim `BaseKind`. Defines actions: `set` (prompts scope+value), `unset` (with confirm), `edit` (opens config file), `yank`.
- **Source** (`@ddu-sources/git_remote`): implements ddu.vim `BaseSource`. Calls `git remote -v` and maps each remote (fetch entries only) into `DduItem[]` with name highlighted.
- **Kind** (`@ddu-kinds/git_remote`): implements ddu.vim `BaseKind`. Defines actions: `fetch`, `fetchPrune`, `yank`. Provides a previewer via `git remote show -n`.
- **Utils** (`@ddu-git-utils/echo.ts`): provides `echoLog` and `echoErr` wrappers around `denops.cmd("echo ...")`.
- **Utils** (`@ddu-git-utils/git.ts`): provides `runGit` to execute git commands via `Deno.Command`. Shared across all kinds.

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
- Use `echoLog` / `echoErr` from `@kmnk/ddu-git-utils/echo` for all user-visible messages.
- Use `runGit` from `@kmnk/ddu-git-utils/git` to execute git commands.
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
