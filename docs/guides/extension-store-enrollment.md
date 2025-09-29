# Browser Extension Store Enrollment Guide

## Chrome Web Store Enrollment

### Prerequisites

- Google Developer account ($5 one-time fee)
- Chrome extension files ready for submission
- High-quality screenshots and promotional images
- Privacy policy hosted on public URL

### Step 1: Create Google Developer Account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click "Sign up as a Chrome Web Store Developer"
3. Pay the $5 one-time registration fee
4. Verify your email address
5. Complete developer profile with:
   - Developer name: "RecipeArchive"
   - Website: https://d1jcaphz4458q7.cloudfront.net
   - Support email: (your email)

### Step 2: Prepare Extension Package

1. Navigate to `extensions/chrome/` directory
2. Create final extension package:
   ```bash
   cd extensions/chrome
   zip -r recipe-archive-chrome.zip . -x "*.DS_Store" "node_modules/*" ".git/*"
   ```
3. Verify manifest.json has correct:
   - Version number (start with 1.0.0)
   - Name: "RecipeArchive"
   - Description: "Save recipes from any cooking website to your personal archive"
   - Permissions clearly listed

### Step 3: Create Store Assets

1. **Icon Requirements:**
   - 16x16px, 32x32px, 48x48px, 128x128px (PNG format)
   - Use current RecipeArchive logo/branding
2. **Screenshots (Required - 1280x800px or 640x400px):**
   - Extension popup showing recipe capture
   - Recipe archive dashboard view
   - Save confirmation dialog
3. **Promotional Images (Optional but recommended):**
   - Small tile: 440x280px
   - Large tile: 920x680px
   - Marquee: 1400x560px

### Step 4: Submit for Review

1. In Developer Dashboard, click "New Item"
2. Upload your .zip file
3. Fill out listing information:
   - **Category:** Productivity
   - **Language:** English
   - **Summary:** "Personal recipe archive tool"
   - **Detailed Description:**

     ```
     RecipeArchive helps you save and organize recipes from any cooking website.
     Simply click the extension while viewing a recipe to automatically extract
     ingredients, instructions, and cooking times into your personal archive.

     Features:
     • One-click recipe saving from popular cooking sites
     • Automatic ingredient and instruction parsing
     • Personal recipe collection with search
     • Cross-device synchronization
     • Privacy-focused: your recipes stay in your account
     ```
4. **Privacy Practices:**
   - Data usage: "Store and manage user recipes"
   - User data handling: "Data is encrypted and stored securely"
   - No data sale to third parties
5. **Store Listing:**
   - Upload screenshots
   - Upload promotional images
   - Set privacy policy URL: (create at your domain)

### Step 5: Review Process

- Initial review: 1-3 business days
- Additional reviews (if needed): 24-48 hours each
- Common rejection reasons:
  - Privacy policy missing/inadequate
  - Permissions not justified in description
  - Screenshots don't match functionality
  - Manifest errors

### Step 6: Post-Approval

1. Extension goes live immediately after approval
2. Monitor reviews and ratings
3. Respond to user feedback promptly
4. Submit updates through same dashboard

---

## Safari Extensions Store Enrollment

### Prerequisites

- Apple Developer account ($99/year)
- Mac with Xcode installed
- Extension converted to Safari Web Extension format

### Step 1: Apple Developer Program

1. Go to [Apple Developer Program](https://developer.apple.com/programs/)
2. Sign in with Apple ID or create new account
3. Enroll in Apple Developer Program ($99/year)
4. Complete identity verification (may take 24-48 hours)
5. Accept agreements in Developer Portal

### Step 2: Convert Extension to Safari Format

1. Open Xcode on Mac
2. Create new project: File → New → Project
3. Choose "Safari Extension App" template
4. Project details:
   - Product Name: "RecipeArchive"
   - Bundle Identifier: "com.yourdomain.recipearchive"
   - Language: Swift
5. Use Safari Web Extension Converter:
   ```bash
   xcrun safari-web-extension-converter extensions/chrome --project-location extensions/safari
   ```

### Step 3: Configure Extension in Xcode

1. Open generated Xcode project
2. Update Info.plist with:
   - App name: "RecipeArchive"
   - App description: "Personal recipe archive tool"
   - Version: 1.0.0
3. Configure signing:
   - Select your Apple Developer team
   - Ensure provisioning profile is valid
4. Add app icons (required sizes):
   - 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024

### Step 4: Test Extension

1. Build and run in Xcode
2. Enable extension in Safari:
   - Safari → Preferences → Extensions
   - Enable RecipeArchive extension
3. Test all functionality:
   - Recipe capture from various sites
   - Popup interface
   - Data synchronization

### Step 5: Prepare App Store Submission

1. **App Store Connect Setup:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Click "My Apps" → "+" → "New App"
   - Platform: macOS
   - App Name: "RecipeArchive"
   - Bundle ID: (same as Xcode project)
   - SKU: "recipearchive-safari"

2. **App Information:**
   - Category: Productivity
   - Subtitle: "Save recipes from any website"
   - Description:

     ```
     Transform your recipe collection with RecipeArchive, the ultimate tool for
     saving and organizing recipes from any cooking website. Simply browse to
     any recipe and click our extension to automatically capture ingredients,
     instructions, and cooking details into your personal archive.

     Key Features:
     • One-click recipe saving from popular cooking sites
     • Intelligent parsing of ingredients and instructions
     • Personal recipe library with powerful search
     • Sync across all your devices
     • Privacy-first: your data stays secure in your account

     Compatible with major recipe sites including Food Network, AllRecipes,
     NYT Cooking, and many more. Start building your digital cookbook today!
     ```

### Step 6: App Store Assets

1. **App Icons:** (provided in Xcode project)
2. **Screenshots (Required - 1280x800px minimum):**
   - Safari with extension popup open
   - Recipe archive web interface
   - Extension preferences/settings
3. **Privacy Policy:** Host at your domain and provide URL

### Step 7: Submit for Review

1. In App Store Connect:
   - Upload build from Xcode (Archive → Upload to App Store)
   - Complete all required metadata
   - Answer App Store Review questionnaire:
     - Uses encryption: No (unless you add it later)
     - Third-party content: No
     - Advertising identifier: No
2. **Submission Notes:**

   ```
   RecipeArchive Safari Extension allows users to save recipes from cooking
   websites to their personal archive. The extension parses recipe content
   and sends it to the user's secure account for storage and organization.

   Test Instructions:
   1. Install and enable the extension in Safari
   2. Visit any recipe website (e.g., allrecipes.com)
   3. Click the RecipeArchive extension icon
   4. Verify recipe is captured and saved
   ```

### Step 8: Review Process

- Initial review: 1-7 days
- Safari extensions reviewed for:
  - Privacy compliance
  - User experience
  - Technical functionality
  - Content accuracy
- Address any reviewer feedback promptly

### Step 9: Post-Approval

1. Extension available in Mac App Store
2. Monitor reviews and update regularly
3. Respond to user feedback
4. Submit updates through App Store Connect

---

## Important Notes

### Privacy Policy Requirements

Both stores require a comprehensive privacy policy. Include:

- What data you collect (recipes, user preferences)
- How data is used (personal organization, search)
- Data storage and security measures
- User rights (data deletion, account management)
- Contact information for privacy concerns

### Compliance Considerations

- **GDPR/CCPA:** Ensure user data rights compliance
- **Store Policies:** Review and follow platform guidelines
- **Regular Updates:** Keep extensions updated with security patches

### Marketing Strategy

1. Soft launch to friends/family first
2. Gather feedback and iterate
3. Create landing page highlighting store availability
4. Social media announcement
5. Consider cooking community outreach

### Support Infrastructure

- Create support email address
- Set up help documentation
- Plan for user feedback management
- Monitor extension performance metrics
