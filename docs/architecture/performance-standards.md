# Performance Standards

## Document Status: **Active**

Performance targets for RecipeArchive v1.0.0 production system.

## Performance Targets

### API Response Times

Target response times (95th percentile):

**Critical Operations** (`<300ms`):
- `GET /recipes/{id}` - Single recipe retrieval
- `POST /recipes` - Recipe creation
- `PUT /recipes/{id}` - Recipe updates
- `DELETE /recipes/{id}` - Recipe deletion

**List Operations** (`<500ms`):
- `GET /recipes` - Recipe listing
- `GET /recipes/search` - Recipe search
- `POST /report-error` - Diagnostic data submission

**Heavy Operations** (`<2s`):
- File uploads to S3
- Web archive generation
- Bulk sync operations

### Client Performance

**Browser Extension:**
- Popup Load: `<500ms` to interactive
- Recipe Extraction: `<3s` for supported sites
- Background Sync: `<5s` for cached recipes
- Local Storage Access: `<100ms` for cached data

**iOS App:**
- App Launch: `<2s` cold start, `<1s` warm start
- Recipe List Load: `<1s` with cached data, `<2s` from network
- Recipe Detail View: `<500ms` with cached data, `<1s` from network
- Search Results: `<1s` for local cache, `<2s` for server search

**Website:**
- Initial Page Load: `<2s` to interactive (First Contentful Paint)
- Recipe List Render: `<1s` with cached data, `<2s` from network
- Recipe Detail Load: `<500ms` with cached data, `<1s` from network
- Search Results: `<1s` for typical queries

### Infrastructure Performance

**AWS Lambda Functions:**
- Cold Start: `<1s`
- Warm Execution: `<100ms` for simple operations

**S3 Operations:**
- Recipe Read (single): `<100ms`
- Recipe List (100 items): `<500ms` in-memory filtering
- Recipe Write: `<200ms`
- Signed URL Generation: `<50ms`
- File Upload Initiation: `<200ms`
- File Download Access: `<100ms` (excluding transfer time)

## Performance Monitoring

### When Performance Degrades

Timeouts and slow operations automatically generate error diagnostics in S3.

**To investigate performance issues:**

```bash
# Get global diagnostic report
cd tools/get-diagnostics && ./get-diagnostics

# Check recent errors across all sources
cd tools/get-diagnostics && ./get-diagnostics -all -since 24h

# Filter by source type
cd tools/get-diagnostics && ./get-diagnostics -lambdas -since 1h
cd tools/get-diagnostics && ./get-diagnostics -extensions -since 1h
cd tools/get-diagnostics && ./get-diagnostics -flutter -since 1h
```

### CloudWatch Metrics

Monitor these metrics:
- **API Gateway**: P95 response times per endpoint
- **Lambda**: Duration, error rate, cold start frequency
- **S3**: Request latency, error rates

### Optimization Strategies

**Caching:**
- Browser Extension: Local storage for 50 most recent recipes
- iOS/Website: Aggressive caching with smart invalidation
- API Gateway: Response caching for read-heavy endpoints

**Code:**
- Lambda: Optimize bundle sizes, use ARM64 Graviton2
- Frontend: Code splitting, lazy loading, tree shaking
- S3: Efficient filtering patterns, batch operations
- Images: WebP format, multiple sizes, lazy loading
