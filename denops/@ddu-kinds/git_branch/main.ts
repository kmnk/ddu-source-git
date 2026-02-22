import type { Denops } from "@denops/std";
import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  branch: string;
  cwd: string;
  isCurrent: boolean;
  text: string;
};

type Params = {
  remote: string;
};

async function openNofileBuffer(
  denops: Denops,
  lines: string[],
): Promise<void> {
  await denops.cmd("new");
  await denops.cmd("setlocal buftype=nofile bufhidden=wipe noswapfile");
  await fn.setline(denops, 1, lines);
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: {
      description: "Yank the branch name.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          await fn.setreg(args.denops, '"', action.text);
          await fn.setreg(args.denops, "*", action.text);
        }
        return ActionFlags.None;
      },
    },

    switch: {
      description: "Switch to the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const { success, out, err } = await runGit(
            ["switch", action.branch],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }

        return ActionFlags.None;
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

          const { success, out, err } = await runGit(
            ["switch", "-c", newName, action.branch],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
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

          const { success, out, err } = await runGit(
            ["branch", "-d", action.branch],
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

          const { success, out, err } = await runGit(
            ["branch", "-D", action.branch],
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

    rebase: {
      description: "Rebase the current branch onto the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const { success, out, err } = await runGit(
            ["rebase", action.branch],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }

        return ActionFlags.None;
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

          const escapedCwd = await fn.shellescape(args.denops, action.cwd);
          const escapedBranch = await fn.shellescape(
            args.denops,
            action.branch,
          );
          await args.denops.cmd(
            `terminal git -C ${escapedCwd} rebase -i ${escapedBranch}`,
          );
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

          const { success, out, err } = await runGit(
            ["branch", "-m", action.branch, newName],
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

          const { success, out, err } = await runGit(
            ["branch", "-c", action.branch, newName],
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

    merge: {
      description:
        "Merge the selected branch into the current branch (`git merge <branch>`). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) continue;

          const confirm = await fn.confirm(
            args.denops,
            `Merge "${action.branch}" into current branch?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["merge", action.branch],
            action.cwd,
          );
          if (!success) {
            const combined = [out, err].filter((s) => s !== "").join("\n");
            await openNofileBuffer(args.denops, combined.split("\n"));
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },

    push: {
      description:
        "Push the selected branch to remote (`git push <remote> <branch>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const remote = args.kindParams.remote;

          const { success, out, err } = await runGit(
            ["push", remote, action.branch],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },

    pushForce: {
      description:
        "Force-push the selected branch with `--force-with-lease`. Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const remote = args.kindParams.remote;

          const confirm = await fn.confirm(
            args.denops,
            `Force-push "${action.branch}" to "${remote}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["push", "--force-with-lease", remote, action.branch],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },

    fetch: {
      description:
        "Fetch the selected branch from remote (`git fetch <remote> <branch>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          const remote = args.kindParams.remote;

          const { success, out, err } = await runGit(
            ["fetch", remote, action.branch],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },

    addWorktree: {
      description:
        "Create a new worktree for the selected branch (`git worktree add <path> <branch>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const path = await fn.input(
            args.denops,
            `Worktree path for "${action.branch}": `,
          ) as string;
          if (path === "") {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["worktree", "add", path, action.branch],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {
      remote: "origin",
    };
  }
}
