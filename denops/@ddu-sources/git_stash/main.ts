import type { Context, Item, SourceOptions } from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_stash";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
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
        const cwd = args.sourceParams.cwd || args.context.cwd;

        const cmdArgs = [
          "stash",
          "list",
          "--format=%gd%x09%gs",
          ...args.sourceParams.args,
        ];

        const proc = new Deno.Command("git", {
          args: cmdArgs,
          cwd,
          stdout: "piped",
          stderr: "piped",
        });
        const { success, stdout, stderr } = await proc.output();

        if (!success) {
          const err = new TextDecoder().decode(stderr).trim();
          console.error(`[ddu-source-git_stash] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const lines = output.split("\n");
        const items: Item<ActionData>[] = lines
          .filter((line) => line !== "")
          .map((line) => {
            const tabIdx = line.indexOf("\t");
            const stashRef = tabIdx !== -1 ? line.slice(0, tabIdx) : line;
            const subject = tabIdx !== -1 ? line.slice(tabIdx + 1) : "";
            const display = `${stashRef}: ${subject}`;

            return {
              word: display,
              display,
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
    };
  }
}
