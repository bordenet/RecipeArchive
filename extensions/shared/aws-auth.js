// AWS Signature Version 4 Authentication for Browser Extensions
// Handles proper signing required by AWS API Gateway

class AWSAuth {
  constructor(region, service = 'execute-api') {
    this.region = region;
    this.service = service;
  }

  // Create AWS Signature Version 4 headers
  async createAuthHeaders(method, url, body, accessKeyId, secretAccessKey, sessionToken = null) {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      const path = urlObj.pathname + urlObj.search;
      
      // Create timestamp
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const dateStamp = amzDate.slice(0, 8);
      
      // Create canonical request
      const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
      const signedHeaders = 'host;x-amz-date';
      
      // Hash the payload
      const payloadHash = body ? await this.sha256Hash(body) : await this.sha256Hash('');
      
      const canonicalRequest = [
        method,
        path,
        '', // query string (empty for POST)
        canonicalHeaders,
        signedHeaders,
        payloadHash
      ].join('\n');
      
      // Create string to sign
      const algorithm = 'AWS4-HMAC-SHA256';
      const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
      const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        await this.sha256Hash(canonicalRequest)
      ].join('\n');
      
      // Calculate signature
      const signature = await this.calculateSignature(secretAccessKey, dateStamp, stringToSign);
      
      // Create authorization header
      const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      
      const headers = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader
      };
      
      // Add session token if present (for temporary credentials)
      if (sessionToken) {
        headers['X-Amz-Security-Token'] = sessionToken;
      }
      
      console.log('🔐 AWS Auth headers created:', {
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader.substring(0, 50) + '...',
        'X-Amz-Security-Token': sessionToken ? sessionToken.substring(0, 20) + '...' : 'none'
      });
      
      return headers;
    } catch (error) {
      console.error('❌ AWS Auth error:', error);
      throw new Error(`AWS authentication failed: ${error.message}`);
    }
  }
  
  // SHA256 hash function using Web Crypto API
  async sha256Hash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // HMAC-SHA256 function using Web Crypto API
  async hmacSha256(key, data) {
    const encoder = new TextEncoder();
    const keyBuffer = typeof key === 'string' ? encoder.encode(key) : key;
    const dataBuffer = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return new Uint8Array(signature);
  }
  
  // Calculate AWS signature
  async calculateSignature(secretAccessKey, dateStamp, stringToSign) {
    const kDate = await this.hmacSha256('AWS4' + secretAccessKey, dateStamp);
    const kRegion = await this.hmacSha256(kDate, this.region);
    const kService = await this.hmacSha256(kRegion, this.service);
    const kSigning = await this.hmacSha256(kService, 'aws4_request');
    const signature = await this.hmacSha256(kSigning, stringToSign);
    
    // Convert to hex
    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export for use in extensions
if (typeof window !== 'undefined') {
  window.AWSAuth = AWSAuth;
}