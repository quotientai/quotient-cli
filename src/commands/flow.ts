import { Command } from "commander";
import pc from "picocolors";
import { loadClient } from "../client.js";
import { handleError } from "../errors.js";
import { attachGlobalFlags, getGlobalOpts } from "../flags.js";
import { printObject } from "../output.js";

export function flowCommand(): Command {
  const cmd = new Command("flow").description("Enroll people in flows");

  attachGlobalFlags(
    cmd
      .command("trigger")
      .description("Enroll a person in a flow")
      .requiredOption("--flow-id <id>")
      .requiredOption("--person-id <id>"),
  ).action(async function (this: Command) {
    try {
      const opts = getGlobalOpts(this);
      const local = this.opts<{ flowId: string; personId: string }>();
      const { sdk } = loadClient({ apiKey: opts.apiKey });
      const res = await sdk.flow.trigger({ flowId: local.flowId, personId: local.personId });
      printObject(
        { ...res, flowId: local.flowId, personId: local.personId },
        [
          {
            label: "Status",
            get: (d) => (d.success ? pc.green("✓ enrolled") : pc.red("✗ failed")),
          },
          { label: "Flow ID", get: (d) => d.flowId },
          { label: "Person ID", get: (d) => d.personId },
        ],
        opts,
      );
    } catch (e) {
      handleError(e);
    }
  });

  return cmd;
}
