import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_tag";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    tagName: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_tag";

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
          "tag",
          "-l",
          "--sort=-version:refname",
          "--format=%(refname:short)\t%(objecttype)\t%(contents:subject)",
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
          console.error(`[ddu-source-git_tag] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { tagName: tagNameHl } = args.sourceParams.highlights;

        const items: Item<ActionData>[] = output
          .split("\n")
          .filter((line) => line !== "")
          .map((line) => {
            const parts = line.split("\t");
            const tagName = parts[0] ?? "";
            const objectType = parts[1] ?? "";
            const subject = parts[2] ?? "";

            const display = subject ? `${tagName}  ${subject}` : tagName;

            const highlights: ItemHighlight[] = [
              {
                name: "git_tag-tagName",
                hl_group: tagNameHl,
                col: 1,
                width: enc.encode(tagName).length,
              },
            ];

            return {
              word: tagName,
              display,
              highlights,
              action: {
                tagName,
                objectType,
                subject,
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
        tagName: "Identifier",
      },
    };
  }
}
