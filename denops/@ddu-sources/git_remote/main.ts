import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_remote";

import type { Denops } from "@denops/std";

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
        const cwd = args.sourceParams.cwd || args.context.cwd;

        const proc = new Deno.Command("git", {
          args: ["remote", "-v", ...args.sourceParams.args],
          cwd,
          stdout: "piped",
          stderr: "piped",
        });
        const { success, stdout, stderr } = await proc.output();

        if (!success) {
          const err = new TextDecoder().decode(stderr).trim();
          console.error(`[ddu-source-git_remote] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const seen = new Set<string>();
        const items: Item<ActionData>[] = [];

        for (const line of output.split("\n")) {
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
