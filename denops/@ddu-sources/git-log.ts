import * as fn from "https://deno.land/x/denops_std@v3.1.0/function/mod.ts";
import type { GatherArguments } from "https://deno.land/x/ddu_vim@v0.14/base/source.ts";
import type { Item } from "https://deno.land/x/ddu_vim@v0.14/types.ts";
import { BaseSource } from "https://deno.land/x/ddu_vim@v0.14/types.ts";
import { ActionData } from "../@ddu-kinds/git-log.ts"

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  kind = "git-log";

  gather(args: GatherArguments<Params>): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        // こっちはいけるが
        //const lines = await fn.systemlist(args.denops, "git log --graph --oneline | cat");
        // こっちはだめ
        //const lines = await fn.systemlist(args.denops, "git log --graph --oneline --date=format:'%Y-%m-%dT%H:%M:%S' --pretty=format:'%H %ad %an%d %s' | cat");
        // an ないver
        const lines = await fn.systemlist(args.denops, "git log --graph --oneline --date=format:'%Y-%m-%dT%H:%M:%S' --pretty=format:'%H %ad %d %s' | cat");

        controller.enqueue(lines.map((line, i) => {
          return {
              word: line,
          };
          //const matches = line.match(/^([*|\\\/ ]+) ([0-9a-z]+) (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}) (.+)$/);
          //if (matches) {
          //  const graph = matches[1];
          //  const hash = matches[2];
          //  const shortHash = hash.substr(0, 8);
          //  const date = matches[3];
          //  const info = matches[4];

          //  return {
          //    word: `${date} ${graph} ${shortHash} ${info}`,
          //    hash: hash,
          //  }
          //} else {
          //  const graph = line.match(/^[*|\\\/ ]+$/)

          //  return {
          //    word: `                    ${graph}`,
          //    hash: "",
          //  }
          //}
        }));

        controller.close();
      },
    });
  }

  params(): Params {
    return {};
  }
}
