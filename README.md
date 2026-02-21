# ddu-source-git

[![Claude Code](https://img.shields.io/badge/Claude_Code-assisted-blueviolet?logo=anthropic)](https://claude.ai/claude-code)

ddu sources and kinds for Git operations (branches, and more to come)

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
