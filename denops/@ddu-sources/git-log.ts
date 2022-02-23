import * as fn from "https://deno.land/x/denops_std/function/mod.ts";
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
        controller.enqueue([
          {
            word: 'hoge',
            graph: '*',
            hash: 'hioafeioafejaiofuearea',
            info: 'infooo',
          }
        ]);

        controller.close();
      },
    });
  }

  params(): Params {
    return {};
  }
}
