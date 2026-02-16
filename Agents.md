# AI Agent Guidelines - RecipeArchive

> **Last Updated**: 2026-02-02
> **Languages**: javascript, go, dart-flutter
> **Type**: web-apps (monorepo with mobile apps, browser extensions, Lambda backend)

**Production**: https://d1jcaphz4458q7.cloudfront.net
<!-- GOLDEN:self-manage:start -->
## ⚠️ Before ANY Task
1. Load `.ai-guidance/invariants.md` — contains critical rules
2. After editing ANY guidance file, check: `wc -l Agents.md .ai-guidance/*.md 2>/dev/null`
   - `Agents.md` >150 lines → refactor into `.ai-guidance/`
   - Any `.ai-guidance/*.md` >250 lines → split into sub-directory
<!-- GOLDEN:self-manage:end -->
<!-- GOLDEN:framework:start -->

---

## Quality Gates (MANDATORY)

Before ANY commit:
1. **Lint**: `npm run lint`
2. **Build**: `npm run build`
3. **Test**: `npm test`
4. **Coverage**: Minimum 70%

**Order matters.** Lint → Build → Test. Never skip steps.

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
- 🔴 **BEFORE writing ANY `.js`, `.ts`, `.jsx`, `.tsx` file**: Read `$HOME/.golden-agents/templates/languages/javascript.md`
- 🔴 **BEFORE writing  go code**: Read `$HOME/.golden-agents/templates/languages/ go.md`
- 🔴 **BEFORE writing  dart-flutter code**: Read `$HOME/.golden-agents/templates/languages/ dart-flutter.md`

### Workflow Modules (🔴 Required)
- 🔴 **BEFORE any commit, PR, push, or merge**: Read `$HOME/.golden-agents/templates/workflows/security.md`
- 🔴 **WHEN tests fail OR after 2+ failed fix attempts**: Read `$HOME/.golden-agents/templates/workflows/testing.md`
- 🔴 **WHEN build fails OR lint errors appear**: Read `$HOME/.golden-agents/templates/workflows/build-hygiene.md`
- 🟡 **BEFORE deploying to any environment**: Read `$HOME/.golden-agents/templates/workflows/deployment.md`
- 🟡 **WHEN conversation exceeds 50 exchanges**: Read `$HOME/.golden-agents/templates/workflows/context-management.md`

### Project type guidance:
- Read `$HOME/.golden-agents/templates/project-types/web-apps (monorepo with mobile apps, browser extensions, Lambda backend).md`

### Optional: Superpowers integration

If [superpowers](https://github.com/obra/superpowers) is installed, run at session start:

```bash
node ~/.codex/superpowers-augment/superpowers-augment.js bootstrap
```

<!-- GOLDEN:framework:end -->

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
