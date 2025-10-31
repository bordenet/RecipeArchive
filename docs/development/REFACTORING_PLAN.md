# Code Refactoring Plan

**Purpose:** Identify and refactor long files (>750 lines) into focused modules
**Goal:** Reduce token consumption for Claude Code maintenance

## Problem Statement

Long monolithic files consume excessive tokens when loaded into context. Files over 750 lines should be split into focused, single-responsibility modules.

## Files Requiring Refactoring

### Critical (>1000 lines)

#### 1. `aws-backend/functions/recipes/main.go` (2100 lines) 🔴
**Current Structure:**
- Single file handling: HTTP routing, recipe CRUD, search, image operations, multi-tenant logic
- Mixed concerns: business logic, data access, HTTP handling

**Refactoring Plan:**
```
recipes/
├── main.go (150 lines) - Entry point, routing
├── handlers/
│   ├── recipe_handlers.go - GET/POST/PUT/DELETE endpoints
│   ├── search_handlers.go - Search operations
│   ├── image_handlers.go - Image upload/retrieval
│   └── import_handlers.go - Recipe import operations
├── services/
│   ├── recipe_service.go - Business logic
│   ├── search_service.go - Search logic
│   └── image_service.go - Image processing
├── repositories/
│   ├── s3_repository.go - S3 operations
│   └── dynamo_repository.go - DynamoDB operations (if used)
└── models/
    ├── recipe.go - Data models
    └── errors.go - Custom errors
```

**Token Savings:** 2100 lines → 8 files averaging 260 lines each
**Benefit:** Load only relevant handler + service when working on specific feature

#### 2. `recipe_archive/lib/screens/recipe_detail_screen.dart` (1286 lines) 🔴
**Current Structure:**
- Massive StatefulWidget with embedded UI, business logic, state management
- Ingredient scaling, unit conversion, print formatting all inline

**Refactoring Plan:**
```
screens/recipe_detail/
├── recipe_detail_screen.dart (200 lines) - Main screen scaffold
├── widgets/
│   ├── recipe_header.dart - Title, metadata, tags
│   ├── ingredient_list.dart - Ingredients with scaling
│   ├── instruction_list.dart - Step-by-step instructions
│   ├── recipe_notes.dart - Notes section
│   ├── recipe_actions.dart - Edit/Delete/Share buttons
│   └── recipe_image_carousel.dart - Image viewer
├── controllers/
│   ├── scaling_controller.dart - Yield scaling logic
│   ├── unit_conversion_controller.dart - Unit conversion
│   └── print_controller.dart - Print formatting
└── services/
    └── recipe_detail_service.dart - Data fetching/updates
```

**Token Savings:** 1286 lines → 10 files averaging 130 lines each

#### 3. `tools/cmd/recipe-cli/main.go` (1078 lines) 🔴
**Current Structure:**
- Single file with all CLI commands, validation, business logic

**Refactoring Plan:**
```
recipe-cli/
├── main.go (100 lines) - Entry point, command registration
├── commands/
│   ├── test.go - Test commands
│   ├── dev.go - Development commands
│   ├── validate.go - Validation commands
│   ├── deploy.go - Deployment commands
│   └── generate.go - Code generation commands
├── services/
│   ├── validator_service.go - Validation logic
│   ├── deployer_service.go - Deployment logic
│   └── generator_service.go - Generation logic
└── utils/
    ├── logger.go - Logging utilities
    └── config.go - Configuration management
```

**Token Savings:** 1078 lines → 8 files averaging 135 lines each

#### 4. `recipe_archive/lib/screens/recipe_edit_screen.dart` (903 lines) 🔴
**Current Structure:**
- Form handling, validation, image uploads all inline

**Refactoring Plan:**
```
screens/recipe_edit/
├── recipe_edit_screen.dart (150 lines) - Main screen
├── widgets/
│   ├── basic_info_form.dart - Title, description, URL
│   ├── ingredient_form.dart - Ingredient list editor
│   ├── instruction_form.dart - Instruction editor
│   ├── metadata_form.dart - Servings, time, tags
│   └── image_upload_widget.dart - Image handling
├── controllers/
│   ├── form_validation_controller.dart - Validation logic
│   └── image_upload_controller.dart - Upload handling
└── services/
    └── recipe_mutation_service.dart - Create/update operations
```

**Token Savings:** 903 lines → 7 files averaging 130 lines each

### High Priority (750-1000 lines)

#### 5. `recipe_archive/lib/screens/home_screen.dart` (842 lines) 🟡
**Refactor To:**
```
screens/home/
├── home_screen.dart (150 lines)
├── widgets/
│   ├── recipe_grid.dart - Grid layout
│   ├── recipe_list.dart - List layout
│   ├── filter_bar.dart - Filtering UI
│   ├── sort_controls.dart - Sorting controls
│   └── empty_state.dart - Empty state UI
└── controllers/
    ├── filter_controller.dart - Filter logic
    └── sort_controller.dart - Sort logic
```

#### 6. `recipe_archive/lib/screens/advanced_search_screen.dart` (833 lines) 🟡
**Refactor To:**
```
screens/search/
├── advanced_search_screen.dart (150 lines)
├── widgets/
│   ├── search_filters.dart - Filter UI
│   ├── search_results.dart - Results display
│   └── search_suggestions.dart - Auto-suggest
└── controllers/
    ├── search_controller.dart - Search logic
    └── filter_controller.dart - Filter management
```

#### 7. `recipe_archive/lib/services/recipe_service.dart` (825 lines) 🟡
**Refactor To:**
```
services/
├── recipe_service.dart (200 lines) - Public API
├── recipe_crud_service.dart - CRUD operations
├── recipe_search_service.dart - Search operations
├── recipe_import_service.dart - Import operations
└── recipe_cache_service.dart - Caching logic
```

#### 8. `recipe_archive/lib/screens/extensions_screen.dart` (822 lines) 🟡
**Refactor To:**
```
screens/extensions/
├── extensions_screen.dart (150 lines)
├── widgets/
│   ├── extension_installation_guide.dart
│   ├── extension_configuration_panel.dart
│   └── extension_troubleshooting.dart
└── services/
    └── extension_config_service.dart
```

#### 9. `aws-backend/functions/recipes/parser.go` (771 lines) 🟡
**Refactor To:**
```
recipes/parser/
├── parser.go (100 lines) - Main interface
├── json_ld_parser.go - JSON-LD extraction
├── html_parser.go - HTML fallback
├── site_specific_parsers.go - Site-specific logic
└── normalizer.go - Data normalization
```

### Shell Scripts (>750 lines)

#### 10. `scripts/setup-macos.sh` (1395 lines) 🔴
**Refactor To:**
```
scripts/setup/
├── setup-macos.sh (150 lines) - Orchestrator
├── install-homebrew.sh
├── install-development-tools.sh
├── install-mobile-tools.sh
├── install-aws-tools.sh
├── install-flutter.sh
├── setup-mcp-servers.sh
└── verify-installation.sh
```

## Refactoring Guidelines

### Principles

1. **Single Responsibility:** Each file should have one clear purpose
2. **Cohesion:** Related functions should be together
3. **Clear Boundaries:** Public API vs. internal implementation
4. **Dependency Direction:** Dependencies flow inward (handlers → services → repositories)

### Process

For each file:

1. **Analyze current structure:**
   ```bash
   # Count logical sections
   grep -E "^func |^type |^class " file.dart | wc -l

   # Identify natural boundaries
   grep -E "^//.*Section|^//.*MARK" file.dart
   ```

2. **Group related functions:**
   - By feature (search, CRUD, import)
   - By layer (handlers, services, repositories)
   - By responsibility (validation, transformation, persistence)

3. **Extract to new file:**
   - Start with smallest, most independent module
   - Move tests with implementation
   - Update imports in original file

4. **Test extraction:**
   - Run all tests
   - Verify no functionality changed
   - Check for circular dependencies

5. **Repeat until file <750 lines**

### Testing Strategy

After each refactoring:

```bash
# For Go files
go test ./...
go build ./...

# For Dart files
flutter test
flutter analyze

# For shell scripts
shellcheck scripts/**/*.sh
bash -n scripts/**/*.sh  # Syntax check
```

## Implementation Priority

### Phase 1: Critical Lambda Functions (Week 1)
- [ ] `recipes/main.go` (2100 → 8 files)
- [ ] `recipes/parser.go` (771 → 5 files)
- [ ] `invitation-manager-s3/main.go` (743 → 4 files)
- [ ] `content-normalizer/main.go` (705 → 4 files)

**Rationale:** Lambda functions are critical path for production, highest maintenance frequency

### Phase 2: Flutter Screens (Week 2)
- [ ] `recipe_detail_screen.dart` (1286 → 10 files)
- [ ] `recipe_edit_screen.dart` (903 → 7 files)
- [ ] `home_screen.dart` (842 → 5 files)
- [ ] `advanced_search_screen.dart` (833 → 4 files)

**Rationale:** UI screens change frequently, high token cost for Claude Code

### Phase 3: Services & Utilities (Week 3)
- [ ] `recipe_service.dart` (825 → 5 files)
- [ ] `recipe-cli/main.go` (1078 → 8 files)
- [ ] `extensions_screen.dart` (822 → 4 files)

**Rationale:** Services are referenced by many screens, benefit compounds

### Phase 4: Shell Scripts (Week 4)
- [ ] `setup-macos.sh` (1395 → 7 files)
- [ ] `manage-api-routes.sh` (541 → 3 files)
- [ ] `aws-deploy-all.sh` (539 → 3 files)

**Rationale:** Lower priority, but still provide token savings

## Token Savings Calculation

### Before Refactoring
- Top 10 files: 11,634 lines
- Average tokens per line: ~4
- Total tokens: **~46,536 tokens**

### After Refactoring
- Top 10 files split into ~60 files
- Average file size: ~190 lines
- When loading 1 file for maintenance: **~760 tokens** (savings: 45,776 tokens)
- When loading 3 related files: **~2,280 tokens** (savings: 44,256 tokens)

### Real-World Impact

**Scenario:** Fix bug in recipe search
- **Before:** Load `recipes/main.go` (2100 lines = 8,400 tokens)
- **After:** Load `search_handlers.go` + `search_service.go` (400 lines = 1,600 tokens)
- **Savings:** 6,800 tokens (81% reduction)

## Success Metrics

- [ ] No file >750 lines in production code
- [ ] Average file size <300 lines
- [ ] Test coverage maintained or improved
- [ ] No circular dependencies introduced
- [ ] Build times unchanged or improved
- [ ] All existing tests pass

## Related

- [Shell Script Style Guide](../../scripts/STYLE_GUIDE.md)
- [PROJECT_STATUS.md](../../PROJECT_STATUS.md)
