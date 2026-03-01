import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_reflog";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    hash: string;
    ref: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_reflog";

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
          "reflog",
          "--format=%h%x09%H%x09%gd%x09%gs",
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
        const { hash: hashHl, ref: refHl } = args.sourceParams.highlights;

        const items: Item<ActionData>[] = out
          .split("\n")
          .filter((line) => line !== "")
          .map((line) => {
            // Split on first 3 tabs to handle tabs in reflog subject
            const t1 = line.indexOf("\t");
            const t2 = t1 !== -1 ? line.indexOf("\t", t1 + 1) : -1;
            const t3 = t2 !== -1 ? line.indexOf("\t", t2 + 1) : -1;
            const shortHash = t1 !== -1 ? line.slice(0, t1) : line;
            const fullHash = t1 !== -1 && t2 !== -1
              ? line.slice(t1 + 1, t2)
              : "";
            const ref = t2 !== -1 && t3 !== -1 ? line.slice(t2 + 1, t3) : "";
            const gs = t3 !== -1 ? line.slice(t3 + 1) : "";

            const colonIdx = gs.indexOf(": ");
            const action = colonIdx !== -1 ? gs.slice(0, colonIdx) : "";
            const subject = colonIdx !== -1 ? gs.slice(colonIdx + 2) : gs;

            const display = `${shortHash}  ${ref}  ${gs}`;

            const highlights: ItemHighlight[] = [];
            if (shortHash !== "") {
              highlights.push({
                name: "git_reflog-hash",
                hl_group: hashHl,
                col: 1,
                width: enc.encode(shortHash).length,
              });
            }
            if (ref !== "") {
              const refCol = enc.encode(shortHash).length + 3;
              highlights.push({
                name: "git_reflog-ref",
                hl_group: refHl,
                col: refCol,
                width: enc.encode(ref).length,
              });
            }

            return {
              word: shortHash,
              display,
              highlights,
              action: {
                shortHash,
                fullHash,
                ref,
                action,
                subject,
                text: shortHash,
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
        hash: "Identifier",
        ref: "Comment",
      },
    };
  }
}
