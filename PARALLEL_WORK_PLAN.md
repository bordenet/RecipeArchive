# Parallel Work Plan: Safari Extension + Backend Fetching

## Overview

**Goal**: Support recipe sharing from all iOS browsers
- **Safari** (Premium): Web Extension captures HTML → 100% success rate
- **Chrome/Firefox** (Best-effort): Share Extension sends URL → Backend fetches HTML → works for public sites

## Work Streams (Parallel)

### Stream 1: Safari Web Extension (Manual - You)
**Status**: Implementation complete, awaiting manual Xcode setup
**Files**: All created, backed up in `.web-extension-backup/`
**Action Required**: Follow [XCODE_WEB_EXTENSION_SETUP.md](XCODE_WEB_EXTENSION_SETUP.md)

**Steps**:
1. Create extension target in Xcode
2. Run `./scripts/restore-web-extension-files.sh`
3. Configure App Groups
4. Build and test

### Stream 2: Backend HTML Fetching (Automated - Claude)
**Status**: Starting now
**Goal**: Make backend fetch HTML when `webArchiveHtml` is missing

**Changes Required**:
1. ✅ Keep Share Extension working (already works - sends URL only)
2. ⏳ Update backend Lambda to detect missing HTML
3. ⏳ Add HTTP client to fetch webpage
4. ⏳ Handle failures gracefully (paywalls, auth, etc.)
5. ⏳ Log best-effort vs premium paths

## Architecture Decision

### Premium Path (Safari + Web Extension)
```
Safari → Web Extension → HTML extracted → App Group → Flutter → Backend
                                                                     ↓
                                                            Parse (100% success)
```

### Best-Effort Path (Chrome/Firefox + Share Extension)
```
Chrome/Firefox → Share Extension → URL only → App Group → Flutter → Backend
                                                                        ↓
                                                            Fetch HTML (best-effort)
                                                                        ↓
                                                            Parse (works for public sites)
```

## Implementation Plan - Backend Fetching

### File to Modify
`aws-backend/functions/recipes/handler.go`

### Changes Needed

1. **Detect Missing HTML**:
   ```go
   if recipe.WebArchiveHtml == "" {
       // Best-effort path: fetch HTML
       html, err := fetchWebpage(recipe.SourceURL)
       if err != nil {
           // Log warning, save as bookmark
           log.Printf("Best-effort fetch failed for %s: %v", recipe.SourceURL, err)
           recipe.Title = "Bookmarked: " + getDomain(recipe.SourceURL)
       } else {
           recipe.WebArchiveHtml = html
       }
   }
   ```

2. **Add HTTP Client**:
   ```go
   func fetchWebpage(url string) (string, error) {
       client := &http.Client{
           Timeout: 10 * time.Second,
       }

       resp, err := client.Get(url)
       if err != nil {
           return "", err
       }
       defer resp.Body.Close()

       if resp.StatusCode == 403 || resp.StatusCode == 401 {
           return "", fmt.Errorf("paywall/auth required (status: %d)", resp.StatusCode)
       }

       if resp.StatusCode != 200 {
           return "", fmt.Errorf("HTTP %d", resp.StatusCode)
       }

       body, err := io.ReadAll(resp.Body)
       if err != nil {
           return "", err
       }

       return string(body), nil
   }
   ```

3. **Add Telemetry**:
   ```go
   // Track premium vs best-effort paths
   if recipe.WebArchiveHtml != "" && strings.Contains(recipe.WebArchiveHtml, "webextension") {
       log.Printf("PREMIUM PATH: Safari Web Extension HTML")
   } else {
       log.Printf("BEST-EFFORT PATH: Backend fetched HTML for %s", recipe.SourceURL)
   }
   ```

### Error Handling Strategy

| Error | Behavior | User Experience |
|-------|----------|-----------------|
| 200 OK | Parse HTML | Full recipe |
| 403 Forbidden | Save as bookmark | "Bookmarked - use Safari for full recipe" |
| 401 Unauthorized | Save as bookmark | "Bookmarked - requires login" |
| Timeout | Save as bookmark | "Bookmarked - site unreachable" |
| Network error | Save as bookmark | "Bookmarked - network error" |

### Logging Strategy

**CloudWatch Log Format**:
```
[PREMIUM] Safari Web Extension - HTML size: 125KB - URL: https://...
[BEST-EFFORT] Backend fetch SUCCESS - HTML size: 87KB - URL: https://...
[BEST-EFFORT] Backend fetch FAILED (403 Forbidden) - URL: https://... - Saved as bookmark
```

## Testing Plan

### Backend Fetching Tests

1. **Public site (should work)**:
   - Share from Chrome: https://www.allrecipes.com/recipe/62696/chicken-parmesan-casserole/
   - Verify: Backend logs show `[BEST-EFFORT] ... SUCCESS`
   - Verify: Recipe parses with full ingredients/instructions

2. **Paywalled site (should bookmark)**:
   - Share from Chrome: https://cooking.nytimes.com/recipes/...
   - Verify: Backend logs show `[BEST-EFFORT] ... FAILED (403)`
   - Verify: Recipe saves as bookmark with message

3. **Safari Web Extension (premium path)**:
   - Share from Safari with extension: https://cooking.nytimes.com/recipes/...
   - Verify: Backend logs show `[PREMIUM]`
   - Verify: Recipe parses successfully (even though paywalled)

### Validation Commands

```bash
# Trace a recipe shared from Chrome (best-effort)
cd tools/recipe-tracer
./recipe-tracer -recipe [CHROME_RECIPE_ID]
# Should show backend fetch attempt

# Trace a recipe shared from Safari (premium)
./recipe-tracer -recipe [SAFARI_RECIPE_ID]
# Should show webArchiveHtml present, no fetch needed

# Check CloudWatch logs
aws logs tail /aws/lambda/RecipeArchive-dev-RecipesFunction --follow
```

## Success Criteria

### Stream 1 (Safari Extension - You)
- [ ] Extension target created in Xcode
- [ ] Files restored via script
- [ ] Extension appears in Safari Settings
- [ ] Test recipe saves with full HTML
- [ ] CloudWatch shows `[PREMIUM]` path

### Stream 2 (Backend Fetching - Claude)
- [ ] Backend detects missing HTML
- [ ] HTTP client fetches public sites
- [ ] Paywalls/auth failures handled gracefully
- [ ] Logging distinguishes premium vs best-effort
- [ ] Chrome-shared recipe parses successfully (public site)
- [ ] Chrome-shared recipe bookmarks gracefully (paywalled site)

## State Recovery

If machine reboots or session ends:

1. **Safari Extension State**:
   - Files backed up in `.web-extension-backup/`
   - Run `./scripts/restore-web-extension-files.sh`
   - Follow [XCODE_WEB_EXTENSION_SETUP.md](XCODE_WEB_EXTENSION_SETUP.md)

2. **Backend Changes State**:
   - Check `aws-backend/functions/recipes/handler.go`
   - If incomplete, look for comments: `// TODO: Best-effort fetch`
   - Refer to this document for implementation details

3. **Testing State**:
   - Use `./tools/content-ops/content-ops` to list recent recipes
   - Use `./tools/recipe-tracer/recipe-tracer -recipe [ID]` to check processing path

## Timeline

- **Stream 1** (Safari Extension): ~30 minutes manual Xcode setup
- **Stream 2** (Backend Fetching): ~20 minutes coding + testing

Both can proceed independently!

## Documentation

- **Quick Start**: [WEB_EXTENSION_QUICK_START.md](WEB_EXTENSION_QUICK_START.md)
- **Detailed Setup**: [XCODE_WEB_EXTENSION_SETUP.md](XCODE_WEB_EXTENSION_SETUP.md)
- **Architecture**: [SAFARI_WEB_EXTENSION_SUMMARY.md](SAFARI_WEB_EXTENSION_SUMMARY.md)
- **This Plan**: [PARALLEL_WORK_PLAN.md](PARALLEL_WORK_PLAN.md)

## Post-Implementation

After both streams complete:

1. Update CLAUDE.md with final architecture
2. Remove "Recent Work" sections (per post-push procedure)
3. Document user-facing behavior differences
4. Create user guide explaining Safari premium experience
5. Add monitoring dashboard for premium vs best-effort ratio
