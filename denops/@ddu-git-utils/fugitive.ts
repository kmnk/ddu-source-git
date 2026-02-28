import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";
import { echoErr } from "./echo.ts";

/**
 * Check if vim-fugitive is available. Shows an error message if not.
 * Returns true if fugitive is available, false otherwise.
 */
export async function requireFugitive(denops: Denops): Promise<boolean> {
  const exists = await denops.eval("exists(':Git')") as number;
  if (!exists) {
    await echoErr(
      denops,
      "vim-fugitive is required for this action. Please install tpope/vim-fugitive.",
    );
    return false;
  }
  return true;
}

/**
 * Run a fugitive :Git command in the specified working directory.
 * Uses :lcd to temporarily change the working directory before calling :Git.
 */
export async function callFugitiveGit(
  denops: Denops,
  cwd: string,
  args: string,
): Promise<void> {
  const escaped = await fn.fnameescape(denops, cwd);
  await denops.cmd(`lcd ${escaped}`);
  await denops.cmd(`Git ${args}`);
}
