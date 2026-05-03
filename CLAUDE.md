# CLAUDE.md

<!-- llm-tools:v1:begin -->
## Cheap-worker delegation (llm-tools)

Three CLIs are on PATH that route bulk I/O and predictable text generation to a
cheap OpenAI-compatible model (DeepSeek V4 Flash by default; V4 Pro for
`llm-write`; Kimi K2.5, OpenRouter, or a local Ollama model are drop-in
alternatives via env vars). Use them when the task is bulk reading or
boilerplate — not when reasoning or correctness is on the line.

- `llm-ask <files...> -q "..."` — bulk read. Use when you'd otherwise read 3+
  files OR a single file >400 lines. Returns a short answer; you read that, not
  the files. Verify details that matter — the cheap model occasionally
  hallucinates a small fact.
- `llm-write -r <ref> -s "<spec>" -o <path>` — generate tests, fixtures, config
  scaffolds, doc templates. Review and edit; do not blindly trust.
- `llm-extract <transcript.jsonl>` — compress a session transcript before doc
  updates.

### When to delegate

- Reading large files or many files just to extract facts / summarize.
- Generating boilerplate: test scaffolds, fixtures, config files, doc templates.
- Compressing transcripts before writing release notes or docs.

### Keep on Claude (do NOT delegate)

- Architectural / design decisions.
- Debugging — the cheap model misses subtle bugs.
- Anything touching auth, payments, PII, deletion, or production data.
- Final commits and PR descriptions.
- Tasks under ~2000 tokens — delegation overhead isn't worth it.
- Inferences across files that aren't literally adjacent in the corpus — cheap
  models are good at "what does this say" and weak at "what would happen if X."

### Documentation workflow

Never write documentation directly. Delegate the draft to `llm-write`, then
review and surgically edit the result.

### Cost reference

~$0.002 to `llm-ask` a ~12k-token doc on DeepSeek V4 Flash vs ~$0.25 for the
same read on Opus 4.7 — ~125× cheaper for the worker call, ~23× cheaper
end-to-end after the worker's answer flows back into Claude's context. Quality
is good enough for "summarize / find facts" tasks.

### Configuration

The CLIs read `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`
(plus `LLM_WRITE_MODEL` for the higher-quality write tier) from the
environment. Defaults target DeepSeek; override for Kimi, OpenRouter, or a
local Ollama endpoint without changing any prompts.
<!-- llm-tools:v1:end -->
