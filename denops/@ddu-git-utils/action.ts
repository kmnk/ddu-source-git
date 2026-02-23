import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";

export async function openNofileBuffer(
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

export function combineOutput(out: string, err: string): string {
  return [out, err].filter((s) => s !== "").join("\n");
}
