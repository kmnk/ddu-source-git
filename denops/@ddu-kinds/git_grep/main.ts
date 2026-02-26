import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";

export type ActionData = {
  path: string; // absolute path
  line: number;
  col: number;
  text: string; // matched line text
  cwd: string;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    open: {
      description: "Open the file at the matched line in a buffer.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`edit +${action.line} ${escaped}`);
          await fn.cursor(args.denops, action.line, action.col);
        }
        return ActionFlags.None;
      },
    },

    tabopen: {
      description: "Open the file at the matched line in a new tab.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`tabedit +${action.line} ${escaped}`);
          await fn.cursor(args.denops, action.line, action.col);
        }
        return ActionFlags.None;
      },
    },

    split: {
      description: "Open the file at the matched line in a horizontal split.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`split +${action.line} ${escaped}`);
          await fn.cursor(args.denops, action.line, action.col);
        }
        return ActionFlags.None;
      },
    },

    vsplit: {
      description: "Open the file at the matched line in a vertical split.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.path === "") continue;
          const escaped = await fn.fnameescape(args.denops, action.path);
          await args.denops.cmd(`vsplit +${action.line} ${escaped}`);
          await fn.cursor(args.denops, action.line, action.col);
        }
        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
