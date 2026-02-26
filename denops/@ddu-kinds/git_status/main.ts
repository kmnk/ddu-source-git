import type { Denops } from "@denops/std";
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

async function openCommitBuffer(
  denops: Denops,
  action: ActionData,
  amend: boolean,
): Promise<ActionFlags> {
  const { success: gitDirSuccess, out: gitDirOut } = await runGit(
    ["rev-parse", "--git-dir"],
    action.cwd,
  );
  if (!gitDirSuccess) return ActionFlags.None;

  const gitDir = gitDirOut.startsWith("/")
    ? gitDirOut
    : `${action.cwd}/${gitDirOut}`;
  const commitMsgFile = `${gitDir}/COMMIT_EDITMSG`;

  const prefix = amend
    ? (await runGit(["log", "-1", "--format=%B"], action.cwd)).out + "\n"
    : "\n";
  const { out: statusOut } = await runGit(["status"], action.cwd);
  const statusLines = statusOut.split("\n").map((l) => `# ${l}`).join("\n");
  const template =
    `${prefix}# Please enter the commit message for your changes. Lines starting\n# with '#' will be stripped.\n#\n${statusLines}\n`;
  await Deno.writeTextFile(commitMsgFile, template);

  const escaped = await fn.fnameescape(denops, commitMsgFile);
  await denops.cmd(`new ${escaped}`);
  await denops.cmd("setlocal filetype=gitcommit bufhidden=wipe");

  const commitArgs = amend
    ? ["commit", "--amend", "--file", commitMsgFile, "--cleanup=strip"]
    : ["commit", "--file", commitMsgFile, "--cleanup=strip"];
  const callbackId = await register(
    denops,
    async () => {
      const { success, out, err } = await runGit(commitArgs, action.cwd);
      await echoLog(denops, out);
      if (!success) {
        await echoErr(denops, err);
      }
    },
    { once: true },
  );
  await denops.cmd(
    `autocmd BufWipeout <buffer> call denops#notify(${
      JSON.stringify(denops.name)
    }, ${JSON.stringify(callbackId)}, [])`,
  );

  return ActionFlags.None;
}

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

    split: {
      description: "Open the file in a horizontal split.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`split ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    vsplit: {
      description: "Open the file in a vertical split.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`vsplit ${escaped}`);
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
        return await openCommitBuffer(args.denops, action, false);
      },
    },

    commitAmend: {
      description: "Amend the last commit by editing COMMIT_EDITMSG.",
      callback: async (args) => {
        const action = args.items[0]?.action as ActionData;
        if (!action) return ActionFlags.None;
        return await openCommitBuffer(args.denops, action, true);
      },
    },
  };

  override params(): Params {
    return {};
  }
}
