import type { IDataSanitizer } from './IDataSanitizer.js';

export class NetworkDataSanitizer implements IDataSanitizer {
  private readonly sensitivePatterns = [
    { pattern: /authorization:\s*[^\s,}]+/gi, replacement: 'authorization: [REDACTED]' },
    { pattern: /"password"\s*:\s*"[^"]*"/g, replacement: '"password":"[REDACTED]"' },
    { pattern: /(api[_-]key)\s*[:=]\s*"?[^"&,}\s]+/gi, replacement: '$1=[REDACTED]' },
    { pattern: /token\s*[:=]\s*"?[^"&,}\s]+/gi, replacement: 'token=[REDACTED]' },
    { pattern: /"token"\s*:\s*"[^"]*"/g, replacement: '"token":"[REDACTED]"' }
  ];
  
  sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const header of sensitiveHeaders) {
      if (header in sanitized) {
        sanitized[header] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  
  sanitizeBody(body: string, _contentType?: string): string {
    let sanitized = body;
    for (const { pattern, replacement } of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }
  
  sanitizeUrl(url: string): string {
    try {
      let sanitized = url;
      const sensitiveParams = ['api_key', 'token', 'auth', 'password'];
      
      for (const param of sensitiveParams) {
        // Match parameter=value patterns in URLs
        const pattern = new RegExp(`(${param})=([^&]+)`, 'g');
        sanitized = sanitized.replace(pattern, `$1=[REDACTED]`);
      }
      
      return sanitized;
    } catch {
      return url;
    }
  }
}