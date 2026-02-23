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

export class Source extends BaseSource<Params> {
  override kind = "git_grep";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    const { denops } = args;
    return new ReadableStream({
      async start(controller) {
        const cwd = args.sourceParams.cwd || args.context.cwd;

        let pattern = args.sourceParams.pattern;
        if (pattern === "") {
          pattern = (await fn.input(denops, "git grep pattern: ")) as string;
          if (pattern === "") {
            controller.close();
            return;
          }
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

        const proc = new Deno.Command("git", {
          args: cmdArgs,
          cwd,
          stdout: "piped",
          stderr: "piped",
        });
        const { stdout, stderr } = await proc.output();

        // git grep exits with 1 when no matches — treat as empty result
        const errText = new TextDecoder().decode(stderr).trim();
        if (errText !== "") {
          console.error(`[ddu-source-git_grep] ${errText}`);
        }

        const output = new TextDecoder().decode(stdout).trimEnd();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { path: pathHl, lineNr: lineNrHl } = args.sourceParams.highlights;
        const hasRev = rev !== "";

        const items: Item<ActionData>[] = output
          .split("\n")
          .filter((line) => line.length > 0)
          .flatMap((line) => {
            let rest = line;

            // Skip the rev prefix (e.g. "HEAD:") if rev is specified
            if (hasRev) {
              const colonIdx = rest.indexOf(":");
              if (colonIdx === -1) return [];
              rest = rest.slice(colonIdx + 1);
            }

            // Parse: file:lineNum:colNum:text
            const c1 = rest.indexOf(":");
            if (c1 === -1) return [];
            const filePath = rest.slice(0, c1);
            rest = rest.slice(c1 + 1);

            const c2 = rest.indexOf(":");
            if (c2 === -1) return [];
            const lineNum = parseInt(rest.slice(0, c2), 10);
            rest = rest.slice(c2 + 1);

            const c3 = rest.indexOf(":");
            if (c3 === -1) return [];
            const colNum = parseInt(rest.slice(0, c3), 10);
            const text = rest.slice(c3 + 1);

            if (isNaN(lineNum) || isNaN(colNum)) return [];

            const absolutePath = filePath.startsWith("/")
              ? filePath
              : `${cwd}/${filePath}`;

            const lineNrStr = String(lineNum);
            const colNumStr = String(colNum);
            const display = `${filePath}:${lineNrStr}:${colNumStr}: ${text}`;

            const pathWidth = enc.encode(filePath).length;
            // lineNr highlight: col after "file:" → pathWidth + 2 (1-indexed + colon)
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

            return [
              {
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
              },
            ];
          });

        controller.enqueue(items);
        controller.close();
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
