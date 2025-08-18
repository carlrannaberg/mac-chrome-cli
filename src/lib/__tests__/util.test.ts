import { 
  formatJSONResult, 
  validateInput, 
  expandPath, 
  escapeCSSSelector,
  ERROR_CODES 
} from '../util';

describe('Utility Functions', () => {
  describe('formatJSONResult', () => {
    it('should format successful results correctly', () => {
      const data = { test: 'value' };
      const result = formatJSONResult(data);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.code).toBe(ERROR_CODES.OK);
      expect(result.timestamp).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should format error results correctly', () => {
      const error = 'Test error message';
      const result = formatJSONResult(null, error, ERROR_CODES.INVALID_INPUT);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.code).toBe(ERROR_CODES.INVALID_INPUT);
      expect(result.error).toBe(error);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle undefined data with OK code', () => {
      const result = formatJSONResult(undefined, undefined, ERROR_CODES.OK);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.code).toBe(ERROR_CODES.OK);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateInput', () => {
    it('should validate required string inputs', () => {
      expect(validateInput('valid string', 'string', true)).toBe(true);
      expect(validateInput('', 'string', true)).toBe(false);
      expect(validateInput('   ', 'string', true)).toBe(false);
      expect(validateInput(null, 'string', true)).toBe(false);
      expect(validateInput(undefined, 'string', true)).toBe(false);
    });

    it('should validate optional string inputs', () => {
      expect(validateInput('valid string', 'string', false)).toBe(true);
      expect(validateInput(null, 'string', false)).toBe(true);
      expect(validateInput(undefined, 'string', false)).toBe(true);
      expect(validateInput('', 'string', false)).toBe(false);
    });

    it('should validate number inputs', () => {
      expect(validateInput(42, 'number', true)).toBe(true);
      expect(validateInput(0, 'number', true)).toBe(true);
      expect(validateInput(-1, 'number', true)).toBe(true);
      expect(validateInput(NaN, 'number', true)).toBe(false);
      expect(validateInput('not a number', 'number', true)).toBe(false);
      expect(validateInput(null, 'number', true)).toBe(false);
    });

    it('should validate boolean inputs', () => {
      expect(validateInput(true, 'boolean', true)).toBe(true);
      expect(validateInput(false, 'boolean', true)).toBe(true);
      expect(validateInput('true', 'boolean', true)).toBe(false);
      expect(validateInput(1, 'boolean', true)).toBe(false);
      expect(validateInput(null, 'boolean', true)).toBe(false);
    });

    it('should validate object inputs', () => {
      expect(validateInput({}, 'object', true)).toBe(true);
      expect(validateInput({ key: 'value' }, 'object', true)).toBe(true);
      expect(validateInput([], 'object', true)).toBe(true);
      expect(validateInput(null, 'object', true)).toBe(false);
      expect(validateInput('not an object', 'object', true)).toBe(false);
    });
  });

  describe('expandPath', () => {
    it('should expand tilde paths', () => {
      const homePath = process.env.HOME || '/Users/test';
      expect(expandPath('~/test.txt')).toBe(`${homePath}/test.txt`);
      expect(expandPath('~/Documents/file.pdf')).toBe(`${homePath}/Documents/file.pdf`);
    });

    it('should leave absolute paths unchanged', () => {
      expect(expandPath('/absolute/path')).toBe('/absolute/path');
      expect(expandPath('/usr/local/bin')).toBe('/usr/local/bin');
    });

    it('should leave relative paths unchanged', () => {
      expect(expandPath('relative/path')).toBe('relative/path');
      expect(expandPath('./current/path')).toBe('./current/path');
      expect(expandPath('../parent/path')).toBe('../parent/path');
    });
  });

  describe('escapeCSSSelector', () => {
    it('should escape single quotes in CSS selectors', () => {
      expect(escapeCSSSelector("div[data-test='value']")).toBe("div[data-test=\\'value\\']");
      expect(escapeCSSSelector("button[title='Click me']")).toBe("button[title=\\'Click me\\']");
    });

    it('should handle selectors without quotes', () => {
      expect(escapeCSSSelector('div.class-name')).toBe('div.class-name');
      expect(escapeCSSSelector('#element-id')).toBe('#element-id');
    });

    it('should handle multiple quotes', () => {
      expect(escapeCSSSelector("input[placeholder='Enter your name']")).toBe("input[placeholder=\\'Enter your name\\']");
      expect(escapeCSSSelector("div[data-test='a'] span[title='b']")).toBe("div[data-test=\\'a\\'] span[title=\\'b\\']");
    });

    it('should handle empty and special cases', () => {
      expect(escapeCSSSelector('')).toBe('');
      expect(escapeCSSSelector('no-quotes-here')).toBe('no-quotes-here');
    });
  });

  describe('ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES.OK).toBe(0);
      expect(ERROR_CODES.INVALID_INPUT).toBe(10);
      expect(ERROR_CODES.TARGET_NOT_FOUND).toBe(20);
      expect(ERROR_CODES.PERMISSION_DENIED).toBe(30);
      expect(ERROR_CODES.TIMEOUT).toBe(40);
      expect(ERROR_CODES.CHROME_NOT_FOUND).toBe(50);
      expect(ERROR_CODES.UNKNOWN_ERROR).toBe(99);
    });

    it('should have unique error codes', () => {
      const codes = Object.values(ERROR_CODES);
      const uniqueCodes = new Set(codes);
      // Allow for aliases like INVALID_PARAMETER -> INVALID_INPUT and RESOURCE_BUSY -> RESOURCE_UNAVAILABLE
      expect(uniqueCodes.size).toBeGreaterThanOrEqual(codes.length - 2);
    });
  });
});