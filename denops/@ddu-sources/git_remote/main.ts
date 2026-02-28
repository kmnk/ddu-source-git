import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_remote";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

type Params = {
  args: string[];
  cwd: string;
};

export class Source extends BaseSource<Params> {
  override kind = "git_remote";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const cwd = resolveCwd(args.sourceParams, args.context);

        const { success, out, err } = await runGit(
          ["remote", "-v", ...args.sourceParams.args],
          cwd,
        );

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
        const seen = new Set<string>();
        const items: Item<ActionData>[] = [];

        for (const line of out.split("\n")) {
          if (line === "") continue;

          // format: <name>\t<url> (fetch)  or  <name>\t<url> (push)
          const tabIdx = line.indexOf("\t");
          if (tabIdx === -1) continue;

          const name = line.slice(0, tabIdx);
          const rest = line.slice(tabIdx + 1);

          // Only keep fetch entries
          if (!rest.endsWith("(fetch)")) continue;

          // Strip the " (fetch)" suffix to get the URL
          const url = rest.slice(0, rest.length - " (fetch)".length).trim();

          if (seen.has(name)) continue;
          seen.add(name);

          const display = `${name.padEnd(20)}  ${url}`;
          const word = `${name}  ${url}`;

          const highlights: ItemHighlight[] = [{
            name: "git_remote-name",
            hl_group: "Identifier",
            col: 1,
            width: enc.encode(name).length,
          }];

          items.push({
            word,
            display,
            highlights,
            action: {
              name,
              url,
              text: url,
              cwd,
            },
          });
        }

        controller.enqueue(items);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      args: [],
      cwd: "",
    };
  }
}
