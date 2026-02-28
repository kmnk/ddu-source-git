import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { openNofileBuffer } from "@kmnk/ddu-git-utils/action";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { commitSummaryArgs, runGit } from "@kmnk/ddu-git-utils/git";

const ZERO_HASH = "0".repeat(40);

export type ActionData = {
  hash: string; // 7-char short hash
  fullHash: string; // 40-char full hash
  author: string;
  authorTime: number; // Unix timestamp
  summary: string; // first line of commit message
  filename: string; // blame target file (relative to cwd)
  line: number; // line number in the file
  content: string; // line content
  path: string; // absolute path
  text: string; // for yank: `hash content`
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    open: {
      description: "Open the file at the blamed line in a buffer.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`edit +${action.line} ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    tabopen: {
      description: "Open the file at the blamed line in a new tab.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`tabedit +${action.line} ${escaped}`);
        }
        return ActionFlags.None;
      },
    },

    showCommit: {
      description:
        "Show commit details for the blamed line in a nofile buffer. Skips uncommitted lines.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === ZERO_HASH) continue;

          const { success, out, err } = await runGit(
            commitSummaryArgs(action.fullHash),
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await openNofileBuffer(args.denops, out.split("\n"));
        }
        return ActionFlags.None;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.fullHash || action.fullHash === ZERO_HASH) return undefined;

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
