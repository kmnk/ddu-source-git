import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_log";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    graph: string;
    node: string;
    hash: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_log";

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
          "log",
          "--graph",
          "--format=%h%x09%H%x09%s%x09%an%x09%ai",
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
          console.error(`[ddu-source-git_log] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { graph: graphHlGroup, node: nodeHlGroup, hash: hashHlGroup } =
          args.sourceParams.highlights;

        const lines = output.split("\n");
        const items: Item<ActionData>[] = lines.map((line) => {
          const fields = line.split("\t");
          if (fields.length < 5) {
            // graph-only line
            const highlights: ItemHighlight[] = [
              {
                name: "git_log-graph",
                hl_group: graphHlGroup,
                col: 1,
                width: enc.encode(line).length,
              },
            ];
            return {
              word: "",
              display: line,
              highlights,
              action: {
                text: "",
                shortHash: "",
                fullHash: "",
                subject: "",
                author: "",
                authorDate: "",
                cwd,
              },
            };
          }

          // commit line: fields[0] = graphPrefix + shortHash
          const shortHashMatch = fields[0].match(/[0-9a-f]+$/);
          const shortHash = shortHashMatch ? shortHashMatch[0] : "";
          const graphPrefix = shortHash
            ? fields[0].slice(0, -shortHash.length)
            : fields[0];
          const fullHash = fields[1];
          const subject = fields[2];
          const author = fields[3];
          const authorDate = fields[4];

          const highlights: ItemHighlight[] = [];
          const starIndex = graphPrefix.lastIndexOf("*");
          if (starIndex !== -1) {
            const graphPre = graphPrefix.slice(0, starIndex);
            const graphPost = graphPrefix.slice(starIndex + 1);
            if (graphPre !== "") {
              highlights.push({
                name: "git_log-graph-pre",
                hl_group: graphHlGroup,
                col: 1,
                width: enc.encode(graphPre).length,
              });
            }
            highlights.push({
              name: "git_log-node",
              hl_group: nodeHlGroup,
              col: enc.encode(graphPre).length + 1,
              width: 1,
            });
            if (graphPost !== "") {
              highlights.push({
                name: "git_log-graph-post",
                hl_group: graphHlGroup,
                col: enc.encode(graphPre).length + 2,
                width: enc.encode(graphPost).length,
              });
            }
          } else if (graphPrefix !== "") {
            highlights.push({
              name: "git_log-graph",
              hl_group: graphHlGroup,
              col: 1,
              width: enc.encode(graphPrefix).length,
            });
          }
          if (shortHash !== "") {
            highlights.push({
              name: "git_log-hash",
              hl_group: hashHlGroup,
              col: enc.encode(graphPrefix).length + 1,
              width: enc.encode(shortHash).length,
            });
          }

          return {
            word: `${shortHash} ${subject}`,
            display: `${graphPrefix}${shortHash} ${subject}`,
            highlights,
            action: {
              text: fullHash,
              shortHash,
              fullHash,
              subject,
              author,
              authorDate,
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
        graph: "Comment",
        node: "Special",
        hash: "Identifier",
      },
    };
  }
}
