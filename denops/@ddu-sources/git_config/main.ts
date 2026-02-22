import type {
  Context,
  Item,
  ItemHighlight,
  SourceOptions,
} from "@shougo/ddu-vim/types";
import { BaseSource } from "@shougo/ddu-vim/source";

import type { ActionData } from "@kmnk/ddu-kind-git_config";

import type { Denops } from "@denops/std";

type Params = {
  args: string[];
  cwd: string;
  scopes: string[]; // [] = all, ["local"] = local only
  highlights: {
    scopeLocal: string;
    scopeGlobal: string;
    scopeSystem: string;
    scopeWorktree: string;
  };
};

export class Source extends BaseSource<Params> {
  override kind = "git_config";

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
          "config",
          "--list",
          "--show-scope",
          "--show-origin",
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
          console.error(`[ddu-source-git_config] ${err}`);
          controller.close();
          return;
        }

        const output = new TextDecoder().decode(stdout).trim();
        if (output === "") {
          controller.close();
          return;
        }

        const enc = new TextEncoder();
        const { highlights } = args.sourceParams;
        const scopeHlMap: Record<string, string> = {
          local: highlights.scopeLocal,
          global: highlights.scopeGlobal,
          system: highlights.scopeSystem,
          worktree: highlights.scopeWorktree,
        };

        const filterScopes = args.sourceParams.scopes;

        const items: Item<ActionData>[] = output
          .split("\n")
          .filter((line) => line !== "")
          .flatMap((line) => {
            // format: <scope>\t<file>\t<key>=<value>
            const t1 = line.indexOf("\t");
            const t2 = t1 !== -1 ? line.indexOf("\t", t1 + 1) : -1;
            const scope = t1 !== -1 ? line.slice(0, t1) : "";
            const originRaw = t1 !== -1 && t2 !== -1
              ? line.slice(t1 + 1, t2)
              : "";
            const keyValue = t2 !== -1 ? line.slice(t2 + 1) : "";

            if (filterScopes.length > 0 && !filterScopes.includes(scope)) {
              return [];
            }

            // Strip "file:" prefix and resolve relative paths
            const rawPath = originRaw.startsWith("file:")
              ? originRaw.slice(5)
              : originRaw;
            const origin = rawPath.startsWith("/")
              ? rawPath
              : rawPath !== ""
              ? `${cwd}/${rawPath}`
              : "";

            const eqIdx = keyValue.indexOf("=");
            const key = eqIdx !== -1 ? keyValue.slice(0, eqIdx) : keyValue;
            const value = eqIdx !== -1 ? keyValue.slice(eqIdx + 1) : "";

            const scopePadded = scope.padEnd(8);
            const display = `${scopePadded}  ${key}=${value}`;
            const word = `${key}=${value}`;

            const hlGroup = scopeHlMap[scope] ?? "";
            const itemHighlights: ItemHighlight[] = hlGroup !== ""
              ? [{
                name: "git_config-scope",
                hl_group: hlGroup,
                col: 1,
                width: enc.encode(scope).length,
              }]
              : [];

            return [{
              word,
              display,
              highlights: itemHighlights,
              action: {
                scope,
                origin,
                key,
                value,
                text: word,
                cwd,
              },
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
      scopes: [],
      highlights: {
        scopeLocal: "Special",
        scopeGlobal: "Identifier",
        scopeSystem: "Comment",
        scopeWorktree: "Special",
      },
    };
  }
}
