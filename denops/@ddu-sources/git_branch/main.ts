import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_branch";

import type { Denops } from "@denops/std";
import { echoErr } from "@kmnk/ddu-git-utils/echo";
import { resolveCwd, runGit } from "@kmnk/ddu-git-utils/git";

type Params = {
  args: string[];
  cwd: string;
  highlights: {
    current: string;
    remote: string;
    worktree: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_branch";

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
          "branch",
          "--format=%(HEAD)\t%(refname)\t%(symref)\t%(worktreepath)",
          ...args.sourceParams.args,
        ];

        // runGit uses trimEnd (not trim) to preserve the leading whitespace
        // in each line. %(HEAD) for a non-current branch is a single space,
        // so trimming leading whitespace from the whole output would break
        // field parsing.
        const { success, out, err } = await runGit(cmdArgs, cwd);

        if (!success) {
          await echoErr(args.denops, err);
          controller.close();
          return;
        }

        const lines = out.split("\n").filter((line) => line !== "");
        if (lines.length === 0) {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const {
          current: currentHlGroup,
          remote: remoteHlGroup,
          worktree: worktreeHlGroup,
        } = args.sourceParams.highlights;

        const items: Item<ActionData>[] = lines
          .flatMap((line) => {
            // Use %(refname) instead of %(refname:short) to avoid ambiguity
            // when a local branch name conflicts with a remote-tracking branch.
            const [head, refname, symref, worktreePath] = line.split("\t");
            if (!refname) return [];
            if (symref) return [];
            // %(HEAD): '*' for current branch, ' ' for everything else
            // (%(worktreepath) is the reliable way to detect linked-worktree branches)
            const isCurrent = head === "*";
            const isRemote = refname.startsWith("refs/remotes/");
            // Strip standard ref prefixes for display
            const branch = refname.startsWith("refs/heads/")
              ? refname.slice("refs/heads/".length)
              : refname.startsWith("refs/remotes/")
              ? refname.slice("refs/remotes/".length)
              : refname;
            // Detect branches checked out in a linked worktree via %(worktreepath)
            const isWorktree = !isCurrent && (worktreePath ?? "") !== "";
            const display = isCurrent
              ? `* ${branch}`
              : isWorktree
              ? `+ ${branch}`
              : `  ${branch}`;

            const highlights: ItemHighlight[] = [];
            if (isCurrent) {
              highlights.push({
                name: "git_branch-current",
                hl_group: currentHlGroup,
                col: 1,
                width: enc.encode(display).length,
              });
            } else if (isWorktree) {
              highlights.push({
                name: "git_branch-worktree",
                hl_group: worktreeHlGroup,
                col: 1,
                width: enc.encode(display).length,
              });
            } else if (isRemote) {
              highlights.push({
                name: "git_branch-remote",
                hl_group: remoteHlGroup,
                col: 3,
                width: enc.encode(branch).length,
              });
            }

            return [{
              word: branch,
              display,
              highlights,
              action: { branch, cwd, isCurrent, isWorktree, text: branch },
            }];
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
        current: "Statement",
        remote: "Comment",
        worktree: "Special",
      },
    };
  }
}
