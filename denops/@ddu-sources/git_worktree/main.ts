import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_worktree";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
};

export class Source extends BaseSource<Params> {
  override kind = "git_worktree";

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
          args: ["worktree", "list", "--porcelain", ...args.sourceParams.args],
          cwd,
          stdout: "piped",
          stderr: "piped",
        });
        const { success, stdout, stderr } = await proc.output();

        if (!success) {
          const err = new TextDecoder().decode(stderr).trim();
          console.error(`[ddu-source-git_worktree] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();

        // Each worktree block is separated by a blank line
        const blocks = output.split(/\n\n+/);
        const items: Item<ActionData>[] = [];

        for (const block of blocks) {
          if (block.trim() === "") continue;

          const lines = block.split("\n");
          let worktreePath = "";
          let hash = "";
          let branch = "";
          let isBare = false;
          let isLocked = false;

          for (const line of lines) {
            if (line.startsWith("worktree ")) {
              worktreePath = line.slice("worktree ".length);
            } else if (line.startsWith("HEAD ")) {
              hash = line.slice("HEAD ".length);
            } else if (line.startsWith("branch ")) {
              branch = line.slice("branch ".length);
            } else if (line === "bare") {
              isBare = true;
            } else if (line === "locked" || line.startsWith("locked ")) {
              isLocked = true;
            }
          }

          if (!worktreePath) continue;

          const shortHash = hash.slice(0, 7);
          // Strip "refs/heads/" prefix for display
          const branchDisplay = branch.startsWith("refs/heads/")
            ? branch.slice("refs/heads/".length)
            : branch || "(detached)";

          const statusParts: string[] = [];
          if (isBare) statusParts.push("bare");
          if (isLocked) statusParts.push("locked");
          const statusSuffix = statusParts.length > 0
            ? `  [${statusParts.join(", ")}]`
            : "";

          const display = `${shortHash}  ${
            branchDisplay.padEnd(30)
          }  ${worktreePath}${statusSuffix}`;
          const word = `${branchDisplay}  ${worktreePath}`;

          const highlights: ItemHighlight[] = [
            {
              name: "git_worktree-hash",
              hl_group: "Identifier",
              col: 1,
              width: enc.encode(shortHash).length,
            },
            {
              name: "git_worktree-branch",
              hl_group: "Special",
              col: enc.encode(shortHash).length + 3,
              width: enc.encode(branchDisplay).length,
            },
          ];

          items.push({
            word,
            display,
            highlights,
            action: {
              worktreePath,
              hash,
              branch,
              isBare,
              isLocked,
              text: worktreePath,
              cwd,
            },
          });
        }

        controller.enqueue(items);
        controller.close();
      },
    });
  }

  override params(): Params {
    return {
      args: [],
      cwd: "",
    };
  }
}
