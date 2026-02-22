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
    out: decoder.decode(stdout).trim(),
    err: decoder.decode(stderr).trim(),
  };
}
