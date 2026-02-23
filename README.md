# ddu-source-git

[![Claude Code](https://img.shields.io/badge/Claude_Code-assisted-blueviolet?logo=anthropic)](https://claude.ai/claude-code)

ddu sources and kinds for Git operations

## Sources / Kinds

| Name | Source | Kind | Description |
|------|--------|------|-------------|
| `git_branch` | `git_branch` | `git_branch` | Lists git branches. Actions: switch, create, delete, deleteForce, rebase, rebaseInteractive, move, copy, merge, push, pushForce, fetch, addWorktree, yank. Kind params: `remote` (default: `"origin"`). |
| `git_status` | `git_status` | `git_status` | Lists changed files from `git status`. Actions: diff, diffCached, add, restore, restoreStaged, commit, commitAmend, open, tabopen, delete, yank. |
| `git_log` | `git_log` | `git_log` | Lists commits from `git log --graph`. Actions: reset, resetHard, createBranch, cherryPick, revert, tag, diff, files, addWorktree, yank. |
| `git_log_files` | `git_log_files` | `git_log_files` | Lists files changed in a commit. Opened from `git_log` files action. Actions: open, tabopen, yank. |
| `git_stash` | `git_stash` | `git_stash` | Lists stashes from `git stash list`. Actions: pop, apply, drop, branch, yank. Preview shows `git stash show -p`. |
| `git_tag` | `git_tag` | `git_tag` | Lists tags from `git tag -l`. Actions: checkout, createBranch, delete, diff, yank. Preview shows `git show --no-patch`. |
| `git_reflog` | `git_reflog` | `git_reflog` | Lists reflog entries from `git reflog`. Actions: reset, resetHard, createBranch, yank. Preview shows commit info. |
| `git_config` | `git_config` | `git_config` | Lists config entries from `git config --list`. Actions: set, unset, edit, yank. Source params: `scopes` (filter by scope). |
| `git_remote` | `git_remote` | `git_remote` | Lists remotes from `git remote -v`. Actions: fetch, fetchPrune, yank. Preview shows `git remote show -n`. |
| `git_worktree` | `git_worktree` | `git_worktree` | Lists worktrees from `git worktree list`. Actions: cd, remove, lock, unlock, yank. Kind params: `cdCommand` (default: `"cd"`). Preview shows path/branch/recent log. |
| `git_grep` | `git_grep` | `git_grep` | Searches git-tracked files with `git grep`. Actions: open, tabopen, yank. Source params: `pattern` (empty prompts input), `rev`, `args`. |
| `git_submodule` | `git_submodule` | `git_submodule` | Lists submodules from `git submodule status`. Actions: open (cd), update, init, deinit, yank. Kind params: `cdCommand` (default: `"cd"`). Preview shows path/hash/status and recent log. |
| `git_blame` | `git_blame` | `git_blame` | Shows per-line blame from `git blame`. Actions: open, tabopen, showCommit, yank. Source params: `file` (empty = current buffer), `rev`, `args`. Preview shows commit info. |

## Requirements

- [Deno](https://deno.land/) — TypeScript runtime
- `git` — available in `$PATH`
- [denops.vim](https://github.com/vim-denops/denops.vim) — Deno–Vim/Neovim bridge
- [ddu.vim](https://github.com/Shougo/ddu.vim) — ddu framework

## Dependencies

TypeScript packages resolved automatically by Deno via `deno.json` import maps (no manual installation required):

| Package | Version |
|---------|---------|
| [`@denops/std`](https://jsr.io/@denops/std) | `~8.0.0` |
| [`@shougo/ddu-vim`](https://jsr.io/@shougo/ddu-vim) | `~11.0.0` |
| [`@shougo/ddu-kind-word`](https://jsr.io/@shougo/ddu-kind-word) | `~1.0.0` |

## Development

This project is developed with [Claude Code](https://claude.ai/claude-code) assistance.

See `CLAUDE.md` for project context loaded automatically by Claude Code.
