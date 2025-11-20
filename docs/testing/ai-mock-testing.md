# AI-Controlled Mock Testing System

## Overview

This system enables AI agents (Claude, etc.) running in VS Code to control recipe normalization testing by mocking OpenAI API responses. This provides:

- **Zero API costs** during development and testing
- **Deterministic test results** for quality control
- **Full end-to-end flow testing** without external dependencies
- **AI-controlled test scenarios** for comprehensive coverage

## Architecture

### Components

1. **Mock Controller** (`tools/mock-controller/`)
   - HTTP server that AI agents can control
   - Provides endpoints to set mock responses
   - Intercepts OpenAI API calls during tests

2. **Mock Response Library** (`tools/mock-controller/responses/`)
   - Pre-defined mock responses for common scenarios
   - Structured JSON files with expected normalization outputs
   - Covers success cases, edge cases, and error scenarios

3. **Test Harness** (`tests/ai-controlled/`)
   - Integration tests that use mock controller
   - Validates end-to-end recipe processing flow
   - Verifies normalization quality

### Environment Detection

The system ONLY activates when:
- Running in VS Code (detected via `VSCODE_PID` environment variable)
- `AI_MOCK_TESTING=true` in `.env` file
- Mock controller server is running

**Production deployments are never affected.**

## Usage

### For AI Agents (Claude in VS Code)

1. **Start Mock Controller**:
   ```bash
   cd tools/mock-controller
   npm start
   # Server runs on http://localhost:3456
   ```

2. **Set Mock Response**:
   ```bash
   curl -X POST http://localhost:3456/mock/set \
     -H "Content-Type: application/json" \
     -d '{
       "scenario": "successful_normalization",
       "response": {
         "title": "Chicken Parmesan",
         "ingredients": [...],
         "instructions": [...]
       }
     }'
   ```

3. **Run Tests**:
   ```bash
   AI_MOCK_TESTING=true npm run test:ai-controlled
   ```

4. **Verify Results**:
   ```bash
   # Check that normalization used mock response
   # Verify recipe was saved correctly
   # Validate all processing steps completed
   ```

### Mock Response Scenarios

Pre-defined scenarios in `tools/mock-controller/responses/`:

- `successful_normalization.json` - Standard recipe normalization
- `missing_ingredients.json` - Recipe with no ingredients detected
- `missing_instructions.json` - Recipe with no instructions detected
- `api_error.json` - OpenAI API error simulation
- `timeout.json` - API timeout simulation
- `malformed_response.json` - Invalid JSON from API

## Implementation Details

### Mock Controller Server

```javascript
// tools/mock-controller/server.js
const express = require("express");
const app = express();

let currentMock = null;

app.post("/mock/set", (req, res) => {
  currentMock = req.body;
  res.json({ status: "mock set", scenario: currentMock.scenario });
});

app.post("/mock/clear", (req, res) => {
  currentMock = null;
  res.json({ status: "mock cleared" });
});

app.get("/mock/current", (req, res) => {
  res.json(currentMock || { status: "no mock set" });
});

// Intercept OpenAI API calls
app.post("/v1/chat/completions", (req, res) => {
  if (!currentMock) {
    return res.status(500).json({ error: "No mock response configured" });
  }
  
  // Return mock response in OpenAI format
  res.json({
    choices: [{
      message: {
        content: JSON.stringify(currentMock.response)
      }
    }]
  });
});

app.listen(3456, () => {
  console.log("Mock controller running on http://localhost:3456");
});
```

### Lambda Function Integration

```go
// aws-backend/functions/normalize-recipe/main.go

func getOpenAIClient() *openai.Client {
    // Check for mock testing mode
    if os.Getenv("AI_MOCK_TESTING") == "true" {
        // Use mock controller endpoint
        config := openai.DefaultConfig(os.Getenv("OPENAI_API_KEY"))
        config.BaseURL = "http://localhost:3456"
        return openai.NewClientWithConfig(config)
    }
    
    // Production: use real OpenAI API
    return openai.NewClient(os.Getenv("OPENAI_API_KEY"))
}
```

## Safety & Documentation

### Clear Separation

- Mock controller ONLY runs locally
- Environment variable guards prevent production use
- Documentation clearly states this is a development/testing feature
- No confusion for new adopters

### Documentation Updates

1. **README.md** - Brief mention in testing section
2. **docs/testing/ai-mock-testing.md** - This comprehensive guide
3. **.env.example** - Add `AI_MOCK_TESTING=false` with clear comment
4. **CLAUDE.md** - Add section on using mock testing

## Benefits

1. **Cost Savings**: No OpenAI API costs during development
2. **Speed**: Instant responses vs. API latency
3. **Reliability**: Deterministic tests, no API rate limits
4. **Coverage**: Test edge cases that are hard to reproduce
5. **Quality Control**: AI agents can verify normalization quality

## Future Enhancements

- Support for Ollama local LLM integration
- Record/replay mode for capturing real API responses
- Performance benchmarking tools
- Automated quality scoring

