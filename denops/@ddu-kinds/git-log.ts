import {
  ActionArguments,
  ActionFlags,
  BaseKind,
  DduItem,
} from "https://deno.land/x/ddu_vim@v1.5.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v1.5.0/deps.ts";

export type ActionData = {
  hash: string;
};

type Params = Record<never, never>;

export class Kind extends BaseKind<Params> {
  actions: Record<
    string,
    (args: ActionArguments<Params>) => Promise<ActionFlags>
  > = {
    yank: async(args) => {
      for (const item of args.items) {
        const action = item?.action as ActionData;
        const hash = action.hash;
        yank(args.denops, hash);
      }
      return Promise.resolve(ActionFlags.None);
    },
    reset: async(args) => {
      const item = args.item[0];
      const hash = action.hash;
      await args.denops.cmd(`Git reset ${hash}`);
    },
  };

  params(): Params {
    return {};
  }
}

const yank = async(denops: Denops, str: string) => {
  await fn.setreg(denops, '"', str);
  if (await fn.has(denops, "clipboard")) {
    await fn.setreg(
      denops,
      await denops.eval("v:register"),
      str,
    );
  }
};
