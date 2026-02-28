import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import * as fn from "@denops/std/function";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { commitSummaryArgs, runGit } from "@kmnk/ddu-git-utils/git";
import { WordActions } from "@shougo/ddu-kind-word";

export type ActionData = {
  shortHash: string;
  fullHash: string;
  ref: string; // "HEAD@{0}"
  action: string; // "commit", "reset", "checkout", ...
  subject: string;
  text: string;
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    reset: {
      description:
        "Run `git reset <fullHash>` (mixed reset) on the selected entry.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, err } = await runGit(
            ["reset", action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },

    resetHard: {
      description:
        "Run `git reset --hard <fullHash>` on the selected entry. Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const confirm = await fn.confirm(
            args.denops,
            `Hard reset to "${action.shortHash} ${action.subject}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["reset", "--hard", action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },

    createBranch: {
      description: "Create a new branch at the selected reflog entry.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `New branch at "${action.shortHash}": `,
          ) as string;
          if (newName === "") {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["switch", "-c", newName, action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.fullHash) return undefined;

    const { out } = await runGit(
      commitSummaryArgs(action.fullHash),
      action.cwd,
    );

    return {
      kind: "nofile",
      contents: out.split("\n"),
    };
  }

  override params(): Params {
    return {};
  }
}
