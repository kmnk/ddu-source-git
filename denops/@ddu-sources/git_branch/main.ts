import type { Context, Item, SourceOptions } from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_branch";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
};

export class Source extends BaseSource<Params> {
  override kind = "git_branch";

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
          "branch",
          "--format=%(HEAD)%(refname:short)",
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
          console.error(`[ddu-source-git_branch] ${err}`);
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
          .flatMap((line) => {
            const match = line.match(/^(\*)?\s*(.+)$/);
            if (!match) return [];
            const isCurrent = match[1] === "*";
            const branch = match[2];
            return [{
              word: branch,
              display: isCurrent ? `* ${branch}` : `  ${branch}`,
              action: { branch, cwd, isCurrent },
            }];
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
