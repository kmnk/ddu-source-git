import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import { combineOutput } from "@kmnk/ddu-git-utils/action";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";
import { WordActions } from "@shougo/ddu-kind-word";

export type ActionData = {
  name: string; // e.g. "origin"
  url: string; // e.g. "git@github.com:user/repo.git"
  text: string; // url (for yank)
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    fetch: {
      description: "Fetch from the remote (`git fetch <name>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, out, err } = await runGit(
            ["fetch", action.name],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err || out);
            return ActionFlags.None;
          }
          await echoLog(args.denops, `Fetched ${action.name}`);
        }
        return ActionFlags.None;
      },
    },

    fetchPrune: {
      description:
        "Fetch from the remote and prune deleted branches (`git fetch --prune <name>`).",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          const { success, out, err } = await runGit(
            ["fetch", "--prune", action.name],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err || out);
            return ActionFlags.None;
          }
          await echoLog(args.denops, `Fetched (--prune) ${action.name}`);
        }
        return ActionFlags.None;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.name) return undefined;

    // Use -n to avoid network calls during preview
    const { out, err } = await runGit(
      ["remote", "show", "-n", action.name],
      action.cwd,
    );
    return {
      kind: "nofile",
      contents: combineOutput(out, err).split("\n"),
    };
  }

  override params(): Params {
    return {};
  }
}
