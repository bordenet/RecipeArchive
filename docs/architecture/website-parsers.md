# Website Parsers Architecture Decision Record (ADR)

## Context

RecipeArchive requires robust extraction of recipe data from a wide variety of cooking websites. The solution must be maintainable, extensible, and resilient to site changes, while supporting strict contract validation and batch enforcement across all supported sites.

## Decision

- **Parser System**: Each supported site has a dedicated TypeScript parser module implementing a shared contract. All parsers are validated against real recipe URLs and must pass contract checks before release.
- **Contract Enforcement**: The contract is defined in shared types and enforced post-assignment in each parser. Fallback logic ensures all required fields are present, even if the site structure changes or data is missing.
- **Extraction Strategy**:
  - Prefer structured data (JSON-LD, microdata) when available.
  - Use targeted CSS selectors and robust fallback logic for missing or incomplete fields.
  - Defensive programming ensures all contract fields are non-empty and correctly typed.
- **Testing & Validation**:
  - Real HTML fixtures are used for targeted parser validation.
  - Automated validator scripts enforce contract compliance and report missing fields.
  - Batch patching and contract expansion are supported for rapid updates.
- **Extensibility**:
  - New site parsers can be added by implementing the shared contract and following the established fallback and validation patterns.
  - The architecture supports migration to new site structures and contract changes with minimal disruption.

## Consequences

- The parser system is maintainable and scalable, supporting rapid onboarding of new sites and contract changes.
- Strict contract enforcement and fallback logic ensure high data quality and resilience to site changes.
- The architecture supports automated validation, batch updates, and robust error handling.

## Cross-links

- [data-model.md](./data-model.md): Details the shared contract and data types used by all parsers.
- [performance-standards.md](./performance-standards.md): Outlines performance requirements for parser execution and validation.
- [search-features.md](./search-features.md): Describes how extracted recipe data is indexed and made searchable.
- [../development/claude-context.md](../development/claude-context.md): Provides additional context on parser migration and contract enforcement workflows.
- [../README.md](../README.md): Project overview and architecture summary.

---
This ADR will be updated as the parser system evolves.
