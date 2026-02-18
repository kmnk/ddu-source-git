import { ActionFlags, type Actions } from "@shougo/ddu-vim/types";
import { BaseKind } from "@shougo/ddu-vim/kind";

export type ActionData = {
  branch: string;
  cwd: string;
  isCurrent: boolean;
};

type Params = Record<string, never>;

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    switch: {
      description: "Switch to the selected branch.",
      callback: async (args) => {
        for (const item of args.items) {
          const action = item?.action as ActionData;

          if (action.isCurrent) {
            continue;
          }

          const proc = new Deno.Command("git", {
            args: ["switch", action.branch],
            cwd: action.cwd,
            stdout: "piped",
            stderr: "piped",
          });
          const { success, stderr } = await proc.output();

          if (!success) {
            const err = new TextDecoder().decode(stderr).trim();
            await args.denops.call(
              "ddu#util#print_error",
              `Failed to switch: ${err}`,
            );
            return ActionFlags.Persist;
          }
        }

        return ActionFlags.None;
      },
    },
  };

  override params(): Params {
    return {};
  }
}
