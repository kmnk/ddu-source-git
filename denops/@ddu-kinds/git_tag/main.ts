import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { openNofileBuffer } from "@kmnk/ddu-git-utils/action";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  tagName: string;
  objectType: string; // "tag" (annotated) | "commit" (lightweight)
  subject: string;
  text: string;
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    checkout: {
      description:
        "Checkout the selected tag in detached HEAD state (`git checkout <tagName>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, err } = await runGit(
            ["checkout", action.tagName],
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
      description:
        "Create a new branch from the selected tag (`git switch -c <name> <tagName>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const newName = await fn.input(
            args.denops,
            `New branch from "${action.tagName}": `,
          ) as string;
          if (newName === "") {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["switch", "-c", newName, action.tagName],
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

    delete: {
      description:
        "Delete the selected tag (`git tag -d <tagName>`). Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const confirm = await fn.confirm(
            args.denops,
            `Delete tag "${action.tagName}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["tag", "-d", action.tagName],
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

    diff: {
      description:
        "Show diff between the selected tag and the working tree in a buffer (`git diff <tagName>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, out, err } = await runGit(
            ["--no-pager", "diff", action.tagName],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await openNofileBuffer(args.denops, out.split("\n"), "diff");
        }
        return ActionFlags.None;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.tagName) return undefined;

    const { out } = await runGit(
      ["show", "--no-patch", action.tagName],
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
