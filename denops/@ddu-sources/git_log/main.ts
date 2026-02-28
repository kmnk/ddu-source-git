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

const BATCH_SIZE = 200;

export class Source extends BaseSource<Params> {
  override kind = "git_log";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    let proc: Deno.ChildProcess | undefined;
    let cancelled = false;

    return new ReadableStream({
      async start(controller) {
        const cwd = args.sourceParams.cwd || args.context.cwd;

        const cmdArgs = [
          "log",
          "--graph",
          "--format=%h%x09%H%x09%s%x09%an%x09%ai",
          ...args.sourceParams.args,
        ];

        proc = new Deno.Command("git", {
          args: cmdArgs,
          cwd,
          stdout: "piped",
          stderr: "null",
        }).spawn();

        const enc = new TextEncoder();
        const { graph: graphHlGroup, node: nodeHlGroup, hash: hashHlGroup } =
          args.sourceParams.highlights;

        let buf = "";
        const lineSplitter = new TransformStream<string, string>({
          transform(chunk, controller) {
            buf += chunk;
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              controller.enqueue(line);
            }
          },
          flush(controller) {
            if (buf.length > 0) controller.enqueue(buf);
          },
        });

        const lineStream = proc.stdout
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(lineSplitter);

        const batch: Item<ActionData>[] = [];

        for await (const line of lineStream) {
          if (cancelled) break;

          const fields = line.split("\t");
          let item: Item<ActionData>;

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
            item = {
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
          } else {
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

            item = {
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
          }

          batch.push(item);

          if (batch.length >= BATCH_SIZE) {
            controller.enqueue([...batch]);
            batch.length = 0;
          }
        }

        if (!cancelled && batch.length > 0) controller.enqueue(batch);
        controller.close();
      },

      cancel() {
        cancelled = true;
        try {
          proc?.kill();
        } catch {
          // already exited
        }
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
