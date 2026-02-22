import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_status";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    staged: string;
    unstaged: string;
    untracked: string;
    conflict: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_status";

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
          "status",
          "--porcelain",
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
          console.error(`[ddu-source-git_status] ${err}`);
          controller.close();
          return;
        }

        const headerItem: Item<ActionData> = {
          word: "",
          display: "   (no file specified)",
          highlights: [],
          action: {
            text: "",
            status: "  ",
            path: "",
            cwd,
          },
        };

        const output = new TextDecoder().decode(stdout).trimEnd();
        if (output === "") {
          controller.enqueue([headerItem]);
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const {
          staged: stagedHl,
          unstaged: unstagedHl,
          untracked: untrackedHl,
          conflict: conflictHl,
        } = args.sourceParams.highlights;

        const lines = output.split("\n");
        const items: Item<ActionData>[] = lines
          .filter((line) => line.length >= 3)
          .map((line) => {
            const xy = line.slice(0, 2);
            const x = xy[0];
            const y = xy[1];
            const pathPart = line.slice(3);

            // Handle rename/copy: "orig -> new"
            let filePath: string;
            let display: string;
            if (pathPart.includes(" -> ")) {
              const parts = pathPart.split(" -> ");
              filePath = parts[parts.length - 1];
              display = `${xy} ${pathPart}`;
            } else {
              filePath = pathPart;
              display = `${xy} ${filePath}`;
            }

            const absolutePath = filePath.startsWith("/")
              ? filePath
              : `${cwd}/${filePath}`;

            const highlights: ItemHighlight[] = [];

            // Conflict: U in either position, or AA/DD
            if (x === "U" || y === "U" || xy === "AA" || xy === "DD") {
              highlights.push({
                name: "git_status-conflict",
                hl_group: conflictHl,
                col: 1,
                width: enc.encode(xy).length,
              });
            } else if (xy === "??") {
              // Untracked
              highlights.push({
                name: "git_status-untracked",
                hl_group: untrackedHl,
                col: 1,
                width: enc.encode(xy).length,
              });
            } else {
              // Staged (X position)
              if (x !== " " && x !== "?" && x !== "!") {
                highlights.push({
                  name: "git_status-staged",
                  hl_group: stagedHl,
                  col: 1,
                  width: enc.encode(x).length,
                });
              }
              // Unstaged (Y position)
              if (y !== " " && y !== "?" && y !== "!") {
                highlights.push({
                  name: "git_status-unstaged",
                  hl_group: unstagedHl,
                  col: 2,
                  width: enc.encode(y).length,
                });
              }
            }

            return {
              word: filePath,
              display,
              highlights,
              action: {
                text: filePath,
                status: xy,
                path: absolutePath,
                cwd,
              },
            };
          });

        controller.enqueue([headerItem, ...items]);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      args: [],
      cwd: "",
      highlights: {
        staged: "diffAdded",
        unstaged: "diffChanged",
        untracked: "Comment",
        conflict: "ErrorMsg",
      },
    };
  }
}
