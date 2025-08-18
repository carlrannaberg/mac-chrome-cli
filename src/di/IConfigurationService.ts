/**
 * Configuration Service Interface
 * Provides application configuration management
 */

export interface GlobalConfiguration {
  timeout: number;
  previewMaxBytes: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  maxCacheSize: number;
  networkMonitoring: {
    maxEvents: number;
    bodyPreviewLimit: number;
    includeHeaders: boolean;
    includeBodies: boolean;
  };
  performance: {
    benchmarkEnabled: boolean;
    maxBenchmarks: number;
  };
  logging: {
    level: string;
    enableConsole: boolean;
    enableFile: boolean;
    maxEntries: number;
  };
}

export interface IConfigurationService {
  /**
   * Get configuration value by key path
   */
  get<T>(keyPath: string): T | undefined;
  
  /**
   * Set configuration value by key path
   */
  set<T>(keyPath: string, value: T): void;
  
  /**
   * Check if configuration key exists
   */
  has(keyPath: string): boolean;
  
  /**
   * Get all configuration
   */
  getAll(): GlobalConfiguration;
  
  /**
   * Reset to default configuration
   */
  reset(): void;
  
  /**
   * Load configuration from file
   */
  loadFromFile(filePath: string): Promise<boolean>;
  
  /**
   * Save configuration to file
   */
  saveToFile(filePath: string): Promise<boolean>;
}
