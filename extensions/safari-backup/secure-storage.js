// Browser Extension Storage Encryption Utility
// Provides secure storage for sensitive data like credentials and tokens

class SecureStorage {
  constructor() {
    this.keyDerivationIterations = 100000;
    this.keyLength = 256; // bits
    this.ivLength = 12; // 96 bits for GCM
  }

  // Generate a key from password using PBKDF2
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.keyDerivationIterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: this.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt data with AES-GCM
  async encrypt(data, password) {
    try {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
      
      const key = await this.deriveKey(password, salt);
      const encodedData = encoder.encode(JSON.stringify(data));
      
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
      );

      // Combine salt + iv + encrypted data
      const result = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encryptedData), salt.length + iv.length);

      // Return base64 encoded result
      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt data with AES-GCM
  async decrypt(encryptedData, password) {
    try {
      // Decode from base64
      const data = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );

      // Extract salt, iv, and encrypted data
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 16 + this.ivLength);
      const encrypted = data.slice(16 + this.ivLength);

      const key = await this.deriveKey(password, salt);
      
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decryptedData));
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - invalid password or corrupted data');
    }
  }

  // Generate a secure random password for master key
  generateMasterKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // Check if Web Crypto API is available
  isSupported() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  }
}

// Browser-specific secure storage implementations
class ChromeSecureStorage extends SecureStorage {
  constructor() {
    super();
    this.storage = chrome.storage.local;
  }

  async setSecureItem(key, value, masterKey) {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported');
    }

    const encryptedValue = await this.encrypt(value, masterKey);
    await this.storage.set({ [key]: encryptedValue });
  }

  async getSecureItem(key, masterKey) {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported');
    }

    const result = await this.storage.get([key]);
    if (!result[key]) {
      return null;
    }

    return await this.decrypt(result[key], masterKey);
  }

  async removeSecureItem(key) {
    await this.storage.remove([key]);
  }

  async setMasterKey(masterKey) {
    // Store master key hash for validation (not the key itself)
    const encoder = new TextEncoder();
    const data = encoder.encode(masterKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    await this.storage.set({ 'master_key_hash': hashHex });
  }

  async validateMasterKey(masterKey) {
    const result = await this.storage.get(['master_key_hash']);
    if (!result.master_key_hash) {
      return false;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(masterKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === result.master_key_hash;
  }
}

class SafariSecureStorage extends SecureStorage {
  constructor() {
    super();
    this.storage = browser.storage.local;
  }

  async setSecureItem(key, value, masterKey) {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported');
    }

    const encryptedValue = await this.encrypt(value, masterKey);
    await this.storage.set({ [key]: encryptedValue });
  }

  async getSecureItem(key, masterKey) {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API not supported');
    }

    const result = await this.storage.get([key]);
    if (!result[key]) {
      return null;
    }

    return await this.decrypt(result[key], masterKey);
  }

  async removeSecureItem(key) {
    await this.storage.remove([key]);
  }

  async setMasterKey(masterKey) {
    // Store master key hash for validation (not the key itself)
    const encoder = new TextEncoder();
    const data = encoder.encode(masterKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    await this.storage.set({ 'master_key_hash': hashHex });
  }

  async validateMasterKey(masterKey) {
    const result = await this.storage.get(['master_key_hash']);
    if (!result.master_key_hash) {
      return false;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(masterKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === result.master_key_hash;
  }
}

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecureStorage, ChromeSecureStorage, SafariSecureStorage };
} else {
  window.SecureStorage = SecureStorage;
  window.ChromeSecureStorage = ChromeSecureStorage;
  window.SafariSecureStorage = SafariSecureStorage;
}
