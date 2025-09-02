# Chrome Extension Development Setup

## Authentication Configuration

### Quick Setup

1. Copy `config.sample.json` to `config.json`
2. Update the credentials in `config.json`:
   ```json
   {
     "auth": {
       "username": "your-username",
       "password": "your-password"
     },
     "api": {
       "baseUrl": "https://your-api-endpoint.com"
     }
   }
   ```

### Test Credentials

For internal testing, use:

For development/testing, use environment variables:
- Username: `${RECIPE_TEST_USER}`
- Password: `${RECIPE_TEST_PASS}`

### Security Note

- `config.json` is gitignored to prevent credentials from being committed
- Never commit real credentials to the repository
- Use the sample config file as a template for other developers

## Extension Features

- BASIC auth setup screen with Chrome storage
- Recipe extraction from 12+ supported sites including Smitten Kitchen, Food52, Alexandra's Kitchen, and more
- Local credential storage with Chrome extension APIs
- Setup validation and error handling
- Future API sync capabilities

## Development

```bash
npm install
npm test
```

## Loading in Chrome

1. Open Chrome Extensions (chrome://extensions/)
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select this directory
5. The extension will prompt for setup on first use
