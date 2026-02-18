import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";

export type ActionData = {
  branch: string;
  cwd: string;
  isCurrent: boolean;
  text: string;
};

type Params = Record<string, never>;

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ success: boolean; err: string }> {
  const proc = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stderr } = await proc.output();
  return { success, err: new TextDecoder().decode(stderr).trim() };
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    ...WordActions,

    switch: {
      description: "Switch to the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const { success, err } = await runGit(
            ["switch", action.branch],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to switch: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.None;
      },
    },

    delete: {
      description: "Delete the selected branch with `git branch -d`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const { success, err } = await runGit(
            ["branch", "-d", action.branch],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to delete: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.RefreshItems;
      },
    },

    rebaseInteractive: {
      description:
        "Interactively rebase the current branch onto the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          await args.denops.cmd(
            `terminal git -C ${action.cwd} rebase -i ${action.branch}`,
          );
        }

        return ActionFlags.None;
      },
    },

    rebase: {
      description: "Rebase the current branch onto the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const { success, err } = await runGit(
            ["rebase", action.branch],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to rebase: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.None;
      },
    },

    move: {
      description: "Rename the selected branch with `git branch -m`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `Rename branch: ${action.branch} -> `,
            action.branch,
          ) as string;
          if (newName === "" || newName === action.branch) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["branch", "-m", action.branch, newName],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to rename: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.RefreshItems;
      },
    },

    copy: {
      description: "Copy the selected branch with `git branch -c`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `Copy branch: ${action.branch} -> `,
            action.branch,
          ) as string;
          if (newName === "" || newName === action.branch) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["branch", "-c", action.branch, newName],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to copy: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.RefreshItems;
      },
    },

    create: {
      description:
        "Create a new branch from the selected branch and switch to it.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `New branch from "${action.branch}": `,
          ) as string;
          if (newName === "") {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["switch", "-c", newName, action.branch],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to create: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.None;
      },
    },

    deleteForce: {
      description:
        "Force delete the selected branch with `git branch -D`. Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const confirm = await fn.confirm(
            args.denops,
            `Force delete branch "${action.branch}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["branch", "-D", action.branch],
            action.cwd,
          );
          if (!success) {
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to force delete: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.RefreshItems;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
