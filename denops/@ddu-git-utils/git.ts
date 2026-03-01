export async function runGit(
  args: string[],
  cwd: string,
): Promise<{ success: boolean; out: string; err: string }> {
  const proc = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stdout, stderr } = await proc.output();
  const decoder = new TextDecoder();
  return {
    success,
    // trimEnd preserves leading whitespace (e.g. %(HEAD) space in git branch,
    // status char in git submodule status) while removing trailing newlines.
    out: decoder.decode(stdout).trimEnd(),
    err: decoder.decode(stderr).trim(),
  };
}

export function resolveCwd(
  sourceParams: { cwd: string },
  context: { cwd: string },
): string {
  return sourceParams.cwd || context.cwd;
}

export function createLineSplitter(): TransformStream<string, string> {
  let buf = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        controller.enqueue(line);
      }
    },
    flush(controller) {
      if (buf.length > 0) controller.enqueue(buf);
    },
  });
}

export function commitSummaryArgs(hash: string): string[] {
  return [
    "show",
    "--no-patch",
    "--format=commit %H%nAuthor: %an <%ae>%nDate:   %ai%n%n    %s%n%n%b",
    hash,
  ];
}
