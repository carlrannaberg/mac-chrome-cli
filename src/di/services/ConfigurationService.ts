/**
 * Configuration Service Implementation
 * Provides hierarchical configuration management with defaults
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { IConfigurationService, GlobalConfiguration } from '../IConfigurationService.js';

export class ConfigurationService implements IConfigurationService {
  private config: GlobalConfiguration;
  private readonly defaultConfig: GlobalConfiguration = {
    timeout: 30000,
    previewMaxBytes: 1572864, // 1.5MB
    cacheEnabled: true,
    cacheTTL: 900000, // 15 minutes
    maxCacheSize: 100,
    networkMonitoring: {
      maxEvents: 100,
      bodyPreviewLimit: 2048,
      includeHeaders: true,
      includeBodies: false
    },
    performance: {
      benchmarkEnabled: true,
      maxBenchmarks: 1000
    },
    logging: {
      level: 'INFO',
      enableConsole: true,
      enableFile: false,
      maxEntries: 1000,
      enableCorrelationIds: true,
      enableJson: false,
      enablePerformanceLogging: true
    }
  };

  constructor(initialConfig?: Partial<GlobalConfiguration>) {
    this.config = { ...this.defaultConfig, ...initialConfig };
  }

  /**
   * Get configuration value by key path (e.g., 'networkMonitoring.maxEvents')
   */
  get<T>(keyPath: string): T | undefined {
    const keys = keyPath.split('.');
    let current: unknown = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current as T;
  }

  /**
   * Set configuration value by key path
   */
  set<T>(keyPath: string, value: T): void {
    const keys = keyPath.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    // Navigate to the parent of the target key
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue; // Skip empty keys
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    // Set the value
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * Check if configuration key exists
   */
  has(keyPath: string): boolean {
    return this.get(keyPath) !== undefined;
  }

  /**
   * Get all configuration
   */
  getAll(): GlobalConfiguration {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...this.defaultConfig };
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(filePath);
      const configData = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(configData) as Partial<GlobalConfiguration>;
      
      // Merge with current config
      this.config = { ...this.config, ...parsed };
      return true;
    } catch (error) {
      // Note: Can't use logger here as it may not be initialized yet during startup
      return false;
    }
  }

  /**
   * Save configuration to file
   */
  async saveToFile(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(filePath);
      const configData = JSON.stringify(this.config, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(resolvedPath, configData, 'utf-8');
      return true;
    } catch (error) {
      // Note: Can't use logger here as it may not be initialized yet during startup
      return false;
    }
  }
}
