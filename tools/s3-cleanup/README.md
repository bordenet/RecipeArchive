# S3 Cleanup Tool

Identifies and moves misplaced recipe images from `recipes/` to `recipe-images/`.

## Problem

Legacy code or bugs may place images in the wrong S3 location:
- **Wrong**: `recipes/{userID}/{recipeID}/main-photo.jpg`
- **Correct**: `recipe-images/{recipeID}/recipes/main-photo.{ext}`

This causes:
1. **content-ops** to fail parsing JPEG as JSON
2. Broken image references in recipes
3. Unnecessary storage costs (duplicate files)

## Usage

```bash
# Build the tool
cd tools/s3-cleanup
go build -o s3-cleanup

# Preview what would be moved (dry run)
./s3-cleanup

# Actually move the files
./s3-cleanup --dry-run=false
```

## What It Does

1. Scans `recipes/` prefix for image files (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`)
2. Identifies misplaced images (should be in `recipe-images/`)
3. Moves them to correct location: `recipe-images/{recipeID}/recipes/main-photo.{ext}`
4. Deletes original file after successful copy

## Safety

- **Dry run by default** - must explicitly disable with `--dry-run=false`
- Uses S3 CopyObject (atomic operation)
- Only deletes after successful copy
- Preserves all file metadata

## Environment

Requires `S3_RECIPE_STORAGE_BUCKET` in `../../.env`:

```bash
S3_RECIPE_STORAGE_BUCKET=recipe-storage-0ea7007d57f67ecb-990537043943
```

## Example Output

```
🔍 DRY RUN MODE - No changes will be made
🔍 Scanning bucket: recipe-storage-0ea7007d57f67ecb-990537043943
📦 Misplaced: recipes/d801a380-d0e1-703b-93fd-513a8ae33f5b/453281c4-2df6-45c9-9d73-96c517a6e8bc/main-photo.jpg
   → Target: recipe-images/453281c4-2df6-45c9-9d73-96c517a6e8bc/recipes/main-photo.jpg
   🔍 Would move (user: d801a380-d0e1-703b-93fd-513a8ae33f5b, recipe: 453281c4-2df6-45c9-9d73-96c517a6e8bc)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:
   Misplaced images found: 1
   ℹ️  Run with --dry-run=false to move files
```

## Related Fixes

This tool addresses the error seen in `content-ops`:
```
⚠️  Could not read recipe recipes/.../main-photo.jpg: invalid character 'ÿ' looking for beginning of value
```

The root cause was fixed in `tools/content-ops/internal/reporting/generator.go` by filtering out non-JSON files.
