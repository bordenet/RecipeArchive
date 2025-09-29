# Multi-Tenant Test Suite

Comprehensive test coverage for RecipeArchive's multi-tenant user provisioning system.

## Overview

This test suite validates all aspects of the multi-tenant functionality:

- **Tenant Isolation**: Ensures users can only access their own data
- **Invitation Flow**: Tests admin invitation creation and user registration
- **Admin Interfaces**: Validates Flutter admin screens and developer tools
- **Security**: Validates JWT tokens, resource access, and quota enforcement

## Test Structure

```
tests/multi-tenant/
├── tenant-isolation.test.go      # Go unit tests for tenant isolation
├── invitation-flow.test.js       # JavaScript integration tests for invitations
├── flutter-admin.test.dart       # Flutter widget tests for admin screens
├── run-tests.sh                  # Comprehensive test runner
├── go.mod                        # Go module dependencies
├── package.json                  # JavaScript test dependencies
└── README.md                     # This file
```

## Running Tests

### All Tests

```bash
cd tests/multi-tenant
./run-tests.sh
```

### Individual Test Suites

#### Go Unit Tests (Tenant Isolation)

```bash
cd tests/multi-tenant
go test -v ./...
```

#### JavaScript Integration Tests (Invitation Flow)

```bash
cd tests/multi-tenant
npm test
```

#### Flutter Tests (Admin Screens)

```bash
cd recipe_archive
flutter test ../tests/multi-tenant/flutter-admin.test.dart
```

## Test Coverage

### Tenant Isolation Tests (`tenant-isolation.test.go`)

**Security Validation:**

- ✅ JWT token parsing and validation
- ✅ User ID format verification (UUID)
- ✅ Cross-tenant access prevention
- ✅ Path traversal attack prevention
- ✅ Resource ownership verification

**Quota Enforcement:**

- ✅ Recipe count limits (500/user)
- ✅ Normalization limits (50/month)
- ✅ Storage limits (1GB/user)
- ✅ Unknown quota type handling

**Performance:**

- ✅ Validation performance benchmarks
- ✅ Memory usage optimization

### Invitation Flow Tests (`invitation-flow.test.js`)

**Admin Invitation Creation:**

- ✅ Valid invitation generation
- ✅ Secure token creation (64-char hex)
- ✅ Email validation and sending
- ✅ Expiry time configuration
- ✅ Duplicate invitation prevention

**Token Validation:**

- ✅ Pending invitation verification
- ✅ Expired invitation rejection
- ✅ Invalid token handling
- ✅ Used invitation prevention

**User Registration:**

- ✅ Cognito user creation
- ✅ Profile creation with quotas
- ✅ Invitation marking as used
- ✅ Email verification bypass
- ✅ Error handling (duplicate users, etc.)

**End-to-End Flow:**

- ✅ Complete invitation-to-registration flow
- ✅ State transitions (pending → used)
- ✅ Invitation reuse prevention

### Flutter Admin Tests (`flutter-admin.test.dart`)

**Invitation Management Screen:**

- ✅ Form validation (email format)
- ✅ Invitation creation with success feedback
- ✅ Invitation list display
- ✅ Status indicators (pending, accepted, expired)
- ✅ Invitation revocation
- ✅ Error handling and retry logic
- ✅ Loading states and empty states

**Developer Settings Screen:**

- ✅ Developer mode toggle
- ✅ Credential form visibility
- ✅ Email and password validation
- ✅ Auto-login configuration
- ✅ Settings persistence
- ✅ Clear all settings functionality
- ✅ Security information display

## Integration with validate-monorepo.sh

The multi-tenant tests are automatically included in the monorepo validation:

```bash
./validate-monorepo.sh
```

**Validation Points:**

- Multi-tenant system tests (Go)
- Invitation flow tests (JavaScript)
- Flutter admin screen tests (Dart)
- Infrastructure file validation
- Deployment script validation

## Test Environment Setup

### Prerequisites

**Go Tests:**

- Go 1.19+
- Required packages: `stretchr/testify`, `aws-lambda-go`, `aws-sdk-go-v2`

**JavaScript Tests:**

- Node.js 16+
- Jest testing framework
- AWS SDK mocks

**Flutter Tests:**

- Flutter 3.0+
- Mockito for service mocking
- Widget testing framework

### Mock Configuration

**AWS Services:**

- DynamoDB operations mocked
- SES email sending mocked
- Cognito user management mocked

**Test Data:**

- Predefined test user IDs
- Mock JWT tokens
- Sample invitation data

## Expected Results

### Passing Tests

```
=== MULTI-TENANT TEST SUMMARY ===
✓ Tenant Isolation Tests (15/15 tests)
✓ Invitation Flow Tests (12/12 tests)
✓ Flutter Admin Tests (8/8 tests)

🎉 All multi-tenant tests passed!
The multi-tenant system is ready for deployment.
```

### Coverage Targets

- **Go Code**: >90% coverage
- **JavaScript Code**: >85% coverage
- **Flutter Widgets**: >80% coverage

## Debugging Failed Tests

### Common Issues

**Go Tests Failing:**

```bash
# Run with verbose output
cd tests/multi-tenant
go test -v ./...

# Check module dependencies
go mod tidy
```

**JavaScript Tests Failing:**

```bash
# Run with detailed output
cd tests/multi-tenant
npm test -- --verbose

# Install dependencies
npm install
```

**Flutter Tests Failing:**

```bash
# Run with verbose output
cd recipe_archive
flutter test ../tests/multi-tenant/flutter-admin.test.dart --reporter=expanded

# Check dependencies
flutter pub get
```

### Mock Issues

If AWS SDK mocks fail:

1. Check mock configuration in test files
2. Verify AWS SDK version compatibility
3. Update mock expectations based on actual AWS responses

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

**GitHub Actions:**

```yaml
- name: Run Multi-Tenant Tests
  run: |
    cd tests/multi-tenant
    ./run-tests.sh
```

**Local Development:**

```bash
# Quick validation before commit
cd tests/multi-tenant
./run-tests.sh

# Full monorepo validation
./validate-monorepo.sh
```

## Contributing

When adding new multi-tenant features:

1. **Add corresponding tests** in the appropriate file
2. **Update test expectations** if API changes
3. **Run full test suite** before committing
4. **Update this README** if new test categories added

### Test Naming Convention

- **Go**: `TestFeatureName` (e.g., `TestValidateResourceAccess`)
- **JavaScript**: `describe('Feature') it('should behavior')`
- **Flutter**: `testWidgets('should behavior')`

This comprehensive test suite ensures the multi-tenant system is robust, secure, and ready for production deployment.
