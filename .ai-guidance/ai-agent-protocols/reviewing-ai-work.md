# Reviewing Work from Other AI Agents - CRITICAL

**When asked to review and integrate work from Google Gemini or other AI agents:**

1. **ASSUME THE WORK IS DONE**: If told "AI X did the implementation", trust that code changes exist
2. **READ CAREFULLY**: Distinguish between:
   - Review the PLAN (just documentation, no code yet)
   - Review the IMPLEMENTATION (code changes already made)
3. **NEVER `git restore` without explicit permission**: File changes may represent hours of work
4. **Check git diff FIRST**: Before making assumptions, review what actually changed
5. **When uncertain, ASK**: "Should I review the plan document or the actual implementation changes?"

## Common Mistake Pattern to Avoid

- User: "Review Gemini's work on X"
- ❌ Wrong: Assume no implementation exists, restore files
- ✅ Right: Check git status/diff, review actual changes made

**Why this matters:** Running `git restore` on implemented work wastes thousands of tokens recreating completed work and damages trust.

