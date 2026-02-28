import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_log_files";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

type Params = {
  hash: string;
  cwd: string;
  highlights: {
    added: string;
    modified: string;
    deleted: string;
    renamed: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_log_files";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const hash = args.sourceParams.hash;
        if (hash === "") {
          controller.close();
          return;
        }

        const cwd = resolveCwd(args.sourceParams, args.context);

        const { success, out, err } = await runGit(
          ["--no-pager", "show", "--name-status", "--format=", hash],
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
        const {
          added: addedHl,
          modified: modifiedHl,
          deleted: deletedHl,
          renamed: renamedHl,
        } = args.sourceParams.highlights;

        const lines = out.split("\n").filter((line) => line.length > 0);
        const items: Item<ActionData>[] = lines.map((line) => {
          const fields = line.split("\t");
          const statusCode = fields[0];
          const firstChar = statusCode[0];

          let filePath: string;
          let display: string;
          if (
            (firstChar === "R" || firstChar === "C") && fields.length >= 3
          ) {
            // Rename/copy: fields[1] = old, fields[2] = new
            filePath = fields[2];
            display = `${statusCode}  ${fields[1]} -> ${fields[2]}`;
          } else {
            filePath = fields[1] ?? "";
            display = `${statusCode}  ${filePath}`;
          }

          const absolutePath = filePath.startsWith("/")
            ? filePath
            : `${cwd}/${filePath}`;

          let hlGroup: string;
          if (firstChar === "A") {
            hlGroup = addedHl;
          } else if (firstChar === "D") {
            hlGroup = deletedHl;
          } else if (firstChar === "R" || firstChar === "C") {
            hlGroup = renamedHl;
          } else {
            hlGroup = modifiedHl;
          }

          const highlights: ItemHighlight[] = [
            {
              name: "git_log_files-status",
              hl_group: hlGroup,
              col: 1,
              width: enc.encode(statusCode).length,
            },
          ];

          return {
            word: filePath,
            display,
            highlights,
            action: {
              text: filePath,
              path: absolutePath,
              cwd,
              status: statusCode,
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
      hash: "",
      cwd: "",
      highlights: {
        added: "diffAdded",
        modified: "diffChanged",
        deleted: "diffRemoved",
        renamed: "diffChanged",
      },
    };
  }
}
