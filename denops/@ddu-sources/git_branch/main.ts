import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_branch";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    current: string;
    remote: string;
  };
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
          "--format=%(HEAD)%(refname:short)\t%(refname)\t%(symref)",
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

        const enc = new TextEncoder();
        const { current: currentHlGroup, remote: remoteHlGroup } =
          args.sourceParams.highlights;

        const lines = output.split("\n");
        const items: Item<ActionData>[] = lines
          .filter((line) => line !== "")
          .flatMap((line) => {
            const [refLine, refname, symref] = line.split("\t");
            if (symref) return [];
            const match = refLine.match(/^(\*)?\s*(.+)$/);
            if (!match) return [];
            const isCurrent = match[1] === "*";
            const branch = match[2];
            const isRemote = refname?.startsWith("refs/remotes/") ?? false;
            const display = isCurrent ? `* ${branch}` : `  ${branch}`;

            const highlights: ItemHighlight[] = [];
            if (isCurrent) {
              highlights.push({
                name: "git_branch-current",
                hl_group: currentHlGroup,
                col: 1,
                width: enc.encode(display).length,
              });
            } else if (isRemote) {
              highlights.push({
                name: "git_branch-remote",
                hl_group: remoteHlGroup,
                col: 3,
                width: enc.encode(branch).length,
              });
            }

            return [{
              word: branch,
              display,
              highlights,
              action: { branch, cwd, isCurrent, text: branch },
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
      highlights: {
        current: "Statement",
        remote: "Comment",
      },
    };
  }
}
