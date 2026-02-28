import type { Denops } from "@denops/std";
import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { callFugitiveGit, requireFugitive } from "@kmnk/ddu-git-utils/fugitive";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  text: string; // text to yank (file path)
  status: string; // "XY" 2 chars
  path: string; // absolute path to the file
  cwd: string; // git worktree root
};

type Params = Record<string, never>;

async function openDiffBuffer(
  denops: Denops,
  action: ActionData,
  cached: boolean,
): Promise<void> {
  const baseArgs = cached
    ? ["--no-pager", "diff", "--cached"]
    : ["--no-pager", "diff"];
  const gitArgs = action.path === "" ? baseArgs : [...baseArgs, action.path];
  const { out } = await runGit(gitArgs, action.cwd);

  await denops.cmd("new");
  await denops.cmd(
    "setlocal buftype=nofile bufhidden=wipe noswapfile filetype=diff",
  );
  await fn.setline(denops, 1, out.split("\n"));
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    diff: {
      description: "Show git diff for the file.",
      callback: async (args) => {
        for (const item of args.items) {
          await openDiffBuffer(args.denops, item?.action as ActionData, false);
        }
        return ActionFlags.None;
      },
    },

    diffCached: {
      description: "Show git diff --cached for the file.",
      callback: async (args) => {
        for (const item of args.items) {
          await openDiffBuffer(args.denops, item?.action as ActionData, true);
        }
        return ActionFlags.None;
      },
    },

    open: {
      description: "Open the file in a buffer.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`edit ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    tabopen: {
      description: "Open the file in a new tab.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`tabedit ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    delete: {
      description: "Delete the file from the filesystem.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const confirm = await fn.confirm(
            args.denops,
            `Delete file "${action.path}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }
          await Deno.remove(action.path);
        }
        return ActionFlags.RefreshItems;
      },
    },

    add: {
      description: "Stage the file with `git add`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const target = action.path === "" ? action.cwd : action.path;
          const { success, out, err } = await runGit(
            ["add", target],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }
        return ActionFlags.RefreshItems;
      },
    },

    restore: {
      description: "Discard worktree changes with `git restore`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const confirm = await fn.confirm(
            args.denops,
            `Discard changes to "${action.path}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }
          const { success, out, err } = await runGit(
            ["restore", action.path],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }
        return ActionFlags.RefreshItems;
      },
    },

    restoreStaged: {
      description: "Unstage the file with `git restore --staged`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const target = action.path === "" ? action.cwd : action.path;
          const { success, out, err } = await runGit(
            ["restore", "--staged", target],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }
        return ActionFlags.RefreshItems;
      },
    },

    commit: {
      description:
        "Commit staged changes via vim-fugitive's :Git commit. Requires vim-fugitive.",
      callback: async (args) => {
        if (!await requireFugitive(args.denops)) return ActionFlags.None;
        const action = args.items[0]?.action as ActionData;
        if (!action) return ActionFlags.None;
        await callFugitiveGit(args.denops, action.cwd, "commit");
        return ActionFlags.None;
      },
    },

    commitAmend: {
      description:
        "Amend the last commit via vim-fugitive's :Git commit --amend. Requires vim-fugitive.",
      callback: async (args) => {
        if (!await requireFugitive(args.denops)) return ActionFlags.None;
        const action = args.items[0]?.action as ActionData;
        if (!action) return ActionFlags.None;
        await callFugitiveGit(args.denops, action.cwd, "commit --amend");
        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
