import type { Denops } from "@denops/std";
import {
  ActionFlags,
  type Actions,
  type Previewer,
} from "@shougo/ddu-vim/types";
import { BaseKind, type GetPreviewerArguments } from "@shougo/ddu-vim/kind";
import { WordActions } from "@shougo/ddu-kind-word";
import * as fn from "@denops/std/function";
import { echoErr, echoLog } from "@kmnk/ddu-git-utils/echo";
import { runGit } from "@kmnk/ddu-git-utils/git";

export type ActionData = {
  text: string;
  shortHash: string;
  fullHash: string;
  subject: string;
  author: string;
  authorDate: string;
  cwd: string;
};

type Params = Record<string, never>;

async function openNofileBuffer(
  denops: Denops,
  lines: string[],
  filetype?: string,
): Promise<void> {
  await denops.cmd("new");
  await denops.cmd(
    `setlocal buftype=nofile bufhidden=wipe noswapfile${
      filetype ? ` filetype=${filetype}` : ""
    }`,
  );
  await fn.setline(denops, 1, lines);
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    yank: WordActions.yank,

    reset: {
      description:
        "Run `git reset <hash>` (mixed reset) on the selected commit.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;

          const confirm = await fn.confirm(
            args.denops,
            `Reset to "${action.shortHash} ${action.subject}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["reset", action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },

    resetHard: {
      description: "Run `git reset --hard <hash>` on the selected commit.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;

          const confirm = await fn.confirm(
            args.denops,
            `Hard reset to "${action.shortHash} ${action.subject}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["reset", "--hard", action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },

    createBranch: {
      description: "Create a new branch at the selected commit.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;

          const newName = await fn.input(
            args.denops,
            `New branch at "${action.shortHash}": `,
          ) as string;
          if (newName === "") {
            return ActionFlags.Persist;
          }

          const { success, err } = await runGit(
            ["switch", "-c", newName, action.fullHash],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
        }
        return ActionFlags.None;
      },
    },

    diff: {
      description:
        "Show diff for the selected commit(s). Single: <hash>^..<hash>. Multiple: <oldest>..<newest>.",
      callback: async (args) => {
        const items = args.items.filter(
          (item) => (item?.action as ActionData).fullHash !== "",
        );
        if (items.length === 0) return ActionFlags.None;

        if (items.length === 1) {
          const action = items[0]?.action as ActionData;
          const { success, out, err } = await runGit(
            ["--no-pager", "diff", `${action.fullHash}^..${action.fullHash}`],
            action.cwd,
          );
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await openNofileBuffer(args.denops, out.split("\n"), "diff");
          return ActionFlags.None;
        }

        // Multiple: items[0] is newest, items[last] is oldest
        const newest = items[0]?.action as ActionData;
        const oldest = items[items.length - 1]?.action as ActionData;
        const { success, out, err } = await runGit(
          ["--no-pager", "diff", `${oldest.fullHash}..${newest.fullHash}`],
          newest.cwd,
        );
        if (!success) {
          await echoErr(args.denops, err);
          return ActionFlags.None;
        }
        await openNofileBuffer(args.denops, out.split("\n"), "diff");
        return ActionFlags.None;
      },
    },

    files: {
      description:
        "Open a ddu UI listing files changed in the selected commit.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;
          await args.denops.call("ddu#start", {
            sources: [{
              name: "git_log_files",
              params: { hash: action.fullHash, cwd: action.cwd },
            }],
          });
        }
        return ActionFlags.None;
      },
    },

    cherryPick: {
      description:
        "Apply the selected commit(s) to the current branch with `git cherry-pick`.",
      callback: async (args) => {
        const items = args.items.filter(
          (item) => (item?.action as ActionData).fullHash !== "",
        );
        if (items.length === 0) return ActionFlags.None;

        // Apply in reverse order (oldest first) so the result matches selection order
        const hashes = items
          .map((item) => (item?.action as ActionData).fullHash)
          .reverse();

        const { success, out, err } = await runGit(
          ["cherry-pick", ...hashes],
          (items[0]?.action as ActionData).cwd,
        );
        if (!success) {
          const combined = [out, err].filter((s) => s !== "").join("\n");
          await openNofileBuffer(args.denops, combined.split("\n"));
          return ActionFlags.None;
        }
        await echoLog(
          args.denops,
          [out, err].filter((s) => s !== "").join("\n"),
        );

        return ActionFlags.None;
      },
    },

    revert: {
      description:
        "Revert the selected commit with `git revert --no-edit`. Requires confirmation.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;

          const confirm = await fn.confirm(
            args.denops,
            `Revert "${action.shortHash} ${action.subject}"?`,
            "&Yes\n&No",
            2,
          ) as number;
          if (confirm !== 1) {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["revert", "--no-edit", action.fullHash],
            action.cwd,
          );
          if (!success) {
            const combined = [out, err].filter((s) => s !== "").join("\n");
            await openNofileBuffer(args.denops, combined.split("\n"));
            return ActionFlags.None;
          }
          await echoLog(
            args.denops,
            [out, err].filter((s) => s !== "").join("\n"),
          );
        }

        return ActionFlags.None;
      },
    },

    tag: {
      description: "Create a tag at the selected commit with `git tag <name>`.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;
          if (action.fullHash === "") continue;

          const tagName = await fn.input(
            args.denops,
            `Tag name for "${action.shortHash}": `,
          ) as string;
          if (tagName === "") {
            return ActionFlags.Persist;
          }

          const { success, out, err } = await runGit(
            ["tag", tagName, action.fullHash],
            action.cwd,
          );
          await echoLog(args.denops, out);
          if (!success) {
            await echoErr(args.denops, err);
            return ActionFlags.None;
          }
          await echoLog(args.denops, err);
        }

        return ActionFlags.None;
      },
    },
  };

  override async getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (!action.fullHash) return undefined;

    const { out } = await runGit(
      [
        "show",
        "--no-patch",
        "--format=commit %H%nAuthor: %an <%ae>%nDate:   %ai%n%n    %s%n%n%b",
        action.fullHash,
      ],
      action.cwd,
    );

    return {
      kind: "nofile",
      contents: out.split("\n"),
    };
  }

  override params(): Params {
    return {};
  }
}
