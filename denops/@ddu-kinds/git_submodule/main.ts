import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";
import { WordActions } from "@shougo/ddu-kind-word";

export type ActionData = {
  isHeader?: boolean; // true for the always-present header item
  status: string; // " " | "-" | "+" | "U"
  hash: string; // commit hash (40 chars)
  path: string; // submodule path relative to cwd
  describe: string; // git describe result (may be empty)
  text: string; // path (for yank)
  cwd: string;
};

type Params = {
  cdCommand: string; // "cd" | "lcd" | "tcd"
};

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    open: {
      description:
        "Change the current directory to the submodule path (uses cdCommand param).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.isHeader) continue;
          const absPath = action.path.startsWith("/")
            ? action.path
            : `${action.cwd}/${action.path}`;
          const cmd = args.kindParams.cdCommand || "cd";
          const escaped = await fn.fnameescape(args.denops, absPath);
          await args.denops.cmd(`${cmd} ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    add: {
      description:
        "Add a new submodule (`git submodule add <url> [path]`). Prompts for URL and optional path.",
      callback: async (args) => {
        const cwd = (args.items[0]?.action as ActionData).cwd;
        const url = (await fn.input(args.denops, "Submodule URL: ")) as string;
        if (url === "") return ActionFlags.Persist;
        const path = (await fn.input(
          args.denops,
          "Submodule path (empty to use default): ",
        )) as string;

        const cmdArgs = [
          "submodule",
          "add",
          url,
          ...(path !== "" ? [path] : []),
        ];
        const { success, err } = await runGit(cmdArgs, cwd);
        if (!success) {
          await echoErr(args.denops, err);
          return ActionFlags.None;
        }
        await echoLog(args.denops, `Added submodule: ${path || url}`);
        return ActionFlags.RefreshItems;
      },
    },

    update: {
      description:
        "Initialize and update the submodule (`git submodule update --init`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.isHeader) continue;

          const { success, err } = await runGit(
            ["submodule", "update", "--init", action.path],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Updated submodule: ${action.path}`,
          );
        }
        return ActionFlags.RefreshItems;
      },
    },

    init: {
      description: "Register the submodule (`git submodule init`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.isHeader) continue;

          const { success, err } = await runGit(
            ["submodule", "init", action.path],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Initialized submodule: ${action.path}`,
          );
        }
        return ActionFlags.RefreshItems;
      },
    },

    delete: {
      description:
        "Completely remove the submodule (`git rm` + `.git/modules` cleanup). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.isHeader) continue;

          const confirm = await fn.confirm(
            args.denops,
            `Delete submodule "${action.path}"? This cannot be undone.`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          // Step 1: git rm removes the submodule from .gitmodules, index, and working tree
          const { success, err } = await runGit(
            ["rm", action.path],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }

          // Step 2: remove .git/modules/<path> to allow re-adding the submodule later
          const { out: gitDir } = await runGit(
            ["rev-parse", "--git-dir"],
            action.cwd,
          );
          if (gitDir !== "") {
            const absGitDir = gitDir.startsWith("/")
              ? gitDir
              : `${action.cwd}/${gitDir}`;
            const modulesPath = `${absGitDir}/modules/${action.path}`;
            try {
              await Deno.remove(modulesPath, { recursive: true });
            } catch {
              // Ignore if the directory does not exist
            }
          }

          await echoLog(args.denops, `Deleted submodule: ${action.path}`);
        }
        return ActionFlags.RefreshItems;
      },
    },

    deinit: {
      description:
        "Unregister the submodule (`git submodule deinit`). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.isHeader) continue;

          const confirm = await fn.confirm(
            args.denops,
            `Deinit submodule "${action.path}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["submodule", "deinit", action.path],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Deinitialized submodule: ${action.path}`,
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
    if (!action.path) return undefined;

    const statusLabel: Record<string, string> = {
      " ": "up-to-date",
      "-": "not initialized",
      "+": "out of sync",
      "U": "merge conflict",
    };

    const lines: string[] = [
      `path:     ${action.path}`,
      `hash:     ${action.hash}`,
      `status:   ${statusLabel[action.status] ?? action.status}`,
    ];
    if (action.describe !== "") {
      lines.push(`describe: ${action.describe}`);
    }

    // Show recent log inside the submodule if it is initialized
    if (action.status !== "-") {
      const absPath = action.path.startsWith("/")
        ? action.path
        : `${action.cwd}/${action.path}`;
      const { out } = await runGit(["log", "--oneline", "-10"], absPath);
      if (out !== "") {
        lines.push("", "recent commits:", ...out.split("\n"));
      }
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
