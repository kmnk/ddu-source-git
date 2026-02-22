import type { Denops } from "@denops/std";

export async function echoLog(
  denops: Denops,
  message: string,
): Promise<void> {
  const lines = message.split("\n").filter((l) => l !== "");
  if (lines.length === 0) return;
  await denops.cmd("redraw");
  const escaped = lines
    .map((l) => l.replace(/\\/g, "\\\\").replace(/"/g, '\\"'))
    .join("\\n");
  await denops.cmd(`echo "${escaped}"`);
}

export async function echoErr(
  denops: Denops,
  message: string,
): Promise<void> {
  const lines = message.split("\n").filter((l) => l !== "");
  if (lines.length === 0) return;
  await denops.cmd("redraw");
  const escaped = lines
    .map((l) => l.replace(/\\/g, "\\\\").replace(/"/g, '\\"'))
    .join("\\n");
  await denops.cmd(`echohl ErrorMsg | echo "${escaped}" | echohl None`);
}
