import { execWithTimeout } from '../lib/util.js';

// Network event types
export type NetworkEventType = 'fetch' | 'xhr' | 'websocket';

export interface NetworkEvent {
  id: string;
  type: NetworkEventType;
  method: string;
  url: string;
  timestamp: number;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  status?: number;
  statusText?: string;
  timing?: {
    startTime: number;
    responseStart?: number;
    responseEnd?: number;
    duration?: number;
  };
  error?: string;
}

export interface NetworkLogState {
  isActive: boolean;
  events: NetworkEvent[];
  maxEvents: number;
  bodyPreviewLimit: number;
}

export interface NetworkLogOptions {
  maxEvents?: number;
  bodyPreviewLimit?: number;
}

export interface HAR {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HAREntry[];
  };
}

export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
    headersSize: number;
    bodySize: number;
  };
  cache: Record<string, unknown>;
  timings: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send?: number;
    wait?: number;
    receive?: number;
    ssl?: number;
  };
}

// JavaScript code to inject into the browser page
const NETWORK_HOOK_SCRIPT = `
(function() {
  'use strict';
  
  // Initialize network log storage
  if (!window.__netlog) {
    window.__netlog = {
      isActive: false,
      events: [],
      maxEvents: 100,
      bodyPreviewLimit: 2048,
      eventCounter: 0
    };
  }
  
  const netlog = window.__netlog;
  
  // Utility functions
  function generateEventId() {
    return 'evt_' + (++netlog.eventCounter);
  }
  
  function truncateBody(body, limit) {
    if (!body) return undefined;
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    return str.length > limit ? str.substring(0, limit) + '...[truncated]' : str;
  }
  
  function addEvent(event) {
    if (!netlog.isActive) return;
    
    // Add to circular buffer
    if (netlog.events.length >= netlog.maxEvents) {
      netlog.events.shift();
    }
    netlog.events.push(event);
  }
  
  function headersToObject(headers) {
    const result = {};
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (headers && typeof headers === 'object') {
      Object.assign(result, headers);
    }
    return result;
  }
  
  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalWebSocket = window.WebSocket;
  
  // Fetch hook
  window.fetch = function(input, init = {}) {
    const eventId = generateEventId();
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';
    const startTime = performance.now();
    
    const event = {
      id: eventId,
      type: 'fetch',
      method: method.toUpperCase(),
      url: url,
      timestamp: Date.now(),
      requestHeaders: headersToObject(init.headers),
      requestBody: truncateBody(init.body, netlog.bodyPreviewLimit),
      timing: {
        startTime: startTime
      }
    };
    
    addEvent(event);
    
    return originalFetch.call(this, input, init)
      .then(response => {
        const responseEnd = performance.now();
        event.status = response.status;
        event.statusText = response.statusText;
        event.responseHeaders = headersToObject(response.headers);
        event.timing.responseStart = responseEnd;
        event.timing.responseEnd = responseEnd;
        event.timing.duration = responseEnd - startTime;
        
        // Clone response to read body without consuming it
        const responseClone = response.clone();
        responseClone.text().then(text => {
          event.responseBody = truncateBody(text, netlog.bodyPreviewLimit);
        }).catch(() => {
          event.responseBody = '[Unable to read response body]';
        });
        
        return response;
      })
      .catch(error => {
        const responseEnd = performance.now();
        event.error = error.message;
        event.timing.responseEnd = responseEnd;
        event.timing.duration = responseEnd - startTime;
        throw error;
      });
  };
  
  // XMLHttpRequest hooks
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this.__netlog_eventId = generateEventId();
    this.__netlog_method = method.toUpperCase();
    this.__netlog_url = url;
    this.__netlog_startTime = performance.now();
    this.__netlog_requestHeaders = {};
    
    return originalXHROpen.call(this, method, url, async, user, password);
  };
  
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (this.__netlog_requestHeaders) {
      this.__netlog_requestHeaders[header] = value;
    }
    return originalSetRequestHeader.call(this, header, value);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (this.__netlog_eventId) {
      const event = {
        id: this.__netlog_eventId,
        type: 'xhr',
        method: this.__netlog_method,
        url: this.__netlog_url,
        timestamp: Date.now(),
        requestHeaders: this.__netlog_requestHeaders || {},
        requestBody: truncateBody(data, netlog.bodyPreviewLimit),
        timing: {
          startTime: this.__netlog_startTime
        }
      };
      
      addEvent(event);
      
      // Hook response
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function() {
        if (this.readyState === XMLHttpRequest.DONE) {
          const responseEnd = performance.now();
          event.status = this.status;
          event.statusText = this.statusText;
          event.responseHeaders = {};
          
          // Parse response headers
          const headerString = this.getAllResponseHeaders();
          if (headerString) {
            headerString.split('\\r\\n').forEach(line => {
              const index = line.indexOf(':');
              if (index > 0) {
                const key = line.substring(0, index).trim();
                const value = line.substring(index + 1).trim();
                event.responseHeaders[key] = value;
              }
            });
          }
          
          event.responseBody = truncateBody(this.responseText, netlog.bodyPreviewLimit);
          event.timing.responseEnd = responseEnd;
          event.timing.duration = responseEnd - this.__netlog_startTime;
          
          if (this.status === 0 || this.status >= 400) {
            event.error = \`HTTP \${this.status} \${this.statusText}\`;
          }
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.call(this);
        }
      };
    }
    
    return originalXHRSend.call(this, data);
  };
  
  // WebSocket hook
  window.WebSocket = function(url, protocols) {
    const eventId = generateEventId();
    const startTime = performance.now();
    
    const event = {
      id: eventId,
      type: 'websocket',
      method: 'CONNECT',
      url: url,
      timestamp: Date.now(),
      requestHeaders: {},
      timing: {
        startTime: startTime
      }
    };
    
    addEvent(event);
    
    const ws = new originalWebSocket(url, protocols);
    
    ws.addEventListener('open', () => {
      const responseEnd = performance.now();
      event.status = 101;
      event.statusText = 'Switching Protocols';
      event.timing.responseEnd = responseEnd;
      event.timing.duration = responseEnd - startTime;
    });
    
    ws.addEventListener('error', (error) => {
      const responseEnd = performance.now();
      event.error = 'WebSocket connection failed';
      event.timing.responseEnd = responseEnd;
      event.timing.duration = responseEnd - startTime;
    });
    
    return ws;
  };
  
  // Copy static properties
  Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  Object.defineProperty(window.WebSocket, 'prototype', {
    value: originalWebSocket.prototype,
    writable: false
  });
  
  // Expose control functions
  window.__netlog.start = function(options = {}) {
    netlog.isActive = true;
    netlog.maxEvents = options.maxEvents || 100;
    netlog.bodyPreviewLimit = options.bodyPreviewLimit || 2048;
    netlog.events = [];
    netlog.eventCounter = 0;
  };
  
  window.__netlog.stop = function() {
    netlog.isActive = false;
  };
  
  window.__netlog.dump = function() {
    return {
      isActive: netlog.isActive,
      events: netlog.events.slice(),
      maxEvents: netlog.maxEvents,
      bodyPreviewLimit: netlog.bodyPreviewLimit
    };
  };
  
  window.__netlog.clear = function() {
    netlog.events = [];
    netlog.eventCounter = 0;
  };
  
})();
`;

/**
 * Execute AppleScript to inject network monitoring hooks
 */
async function executeAppleScript(script: string): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const result = await execWithTimeout('osascript', ['-e', script], 10000);
    return {
      success: result.success,
      result: result.stdout,
      ...(result.stderr && { error: result.stderr })
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Inject network monitoring hooks into the active Chrome tab
 */
async function injectNetworkHooks(): Promise<{ success: boolean; error?: string }> {
  const script = `
tell application "Google Chrome"
  if not running then
    return "Chrome is not running"
  end if
  
  if (count of windows) = 0 then
    return "No Chrome windows open"
  end if
  
  set activeTab to active tab of front window
  
  try
    execute activeTab javascript "${NETWORK_HOOK_SCRIPT.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
    return "Network hooks injected successfully"
  on error errorMessage
    return "Failed to inject hooks: " & errorMessage
  end try
end tell
`;

  const result = await executeAppleScript(script);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to execute AppleScript'
    };
  }
  
  if (result.result?.includes('Failed to inject hooks')) {
    return {
      success: false,
      error: result.result
    };
  }
  
  return { success: true };
}

/**
 * Execute JavaScript in the active Chrome tab
 */
async function executeJavaScript(jsCode: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const script = `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  if (count of windows) = 0 then
    return "ERROR: No Chrome windows open"
  end if
  
  set activeTab to active tab of front window
  
  try
    set result to execute activeTab javascript "${jsCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
    return "SUCCESS:" & result
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell
`;

  const result = await executeAppleScript(script);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to execute AppleScript'
    };
  }
  
  if (result.result?.startsWith('ERROR:')) {
    return {
      success: false,
      error: result.result.substring(6)
    };
  }
  
  if (result.result?.startsWith('SUCCESS:')) {
    const jsonResult = result.result.substring(8);
    try {
      return {
        success: true,
        result: JSON.parse(jsonResult)
      };
    } catch {
      return {
        success: true,
        result: jsonResult
      };
    }
  }
  
  return {
    success: true,
    result: result.result
  };
}

/**
 * Start network monitoring
 */
export async function startNetworkMonitoring(options: NetworkLogOptions = {}): Promise<{ success: boolean; error?: string }> {
  // First inject the hooks
  const injectResult = await injectNetworkHooks();
  if (!injectResult.success) {
    return injectResult;
  }
  
  // Start monitoring with options
  const startScript = `
if (window.__netlog) {
  window.__netlog.start({
    maxEvents: ${options.maxEvents || 100},
    bodyPreviewLimit: ${options.bodyPreviewLimit || 2048}
  });
  JSON.stringify({ success: true, message: 'Network monitoring started' });
} else {
  JSON.stringify({ success: false, error: 'Network hooks not available' });
}
`;

  const result = await executeJavaScript(startScript);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to start network monitoring'
    };
  }
  
  const response = result.result as { success: boolean; error?: string };
  return response;
}

/**
 * Stop network monitoring
 */
export async function stopNetworkMonitoring(): Promise<{ success: boolean; error?: string }> {
  const stopScript = `
if (window.__netlog) {
  window.__netlog.stop();
  JSON.stringify({ success: true, message: 'Network monitoring stopped' });
} else {
  JSON.stringify({ success: false, error: 'Network hooks not available' });
}
`;

  const result = await executeJavaScript(stopScript);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to stop network monitoring'
    };
  }
  
  const response = result.result as { success: boolean; error?: string };
  return response;
}

/**
 * Dump network monitoring data
 */
export async function dumpNetworkLog(): Promise<{ success: boolean; data?: NetworkLogState; error?: string }> {
  const dumpScript = `
if (window.__netlog) {
  JSON.stringify(window.__netlog.dump());
} else {
  JSON.stringify({ success: false, error: 'Network hooks not available' });
}
`;

  const result = await executeJavaScript(dumpScript);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to dump network log'
    };
  }
  
  try {
    const data = result.result as NetworkLogState;
    if ('success' in data && !data.success) {
      const errorData = data as { success: boolean; error?: string };
      return {
        success: false,
        error: errorData.error || 'Unknown error'
      };
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse network log data: ${error}`
    };
  }
}

/**
 * Convert network events to HAR format
 */
export function convertToHAR(events: NetworkEvent[]): HAR {
  const entries: HAREntry[] = events.map(event => {
    const startedDateTime = new Date(event.timestamp).toISOString();
    const time = event.timing?.duration || 0;
    
    // Parse query string from URL
    const url = new URL(event.url, 'http://localhost');
    const queryString = Array.from(url.searchParams.entries()).map(([name, value]) => ({
      name,
      value
    }));
    
    // Convert headers to HAR format
    const requestHeaders = Object.entries(event.requestHeaders).map(([name, value]) => ({
      name,
      value
    }));
    
    const responseHeaders = Object.entries(event.responseHeaders || {}).map(([name, value]) => ({
      name,
      value
    }));
    
    const entry: HAREntry = {
      startedDateTime,
      time,
      request: {
        method: event.method,
        url: event.url,
        httpVersion: 'HTTP/1.1',
        headers: requestHeaders,
        queryString,
        headersSize: requestHeaders.reduce((sum, h) => sum + h.name.length + h.value.length + 4, 0),
        bodySize: event.requestBody ? event.requestBody.length : 0
      },
      response: {
        status: event.status || 0,
        statusText: event.statusText || '',
        httpVersion: 'HTTP/1.1',
        headers: responseHeaders,
        content: {
          size: event.responseBody ? event.responseBody.length : 0,
          mimeType: responseHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || 'text/plain',
          ...(event.responseBody && { text: event.responseBody })
        },
        headersSize: responseHeaders.reduce((sum, h) => sum + h.name.length + h.value.length + 4, 0),
        bodySize: event.responseBody ? event.responseBody.length : 0
      },
      cache: {},
      timings: {
        send: 0,
        wait: event.timing?.duration || 0,
        receive: 0
      }
    };
    
    // Add POST data if available
    if (event.requestBody && (event.method === 'POST' || event.method === 'PUT' || event.method === 'PATCH')) {
      entry.request.postData = {
        mimeType: requestHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || 'text/plain',
        text: event.requestBody
      };
    }
    
    return entry;
  });
  
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'mac-chrome-cli',
        version: '1.0.0'
      },
      entries
    }
  };
}

/**
 * Clear network monitoring data
 */
export async function clearNetworkLog(): Promise<{ success: boolean; error?: string }> {
  const clearScript = `
if (window.__netlog) {
  window.__netlog.clear();
  JSON.stringify({ success: true, message: 'Network log cleared' });
} else {
  JSON.stringify({ success: false, error: 'Network hooks not available' });
}
`;

  const result = await executeJavaScript(clearScript);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to clear network log'
    };
  }
  
  const response = result.result as { success: boolean; error?: string };
  return response;
}