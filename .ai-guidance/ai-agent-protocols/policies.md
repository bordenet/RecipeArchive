# AI Agent Policies

## Localhost Policy

**NEVER attempt to run Flutter locally or test localhost endpoints.**

This consistently fails and wastes significant tokens. Always work directly with the production environment at https://d1jcaphz4458q7.cloudfront.net for testing and debugging.

## Post-Push Procedure

**Standard process after successful GitHub push:**

1. Remove all backwards-looking "Recent Completed Work" sections from documentation
2. Archive accomplishments to maintain lean documentation focused on:
   - Current issues requiring attention
   - How-to guidance for upcoming work
   - Essential context for development workflow
3. Keep document orientation forward-looking and actionable

## Important Instruction Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation files

## Tool Reminders

| Situation | Tool to Use |
|-----------|-------------|
| Find recipeID from title | `tools/content-ops/content-ops -include-recipe-id` |
| Review normalization issues | `tools/recipe-tracer` |
| Review Flutter errors | `tools/analyze-flutter-errors.sh` |
| Review recipe reports | `tools/recipe-report.sh` |

