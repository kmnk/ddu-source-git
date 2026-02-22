import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { register } from "@denops/std/lambda";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  text: string; // text to yank (file path)
  status: string; // "XY" 2 chars
  path: string; // absolute path to the file
  cwd: string; // git worktree root
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    diff: {
      description: "Show git diff for the file.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const gitArgs = action.path === ""
            ? ["--no-pager", "diff"]
            : ["--no-pager", "diff", action.path];
          const { out } = await runGit(gitArgs, action.cwd);

          await args.denops.cmd("new");
          await args.denops.cmd(
            "setlocal buftype=nofile bufhidden=wipe noswapfile filetype=diff",
          );
          const lines = out.split("\n");
          await fn.setline(args.denops, 1, lines);
        }
        return ActionFlags.None;
      },
    },

    diffCached: {
      description: "Show git diff --cached for the file.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const gitArgs = action.path === ""
            ? ["--no-pager", "diff", "--cached"]
            : ["--no-pager", "diff", "--cached", action.path];
          const { out } = await runGit(gitArgs, action.cwd);

          await args.denops.cmd("new");
          await args.denops.cmd(
            "setlocal buftype=nofile bufhidden=wipe noswapfile filetype=diff",
          );
          const lines = out.split("\n");
          await fn.setline(args.denops, 1, lines);
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
      description: "Commit staged changes by editing COMMIT_EDITMSG.",
      callback: async (args) => {
        const action = args.items[0]?.action as ActionData;
        if (!action) return ActionFlags.None;

        // Get git directory
        const { success: gitDirSuccess, out: gitDirOut } = await runGit(
          ["rev-parse", "--git-dir"],
          action.cwd,
        );
        if (!gitDirSuccess) return ActionFlags.None;

        const gitDir = gitDirOut.startsWith("/")
          ? gitDirOut
          : `${action.cwd}/${gitDirOut}`;
        const commitMsgFile = `${gitDir}/COMMIT_EDITMSG`;

        // Get current status for template comments
        const { out: statusOut } = await runGit(["status"], action.cwd);
        const statusLines = statusOut.split("\n").map((l) => `# ${l}`).join(
          "\n",
        );
        const template =
          `\n# Please enter the commit message for your changes. Lines starting\n# with '#' will be stripped.\n#\n${statusLines}\n`;
        await Deno.writeTextFile(commitMsgFile, template);

        // Open the file in a new split
        const escaped = await fn.fnameescape(args.denops, commitMsgFile);
        await args.denops.cmd(`new ${escaped}`);
        await args.denops.cmd("setlocal filetype=gitcommit bufhidden=wipe");

        // Run git commit when the buffer is closed
        const callbackId = await register(
          args.denops,
          async () => {
            const { success, out, err } = await runGit(
              ["commit", "--file", commitMsgFile, "--cleanup=strip"],
              action.cwd,
            );
            await echoLog(args.denops, out);
            if (!success) {
              await echoErr(args.denops, err);
            }
          },
          { once: true },
        );
        await args.denops.cmd(
          `autocmd BufWipeout <buffer> call denops#notify(${
            JSON.stringify(args.denops.name)
          }, ${JSON.stringify(callbackId)}, [])`,
        );

        return ActionFlags.None;
      },
    },

    commitAmend: {
      description: "Amend the last commit by editing COMMIT_EDITMSG.",
      callback: async (args) => {
        const action = args.items[0]?.action as ActionData;
        if (!action) return ActionFlags.None;

        // Get git directory
        const { success: gitDirSuccess, out: gitDirOut } = await runGit(
          ["rev-parse", "--git-dir"],
          action.cwd,
        );
        if (!gitDirSuccess) return ActionFlags.None;

        const gitDir = gitDirOut.startsWith("/")
          ? gitDirOut
          : `${action.cwd}/${gitDirOut}`;
        const commitMsgFile = `${gitDir}/COMMIT_EDITMSG`;

        // Pre-populate with the last commit message
        const { out: lastMsg } = await runGit(
          ["log", "-1", "--format=%B"],
          action.cwd,
        );
        const { out: statusOut } = await runGit(["status"], action.cwd);
        const statusLines = statusOut.split("\n").map((l) => `# ${l}`).join(
          "\n",
        );
        const template =
          `${lastMsg}\n# Please enter the commit message for your changes. Lines starting\n# with '#' will be stripped.\n#\n${statusLines}\n`;
        await Deno.writeTextFile(commitMsgFile, template);

        // Open the file in a new split
        const escaped = await fn.fnameescape(args.denops, commitMsgFile);
        await args.denops.cmd(`new ${escaped}`);
        await args.denops.cmd("setlocal filetype=gitcommit bufhidden=wipe");

        // Run git commit --amend when the buffer is closed
        const callbackId = await register(
          args.denops,
          async () => {
            const { success, out, err } = await runGit(
              ["commit", "--amend", "--file", commitMsgFile, "--cleanup=strip"],
              action.cwd,
            );
            await echoLog(args.denops, out);
            if (!success) {
              await echoErr(args.denops, err);
            }
          },
          { once: true },
        );
        await args.denops.cmd(
          `autocmd BufWipeout <buffer> call denops#notify(${
            JSON.stringify(args.denops.name)
          }, ${JSON.stringify(callbackId)}, [])`,
        );

        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
