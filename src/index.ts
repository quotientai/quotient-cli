import { Command } from "commander";
import { audienceCommand } from "./commands/audience.js";
import { authCommand } from "./commands/auth.js";
import { blogCommand } from "./commands/blog.js";
import { completionCommand } from "./commands/completion.js";
import { flowCommand } from "./commands/flow.js";
import { memoryCommand } from "./commands/memory.js";
import { handleError } from "./errors.js";

const VERSION = "0.1.0";

export function buildProgram(): Command {
  const program = new Command("qt")
    .description("Quotient CLI — wraps the @quotientjs/server SDK for humans and agents")
    .version(VERSION, "-v, --version", "print version and exit")
    .showHelpAfterError("(run `qt <command> --help` for details)")
    .enablePositionalOptions();

  program.addCommand(authCommand());
  program.addCommand(audienceCommand());
  program.addCommand(blogCommand());
  program.addCommand(flowCommand());
  program.addCommand(memoryCommand());
  program.addCommand(completionCommand(() => program));

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    handleError(e);
  }
}

main();
