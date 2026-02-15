# AI Agent Protocols

## Reviewing Work from Other AI Agents - CRITICAL

**When asked to review and integrate work from Google Gemini or other AI agents:**

1. **ASSUME THE WORK IS DONE**: If told "AI X did the implementation", trust that code changes exist
2. **READ CAREFULLY**: Distinguish between:
   - Review the PLAN (just documentation, no code yet)
   - Review the IMPLEMENTATION (code changes already made)
3. **NEVER `git restore` without explicit permission**: File changes may represent hours of work
4. **Check git diff FIRST**: Before making assumptions, review what actually changed
5. **When uncertain, ASK**: "Should I review the plan document or the actual implementation changes?"

### Common Mistake Pattern to Avoid

- User: "Review Gemini's work on X"
- ❌ Wrong: Assume no implementation exists, restore files
- ✅ Right: Check git status/diff, review actual changes made

**Why this matters:** Running `git restore` on implemented work wastes thousands of tokens recreating completed work and damages trust.

---

## Build & Compilation Issues - Perplexity Escalation

**MANDATORY: When encountering build/compilation errors:**

1. **After 5 minutes OR 3 failed attempts**, STOP and generate a Perplexity.ai prompt
2. Include in prompt:
   - Exact error message
   - Environment details (Xcode version, OS version, tool versions)
   - Project structure (Flutter/React/Go/etc.)
   - Steps already attempted
   - Full dependency chain if applicable (CocoaPods, npm, etc.)
3. **DO NOT continue troubleshooting without external research**
4. Use Perplexity's findings to guide solution

### Example Scenarios Requiring Perplexity Escalation

- Xcode circular dependency errors
- CocoaPods version compatibility issues
- Build system failures across multiple attempts
- Obscure compiler/linker errors
- Platform-specific toolchain issues

**Why this matters:** Build toolchain issues often have known solutions in the community. Spending 30+ minutes on trial-and-error wastes time when a 2-minute search would reveal the answer.

---

## Localhost Policy

**NEVER attempt to run Flutter locally or test localhost endpoints.**

This consistently fails and wastes significant tokens. Always work directly with the production environment at https://d1jcaphz4458q7.cloudfront.net for testing and debugging.

---

## Post-Push Procedure

**Standard process after successful GitHub push:**

1. Remove all backwards-looking "Recent Completed Work" sections from documentation
2. Archive accomplishments to maintain lean documentation focused on:
   - Current issues requiring attention
   - How-to guidance for upcoming work
   - Essential context for development workflow
3. Keep document orientation forward-looking and actionable

---

## Important Instruction Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation files

### Tool Reminders

| Situation | Tool to Use |
|-----------|-------------|
| Find recipeID from title | `tools/content-ops/content-ops -include-recipe-id` |
| Review normalization issues | `tools/recipe-tracer` |
| Review Flutter errors | `tools/analyze-flutter-errors.sh` |
| Review recipe reports | `tools/recipe-report.sh` |

