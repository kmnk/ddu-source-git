import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_tag";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

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
        const cwd = resolveCwd(args.sourceParams, args.context);

        const cmdArgs = [
          "tag",
          "-l",
          "--sort=-version:refname",
          "--format=%(refname:short)\t%(objecttype)\t%(contents:subject)",
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
        const { tagName: tagNameHl } = args.sourceParams.highlights;

        const items: Item<ActionData>[] = out
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
                text: tagName,
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
