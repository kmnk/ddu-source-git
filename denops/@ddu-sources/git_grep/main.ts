import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_grep";

import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";
import { createLineSplitter, resolveCwd } from "@kmnk/ddu-git-utils/git";

type Params = {
  pattern: string;
  rev: string;
  args: string[];
  cwd: string;
  highlights: {
    path: string;
    lineNr: string;
  };
};

const BATCH_SIZE = 100;

export class Source extends BaseSource<Params> {
  override kind = "git_grep";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    const { denops } = args;
    let proc: Deno.ChildProcess | undefined;
    let cancelled = false;

    return new ReadableStream({
      async start(controller) {
        const cwd = resolveCwd(args.sourceParams, args.context);

        let pattern = args.sourceParams.pattern;
        if (pattern === "") {
          pattern = (await fn.input(denops, "git grep pattern: ")) as string;
          if (pattern === "") {
            controller.close();
            return;
          }
        }

        if (cancelled) {
          controller.close();
          return;
        }

        const rev = args.sourceParams.rev;
        const cmdArgs = [
          "--no-pager",
          "grep",
          "-n",
          "--column",
          "--no-color",
          ...args.sourceParams.args,
          "-e",
          pattern,
          ...(rev !== "" ? [rev] : []),
        ];

        proc = new Deno.Command("git", {
          args: cmdArgs,
          cwd,
          stdout: "piped",
          stderr: "null",
        }).spawn();

        const enc = new TextEncoder();
        const { path: pathHl, lineNr: lineNrHl } = args.sourceParams.highlights;
        const hasRev = rev !== "";

        const lineStream = proc.stdout
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(createLineSplitter());

        const batch: Item<ActionData>[] = [];

        for await (const line of lineStream) {
          if (cancelled) break;

          if (line.length === 0) continue;

          let rest = line;

          if (hasRev) {
            const colonIdx = rest.indexOf(":");
            if (colonIdx === -1) continue;
            rest = rest.slice(colonIdx + 1);
          }

          const c1 = rest.indexOf(":");
          if (c1 === -1) continue;
          const filePath = rest.slice(0, c1);
          rest = rest.slice(c1 + 1);

          const c2 = rest.indexOf(":");
          if (c2 === -1) continue;
          const lineNum = parseInt(rest.slice(0, c2), 10);
          rest = rest.slice(c2 + 1);

          const c3 = rest.indexOf(":");
          if (c3 === -1) continue;
          const colNum = parseInt(rest.slice(0, c3), 10);
          const text = rest.slice(c3 + 1);

          if (isNaN(lineNum) || isNaN(colNum)) continue;

          const absolutePath = filePath.startsWith("/")
            ? filePath
            : `${cwd}/${filePath}`;

          const lineNrStr = String(lineNum);
          const colNumStr = String(colNum);
          const display = `${filePath}:${lineNrStr}:${colNumStr}: ${text}`;

          const pathWidth = enc.encode(filePath).length;
          const lineNrCol = pathWidth + 2;
          const lineNrWidth = enc.encode(lineNrStr).length;

          const highlights: ItemHighlight[] = [
            {
              name: "git_grep-path",
              hl_group: pathHl,
              col: 1,
              width: pathWidth,
            },
            {
              name: "git_grep-line-nr",
              hl_group: lineNrHl,
              col: lineNrCol,
              width: lineNrWidth,
            },
          ];

          batch.push({
            word: `${filePath}:${lineNum}`,
            display,
            highlights,
            action: {
              path: absolutePath,
              line: lineNum,
              col: colNum,
              text,
              cwd,
            },
          });

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
      pattern: "",
      rev: "",
      args: [],
      cwd: "",
      highlights: {
        path: "Directory",
        lineNr: "LineNr",
      },
    };
  }
}
