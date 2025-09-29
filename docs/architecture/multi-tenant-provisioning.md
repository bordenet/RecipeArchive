# Multi-Tenant User Provisioning Architecture

## Current System Analysis

### Existing Components

- **Cognito User Pool**: `us-west-2_qJ1i9RhxD` (single pool for all users)
- **S3 Tenant Isolation**: `recipes/{userID}/{recipeID}.json` structure
- **JWT Validation**: All Lambda functions validate user tokens and extract `userID`
- **Flutter Auth Service**: Handles sign-up, confirmation, sign-in flows

### Strengths

✅ **Tenant Isolation Already Implemented**: S3 paths partition data by user ID
✅ **JWT Security**: All API endpoints validate user ownership before data access
✅ **Single User Pool**: Simpler to manage than multiple pools

## Multi-Tenant Architecture Design

### 1. Invitation System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Invitation Flow                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Admin generates invitation link                          │
│ 2. System creates InvitationToken (DynamoDB)               │
│ 3. Invitation email sent with unique link                  │
│ 4. User clicks link → Registration form                    │
│ 5. User completes registration → Cognito user created      │
│ 6. Welcome email with extension links                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Database Schema (DynamoDB Tables)

```typescript
// InvitationTokens Table
{
  id: string,              // PK: UUID
  email: string,           // GSI
  invitedBy: string,       // Admin user ID
  token: string,           // Unique invitation token
  status: 'pending' | 'used' | 'expired',
  expiresAt: number,       // Unix timestamp
  createdAt: number,
  usedAt?: number,
  metadata?: {
    inviteMessage?: string,
    allowedFeatures?: string[]
  }
}

// UserProfiles Table
{
  userId: string,          // PK: Cognito sub
  email: string,           // GSI
  status: 'active' | 'suspended' | 'trial',
  accountType: 'beta' | 'paid' | 'admin',
  trialEndsAt?: number,
  invitedBy: string,       // Admin user ID
  createdAt: number,
  lastLoginAt?: number,
  quotas: {
    maxRecipes: number,      // Default: 500
    maxNormalizations: number, // Default: 50/month
    storageGB: number        // Default: 1GB
  },
  usage: {
    recipeCount: number,
    normalizationsThisMonth: number,
    storageUsedMB: number
  }
}
```

### 3. API Endpoints Design

```typescript
// Admin-only endpoints
POST /admin/invitations
  - Create invitation link
  - Input: { email, message?, features? }
  - Output: { invitationLink, token, expiresAt }

GET /admin/invitations
  - List all invitations with status
  - Support filtering by status

DELETE /admin/invitations/{token}
  - Revoke/expire invitation

GET /admin/users
  - List all users with quotas and usage

PUT /admin/users/{userId}/quotas
  - Update user quotas

// Public registration endpoint
POST /auth/register-with-invitation
  - Input: { token, email, password, username? }
  - Validates invitation token
  - Creates Cognito user
  - Creates UserProfile record
  - Marks invitation as used

// User profile endpoints
GET /profile
  - Get current user profile and usage stats

PUT /profile
  - Update user profile (limited fields)
```

### 4. Lambda Function Architecture

```
├── invitation-manager/
│   ├── main.go              # Admin invitation management
│   └── models/
│       └── invitation.go
├── registration-handler/
│   ├── main.go              # Handle invitation-based registration
│   └── models/
│       └── registration.go
├── user-profile-service/
│   ├── main.go              # User profile CRUD operations
│   └── models/
│       └── profile.go
└── quota-enforcer/
    ├── main.go              # Middleware for quota validation
    └── models/
        └── quota.go
```

### 5. Security & Access Control

```typescript
// JWT Claims Enhancement
interface EnhancedJWTClaims {
  sub: string; // User ID
  email: string;
  accountType: 'beta' | 'paid' | 'admin';
  quotas: {
    maxRecipes: number;
    maxNormalizations: number;
    storageGB: number;
  };
}

// Middleware Integration
function validateUserAccess(request, requiredQuota?) {
  claims = extractJWT(request);
  profile = getUserProfile(claims.sub);

  if (requiredQuota) {
    enforceQuota(profile, requiredQuota);
  }

  return { userId: claims.sub, profile };
}
```

### 6. Deployment Strategy

#### Phase 1: Foundation (Week 1)

- [ ] Create DynamoDB tables
- [ ] Build invitation-manager Lambda
- [ ] Build registration-handler Lambda
- [ ] Create admin Flutter screens
- [ ] Test invitation flow end-to-end

#### Phase 2: User Management (Week 2)

- [ ] Build user-profile-service Lambda
- [ ] Add quota enforcement to recipes Lambda
- [ ] Create user dashboard in Flutter
- [ ] Implement usage tracking
- [ ] Email automation setup

#### Phase 3: Production Ready (Week 3)

- [ ] Admin user management tools
- [ ] Monitoring and alerting
- [ ] Cost tracking dashboards
- [ ] Documentation and testing

### 7. Cost Control Mechanisms

#### Quota Enforcement Points

```go
// In recipes Lambda
func handleCreateRecipe(...) {
  // Check recipe count quota
  if userProfile.Usage.RecipeCount >= userProfile.Quotas.MaxRecipes {
    return quotaExceededError("Recipe limit reached")
  }

  // Check normalization quota (monthly)
  if needsNormalization && userProfile.Usage.NormalizationsThisMonth >= userProfile.Quotas.MaxNormalizations {
    return quotaExceededError("Normalization limit reached")
  }
}

// Usage tracking
func updateUsageStats(userID string, action string) {
  // Increment counters in UserProfile
  // Reset monthly counters on month boundary
}
```

#### Rate Limiting

- API Gateway: 100 requests/minute per user
- OpenAI normalization: 50/month per user
- S3 storage: 1GB per user

### 8. Migration Strategy

#### Existing Users

```go
// One-time migration script
func migrateExistingUsers() {
  cognitoUsers = listAllCognitoUsers()

  for user := range cognitoUsers {
    profile = UserProfile{
      UserID: user.Sub,
      Email: user.Email,
      Status: "active",
      AccountType: "admin", // Existing users become admin
      CreatedAt: user.CreatedAt,
      Quotas: {
        MaxRecipes: 1000,    // Higher limits for existing
        MaxNormalizations: 100,
        StorageGB: 5,
      }
    }
    createUserProfile(profile)
  }
}
```

### 9. Monitoring & Alerts

#### CloudWatch Metrics

- New user registrations per day
- Quota violations by user
- Storage usage by tenant
- API request rates by user
- Failed authentication attempts

#### Cost Alerting

```yaml
AlertRules:
  - TotalStorageCost > $10/month
  - OpenAI_API_calls > 1000/day
  - Lambda_invocations > 100k/day
  - New_users > 5/day
```

## Implementation Priority

### Must Have (MVP)

1. ✅ DynamoDB tables for invitations and user profiles
2. ✅ Invitation generation and validation system
3. ✅ Invitation-based registration flow
4. ✅ Basic quota enforcement for recipes

### Should Have (Phase 2)

1. Admin user management interface
2. User usage dashboard
3. Email automation (welcome, quota alerts)
4. Monthly quota reset automation

### Could Have (Future)

1. Billing integration
2. Advanced analytics
3. User self-service tools
4. Mobile app admin features

This architecture maintains the existing single Cognito pool while adding proper multi-tenant controls, invitation management, and cost protection mechanisms.
