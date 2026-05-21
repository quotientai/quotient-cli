# `qt` — Quotient CLI

Thin, type-safe wrapper around the [`@quotientjs/server`](https://www.npmjs.com/package/@quotientjs/server) SDK. Designed to be driven by humans **and** by agents (Claude Code).

- Mirrors the [SDK namespace](https://www.getquotient.ai/docs/sdk) — if you know the SDK, you know the CLI
- Private-key only (`sk_*`); refuses public keys
- XDG config (`~/.config/quotient/config.json`, mode 600)
- Tables in your terminal, compact JSON when piped — picks the right one automatically
- Distributed as standalone Bun-compiled binaries, no Node required

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/quotient/cli/main/install.sh | bash
```

Pinned version:

```bash
VERSION=v0.1.0 curl -fsSL https://raw.githubusercontent.com/quotient/cli/main/install.sh | bash
```

Or grab a binary from the [releases page](https://github.com/quotient/cli/releases) directly.

## Authenticate

```bash
qt auth login                       # interactive prompt
qt auth login --api-key sk_...      # non-interactive

qt auth whoami                      # business id, scopes, key source
qt auth logout                      # remove local config
```

Key resolution order: `--api-key` flag → `$QUOTIENT_API_KEY` → `~/.config/quotient/config.json`.

For CI, prefer the env var — no file gets written and the key never lands on disk.

## Output

- **Interactive terminal** → rendered tables with pagination footers and color.
- **Piped or non-TTY** → compact JSON to stdout, JSON error envelope to stderr. No flag needed.
- Override anywhere: `--output table|json|jsonl|yaml`.

```bash
qt audience lists list                          # table
qt audience lists list | jq '.lists[]'          # JSON, auto
qt audience lists list -o jsonl                 # newline-delimited
```

## Commands

```
qt auth login | logout | whoami
qt audience people upsert      --email <e> [...]
qt audience companies upsert   --domain <d> [...]
qt audience lists list         [--search] [--page] [--limit] [--all]
qt audience lists get          <slug>
qt audience lists upsert       (--name | --slug) [--description]
qt audience lists list-people  <slug> [--search] [--page] [--limit] [--all]
qt audience lists add-people   <slug> (--email ... | --person-id ...)
qt audience lists remove-people <slug> (--email ... | --person-id ...)
qt blog get                    <slug> [--raw-html]
qt blog list                   [--author] [--tag] [--status] [--search] [--all]
qt blog list-authors           [--search] [--all]
qt blog list-tags
qt flow trigger                --flow-id <id> --person-id <id>
qt memory ls                   <path> [--deep]
qt memory cat                  <path>
qt memory write                <path> (--content <t> | --file <p> | --stdin) [--title] [--tag] [--pinned]
qt memory mkdir                <path> [--name]
qt memory rm                   <path> [-y]
qt memory search               <query> [--tag]
qt completion                  <bash|zsh|fish>
```

Global flags on every command: `-o/--output`, `--api-key`, `--debug`, `--no-color`.

## Shell completions

```bash
# zsh — one-shot
source <(qt completion zsh)

# zsh — persistent
qt completion zsh > "${fpath[1]}/_qt"

# bash
qt completion bash > /usr/local/etc/bash_completion.d/qt

# fish
qt completion fish > ~/.config/fish/completions/qt.fish
```

## Examples

```bash
# Add a person and put them on the founders list
qt audience people upsert --email ada@example.com --first-name Ada --last-name Lovelace --list founders

# Write a Claude-generated doc up to memory
qt memory write /reports/q2.md --file ./local-report.md --tag report --tag q2

# Vector search
qt memory search "pricing strategy" --tag strategy

# Pipe to jq for agents
qt audience lists list --all | jq '.lists | map(.slug)'

# Trigger a flow for a known person
qt flow trigger --flow-id flow_abc --person-id per_xyz
```

## Errors

- **Missing key** (`exit 3`): `qt auth login` to fix.
- **401 unauthorized** (`exit 3`): the configured key is invalid or revoked.
- **403 scope mismatch** (`exit 6`): the response includes which scopes are needed and which scopes your key has. Regenerate a key with the right scopes at https://app.getquotient.ai/settings/developers.
- **404 not found** (`exit 4`).
- **5xx / network** (`exit 5`).
- Any non-TTY error: `{"error":{"code":"...","message":"...","hint":"...","required":[...],"granted":[...]}}` on stderr.

## Releases

- `feat:` / `fix:` conventional commits on `main` open a release PR via [`release-please`](https://github.com/googleapis/release-please).
- Merging that PR tags `vX.Y.Z` and triggers `.github/workflows/release.yml`.
- Per-platform binaries (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `windows-x64`) are compiled with `bun build --compile`, tar/zipped, and attached to the GitHub release.
- A `RELEASE_PAT` secret with `contents: write` + `pull_requests: write` is required so tag pushes from `release-please` actually trigger the build workflow.

## Local development

This is a Bun-native app — Bun is the package manager, runtime, test runner, and bundler.

```bash
bun install
bun run dev -- --help          # run from source
bun run build && ./dist/qt --help   # compile to a standalone binary

bun run typecheck
bun run lint
bun test
```

## License

MIT
