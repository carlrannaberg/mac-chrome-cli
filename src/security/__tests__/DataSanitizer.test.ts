import { NetworkDataSanitizer } from '../DataSanitizer.js';

describe('NetworkDataSanitizer', () => {
  let sanitizer: NetworkDataSanitizer;

  beforeEach(() => {
    sanitizer = new NetworkDataSanitizer();
  });

  describe('sanitizeHeaders', () => {
    it('should redact authorization headers', () => {
      const headers = {
        'authorization': 'Bearer secret-token-123',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0'
      };
      
      const sanitized = sanitizer.sanitizeHeaders(headers);
      
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized['content-type']).toBe('application/json');
      expect(sanitized['user-agent']).toBe('Mozilla/5.0');
    });

    it('should redact cookie headers', () => {
      const headers = {
        'cookie': 'session_id=abc123; auth_token=xyz789',
        'accept': 'application/json'
      };
      
      const sanitized = sanitizer.sanitizeHeaders(headers);
      
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.accept).toBe('application/json');
    });

    it('should redact x-api-key and x-auth-token headers', () => {
      const headers = {
        'x-api-key': 'api-key-123',
        'x-auth-token': 'auth-token-456',
        'content-length': '100'
      };
      
      const sanitized = sanitizer.sanitizeHeaders(headers);
      
      expect(sanitized['x-api-key']).toBe('[REDACTED]');
      expect(sanitized['x-auth-token']).toBe('[REDACTED]');
      expect(sanitized['content-length']).toBe('100');
    });

    it('should preserve original headers object', () => {
      const headers = {
        'authorization': 'Bearer token',
        'content-type': 'application/json'
      };
      
      const sanitized = sanitizer.sanitizeHeaders(headers);
      
      expect(headers.authorization).toBe('Bearer token');
      expect(sanitized).not.toBe(headers);
    });
  });

  describe('sanitizeBody', () => {
    it('should redact password fields in JSON', () => {
      const body = '{"username": "user", "password": "secret123", "email": "user@example.com"}';
      
      const sanitized = sanitizer.sanitizeBody(body);
      
      expect(sanitized).toContain('"password":"[REDACTED]"');
      expect(sanitized).toContain('"username": "user"');
      expect(sanitized).toContain('"email": "user@example.com"');
    });

    it('should redact authorization patterns', () => {
      const body = 'authorization: Bearer secret-token-123, other: value';
      
      const sanitized = sanitizer.sanitizeBody(body);
      
      expect(sanitized).toContain('authorization: [REDACTED]');
      expect(sanitized).toContain('other: value');
    });

    it('should redact API key patterns', () => {
      const body = 'api_key=secret123&user=john&api-key="another-secret"';
      
      const sanitized = sanitizer.sanitizeBody(body);
      
      expect(sanitized).toContain('api_key=[REDACTED]');
      expect(sanitized).toContain('api-key=[REDACTED]');
      expect(sanitized).toContain('user=john');
    });

    it('should redact token patterns', () => {
      const body = 'token=jwt123&refresh_token="refresh456"&user_id=789';
      
      const sanitized = sanitizer.sanitizeBody(body);
      
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('user_id=789');
    });

    it('should handle empty or undefined body', () => {
      expect(sanitizer.sanitizeBody('')).toBe('');
      expect(sanitizer.sanitizeBody('normal text')).toBe('normal text');
    });
  });

  describe('sanitizeUrl', () => {
    it('should redact sensitive URL parameters', () => {
      const url = 'https://api.example.com/data?api_key=secret123&user_id=456&token=jwt789';
      
      const sanitized = sanitizer.sanitizeUrl(url);
      
      expect(sanitized).toContain('api_key=[REDACTED]');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('user_id=456');
    });

    it('should handle password parameters', () => {
      const url = 'https://login.example.com/auth?username=john&password=secret&remember=true';
      
      const sanitized = sanitizer.sanitizeUrl(url);
      
      expect(sanitized).toContain('password=[REDACTED]');
      expect(sanitized).toContain('username=john');
      expect(sanitized).toContain('remember=true');
    });

    it('should handle auth parameters', () => {
      const url = 'https://api.example.com/endpoint?auth=bearer123&data=value';
      
      const sanitized = sanitizer.sanitizeUrl(url);
      
      expect(sanitized).toContain('auth=[REDACTED]');
      expect(sanitized).toContain('data=value');
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrl = 'not-a-valid-url';
      
      const sanitized = sanitizer.sanitizeUrl(malformedUrl);
      
      expect(sanitized).toBe(malformedUrl);
    });

    it('should preserve URLs without sensitive parameters', () => {
      const url = 'https://api.example.com/data?user_id=123&page=1';
      
      const sanitized = sanitizer.sanitizeUrl(url);
      
      expect(sanitized).toBe(url);
    });
  });

  describe('performance', () => {
    it('should process data efficiently', () => {
      const largeBody = JSON.stringify({
        password: 'secret'.repeat(100),
        data: 'x'.repeat(1000),
        api_key: 'key'.repeat(50)
      });
      
      const start = process.hrtime.bigint();
      const sanitized = sanitizer.sanitizeBody(largeBody);
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1000000;
      
      expect(durationMs).toBeLessThan(10); // Should be under 10ms
      expect(sanitized).toContain('[REDACTED]');
    });
  });
});