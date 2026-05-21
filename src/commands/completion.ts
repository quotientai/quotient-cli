import { Command } from "commander";

type CommandNode = {
  name: string;
  flags: string[];
  children: CommandNode[];
};

function walk(cmd: Command): CommandNode {
  return {
    name: cmd.name(),
    flags: cmd.options.map((o) => o.long).filter((f): f is string => typeof f === "string"),
    children: cmd.commands.map(walk),
  };
}

function flatten(node: CommandNode, prefix = ""): string[] {
  const path = prefix ? `${prefix} ${node.name}` : node.name;
  const out = [path];
  for (const c of node.children) out.push(...flatten(c, path));
  return out;
}

function bashScript(root: CommandNode): string {
  const lines = flatten(root)
    .map((p) => {
      const parts = p.split(" ");
      const node = findNode(root, parts.slice(1));
      const subs = node?.children.map((c) => c.name).join(" ") ?? "";
      const flags = node?.flags.join(" ") ?? "";
      return `      "${p}") COMPREPLY=( $(compgen -W "${subs} ${flags}" -- "$cur") ) ;;`;
    })
    .join("\n");
  return `_qt_complete() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  local path="\${COMP_WORDS[@]:0:COMP_CWORD}"
  path="\${path// /-}"
  local joined
  joined="$(printf '%s ' "\${COMP_WORDS[@]:0:COMP_CWORD}")"
  joined="\${joined% }"
  case "$joined" in
${lines}
    *) COMPREPLY=( $(compgen -W "${root.children.map((c) => c.name).join(" ")}" -- "$cur") ) ;;
  esac
}
complete -F _qt_complete qt
`;
}

function zshScript(root: CommandNode): string {
  const subs = root.children.map((c) => `    '${c.name}:${escapeZsh(describe(c))}'`).join("\n");
  const subBlocks = root.children
    .map((sub) => {
      const subSubs = sub.children
        .map((s) => `        '${s.name}:${escapeZsh(describe(s))}'`)
        .join("\n");
      const flags = sub.flags.map((f) => `'${f}[flag]'`).join(" ");
      return `  ${sub.name})
    _arguments \\
      '1:subcommand:((
${subSubs}
      ))' \\
      ${flags}
    ;;`;
    })
    .join("\n");
  return `#compdef qt
_qt() {
  local -a commands
  commands=(
${subs}
  )
  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi
  case "\${words[2]}" in
${subBlocks}
  esac
}
_qt "$@"
`;
}

function fishScript(root: CommandNode): string {
  const lines: string[] = ["# qt fish completions"];
  lines.push("complete -c qt -f");
  for (const sub of root.children) {
    lines.push(`complete -c qt -n "__fish_use_subcommand" -a "${sub.name}" -d "${describe(sub)}"`);
    for (const ss of sub.children) {
      lines.push(
        `complete -c qt -n "__fish_seen_subcommand_from ${sub.name}" -a "${ss.name}" -d "${describe(ss)}"`,
      );
      for (const f of ss.flags) {
        lines.push(
          `complete -c qt -n "__fish_seen_subcommand_from ${sub.name}; and __fish_seen_subcommand_from ${ss.name}" -l "${f.replace(/^--/, "")}"`,
        );
      }
    }
    for (const f of sub.flags) {
      lines.push(
        `complete -c qt -n "__fish_seen_subcommand_from ${sub.name}" -l "${f.replace(/^--/, "")}"`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

function describe(_n: CommandNode): string {
  return "";
}

function escapeZsh(s: string): string {
  return s.replace(/'/g, "''");
}

function findNode(node: CommandNode, parts: string[]): CommandNode | null {
  let current: CommandNode | null = node;
  for (const p of parts) {
    if (!current) return null;
    const next: CommandNode | undefined = current.children.find((c) => c.name === p);
    current = next ?? null;
  }
  return current;
}

export function completionCommand(getProgram: () => Command): Command {
  const cmd = new Command("completion")
    .description("Print a shell completion script (bash, zsh, fish)")
    .argument("<shell>", "bash | zsh | fish")
    .action((shell: string) => {
      const tree = walk(getProgram());
      switch (shell) {
        case "bash":
          process.stdout.write(bashScript(tree));
          return;
        case "zsh":
          process.stdout.write(zshScript(tree));
          return;
        case "fish":
          process.stdout.write(fishScript(tree));
          return;
        default:
          process.stderr.write(`Unknown shell "${shell}". Use bash, zsh, or fish.\n`);
          process.exit(2);
      }
    });
  return cmd;
}
