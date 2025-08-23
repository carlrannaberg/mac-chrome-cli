/**
 * Network Service Implementation
 * Provides network monitoring and management functionality using existing netlog infrastructure
 */

import { 
  INetworkService, 
  NetworkEvent as INetworkEvent, 
  NetworkStats, 
  NetworkMonitoringOptions 
} from '../INetworkService.js';
import { 
  startNetworkMonitoring, 
  stopNetworkMonitoring, 
  dumpNetworkLog, 
  clearNetworkLog, 
  convertToHAR,
  NetworkEvent as NetlogEvent,
  NetworkLogState
} from '../../commands/netlog.js';

/**
 * NetworkService implementation that wraps the existing netlog functionality
 */
export class NetworkService implements INetworkService {
  private monitoringActive = false;

  /**
   * Start network monitoring
   */
  async startMonitoring(options: NetworkMonitoringOptions = {}): Promise<boolean> {
    try {
      const result = await startNetworkMonitoring({
        maxEvents: options.maxEvents,
        bodyPreviewLimit: options.bodyPreviewLimit
      });

      if (result.success) {
        this.monitoringActive = true;
      }

      return result.success;
    } catch (error) {
      this.monitoringActive = false;
      return false;
    }
  }

  /**
   * Stop network monitoring
   */
  async stopMonitoring(): Promise<boolean> {
    try {
      const result = await stopNetworkMonitoring();
      
      if (result.success) {
        this.monitoringActive = false;
      }

      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.monitoringActive;
  }

  /**
   * Get captured network events
   */
  getEvents(): INetworkEvent[] {
    // This method would typically be synchronous, but we need to call the async dump
    // For now, return an empty array and suggest using getEventsAsync() instead
    return [];
  }

  /**
   * Get captured network events (async version)
   */
  async getEventsAsync(): Promise<INetworkEvent[]> {
    try {
      const result = await dumpNetworkLog();
      
      if (!result.success || !result.data) {
        return [];
      }

      // Convert netlog events to INetworkService format
      return result.data.events.map(this.convertNetlogEventToServiceEvent);
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear captured events
   */
  clearEvents(): void {
    // This is async in the underlying implementation
    clearNetworkLog().catch(() => {
      // Silently handle errors in fire-and-forget operation
    });
  }

  /**
   * Clear captured events (async version)
   */
  async clearEventsAsync(): Promise<boolean> {
    try {
      const result = await clearNetworkLog();
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    // This would typically be synchronous, but requires async data fetch
    // Return default stats for synchronous interface
    return {
      totalRequests: 0,
      totalResponses: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      totalBytesTransferred: 0,
      activeConnections: 0
    };
  }

  /**
   * Get network statistics (async version)
   */
  async getStatsAsync(): Promise<NetworkStats> {
    try {
      const result = await dumpNetworkLog();
      
      if (!result.success || !result.data) {
        return this.getStats(); // Return default stats
      }

      const events = result.data.events;
      const requests = events.length;
      const responses = events.filter(e => e.status && e.status > 0).length;
      const errors = events.filter(e => e.error || (e.status && e.status >= 400)).length;
      
      const responseTimes = events
        .map(e => e.timing?.duration)
        .filter((duration): duration is number => typeof duration === 'number');
      
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      // Estimate total bytes (rough calculation)
      const totalBytesTransferred = events.reduce((total, event) => {
        let bytes = 0;
        if (event.requestBody) bytes += event.requestBody.length;
        if (event.responseBody) bytes += event.responseBody.length;
        return total + bytes;
      }, 0);

      return {
        totalRequests: requests,
        totalResponses: responses,
        totalErrors: errors,
        averageResponseTime,
        totalBytesTransferred,
        activeConnections: this.monitoringActive ? 1 : 0
      };
    } catch (error) {
      return this.getStats(); // Return default stats on error
    }
  }

  /**
   * Export events in HAR format
   */
  exportToHAR(): unknown {
    // This requires async data fetch, so return null for sync interface
    return null;
  }

  /**
   * Export events in HAR format (async version)
   */
  async exportToHARAsync(): Promise<unknown> {
    try {
      const result = await dumpNetworkLog();
      
      if (!result.success || !result.data) {
        return null;
      }

      return convertToHAR(result.data.events);
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert netlog event format to INetworkService event format
   */
  private convertNetlogEventToServiceEvent(netlogEvent: NetlogEvent): INetworkEvent {
    return {
      id: netlogEvent.id,
      type: this.mapEventType(netlogEvent.type),
      timestamp: netlogEvent.timestamp,
      url: netlogEvent.url,
      method: netlogEvent.method,
      statusCode: netlogEvent.status,
      headers: {
        ...netlogEvent.requestHeaders,
        ...netlogEvent.responseHeaders
      },
      body: netlogEvent.requestBody || netlogEvent.responseBody,
      size: this.calculateEventSize(netlogEvent),
      duration: netlogEvent.timing?.duration,
      error: netlogEvent.error
    };
  }

  /**
   * Map netlog event type to INetworkService event type
   */
  private mapEventType(netlogType: string): 'request' | 'response' | 'error' {
    if (netlogType === 'websocket') return 'request';
    return netlogType as 'request' | 'response' | 'error';
  }

  /**
   * Calculate approximate size of network event
   */
  private calculateEventSize(event: NetlogEvent): number {
    let size = 0;
    if (event.requestBody) size += event.requestBody.length;
    if (event.responseBody) size += event.responseBody.length;
    return size;
  }
}