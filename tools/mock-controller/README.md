# AI-Controlled Mock Testing Server

## Purpose

This tool enables AI agents (Claude, etc.) running in VS Code to control recipe normalization testing by mocking OpenAI API responses.

**⚠️ Development/Testing Only** - This is NOT used in production deployments.

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Server runs on http://localhost:3456
```

## Usage

### Set Mock Response

```bash
# Use pre-defined scenario
curl -X POST http://localhost:3456/mock/set \
  -H "Content-Type: application/json" \
  -d '{"scenario": "successful_normalization"}'

# Custom response
curl -X POST http://localhost:3456/mock/set \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "custom_test",
    "response": {
      "title": "Test Recipe",
      "ingredients": [...],
      "instructions": [...]
    }
  }'
```

### List Available Scenarios

```bash
curl http://localhost:3456/mock/scenarios
```

### Clear Mock

```bash
curl -X POST http://localhost:3456/mock/clear
```

### View Request Log

```bash
curl http://localhost:3456/mock/log
```

## Pre-defined Scenarios

Located in `responses/` directory:

- `successful_normalization.json` - Complete recipe with all fields
- `missing_ingredients.json` - Recipe with no ingredients
- `api_error.json` - Simulated API error

## Integration with Lambda Functions

When `AI_MOCK_TESTING=true` is set, Lambda functions will use `http://localhost:3456` as the OpenAI API base URL instead of the real API.

## For AI Agents

This tool is designed to be controlled by AI agents during testing:

1. Start the mock server
2. Set desired mock response via API
3. Run tests with `AI_MOCK_TESTING=true`
4. Verify results
5. Clear mock and repeat

See `docs/testing/ai-mock-testing.md` for comprehensive documentation.

