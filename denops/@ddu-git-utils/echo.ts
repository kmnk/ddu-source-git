import type { Denops } from "@denops/std";

function escape(line: string): string {
  return line.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function echoLog(
  denops: Denops,
  message: string,
): Promise<void> {
  const lines = message.split("\n").filter((l) => l !== "");
  if (lines.length === 0) return;
  await denops.cmd("redraw");
  for (const line of lines) {
    await denops.cmd(`echomsg "${escape(line)}"`);
  }
}

export async function echoErr(
  denops: Denops,
  message: string,
): Promise<void> {
  // Filter out hint lines to avoid "Press ENTER" prompt from long output.
  // Full output including hints remains visible via :messages.
  const lines = message
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("hint:"));
  if (lines.length === 0) return;
  await denops.cmd("redraw");
  await denops.cmd("echohl ErrorMsg");
  for (const line of lines) {
    await denops.cmd(`echomsg "${escape(line)}"`);
  }
  await denops.cmd("echohl None");
}
