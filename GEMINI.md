# Gemini Instructions for RecipeArchive

## Scope & Constraints
- **LIMITED TO TOOLS WORK ONLY** - Support tooling, not core application code
- Code updates for linting errors require explicit approval before each change
- Read files back immediately after modifications to verify changes
- Use `gemini.yaml` in repo root for Go monorepo tooling issues

## Critical Rules
1. **STOP on tool errors** - Never overwrite files when tools malfunction (see Sept 20, 2025 incident)
2. **Measure 4x, cut once** - Avoid regressions, death spirals, token waste
3. **Read → Replace → Verify** - Use small, targeted operations
4. **Work within existing architecture** - No globals changes, no over-engineering

## Documentation Maintenance
- Keep [README.md](README.md) accurate with valid resource references
- Maintain accuracy of all markdown files under [docs/](docs/)
- Identify legacy/abandoned shell scripts across monorepo

## Pattern to Avoid
Going off-rails with over-engineering. Keep changes simple, targeted, and within existing patterns. When uncertain, ask before proceeding.