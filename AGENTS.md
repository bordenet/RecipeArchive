# AI Agent Guidelines - RecipeArchive

> **Last Updated**: 2026-02-02
> **Languages**: javascript, go, dart-flutter
> **Type**: web-apps (monorepo with mobile apps, browser extensions, Lambda backend)

**Production**: https://d1jcaphz4458q7.cloudfront.net
<!-- GOLDEN:self-manage:start -->
## ⚠️ Before ANY Task
1. Load `.ai-guidance/invariants.md` — contains critical rules
2. After editing ANY guidance file, check: `wc -l AGENTS.md .ai-guidance/*.md 2>/dev/null`
   - `AGENTS.md` >250 lines → refactor into `.ai-guidance/`
   - Any `.ai-guidance/*.md` >250 lines → split into sub-directory
3. Over the limit, draft a diff. Do not apply it. A human merges it.
<!-- GOLDEN:self-manage:end -->
<!-- golden-agents:stamp version=1.4.0 updated=2026-11-13 -->
<!-- golden-agents:modules javascript=819cd988d53fe2b547746e17fbef9f2ae9c629eef94e2e27778de8891e10b5c2 security=1ac770a3537cafe41a39200b507aaa0b4c6a52f2d978d3c9d6be1b44a91687a3 testing=4f99d896d81c026019fbe4e2682baf1ae0bda9cec0ce1c690be6a95d54781509 build-hygiene=17a6efa17673d4e31ff352f4f1a83cb6aab5a9f8804c7e530e1d23677142be86 deployment=738982f51f7ceb856fb3aea9d97236de6725440e04d112cbd1b7ec276c116be8 -->
<!-- GOLDEN:framework:start -->

---

## Quality Gates

Before a commit, run the gates for each language you changed:
- **javascript**
  1. **Lint**: `npm run lint` (package.json)
  2. **Build**: `npm run build`
  3. **Test**: `npm run test` (package.json)
  4. **Coverage**: Minimum 70%
- ** go**
  1. **Lint**: `npm run lint` (package.json)
  3. **Test**: `npm run test` (package.json)
- ** dart-flutter**
  1. **Lint**: `npm run lint` (package.json)
  3. **Test**: `npm run test` (package.json)

Lint, then build, then test. Run the same commands in CI or a hook.

---

## Communication Rules

- **No flattery** - Skip "Great question!" or "Excellent point!"
- **No hype** - Avoid "revolutionary", "game-changing", "seamless"
- **Evidence-based** - Cite sources or qualify as opinion
- **Direct** - State facts without embellishment

**Banned phrases**: production-grade, world-class, leverage, utilize, incredibly, extremely, Happy to help!

---

## 🚨 Progressive Module Loading

**STOP and load the relevant module BEFORE these actions:**

### Language Modules (🔴 Required)
- 🔴 **BEFORE writing ANY `.js`, `.ts`, `.jsx`, `.tsx` file**: Read `.golden-agents/modules/javascript.md`
- 🔴 **BEFORE writing  go code**: Read `.golden-agents/modules/ go.md`
- 🔴 **BEFORE writing  dart-flutter code**: Read `.golden-agents/modules/ dart-flutter.md`

### Workflow Modules (🔴 Required)
- 🔴 **BEFORE any commit, PR, push, or merge**: Read `.golden-agents/modules/security.md`
- 🔴 **WHEN tests fail OR after 2+ failed fix attempts**: Read `.golden-agents/modules/testing.md`
- 🔴 **WHEN build fails OR lint errors appear**: Read `.golden-agents/modules/build-hygiene.md`
- 🟡 **BEFORE deploying to any environment**: Read `.golden-agents/modules/deployment.md`

### Project type guidance:
- Read `.golden-agents/modules/web-apps (monorepo with mobile apps, browser extensions, Lambda backend).md`

<!-- GOLDEN:framework:end -->

### Optional: Superpowers integration

If [superpowers](https://github.com/obra/superpowers) is installed, run at session start:

```bash
node ~/.codex/superpowers-augment/superpowers-augment.js bootstrap
```
## Quality Gates (MANDATORY)
Before ANY commit:
**Order matters.** Lint → Build → Test. Never skip steps.

---

## Project-Specific Quick Reference

### Git Workflow Policy

| Environment | Behavior |
|-------------|----------|
| **Claude Code / Web** | DO create PRs yourself. Commit → Push → `gh pr create` → Return PR URL |
| **VS Code Agent Mode** | DON'T run git commands. Show user exact commands to run |

**Detection**: Claude Code sessions have task instructions with designated branches.

### Essential Commands

```bash
./validate-monorepo.sh --all           # Validate all components
npm run build:extensions               # Build extensions
npm run lint -- --fix                  # Fix JS quote style (double quotes required)
```

**See [COMMANDS.md](COMMANDS.md) for complete reference.**

### Go Tools (run from repo root)

| Tool | Purpose |
|------|---------|
| `tools/content-ops/content-ops -include-recipe-id "Name"` | Find recipe ID |
| `tools/recipe-tracer/recipe-tracer -recipe ID` | Trace recipe processing |
| `tools/get-diagnostics/get-diagnostics` | Production error triage |

### Mobile Builds (Quick Reference)

| Platform | Command |
|----------|---------|
| iOS dev | `./scripts/ios/build.sh --dev --run` |
| iOS prod | `./scripts/ios/build.sh --prod --device --release --version X.Y.Z` |
| Android dev | `./scripts/android/build.sh --dev --run` |
| Android prod | `./scripts/android/build.sh --prod --device --release --version X.Y.Z` |

**NEVER use `flutter build ios`** - use `xcodebuild` directly. See [.ai-guidance/mobile-builds.md](.ai-guidance/mobile-builds.md) for details.

### Lambda Deployment

```bash
./scripts/aws/lambda.sh recipes        # Deploy specific function
./scripts/aws/lambda.sh --all          # Deploy all
```

### Critical Policies

1. **Build hygiene**: Output to `build/` or `dist/`, never modify source in place
2. **Scripts location**: ALL scripts in `./scripts/` at repo root
3. **Localhost**: NEVER run Flutter locally - use production URL
4. **S3 access**: NEVER use AWS CLI directly - use Go tools
5. **10-minute timeout**: Required on all long-running operations
6. **Perplexity escalation**: After 5 min OR 3 failed attempts on build issues

### Recipe Normalization Workflow

1. Find ID: `cd tools/content-ops && ./content-ops -include-recipe-id "Name"`
2. Trace: `cd tools/recipe-tracer && ./recipe-tracer -recipe ID`
3. Analyze: Check ingredient/instruction counts, CloudWatch logs, cache hits
