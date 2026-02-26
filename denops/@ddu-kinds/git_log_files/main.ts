import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";

export type ActionData = {
  text: string; // relative path (destination for renames) — yank target
  path: string; // absolute path (destination for renames) — open target
  cwd: string;
  status: string; // e.g. "M", "A", "D", "R100"
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

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
  };

  override params(): Params {
    return {};
  }
}
