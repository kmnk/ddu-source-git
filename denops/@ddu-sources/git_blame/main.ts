import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_blame";

import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

const ZERO_HASH = "0".repeat(40);

type Params = {
  file: string;
  rev: string;
  args: string[];
  cwd: string;
  highlights: {
    hash: string;
    date: string;
    lineNr: string;
  };
};

type BlameBlock = {
  fullHash: string;
  finalLine: number;
  author: string;
  authorTime: number;
  summary: string;
  filename: string;
  content: string;
};

function parseBlameOutput(output: string): BlameBlock[] {
  const lines = output.split("\n");
  const blocks: BlameBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const headerLine = lines[i];
    if (!headerLine || headerLine.trim() === "") {
      i++;
      continue;
    }

    // Header: "<40-char-hash> <orig-line> <final-line> [<count>]"
    const parts = headerLine.split(" ");
    if (parts.length < 3 || (parts[0]?.length ?? 0) !== 40) {
      i++;
      continue;
    }

    const fullHash = parts[0] ?? "";
    const finalLine = parseInt(parts[2] ?? "0", 10);
    i++;

    let author = "";
    let authorTime = 0;
    let summary = "";
    let filename = "";
    let content = "";

    while (i < lines.length) {
      const line = lines[i];
      if (line === undefined) break;

      if (line.startsWith("\t")) {
        content = line.slice(1);
        i++;
        break;
      } else if (line.startsWith("author ")) {
        author = line.slice(7);
      } else if (line.startsWith("author-time ")) {
        authorTime = parseInt(line.slice(12), 10);
      } else if (line.startsWith("summary ")) {
        summary = line.slice(8);
      } else if (line.startsWith("filename ")) {
        filename = line.slice(9);
      }
      i++;
    }

    blocks.push({
      fullHash,
      finalLine,
      author,
      authorTime,
      summary,
      filename,
      content,
    });
  }

  return blocks;
}

function formatDate(unixTime: number): string {
  const d = new Date(unixTime * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class Source extends BaseSource<Params> {
  override kind = "git_blame";

  override gather(args: {
    denops: Denops;
    context: Context;
    sourceOptions: SourceOptions;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    const { denops } = args;
    return new ReadableStream({
      async start(controller) {
        const cwd = resolveCwd(args.sourceParams, args.context);

        let file = args.sourceParams.file;
        if (file === "") {
          const bufname = await fn.bufname(denops, "") as string;
          if (bufname === "") {
            controller.close();
            return;
          }
          file = bufname;
        }

        const rev = args.sourceParams.rev;
        const cmdArgs = [
          "blame",
          "--line-porcelain",
          ...args.sourceParams.args,
          ...(rev !== "" ? [rev] : []),
          "--",
          file,
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

        const blocks = parseBlameOutput(out);
        if (blocks.length === 0) {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { hash: hashHl, date: dateHl, lineNr: lineNrHl } =
          args.sourceParams.highlights;

        // Compute padding widths from all blocks
        const maxAuthorLen = Math.max(
          ...blocks.map((b) => enc.encode(b.author).length),
        );
        const maxLineNrLen = String(
          Math.max(...blocks.map((b) => b.finalLine)),
        ).length;

        const items: Item<ActionData>[] = blocks.map((block) => {
          const shortHash = block.fullHash === ZERO_HASH
            ? "0000000"
            : block.fullHash.slice(0, 7);

          const dateStr = block.fullHash === ZERO_HASH
            ? "          "
            : formatDate(block.authorTime);

          const authorPadded = block.author.padEnd(maxAuthorLen);
          const lineNrStr = String(block.finalLine).padStart(maxLineNrLen);

          // display: "<shortHash> <YYYY-MM-DD> <author>  <lineNr>: <content>"
          const display =
            `${shortHash} ${dateStr} ${authorPadded}  ${lineNrStr}: ${block.content}`;

          const hashWidth = enc.encode(shortHash).length;
          // date starts after hash + space
          const dateCol = hashWidth + 2;
          const dateWidth = enc.encode(dateStr).length;
          // author starts after date + space
          // lineNr starts after author_padded + 2 spaces
          const lineNrCol = dateCol + dateWidth + 1 +
            enc.encode(authorPadded).length + 3;
          const lineNrWidth = enc.encode(lineNrStr).length;

          const highlights: ItemHighlight[] = [];
          if (block.fullHash !== ZERO_HASH) {
            highlights.push({
              name: "git_blame-hash",
              hl_group: hashHl,
              col: 1,
              width: hashWidth,
            });
            highlights.push({
              name: "git_blame-date",
              hl_group: dateHl,
              col: dateCol,
              width: dateWidth,
            });
          }
          highlights.push({
            name: "git_blame-line-nr",
            hl_group: lineNrHl,
            col: lineNrCol,
            width: lineNrWidth,
          });

          const absolutePath = block.filename.startsWith("/")
            ? block.filename
            : `${cwd}/${block.filename}`;

          return {
            word: `${shortHash} ${block.content}`,
            display,
            highlights,
            action: {
              hash: shortHash,
              fullHash: block.fullHash,
              author: block.author,
              authorTime: block.authorTime,
              summary: block.summary,
              filename: block.filename,
              line: block.finalLine,
              content: block.content,
              path: absolutePath,
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
      file: "",
      rev: "",
      args: [],
      cwd: "",
      highlights: {
        hash: "Identifier",
        date: "Comment",
        lineNr: "LineNr",
      },
    };
  }
}
