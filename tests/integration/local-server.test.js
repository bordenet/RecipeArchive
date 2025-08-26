const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Helper function to find an available port
const getAvailablePort = () => {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });
};

describe('Local Development Environment Integration', () => {
  let serverProcess;
  const HOST = 'localhost';
  let PORT; // Dynamic port assignment

  beforeAll(async () => {
    // Get an available port first
    PORT = await getAvailablePort();
    console.log(`Using port ${PORT} for integration tests`);
    
    // Start the local server for testing
    const serverPath = path.join(__dirname, '../../aws-backend/functions/local-server');
    
    return new Promise((resolve, reject) => {
      serverProcess = spawn('go', ['run', 'main.go'], {
        cwd: serverPath,
        env: { ...process.env, PORT: PORT.toString() }
      });

      serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data}`);
        if (data.toString().includes('starting on port')) {
          // Give server time to fully start
          setTimeout(resolve, 1000);
        }
      });

      serverProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        console.error(`Server Error: ${errorMsg}`);
        // Only reject for actual errors, not normal stderr output
        if (errorMsg.includes('failed to start') || errorMsg.includes('error') || errorMsg.includes('panic')) {
          reject(new Error(`Server failed to start: ${errorMsg}`));
        }
      });

      serverProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn server process: ${error.message}`));
      });

      serverProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code} and signal ${signal}`));
        }
      });

      // Timeout after 12 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout - no "starting on port" message received'));
      }, 12000);
    });
  }, 20000);

  afterAll(() => {
    if (serverProcess) {
      console.log('Cleaning up server process...');
      serverProcess.kill('SIGTERM');
      
      // Force kill if it doesn't terminate gracefully
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          console.log('Force killing server process...');
          serverProcess.kill('SIGKILL');
        }
      }, 2000);
    }
  });

  test('Health endpoint returns healthy status', async () => {
    const response = await makeRequest('GET', `http://${HOST}:${PORT}/health`);
    
    expect(response.statusCode).toBe(200);
    expect(response.data.status).toBe('healthy');
    expect(response.data.service).toBe('recipe-archive-local');
  });

  test('Diagnostics endpoint accepts POST data', async () => {
    const diagnosticData = {
      test: 'integration',
      url: 'http://example.com',
      userAgent: 'Jest Integration Test',
      diagnosticData: {
        pageAnalysis: 'test data'
      }
    };

    const response = await makeRequest(
      'POST', 
      `http://${HOST}:${PORT}/diagnostics`,
      diagnosticData
    );
    
    expect(response.statusCode).toBe(200);
    expect(response.data.status).toBe('received');
    expect(response.data.message).toContain('processed successfully');
  });

  test('Protected recipes endpoint requires authentication', async () => {
    const response = await makeRequest('GET', `http://${HOST}:${PORT}/api/recipes`);
    
    expect(response.statusCode).toBe(401);
  });

  test('Recipes endpoint works with mock authentication', async () => {
    const response = await makeRequest(
      'GET', 
      `http://${HOST}:${PORT}/api/recipes`,
      null,
      { 'Authorization': 'Bearer test123' }
    );
    
    expect(response.statusCode).toBe(200);
    expect(response.data).toHaveProperty('recipes');
    expect(Array.isArray(response.data.recipes)).toBe(true);
  });

  test('CORS headers are present for extension requests', async () => {
    const response = await makeRequest(
      'OPTIONS', 
      `http://${HOST}:${PORT}/health`,
      null,
      { 
        'Origin': 'chrome-extension://test',
        'Access-Control-Request-Method': 'GET'
      }
    );
    
    expect(response.statusCode).toBe(204); // CORS preflight returns 204 No Content
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});

// Helper function to make HTTP requests
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}
