# Authentication Architecture Decision Document (ADD)

## Decision Status: **PENDING APPROVAL**

**Date**: August 24, 2025  
**Decision Makers**: Matt Bordenet  
**Context**: RecipeArchive Cross-Platform Authentication Strategy

## Problem Statement

The current PRDs contain a **critical authentication conflict** that blocks development:

- **Browser Extension PRD**: "Basic authentication for beta phase" → AWS Cognito migration post-beta
- **iOS App PRD**: "AWS Cognito for user management" (day 1)
- **Website PRD**: "AWS Cognito for user management" (day 1)
- **AWS Backend PRD**: "AWS Cognito for user management" (day 1)

This creates incompatible authentication systems across platforms during the critical beta phase.

## Decision Options

### Option A: Staged Authentication (Browser Extension Approach)

**Implementation**: Start all platforms with basic email/password authentication, migrate to AWS Cognito post-beta

**Pros**:

- Simpler initial implementation
- Faster time to beta launch
- Lower AWS costs during beta

**Cons**:

- Requires building temporary auth system
- Two separate migration efforts (auth system + user data)
- Technical debt and complexity
- Security concerns with custom auth implementation
- User disruption during migration

### Option B: AWS Cognito from Day 1 (Unified Approach) ⭐ **RECOMMENDED**

**Implementation**: Use AWS Cognito across all platforms from initial deployment

**Pros**:

- Single authentication system across all platforms
- Production-ready security from day 1
- No migration complexity or user disruption
- Leverages AWS best practices
- Supports future multi-tenant requirements
- JWT tokens work seamlessly across platforms

**Cons**:

- Slightly more complex initial setup
- Higher initial AWS costs (minimal for beta scale)
- Requires AWS Cognito learning curve

## Recommended Decision: Option B - AWS Cognito from Day 1

### Rationale

1. **Consistency**: All platforms use identical authentication flow
2. **Security**: Production-grade security from launch
3. **Scalability**: Built for the multi-tenant future we're planning
4. **Developer Experience**: Single auth implementation to maintain
5. **User Experience**: No disruptive migrations
6. **Cost**: Negligible difference at beta scale (<50 users)

### Implementation Requirements

#### JWT Token Configuration

- **Access Token TTL**: 1 hour
- **Refresh Token TTL**: 30 days
- **ID Token TTL**: 1 hour
- **Token Rotation**: Automatic refresh token rotation enabled

#### User Pool Configuration

- **Username**: Email address
- **Required Attributes**: Email (verified)
- **Optional Attributes**: Given name, family name
- **Password Policy**: Minimum 8 characters, require uppercase, lowercase, number
- **MFA**: Optional (disabled for MVP)

#### Application Client Settings

- **Browser Extension**: Public client (no client secret)
- **iOS App**: Public client (no client secret)
- **Website**: Public client (no client secret)
- **Backend APIs**: Use Cognito authorizer for API Gateway

#### Security Features

- **Account Recovery**: Email-based password reset
- **Email Verification**: Required before account activation
- **Rate Limiting**: Built-in Cognito protection against brute force
- **HTTPS Only**: All authentication endpoints

### Migration Impact on PRDs

#### Browser Extension PRD Changes Required

- Remove "Basic authentication for beta phase"
- Update to "AWS Cognito authentication from day 1"
- Remove "AWS Cognito migration post-beta" from future considerations
- Update authentication section with JWT token handling

#### iOS App PRD Changes Required

- Add specific JWT token storage and refresh requirements
- Specify Cognito SDK integration requirements

#### Website PRD Changes Required

- Add specific JWT token storage and refresh requirements
- Specify Cognito SDK integration requirements

#### AWS Backend PRD Changes Required

- Add detailed Cognito User Pool configuration requirements
- Specify API Gateway Cognito authorizer setup
- Add JWT token validation middleware requirements

### Implementation Timeline

- **Week 1**: Set up AWS Cognito User Pool and Identity Pool
- **Week 2**: Implement authentication in AWS Backend (API authorizers)
- **Week 3**: Integrate Browser Extension with Cognito
- **Week 4**: Integrate Website and iOS App with Cognito
- **Week 5**: End-to-end testing and security validation

### Success Criteria

- [ ] All platforms authenticate against same Cognito User Pool
- [ ] JWT tokens work seamlessly across all platforms
- [ ] User registration/login flow consistent across platforms
- [ ] Token refresh works automatically in all clients
- [ ] Security audit passes with no critical findings

---

**Next Steps**:

1. Get approval for Option B decision
2. Update all four PRDs with unified authentication requirements
3. Begin AWS Cognito User Pool setup
4. Define API authentication middleware specifications

**Decision Required By**: August 26, 2025 (to maintain development timeline)
