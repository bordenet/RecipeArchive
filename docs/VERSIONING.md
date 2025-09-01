# Semantic Versioning Strategy

## Browser Extensions

Both Chrome and Safari extensions follow [Semantic Versioning](https://semver.org/) principles:

### Version Format: MAJOR.MINOR.PATCH

- **MAJOR** (X.0.0): Breaking changes, major architecture rewrites
- **MINOR** (x.X.0): New features, new site parser support, API changes
- **PATCH** (x.x.X): Bug fixes, parser improvements, security updates

### Current Versions

- **Chrome Extension**: 0.2.0
- **Safari Extension**: 0.3.0

### Version Management

Use the automated script to update versions:

```bash
# Increment patch version (default)
./scripts/update-extension-versions.sh patch

# Increment minor version (new features)
./scripts/update-extension-versions.sh minor

# Increment major version (breaking changes)
./scripts/update-extension-versions.sh major
```

### Release Process

1. **Update versions** using the script
2. **Test extensions** thoroughly with new version numbers
3. **Commit changes**: `git commit -m "🔢 Bump extension versions (patch)"`
4. **Tag release**: `git tag v0.2.1` (use new version)
5. **Push to repository**: `git push && git push --tags`

### Version History

- **0.3.0**: Safari extension with enhanced permissions and content script improvements
- **0.2.0**: Chrome extension with AWS Cognito authentication and API integration
- **0.1.0**: Initial extension releases with basic recipe parsing

### Guidelines

- **Patch releases** for:
  - Bug fixes in parsers
  - Security patches
  - Performance improvements
  - Documentation updates

- **Minor releases** for:
  - New recipe site support
  - New features (bulk export, enhanced UI)
  - API endpoint additions
  - Non-breaking authentication updates

- **Major releases** for:
  - Complete authentication system overhauls
  - Breaking API changes
  - Major UI/UX redesigns
  - Migration to new manifest versions

### Synchronization

Both extensions should maintain consistent versioning for major releases, but may have different minor/patch versions based on platform-specific updates.