import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_stash";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    stashRef: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_stash";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const cwd = resolveCwd(args.sourceParams, args.context);

        const cmdArgs = [
          "stash",
          "list",
          "--format=%gd%x09%gs",
          ...args.sourceParams.args,
        ];

        const { success, out, err } = await runGit(cmdArgs, cwd);

        if (!success) {
          await echoErr(args.denops, err);
          controller.close();
          return;
        }

        if (out === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { stashRef: stashRefHl } = args.sourceParams.highlights;

        const items: Item<ActionData>[] = out
          .split("\n")
          .filter((line) => line !== "")
          .map((line) => {
            const tabIdx = line.indexOf("\t");
            const stashRef = tabIdx !== -1 ? line.slice(0, tabIdx) : line;
            const subject = tabIdx !== -1 ? line.slice(tabIdx + 1) : "";
            const display = `${stashRef}: ${subject}`;

            const highlights: ItemHighlight[] = [
              {
                name: "git_stash-stashRef",
                hl_group: stashRefHl,
                col: 1,
                width: enc.encode(stashRef).length,
              },
            ];

            return {
              word: display,
              display,
              highlights,
              action: {
                stashRef,
                subject,
                text: stashRef,
                cwd,
              },
            };
          });

        controller.enqueue(items);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      args: [],
      cwd: "",
      highlights: {
        stashRef: "Identifier",
      },
    };
  }
}
