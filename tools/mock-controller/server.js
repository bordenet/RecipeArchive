#!/usr/bin/env node

/**
 * AI-Controlled Mock Testing Server
 * 
 * This server allows AI agents (Claude, etc.) to control OpenAI API mocking
 * for end-to-end testing without API costs.
 * 
 * IMPORTANT: This is a development/testing tool ONLY.
 * - Only runs locally (localhost:3456)
 * - Only activates when AI_MOCK_TESTING=true
 * - Never used in production deployments
 * 
 * Usage:
 *   npm start
 *   curl -X POST http://localhost:3456/mock/set -d '{"scenario":"test","response":{...}}'
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3456;

// Middleware
app.use(cors());
app.use(express.json());

// Current mock state
let currentMock = null;
let requestLog = [];

// Load pre-defined scenarios
const scenariosDir = path.join(__dirname, "responses");
const scenarios = {};

if (fs.existsSync(scenariosDir)) {
  fs.readdirSync(scenariosDir)
    .filter(file => file.endsWith(".json"))
    .forEach(file => {
      const scenarioName = file.replace(".json", "");
      scenarios[scenarioName] = JSON.parse(
        fs.readFileSync(path.join(scenariosDir, file), "utf8")
      );
    });
}

// API Endpoints

/**
 * Set mock response
 * POST /mock/set
 * Body: { scenario: "name", response: {...} } or { scenario: "predefined_name" }
 */
app.post("/mock/set", (req, res) => {
  const { scenario, response } = req.body;
  
  if (!scenario) {
    return res.status(400).json({ error: "scenario is required" });
  }
  
  // Use pre-defined scenario if no response provided
  if (!response && scenarios[scenario]) {
    currentMock = {
      scenario,
      response: scenarios[scenario]
    };
  } else if (response) {
    currentMock = { scenario, response };
  } else {
    return res.status(404).json({ 
      error: `Scenario '${scenario}' not found`,
      available: Object.keys(scenarios)
    });
  }
  
  console.log(`✓ Mock set: ${scenario}`);
  res.json({ 
    status: "mock set", 
    scenario: currentMock.scenario,
    timestamp: new Date().toISOString()
  });
});

/**
 * Clear current mock
 * POST /mock/clear
 */
app.post("/mock/clear", (req, res) => {
  currentMock = null;
  requestLog = [];
  console.log("✓ Mock cleared");
  res.json({ status: "mock cleared" });
});

/**
 * Get current mock state
 * GET /mock/current
 */
app.get("/mock/current", (req, res) => {
  res.json(currentMock || { status: "no mock set" });
});

/**
 * List available scenarios
 * GET /mock/scenarios
 */
app.get("/mock/scenarios", (req, res) => {
  res.json({
    scenarios: Object.keys(scenarios),
    count: Object.keys(scenarios).length
  });
});

/**
 * Get request log
 * GET /mock/log
 */
app.get("/mock/log", (req, res) => {
  res.json({ requests: requestLog, count: requestLog.length });
});

/**
 * OpenAI API Mock Endpoint
 * POST /v1/chat/completions
 * 
 * Intercepts OpenAI API calls and returns mock responses
 */
app.post("/v1/chat/completions", (req, res) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    model: req.body.model,
    messages: req.body.messages
  };
  requestLog.push(logEntry);
  
  if (!currentMock) {
    console.error("✗ No mock response configured");
    return res.status(500).json({ 
      error: {
        message: "No mock response configured. Use POST /mock/set first.",
        type: "mock_not_configured"
      }
    });
  }
  
  console.log(`→ Returning mock response for scenario: ${currentMock.scenario}`);
  
  // Return mock response in OpenAI API format
  res.json({
    id: "mock-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: req.body.model || "gpt-4",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify(currentMock.response)
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300
    }
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    mockActive: currentMock !== null,
    requestCount: requestLog.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  AI-Controlled Mock Testing Server                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Available scenarios: ${Object.keys(scenarios).length}`);
  console.log("");
  console.log("  Endpoints:");
  console.log("    POST /mock/set          - Set mock response");
  console.log("    POST /mock/clear        - Clear mock");
  console.log("    GET  /mock/current      - Get current mock");
  console.log("    GET  /mock/scenarios    - List scenarios");
  console.log("    GET  /mock/log          - View request log");
  console.log("    POST /v1/chat/completions - OpenAI API mock");
  console.log("");
  console.log("  ⚠️  Development/Testing Only - Not for production use");
  console.log("");
});

