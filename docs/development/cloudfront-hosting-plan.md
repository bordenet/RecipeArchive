# CloudFront Distribution Hosting Plan for Flutter Web App

## Overview

This document outlines a comprehensive plan for hosting the RecipeArchive Flutter web application on AWS CloudFront distribution, providing global content delivery, enhanced performance, and production-grade hosting infrastructure.

## Current Architecture Context

Our RecipeArchive Flutter web application currently operates with:
- **Flutter Web App**: Built with `flutter build web` from `recipe_archive_fresh/` directory
- **Local Development**: `flutter run -d chrome` for development server
- **Static Assets**: Generated in `build/web/` directory after build process
- **AWS Backend**: Existing Lambda + S3 + Cognito infrastructure in US-West-2
- **Mobile Apps**: Native iOS/iPad and Android apps with AWS integration

## Problem Statement

Current hosting limitations:
1. **No Production Deployment**: Web app only runs locally during development
2. **Performance Issues**: No CDN for global content delivery and caching
3. **Scalability Concerns**: No infrastructure for handling production traffic loads
4. **Security Gaps**: Missing HTTPS enforcement, CSP headers, and security best practices
5. **Availability Risk**: Single point of failure without redundancy or monitoring
6. **Developer Experience**: Manual deployment process without CI/CD automation

## Proposed CloudFront Architecture

### Phase 1: Basic CloudFront Distribution Setup

**Core Infrastructure Components:**

**S3 Static Website Hosting:**
```
recipearchive-web-app-{environment}-{accountId}/
├── index.html                    # Flutter app entry point
├── main.dart.js                  # Compiled Flutter application
├── assets/
│   ├── fonts/                    # Material Design fonts
│   ├── packages/                 # Flutter package assets
│   └── NOTICES                   # License information
├── canvaskit/                    # Flutter rendering engine
├── favicon.png                   # App icon
└── manifest.json                 # PWA configuration
```

**CloudFront Configuration:**
- **Origin**: S3 bucket with static website hosting enabled
- **Distribution Domain**: `app.recipearchive.com` (custom domain)
- **SSL Certificate**: AWS Certificate Manager (ACM) for HTTPS
- **Default Root Object**: `index.html`
- **Error Pages**: Custom 404/500 pages routing back to Flutter app
- **Caching Behavior**: Optimized for SPA (Single Page Application) patterns

### Phase 2: Performance Optimization

**Caching Strategy:**

**Static Assets (Long-term Cache):**
```typescript
interface CachingRules {
  '*.js': {
    cacheTTL: '1 year',
    browserCache: '1 year',
    compression: 'gzip, brotli'
  },
  '*.css': {
    cacheTTL: '1 year', 
    browserCache: '1 year',
    compression: 'gzip, brotli'
  },
  'assets/*': {
    cacheTTL: '1 year',
    browserCache: '1 year',
    compression: 'gzip, brotli'
  }
}
```

**Dynamic Content (Short-term Cache):**
```typescript
interface DynamicCaching {
  'index.html': {
    cacheTTL: '1 hour',
    browserCache: 'no-cache',
    headers: ['Cache-Control: no-cache, no-store, must-revalidate']
  },
  'manifest.json': {
    cacheTTL: '1 day',
    browserCache: '1 day',
    compression: 'gzip'
  }
}
```

**Compression Settings:**
- **Brotli Compression**: Enable for modern browsers (30% better than gzip)
- **Gzip Fallback**: Legacy browser support
- **Automatic Compression**: All text-based assets (HTML, CSS, JS, JSON)

### Phase 3: Security & Best Practices

**Security Headers Configuration:**

```typescript
interface SecurityHeaders {
  'Strict-Transport-Security': 'max-age=31536000; includeSubdomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.amazonaws.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https://*.amazonaws.com;
    connect-src 'self' https://*.amazonaws.com wss://*.amazonaws.com;
  `,
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
}
```

**AWS Certificate Manager (ACM):**
- **Certificate Type**: Wildcard SSL certificate for `*.recipearchive.com`
- **Validation Method**: DNS validation through Route 53
- **Auto-Renewal**: Automatic certificate renewal before expiration
- **Multiple Domains**: Support for `app.recipearchive.com` and `www.recipearchive.com`

### Phase 4: Custom Domain & Route 53 Integration

**Domain Configuration:**

**Route 53 Hosted Zone Setup:**
```typescript
interface DNSConfiguration {
  domain: 'recipearchive.com',
  records: [
    {
      name: 'app.recipearchive.com',
      type: 'A',
      alias: {
        target: 'CloudFront Distribution',
        evaluateTargetHealth: true
      }
    },
    {
      name: 'www.recipearchive.com', 
      type: 'CNAME',
      value: 'app.recipearchive.com',
      ttl: 300
    }
  ]
}
```

**SSL/TLS Configuration:**
- **Protocol Version**: TLSv1.2 minimum (TLSv1.3 preferred)
- **Cipher Suites**: Modern, secure cipher suites only
- **HTTP to HTTPS Redirect**: Automatic redirect for all HTTP requests
- **HSTS Preload**: Include domain in browser HSTS preload lists

### Phase 5: Single Page Application (SPA) Support

**Flutter Router Configuration:**

**CloudFront Error Pages:**
```typescript
interface SPARoutingConfig {
  errorPages: [
    {
      errorCode: 404,
      responseCode: 200,
      responsePage: '/index.html',
      cacheTTL: 0
    },
    {
      errorCode: 403,
      responseCode: 200, 
      responsePage: '/index.html',
      cacheTTL: 0
    }
  ]
}
```

**Flutter Web Router Integration:**
```dart
// Configure Flutter web routing for CloudFront
class AppRouter {
  static final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/recipes',
        builder: (context, state) => const RecipeListScreen(),
      ),
      GoRoute(
        path: '/recipes/:id',
        builder: (context, state) => RecipeDetailScreen(
          recipeId: state.params['id']!,
        ),
      ),
      GoRoute(
        path: '/failed-parses',
        builder: (context, state) => const FailedParsesScreen(),
      ),
    ],
    errorBuilder: (context, state) => const NotFoundScreen(),
  );
}
```

### Phase 6: Deployment Automation & CI/CD

**GitHub Actions Workflow:**

```yaml
name: Deploy Flutter Web to CloudFront

on:
  push:
    branches: [main]
    paths: ['recipe_archive_fresh/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.10.0'
          
      - name: Install dependencies
        run: |
          cd recipe_archive_fresh
          flutter pub get
          
      - name: Build web app
        run: |
          cd recipe_archive_fresh
          flutter build web --release --web-renderer canvaskit
          
      - name: Deploy to S3
        run: |
          aws s3 sync recipe_archive_fresh/build/web/ s3://recipearchive-web-app-prod-${AWS_ACCOUNT_ID}/ --delete
          
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

**Deployment Script:**
```bash
#!/bin/bash
# deploy-web-app.sh

set -e

echo "🚀 Deploying RecipeArchive Flutter Web App to CloudFront"

# Build Flutter web app
cd recipe_archive_fresh
echo "📦 Building Flutter web app..."
flutter build web --release --web-renderer canvaskit

# Deploy to S3
echo "☁️ Uploading to S3..."
aws s3 sync build/web/ s3://recipearchive-web-app-prod-${AWS_ACCOUNT_ID}/ --delete --cache-control "public,max-age=31536000" --exclude "index.html" --exclude "manifest.json"

# Upload cache-sensitive files separately
aws s3 cp build/web/index.html s3://recipearchive-web-app-prod-${AWS_ACCOUNT_ID}/index.html --cache-control "public,max-age=0,must-revalidate"
aws s3 cp build/web/manifest.json s3://recipearchive-web-app-prod-${AWS_ACCOUNT_ID}/manifest.json --cache-control "public,max-age=86400"

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*"

echo "✅ Deployment complete! App available at: https://app.recipearchive.com"
```

### Phase 7: Monitoring & Analytics

**CloudWatch Integration:**

**Performance Metrics:**
```typescript
interface MonitoringMetrics {
  cloudFrontMetrics: [
    'Requests',           // Total request count
    'BytesDownloaded',    // Data transfer metrics
    'BytesUploaded',      // Upload data (API calls)
    '4xxErrors',          // Client errors (404, etc.)
    '5xxErrors',          // Server errors
    'CacheHitRate',       // Cache efficiency
    'OriginLatency'       // S3 response time
  ],
  customMetrics: [
    'FlutterAppLoads',    // Successful app initializations
    'RouteChanges',       // SPA navigation events
    'APICallLatency',     // Backend API performance
    'UserSessions'        // Active user tracking
  ]
}
```

**Real User Monitoring (RUM):**
```dart
// Integrate AWS CloudWatch RUM with Flutter
class AnalyticsService {
  static void initializeRUM() {
    // Configure CloudWatch RUM
    RumService.configure(
      applicationId: 'recipearchive-web-app',
      region: 'us-west-2',
      endpoint: 'https://cognito-identity.us-west-2.amazonaws.com',
      guestRoleArn: 'arn:aws:iam::ACCOUNT:role/RUM-Monitor-Role'
    );
  }
  
  static void trackPageView(String routeName) {
    RumService.recordPageView(routeName);
  }
  
  static void trackCustomEvent(String eventName, Map<String, String> attributes) {
    RumService.recordCustomEvent(eventName, attributes);
  }
}
```

### Phase 8: Cost Optimization & Scaling

**Cost Management Strategy:**

**CloudFront Pricing Tiers:**
```typescript
interface CostOptimization {
  priceClass: 'PriceClass_100',  // US, Canada, Europe (lowest cost)
  requestPricing: {
    first10TB: '$0.085 per GB',
    next40TB: '$0.080 per GB',
    httpRequests: '$0.0075 per 10,000',
    httpsRequests: '$0.0100 per 10,000'
  },
  estimatedMonthlyCost: {
    smallScale: '$5-15',   // <1GB transfer, <100k requests
    mediumScale: '$15-50', // 1-10GB transfer, 100k-1M requests  
    largeScale: '$50-200'  // 10-100GB transfer, 1M-10M requests
  }
}
```

**S3 Storage Optimization:**
```typescript
interface S3Configuration {
  storageClass: 'STANDARD',
  lifecycleRules: [
    {
      status: 'Enabled',
      transitions: [
        {
          days: 30,
          storageClass: 'STANDARD_IA'
        },
        {
          days: 90, 
          storageClass: 'GLACIER'
        }
      ]
    }
  ],
  versioning: 'Enabled',
  retentionPolicy: '90 days'
}
```

## Implementation Timeline

### Week 1-2: Infrastructure Foundation
- Set up S3 bucket for static website hosting
- Create CloudFront distribution with basic configuration
- Configure Route 53 hosted zone and DNS records
- Set up ACM certificate with DNS validation

### Week 3-4: Security & Performance
- Implement security headers and CSP policies
- Configure caching strategies for static and dynamic content
- Set up compression (Brotli + Gzip) for all text assets
- Implement SPA routing support with error page handling

### Week 5-6: Deployment Automation
- Create GitHub Actions workflow for automated deployment
- Set up S3 sync with proper cache-control headers
- Implement CloudFront invalidation in deployment pipeline
- Create deployment scripts for manual releases

### Week 7-8: Monitoring & Optimization  
- Configure CloudWatch monitoring and alerting
- Set up Real User Monitoring (RUM) for performance tracking
- Implement cost monitoring and budget alerts
- Performance testing and optimization based on metrics

## Success Metrics

### Performance Metrics
- **Page Load Time**: <2s initial load, <500ms subsequent navigation
- **Cache Hit Ratio**: >90% for static assets
- **Global Latency**: <200ms from major global regions
- **Uptime**: >99.9% availability SLA

### User Experience Metrics  
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Cumulative Layout Shift (CLS)**: <0.1
- **Core Web Vitals**: Pass all three metrics consistently

### Business Metrics
- **Cost Efficiency**: <$50/month for typical usage patterns
- **Global Reach**: Serve users from 6 continents with <300ms latency
- **Deployment Velocity**: <5 minutes from code push to live deployment
- **Error Rate**: <0.1% of requests result in errors

## Testing Strategy

### Performance Testing
- **Load Testing**: Simulate traffic patterns using AWS Load Testing solution
- **Global Performance**: Test from multiple geographic regions
- **Mobile Performance**: Verify performance on mobile networks (3G/4G/5G)
- **Core Web Vitals**: Continuous monitoring with Lighthouse CI

### Security Testing
- **HTTPS Enforcement**: Verify all HTTP requests redirect to HTTPS
- **Header Validation**: Test all security headers are properly configured
- **CSP Compliance**: Validate Content Security Policy doesn't break functionality
- **Certificate Validation**: Verify SSL certificate chain and expiration monitoring

### Deployment Testing
- **Blue/Green Deployments**: Zero-downtime deployment verification
- **Rollback Testing**: Verify ability to quickly rollback problematic deployments
- **Cache Invalidation**: Test cache invalidation works properly after deployments
- **DNS Propagation**: Verify DNS changes propagate globally within expected timeframes

## Security Considerations

### Infrastructure Security
- **S3 Bucket Security**: Block all public access, use CloudFront OAI (Origin Access Identity)
- **IAM Policies**: Minimal permissions for deployment roles
- **VPC Integration**: Consider VPC endpoints for S3 access if needed
- **Access Logging**: Enable CloudFront and S3 access logs for security monitoring

### Application Security
- **Content Security Policy**: Strict CSP to prevent XSS attacks
- **HTTPS Only**: Force HTTPS for all connections with HSTS headers
- **Subresource Integrity**: Consider SRI for critical assets
- **Regular Security Updates**: Keep Flutter and dependencies up to date

### Compliance & Privacy
- **Data Residency**: Ensure compliance with regional data laws
- **Privacy Headers**: Implement privacy-focused headers and policies
- **Cookie Management**: Secure cookie handling for authentication
- **GDPR Compliance**: Privacy controls for EU users if applicable

## Risk Mitigation

### Technical Risks
- **Single Region Dependency**: Consider multi-region setup for disaster recovery
- **CDN Edge Failures**: Monitor edge location health and implement fallbacks
- **Certificate Expiration**: Automated renewal monitoring and alerting
- **S3 Outages**: Consider multiple origin support for critical availability

### Operational Risks  
- **Deployment Failures**: Automated rollback mechanisms and health checks
- **Cost Overruns**: Budget alerts and usage monitoring to prevent unexpected costs
- **Performance Degradation**: Real-time monitoring with automatic scaling policies
- **Security Incidents**: Incident response plan and security monitoring

### Business Risks
- **User Experience**: Comprehensive monitoring to catch UX issues early
- **Global Performance**: Regular testing from different geographic regions
- **Mobile Experience**: Continuous mobile performance monitoring and optimization
- **Accessibility**: Regular accessibility audits and compliance monitoring

## Future Enhancements

### Advanced CDN Features
- **Edge Computing**: Lambda@Edge functions for dynamic content personalization
- **Real-Time Logs**: CloudFront real-time logs for immediate insights
- **Origin Shield**: Additional caching layer for improved cache hit ratios
- **HTTP/3 Support**: Enable when available for improved performance

### Progressive Web App Features
- **Service Worker**: Advanced caching strategies and offline functionality
- **Push Notifications**: Web push notifications for recipe updates
- **App Install Prompts**: Encourage users to install PWA on mobile devices
- **Background Sync**: Sync recipe changes when users come back online

### Global Expansion
- **Multi-Region Origins**: Regional S3 buckets for improved global performance
- **Localization**: Support for multiple languages and regional content
- **Compliance**: Regional compliance for different international markets
- **Currency Support**: Regional pricing and currency support if applicable

---

This comprehensive CloudFront hosting plan transforms the RecipeArchive Flutter web application from local development to a production-grade, globally distributed web application with enterprise-level performance, security, and scalability capabilities.