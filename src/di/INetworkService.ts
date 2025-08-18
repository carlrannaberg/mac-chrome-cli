/**
 * Network Service Interface
 * Provides network monitoring and management functionality
 */

export interface NetworkEvent {
  id: string;
  type: 'request' | 'response' | 'error';
  timestamp: number;
  url: string;
  method?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  size?: number;
  duration?: number;
  error?: string;
}

export interface NetworkStats {
  totalRequests: number;
  totalResponses: number;
  totalErrors: number;
  averageResponseTime: number;
  totalBytesTransferred: number;
  activeConnections: number;
}

export interface NetworkMonitoringOptions {
  maxEvents?: number;
  bodyPreviewLimit?: number;
  includeHeaders?: boolean;
  includeBodies?: boolean;
}

export interface INetworkService {
  /**
   * Start network monitoring
   */
  startMonitoring(options?: NetworkMonitoringOptions): Promise<boolean>;
  
  /**
   * Stop network monitoring
   */
  stopMonitoring(): Promise<boolean>;
  
  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean;
  
  /**
   * Get captured network events
   */
  getEvents(): NetworkEvent[];
  
  /**
   * Clear captured events
   */
  clearEvents(): void;
  
  /**
   * Get network statistics
   */
  getStats(): NetworkStats;
  
  /**
   * Export events in HAR format
   */
  exportToHAR(): unknown;
}
