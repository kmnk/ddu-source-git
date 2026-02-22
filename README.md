# ddu-source-git

[![Claude Code](https://img.shields.io/badge/Claude_Code-assisted-blueviolet?logo=anthropic)](https://claude.ai/claude-code)

ddu sources and kinds for Git operations

## Sources / Kinds

| Name | Source | Kind | Description |
|------|--------|------|-------------|
| `git_branch` | `git_branch` | `git_branch` | Lists git branches. Actions: switch, create, delete, deleteForce, rebase, rebaseInteractive, move, copy, yank. |
| `git_status` | `git_status` | `git_status` | Lists changed files from `git status`. Actions: diff, diffCached, add, restore, restoreStaged, commit, commitAmend, open, tabopen, delete, yank. |
| `git_log` | `git_log` | `git_log` | Lists commits from `git log --graph`. Actions: reset, resetHard, createBranch, diff, files, yank. |
| `git_log_files` | `git_log_files` | `git_log_files` | Lists files changed in a commit. Opened from `git_log` files action. Actions: open, tabopen, yank. |

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
