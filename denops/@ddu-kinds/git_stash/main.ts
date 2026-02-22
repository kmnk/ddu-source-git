import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  stashRef: string;
  subject: string;
  text: string;
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    pop: {
      description:
        "Apply the selected stash and remove it from the stash list (`git stash pop`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, out, err } = await runGit(
            ["stash", "pop", action.stashRef],
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

    apply: {
      description:
        "Apply the selected stash without removing it (`git stash apply`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, out, err } = await runGit(
            ["stash", "apply", action.stashRef],
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

    drop: {
      description:
        "Drop the selected stash (`git stash drop`). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const confirm = await fn.confirm(
            args.denops,
            `Drop stash "${action.stashRef}: ${action.subject}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["stash", "drop", action.stashRef],
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

    branch: {
      description:
        "Create a new branch from the selected stash (`git stash branch <name>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `New branch from "${action.stashRef}": `,
          ) as string;
          if (newName === "") {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["stash", "branch", newName, action.stashRef],
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
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.stashRef) return undefined;

    const { out } = await runGit(
      ["stash", "show", "-p", action.stashRef],
      action.cwd,
    );

    return {
      kind: "nofile",
      contents: out.split("\n"),
      syntax: "diff",
    };
  }

  override params(): Params {
    return {};
  }
}
