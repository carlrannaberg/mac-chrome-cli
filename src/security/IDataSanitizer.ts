export interface IDataSanitizer {
  sanitizeHeaders(headers: Record<string, string>): Record<string, string>;
  sanitizeBody(body: string, contentType?: string): string;
  sanitizeUrl(url: string): string;
}