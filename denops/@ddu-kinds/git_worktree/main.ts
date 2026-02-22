import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  worktreePath: string;
  hash: string;
  branch: string; // "refs/heads/main" or "" if detached/bare
  isBare: boolean;
  isLocked: boolean;
  text: string; // worktreePath (for yank)
  cwd: string;
};

type Params = {
  cdCommand: string; // "cd" | "lcd" | "tcd"
};

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: {
      description: "Yank the worktree path.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          await fn.setreg(args.denops, '"', action.text);
          await fn.setreg(args.denops, "*", action.text);
        }
        return ActionFlags.None;
      },
    },

    cd: {
      description:
        "Change the current directory to the worktree path (uses cdCommand param).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const cmd = args.kindParams.cdCommand || "cd";
          const escaped = await fn.fnameescape(
            args.denops,
            action.worktreePath,
          );
          await args.denops.cmd(`${cmd} ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    remove: {
      description:
        "Remove the worktree (`git worktree remove`). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const confirm = await fn.confirm(
            args.denops,
            `Remove worktree "${action.worktreePath}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["worktree", "remove", action.worktreePath],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Removed worktree: ${action.worktreePath}`,
          );
        }
        return ActionFlags.RefreshItems;
      },
    },

    lock: {
      description: "Lock the worktree (`git worktree lock`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, err } = await runGit(
            ["worktree", "lock", action.worktreePath],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Locked worktree: ${action.worktreePath}`,
          );
        }
        return ActionFlags.RefreshItems;
      },
    },

    unlock: {
      description: "Unlock the worktree (`git worktree unlock`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, err } = await runGit(
            ["worktree", "unlock", action.worktreePath],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Unlocked worktree: ${action.worktreePath}`,
          );
        }
        return ActionFlags.RefreshItems;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.worktreePath) return undefined;

    const lines: string[] = [
      `path:   ${action.worktreePath}`,
      `HEAD:   ${action.hash}`,
      `branch: ${action.branch || "(detached)"}`,
    ];
    if (action.isBare) lines.push("bare:   true");
    if (action.isLocked) lines.push("locked: true");

    // Show recent log of the worktree
    const { out } = await runGit(
      ["log", "--oneline", "-10"],
      action.worktreePath,
    );
    if (out !== "") {
      lines.push("", "recent commits:", ...out.split("\n"));
    }

    return {
      kind: "nofile",
      contents: lines,
    };
  }

  override params(): Params {
    return {
      cdCommand: "cd",
    };
  }
}
