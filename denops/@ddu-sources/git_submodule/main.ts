import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_submodule";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    hash: string;
    status: string;
  };
};

// git submodule status output:
//   [STATUS][HASH] [PATH] ([DESCRIBE])
// STATUS: ' ' (ok), '-' (not init), '+' (out of sync), 'U' (conflict)
function parseLine(line: string): Omit<ActionData, "text" | "cwd"> | null {
  if (line.length < 42) return null;

  const status = line[0];
  if (!" -+U".includes(status)) return null;

  const rest = line.slice(1);
  const spaceIdx = rest.indexOf(" ");
  if (spaceIdx === -1) return null;

  const hash = rest.slice(0, spaceIdx);
  const remainder = rest.slice(spaceIdx + 1);

  // Remainder: "path/to/submodule" or "path/to/submodule (describe)"
  const parenIdx = remainder.lastIndexOf(" (");
  let path: string;
  let describe: string;

  if (parenIdx !== -1 && remainder.endsWith(")")) {
    path = remainder.slice(0, parenIdx);
    describe = remainder.slice(parenIdx + 2, -1);
  } else {
    path = remainder;
    describe = "";
  }

  return { status, hash, path, describe };
}

export class Source extends BaseSource<Params> {
  override kind = "git_submodule";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const cwd = args.sourceParams.cwd || args.context.cwd;

        const proc = new Deno.Command("git", {
          args: [
            "submodule",
            "status",
            ...args.sourceParams.args,
          ],
          cwd,
          stdout: "piped",
          stderr: "piped",
        });
        const { success, stdout, stderr } = await proc.output();

        if (!success) {
          const err = new TextDecoder().decode(stderr).trim();
          console.error(`[ddu-source-git_submodule] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trimEnd();

        const enc = new TextEncoder();
        const { hash: hashHl, status: statusHl } = args.sourceParams.highlights;

        // Header item is always present so actions (e.g. `add`) can be
        // triggered even when there are no submodules yet.
        const headerItem: Item<ActionData> = {
          word: cwd,
          action: {
            isHeader: true,
            status: "",
            hash: "",
            path: "",
            describe: "",
            text: "",
            cwd,
          },
        };

        const submoduleItems: Item<ActionData>[] = output === "" ? [] : output
          .split("\n")
          .filter((line) => line.length > 0)
          .flatMap((line) => {
            const parsed = parseLine(line);
            if (!parsed) return [];

            const { status, hash, path, describe } = parsed;
            const shortHash = hash.slice(0, 7);

            const statusChar = status;
            const describeStr = describe !== "" ? `  (${describe})` : "";
            const display = `${statusChar}${shortHash}  ${path}${describeStr}`;
            const word = `${path}`;

            const highlights: ItemHighlight[] = [
              {
                name: "git_submodule-status",
                hl_group: statusHl,
                col: 1,
                width: enc.encode(statusChar).length,
              },
              {
                name: "git_submodule-hash",
                hl_group: hashHl,
                col: enc.encode(statusChar).length + 1,
                width: enc.encode(shortHash).length,
              },
            ];

            return [
              {
                word,
                display,
                highlights,
                action: {
                  status,
                  hash,
                  path,
                  describe,
                  text: path,
                  cwd,
                },
              },
            ];
          });

        controller.enqueue([headerItem, ...submoduleItems]);
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
        status: "Special",
      },
    };
  }
}
