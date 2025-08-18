import { convertToHAR } from '../netlog.js';
import type { NetworkEvent } from '../netlog.js';

describe('Network Logging with Sanitization', () => {
  describe('convertToHAR', () => {
    it('should sanitize sensitive data in HAR conversion', () => {
      const events: NetworkEvent[] = [
        {
          id: 'test1',
          type: 'fetch',
          method: 'POST',
          url: 'https://api.example.com/login?api_key=secret123&user=john',
          timestamp: Date.now(),
          requestHeaders: {
            'authorization': 'Bearer token123',
            'content-type': 'application/json'
          },
          requestBody: '{"password": "secret456", "email": "user@example.com"}',
          responseHeaders: {
            'x-auth-token': 'response-token-789'
          },
          responseBody: '{"token": "jwt123", "user_id": 456}',
          status: 200,
          statusText: 'OK'
        }
      ];

      const har = convertToHAR(events);
      const entry = har.log.entries[0];

      // Check URL sanitization
      expect(entry.request.url).toContain('api_key=[REDACTED]');
      expect(entry.request.url).toContain('user=john');

      // Check request header sanitization
      const authHeader = entry.request.headers.find(h => h.name === 'authorization');
      expect(authHeader?.value).toBe('[REDACTED]');
      
      const contentTypeHeader = entry.request.headers.find(h => h.name === 'content-type');
      expect(contentTypeHeader?.value).toBe('application/json');

      // Check request body sanitization
      expect(entry.request.postData?.text).toContain('"password":"[REDACTED]"');
      expect(entry.request.postData?.text).toContain('"email": "user@example.com"');

      // Check response header sanitization
      const responseAuthHeader = entry.response.headers.find(h => h.name === 'x-auth-token');
      expect(responseAuthHeader?.value).toBe('[REDACTED]');

      // Check response body sanitization
      expect(entry.response.content.text).toContain('"token":"[REDACTED]"');
      expect(entry.response.content.text).toContain('"user_id": 456');
    });

    it('should preserve non-sensitive data during sanitization', () => {
      const events: NetworkEvent[] = [
        {
          id: 'test2',
          type: 'xhr',
          method: 'GET',
          url: 'https://api.example.com/users?page=1&limit=10',
          timestamp: Date.now(),
          requestHeaders: {
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0'
          },
          responseBody: '{"users": [{"id": 1, "name": "John"}], "total": 100}',
          status: 200,
          statusText: 'OK'
        }
      ];

      const har = convertToHAR(events);
      const entry = har.log.entries[0];

      // Non-sensitive data should be preserved
      expect(entry.request.url).toBe('https://api.example.com/users?page=1&limit=10');
      expect(entry.response.content.text).toBe('{"users": [{"id": 1, "name": "John"}], "total": 100}');
      
      const acceptHeader = entry.request.headers.find(h => h.name === 'accept');
      expect(acceptHeader?.value).toBe('application/json');
    });

    it('should handle events with missing optional properties', () => {
      const events: NetworkEvent[] = [
        {
          id: 'test3',
          type: 'websocket',
          method: 'CONNECT',
          url: 'wss://api.example.com/socket',
          timestamp: Date.now(),
          requestHeaders: {}
        }
      ];

      const har = convertToHAR(events);
      const entry = har.log.entries[0];

      expect(entry.request.url).toBe('wss://api.example.com/socket');
      expect(entry.request.headers).toEqual([]);
      expect(entry.response.status).toBe(0);
    });
  });
});