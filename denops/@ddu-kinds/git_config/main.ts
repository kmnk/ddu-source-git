import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  scope: string; // "local" | "global" | "system" | "worktree"
  origin: string; // absolute file path (e.g. "/path/to/.git/config")
  key: string; // "user.name"
  value: string; // "kmnk"
  text: string; // "user.name=kmnk" (for yank)
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: {
      description: "Yank the config entry as `key=value`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          await fn.setreg(args.denops, '"', action.text);
          await fn.setreg(args.denops, "*", action.text);
        }
        return ActionFlags.None;
      },
    },

    set: {
      description:
        "Set a new value for the config key. Prompts for scope (local/global) and value.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const scopeChoice = await fn.confirm(
            args.denops,
            `Set "${action.key}" in:`,
            "&Local\n&Global",
            1,
          ) as number;
          if (scopeChoice === 0) {
            return ActionFlags.Persist;
          }
          const scope = scopeChoice === 1 ? "local" : "global";

          const newValue = await fn.input(
            args.denops,
            `${action.key} = `,
            action.value,
          ) as string;
          if (newValue === action.value) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["config", `--${scope}`, action.key, newValue],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            `Set ${action.key}=${newValue} (${scope})`,
          );
        }

        return ActionFlags.RefreshItems;
      },
    },

    unset: {
      description:
        "Unset the config key in its current scope. Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const confirm = await fn.confirm(
            args.denops,
            `Unset "${action.key}" from ${action.scope}?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["config", `--${action.scope}`, "--unset", action.key],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, out);
        }

        return ActionFlags.RefreshItems;
      },
    },

    edit: {
      description: "Open the config file containing the entry in a buffer.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (!action.origin) {
            await echoErr(args.denops, "Cannot edit: not a file-based config");
            return ActionFlags.None;
          }

          const escaped = await fn.fnameescape(args.denops, action.origin);
          await args.denops.cmd(`edit ${escaped}`);
        }
        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
