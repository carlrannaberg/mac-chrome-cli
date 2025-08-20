import { Result, mapError } from '../core/index.js';
import { executeWithContext } from '../core/ErrorUtils.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Get package.json path relative to project root
function getPackageJsonPath(): string {
  // Since this is compiled to dist/commands/meta.js, 
  // package.json is at ../../package.json from there
  // Use import.meta.url to get the actual location of this module
  const currentModuleDir = new URL('.', import.meta.url).pathname;
  // Go up two directories from dist/commands/ to get to project root
  return join(currentModuleDir, '..', '..', 'package.json');
}

export interface MetaInfo {
  version: string;
  name: string;
  description: string;
  platform: {
    node: string;
    os: string;
    arch: string;
    macosVersion: string | undefined;
    macosMinimum: string;
  };
  capabilities: string[];
  repository: string;
  license: string;
  dependencies: {
    external: ExternalDependency[];
    node: string;
  };
}

export interface CommandInfo {
  name: string;
  description: string;
  category: string;
  options?: CommandOption[];
  examples?: string[];
  permissions: string[];
  subcommands?: CommandInfo[];
}

export interface CommandOption {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
  default?: string | number | boolean;
}

export interface ExternalDependency {
  name: string;
  description: string;
  required: boolean;
  installCommand?: string;
  validateCommand?: string;
}

export interface PermissionInfo {
  name: string;
  description: string;
  required: boolean;
  purpose: string[];
  commands: string[];
  setupInstructions: string;
}

/**
 * Get package.json information
 */
function getPackageInfo(): { name: string; version: string; description: string; repository: string; license: string } {
  try {
    // Try to read package.json from the project root
    const packagePath = getPackageJsonPath();
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    
    return {
      name: packageJson.name || 'mac-chrome-cli',
      version: packageJson.version || '1.0.0',
      description: packageJson.description || 'Command-line interface for controlling Google Chrome on macOS',
      repository: typeof packageJson.repository === 'string' 
        ? packageJson.repository 
        : packageJson.repository?.url || 'https://github.com/carlrannaberg/mac-chrome-cli',
      license: packageJson.license || 'ISC'
    };
  } catch {
    // Fallback values if package.json can't be read
    return {
      name: 'mac-chrome-cli',
      version: '1.0.0',
      description: 'Command-line interface for controlling Google Chrome on macOS',
      repository: 'https://github.com/carlrannaberg/mac-chrome-cli',
      license: 'ISC'
    };
  }
}

/**
 * Get complete command registry with detailed information
 */
function getCommandRegistry(): CommandInfo[] {
  return [
    // System Commands
    {
      name: 'doctor',
      description: 'Diagnose system setup and dependencies',
      category: 'System Diagnostics',
      permissions: ['accessibility', 'automation'],
      examples: ['mac-chrome-cli doctor']
    },
    {
      name: 'test',
      description: 'Test command to verify CLI is working',
      category: 'System Diagnostics',
      permissions: [],
      examples: ['mac-chrome-cli test']
    },
    
    // Navigation Commands
    {
      name: 'nav',
      description: 'Navigation and page control commands',
      category: 'Navigation',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'nav go',
          description: 'Navigate to URL',
          category: 'Navigation',
          permissions: ['automation'],
          options: [{
            name: '--url',
            type: 'string',
            required: true,
            description: 'URL to navigate to'
          }]
        },
        {
          name: 'nav reload',
          description: 'Reload current page',
          category: 'Navigation',
          permissions: ['automation'],
          options: [{
            name: '--hard',
            type: 'boolean',
            required: false,
            description: 'Perform hard reload (bypass cache)'
          }]
        },
        {
          name: 'nav back',
          description: 'Navigate back in history',
          category: 'Navigation',
          permissions: ['automation']
        },
        {
          name: 'nav forward',
          description: 'Navigate forward in history',
          category: 'Navigation',
          permissions: ['automation']
        }
      ]
    },
    
    // Tab Management
    {
      name: 'tab',
      description: 'Tab management commands',
      category: 'Tab Management',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'tab focus',
          description: 'Focus tab by match criteria',
          category: 'Tab Management',
          permissions: ['automation'],
          options: [{
            name: '--match',
            type: 'string',
            required: false,
            description: 'Pattern to match tab title or URL'
          }]
        }
      ]
    },
    
    // Screenshot Commands
    {
      name: 'shot',
      description: 'Screenshot capture commands',
      category: 'Screenshot Capture',
      permissions: ['screen-recording', 'automation'],
      subcommands: [
        {
          name: 'shot viewport',
          description: 'Capture viewport screenshot',
          category: 'Screenshot Capture',
          permissions: ['screen-recording', 'automation']
        },
        {
          name: 'shot window',
          description: 'Capture window screenshot',
          category: 'Screenshot Capture',
          permissions: ['screen-recording', 'automation']
        },
        {
          name: 'shot element',
          description: 'Capture element screenshot',
          category: 'Screenshot Capture',
          permissions: ['screen-recording', 'automation'],
          options: [{
            name: '--selector',
            type: 'string',
            required: true,
            description: 'CSS selector for element'
          }]
        }
      ]
    },
    
    // Mouse Commands
    {
      name: 'mouse',
      description: 'Mouse interaction commands',
      category: 'Input Control',
      permissions: ['accessibility', 'automation'],
      subcommands: [
        {
          name: 'mouse click',
          description: 'Click at coordinates or element',
          category: 'Input Control',
          permissions: ['accessibility', 'automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: false,
              description: 'CSS selector for element'
            },
            {
              name: '--x',
              type: 'number',
              required: false,
              description: 'X coordinate'
            },
            {
              name: '--y',
              type: 'number',
              required: false,
              description: 'Y coordinate'
            },
            {
              name: '--button',
              type: 'string',
              required: false,
              default: 'left',
              description: 'Mouse button (left|right|middle)'
            }
          ]
        },
        {
          name: 'mouse move',
          description: 'Move mouse to coordinates or element',
          category: 'Input Control',
          permissions: ['accessibility', 'automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: false,
              description: 'CSS selector for element'
            },
            {
              name: '--x',
              type: 'number',
              required: false,
              description: 'X coordinate'
            },
            {
              name: '--y',
              type: 'number',
              required: false,
              description: 'Y coordinate'
            }
          ]
        }
      ]
    },
    
    // Keyboard Commands
    {
      name: 'keyboard',
      description: 'Keyboard input commands',
      category: 'Input Control',
      permissions: ['accessibility', 'automation'],
      subcommands: [
        {
          name: 'keyboard type',
          description: 'Type text',
          category: 'Input Control',
          permissions: ['accessibility', 'automation'],
          options: [
            {
              name: '--text',
              type: 'string',
              required: true,
              description: 'Text to type'
            },
            {
              name: '--speed',
              type: 'number',
              required: false,
              default: 50,
              description: 'Delay between characters in ms'
            }
          ]
        },
        {
          name: 'keyboard keys',
          description: 'Send key combination',
          category: 'Input Control',
          permissions: ['accessibility', 'automation'],
          options: [{
            name: '--combo',
            type: 'string',
            required: true,
            description: 'Key combination (e.g., cmd+shift+r)'
          }]
        }
      ]
    },
    
    // Input Commands
    {
      name: 'input',
      description: 'Form input commands',
      category: 'Form Control',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'input fill',
          description: 'Fill input field',
          category: 'Form Control',
          permissions: ['automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: true,
              description: 'CSS selector for input'
            },
            {
              name: '--value',
              type: 'string',
              required: true,
              description: 'Value to fill'
            },
            {
              name: '--clear',
              type: 'boolean',
              required: false,
              description: 'Clear field before filling'
            }
          ]
        }
      ]
    },
    
    // DOM Commands
    {
      name: 'dom eval',
      description: 'Execute JavaScript in page context',
      category: 'DOM Evaluation',
      permissions: ['automation'],
      options: [
        {
          name: '--js',
          type: 'string',
          required: true,
          description: 'JavaScript code to execute'
        },
        {
          name: '--tab',
          type: 'number',
          required: false,
          default: 1,
          description: 'Tab index (1-based)'
        },
        {
          name: '--window',
          type: 'number',
          required: false,
          default: 1,
          description: 'Window index (1-based)'
        },
        {
          name: '--max-size',
          type: 'number',
          required: false,
          default: 1048576,
          description: 'Maximum result size in bytes'
        }
      ],
      examples: [
        'mac-chrome-cli dom eval --js "document.title"',
        'mac-chrome-cli dom eval --js "document.querySelectorAll(\'button\').length"'
      ]
    },
    
    // Wait Command
    {
      name: 'wait',
      description: 'Wait for specified duration',
      category: 'Utility Commands',
      permissions: [],
      options: [{
        name: '--ms',
        type: 'number',
        required: false,
        default: 800,
        description: 'Duration to wait in milliseconds'
      }],
      examples: ['mac-chrome-cli wait --ms 1000']
    },
    
    // Network Monitoring
    {
      name: 'netlog',
      description: 'Network monitoring and logging commands',
      category: 'Network Monitoring',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'netlog start',
          description: 'Start network monitoring',
          category: 'Network Monitoring',
          permissions: ['automation'],
          options: [
            {
              name: '--max-events',
              type: 'number',
              required: false,
              default: 100,
              description: 'Maximum number of events to store'
            },
            {
              name: '--body-limit',
              type: 'number',
              required: false,
              default: 2048,
              description: 'Maximum body preview size in bytes'
            }
          ]
        },
        {
          name: 'netlog stop',
          description: 'Stop network monitoring',
          category: 'Network Monitoring',
          permissions: ['automation']
        },
        {
          name: 'netlog dump',
          description: 'Dump captured network events',
          category: 'Network Monitoring',
          permissions: ['automation'],
          options: [{
            name: '--format',
            type: 'string',
            required: false,
            default: 'json',
            description: 'Output format (json|har)'
          }]
        },
        {
          name: 'netlog clear',
          description: 'Clear captured network events',
          category: 'Network Monitoring',
          permissions: ['automation']
        }
      ]
    },
    
    // Snapshot Commands
    {
      name: 'snapshot',
      description: 'Page structure extraction commands',
      category: 'Page Snapshots',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'snapshot outline',
          description: 'Capture flat list of interactive elements',
          category: 'Page Snapshots',
          permissions: ['automation'],
          options: [{
            name: '--visible-only',
            type: 'boolean',
            required: false,
            description: 'Only include visible elements'
          }]
        },
        {
          name: 'snapshot dom-lite',
          description: 'Capture pruned DOM hierarchy',
          category: 'Page Snapshots',
          permissions: ['automation'],
          options: [
            {
              name: '--max-depth',
              type: 'number',
              required: false,
              default: 10,
              description: 'Maximum traversal depth'
            },
            {
              name: '--visible-only',
              type: 'boolean',
              required: false,
              description: 'Only include visible elements'
            }
          ]
        }
      ]
    },
    
    // Scroll Commands
    {
      name: 'scroll',
      description: 'Page scrolling commands',
      category: 'Scrolling Control',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'scroll to',
          description: 'Scroll to element (centers in viewport)',
          category: 'Scrolling Control',
          permissions: ['automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: true,
              description: 'CSS selector for element'
            },
            {
              name: '--smooth',
              type: 'boolean',
              required: false,
              description: 'Use smooth scrolling animation'
            },
            {
              name: '--tab',
              type: 'number',
              required: false,
              default: 1,
              description: 'Tab index (1-based)'
            },
            {
              name: '--window',
              type: 'number',
              required: false,
              default: 1,
              description: 'Window index (1-based)'
            }
          ]
        },
        {
          name: 'scroll by',
          description: 'Scroll by pixel amount',
          category: 'Scrolling Control',
          permissions: ['automation'],
          options: [
            {
              name: '--px',
              type: 'number',
              required: true,
              description: 'Number of pixels to scroll'
            },
            {
              name: '--smooth',
              type: 'boolean',
              required: false,
              description: 'Use smooth scrolling animation'
            },
            {
              name: '--horizontal',
              type: 'boolean',
              required: false,
              description: 'Scroll horizontally instead of vertically'
            },
            {
              name: '--tab',
              type: 'number',
              required: false,
              default: 1,
              description: 'Tab index (1-based)'
            },
            {
              name: '--window',
              type: 'number',
              required: false,
              default: 1,
              description: 'Window index (1-based)'
            }
          ]
        },
        {
          name: 'scroll position',
          description: 'Get current scroll position',
          category: 'Scrolling Control',
          permissions: ['automation'],
          options: [
            {
              name: '--tab',
              type: 'number',
              required: false,
              default: 1,
              description: 'Tab index (1-based)'
            },
            {
              name: '--window',
              type: 'number',
              required: false,
              default: 1,
              description: 'Window index (1-based)'
            }
          ]
        }
      ]
    },
    
    // File Commands
    {
      name: 'files',
      description: 'File upload and management commands',
      category: 'File Operations',
      permissions: ['automation'],
      subcommands: [
        {
          name: 'files upload',
          description: 'Upload files to a file input element',
          category: 'File Operations',
          permissions: ['automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: true,
              description: 'CSS selector for file input element'
            },
            {
              name: '--path',
              type: 'string',
              required: true,
              description: 'File path or comma-separated paths for multiple files'
            },
            {
              name: '--multiple',
              type: 'boolean',
              required: false,
              description: 'Enable multiple file selection'
            }
          ]
        },
        {
          name: 'files dragdrop',
          description: 'Simulate drag and drop file upload to a dropzone',
          category: 'File Operations',
          permissions: ['automation'],
          options: [
            {
              name: '--selector',
              type: 'string',
              required: true,
              description: 'CSS selector for dropzone element'
            },
            {
              name: '--path',
              type: 'string',
              required: true,
              description: 'File path or comma-separated paths for multiple files'
            },
            {
              name: '--multiple',
              type: 'boolean',
              required: false,
              description: 'Enable multiple file selection'
            }
          ]
        }
      ]
    },
    
    // Meta Commands
    {
      name: 'meta',
      description: 'CLI information and statistics commands',
      category: 'System Diagnostics',
      permissions: [],
      subcommands: [
        {
          name: 'meta info',
          description: 'Show CLI version, capabilities, and implementation status',
          category: 'System Diagnostics',
          permissions: []
        },
        {
          name: 'meta stats',
          description: 'Show CLI runtime statistics and performance metrics',
          category: 'System Diagnostics',
          permissions: []
        },
        {
          name: 'meta commands',
          description: 'List all available commands with descriptions and status',
          category: 'System Diagnostics',
          permissions: []
        },
        {
          name: 'meta permissions',
          description: 'Show permission requirements for all features',
          category: 'System Diagnostics',
          permissions: []
        },
        {
          name: 'meta performance',
          description: 'Show performance statistics and optimization recommendations',
          category: 'System Diagnostics',
          permissions: []
        }
      ]
    }
  ];
}


/**
 * Get external dependencies
 */
function getExternalDependencies(): ExternalDependency[] {
  return [
    {
      name: 'Google Chrome',
      description: 'Google Chrome browser for automation',
      required: true,
      validateCommand: 'osascript -e "tell application \"Google Chrome\" to get version"'
    },
    {
      name: 'chrome-cli',
      description: 'Chrome CLI tool for advanced browser control',
      required: false,
      installCommand: 'brew install chrome-cli',
      validateCommand: 'which chrome-cli'
    },
    {
      name: 'cliclick',
      description: 'Command-line interface for mouse and keyboard control',
      required: false,
      installCommand: 'brew install cliclick',
      validateCommand: 'which cliclick'
    }
  ];
}

/**
 * Get permission requirements
 */
function getPermissionRequirements(): PermissionInfo[] {
  return [
    {
      name: 'accessibility',
      description: 'Accessibility permissions for UI element interaction',
      required: true,
      purpose: [
        'Interact with Chrome UI elements',
        'Simulate mouse and keyboard input',
        'Read page content and structure'
      ],
      commands: ['mouse', 'keyboard', 'input'],
      setupInstructions: 'System Settings > Privacy & Security > Accessibility > Add Terminal'
    },
    {
      name: 'automation',
      description: 'Automation permissions for controlling Chrome via AppleScript',
      required: true,
      purpose: [
        'Send AppleScript commands to Chrome',
        'Control browser navigation',
        'Execute JavaScript in page context',
        'Monitor network activity'
      ],
      commands: ['nav', 'dom', 'snapshot', 'scroll', 'files', 'netlog', 'tab'],
      setupInstructions: 'System Settings > Privacy & Security > Automation > Terminal > Google Chrome'
    },
    {
      name: 'screen-recording',
      description: 'Screen recording permissions for capturing screenshots',
      required: false,
      purpose: [
        'Capture viewport screenshots',
        'Capture window screenshots',
        'Capture element screenshots'
      ],
      commands: ['shot'],
      setupInstructions: 'System Settings > Privacy & Security > Screen Recording > Add Terminal'
    }
  ];
}

/**
 * Get system capabilities
 */
function getCapabilities(): string[] {
  return [
    'AppleScript automation for Chrome control',
    'JavaScript execution in browser context',
    'Network traffic monitoring and HAR export',
    'Page structure extraction and DOM analysis',
    'File upload automation (input and drag-drop)',
    'Scrolling control with smooth animations',
    'Cross-tab and cross-window support',
    'Timeout and error handling for all operations',
    'JSON output format for programmatic use',
    'Security validation for JavaScript execution',
    'Screenshot capture (requires screen recording permission)',
    'Mouse and keyboard simulation (requires accessibility permission)'
  ];
}

/**
 * Get macOS version information
 */
async function getMacOSVersion(): Promise<string | undefined> {
  try {
    const { execWithTimeout } = await import('../lib/util.js');
    const result = await execWithTimeout('sw_vers', ['-productVersion'], 5000);
    return result.success ? result.data.stdout.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get comprehensive meta information about the CLI
 * 
 * @throws {SYSTEM_ERROR} When unable to retrieve system information
 * @throws {FILE_READ_ERROR} When package.json cannot be read
 * @throws {TIMEOUT} When system command execution times out
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during information gathering
 */
export async function getMetaInfo(): Promise<Result<MetaInfo, string>> {
  const result = await executeWithContext(async () => {
    const packageInfo = getPackageInfo();
    const capabilities = getCapabilities();
    const dependencies = getExternalDependencies();
    const macosVersion = await getMacOSVersion();
    
    const metaInfo: MetaInfo = {
      version: packageInfo.version,
      name: packageInfo.name,
      description: packageInfo.description,
      platform: {
        node: process.version,
        os: `${process.platform} ${process.arch}`,
        arch: process.arch,
        macosVersion: macosVersion,
        macosMinimum: '10.15'
      },
      capabilities,
      repository: packageInfo.repository,
      license: packageInfo.license,
      dependencies: {
        external: dependencies,
        node: process.version
      }
    };

    return metaInfo;
  }, 'gather-meta-info');
  
  return mapError(result, (err) => err.message);
}

/**
 * Get detailed command information
 * 
 * @throws {SYSTEM_ERROR} When unable to retrieve command registry information
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during command information gathering
 */
export async function getCommands(): Promise<Result<CommandInfo[], string>> {
  const result = await executeWithContext(async () => {
    return getCommandRegistry();
  }, 'gather-command-info');
  
  return mapError(result, (err) => err.message);
}

/**
 * Get permission requirements
 * 
 * @throws {SYSTEM_ERROR} When unable to retrieve permission information
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during permission information gathering
 */
export async function getPermissions(): Promise<Result<PermissionInfo[], string>> {
  const result = await executeWithContext(async () => {
    return getPermissionRequirements();
  }, 'gather-permission-info');
  
  return mapError(result, (err) => err.message);
}

/**
 * Get CLI statistics and usage information
 */
export interface CliStats {
  uptime: number;
  startTime: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  processInfo: {
    pid: number;
    ppid: number;
    uid?: number | undefined;
    gid?: number | undefined;
  };
}

/**
 * Get CLI statistics and usage information
 * 
 * @throws {SYSTEM_ERROR} When unable to retrieve process information
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during statistics gathering  
 */
export async function getCliStats(): Promise<Result<CliStats, string>> {
  const result = await executeWithContext(async () => {
    const stats: CliStats = {
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      memoryUsage: process.memoryUsage(),
      processInfo: {
        pid: process.pid,
        ppid: process.ppid,
        uid: process.getuid?.(),
        gid: process.getgid?.()
      }
    };
    
    return stats;
  }, 'gather-cli-stats');
  
  return mapError(result, (err) => err.message);
}

/**
 * Performance statistics data structure
 */
export interface PerformanceStats {
  cacheStats: {
    scriptCache: { size: number; maxSize: number };
    coordsCache: { size: number; maxSize: number };
    webpCache: { size: number; maxSize: number };
  };
  connectionPool: { activeConnections: number; maxConnections: number };
  memory: {
    rss: number;
    heapTotal: number; 
    heapUsed: number;
    external: number;
  };
}

/**
 * Performance information result
 */
export interface PerformanceInfo {
  stats: PerformanceStats;
  recommendations: string[];
  timestamp: string;
}

/**
 * Get performance statistics and recommendations
 * 
 * @throws {SYSTEM_ERROR} When unable to retrieve performance statistics
 * @throws {UNKNOWN_ERROR} When unexpected errors occur during performance information gathering
 */
export async function getPerformanceInfo(): Promise<Result<PerformanceInfo, string>> {
  const result = await executeWithContext(async () => {
    const { getPerformanceStats, getPerformanceRecommendations } = await import('../lib/performance.js');
    
    const performanceInfo: PerformanceInfo = {
      stats: getPerformanceStats(),
      recommendations: getPerformanceRecommendations(),
      timestamp: new Date().toISOString()
    };

    return performanceInfo;
  }, 'gather-performance-info');
  
  return mapError(result, (err) => err.message);
}

/**
 * Format meta information for human-readable output
 */
export function formatMetaOutput(metaResult: Result<MetaInfo, string>): string {
  if (!metaResult.success) {
    return `Error: ${metaResult.error || 'Failed to get meta information'}`;
  }

  const meta = metaResult.data;

  return `
🖥️  ${meta.name} v${meta.version}

📝 Description: ${meta.description}

🔧 Platform:
   Node.js: ${meta.platform.node}
   OS: ${meta.platform.os}
   macOS: ${meta.platform.macosVersion || 'Unknown'} (minimum: ${meta.platform.macosMinimum})

📦 Dependencies:
   Required: ${meta.dependencies.external.filter(d => d.required).map(d => d.name).join(', ')}
   Optional: ${meta.dependencies.external.filter(d => !d.required).map(d => d.name).join(', ')}

✨ Key Capabilities:
${meta.capabilities.map(cap => `   • ${cap}`).join('\n')}

🔗 Repository: ${meta.repository}
📄 License: ${meta.license}
`.trim();
}

/**
 * Format command information for human-readable output
 */
export function formatCommandsOutput(commandsResult: Result<CommandInfo[], string>): string {
  if (!commandsResult.success) {
    return `Error: ${commandsResult.error || 'Failed to get command information'}`;
  }

  const commands = commandsResult.data;
  const categories = new Map<string, CommandInfo[]>();
  
  // Group commands by category
  function organizeCommands(cmds: CommandInfo[], parentName = '') {
    for (const cmd of cmds) {
      const fullName = parentName ? `${parentName} ${cmd.name.split(' ').pop()}` : cmd.name;
      const cmdWithFullName = { ...cmd, name: fullName };
      
      if (!categories.has(cmd.category)) {
        categories.set(cmd.category, []);
      }
      categories.get(cmd.category)!.push(cmdWithFullName);
      
      if (cmd.subcommands) {
        organizeCommands(cmd.subcommands, cmd.name);
      }
    }
  }
  
  organizeCommands(commands);
  
  let output = '\n📋 Available Commands\n\n';
  
  for (const [category, categoryCommands] of Array.from(categories.entries()).sort()) {
    output += `▼ ${category}:\n`;
    
    for (const cmd of categoryCommands.sort((a, b) => a.name.localeCompare(b.name))) {
      const status = '✅'; // All existing commands are available
      const permissions = cmd.permissions.length > 0 ? ` (permissions: ${cmd.permissions.join(', ')})` : '';
      
      output += `   ${status} ${cmd.name}\n`;
      output += `      ${cmd.description}${permissions}\n`;
      
      if (cmd.options && cmd.options.length > 0) {
        const requiredOptions = cmd.options.filter(opt => opt.required);
        const optionalOptions = cmd.options.filter(opt => !opt.required);
        
        if (requiredOptions.length > 0) {
          output += `      Required: ${requiredOptions.map(opt => opt.name).join(', ')}\n`;
        }
        if (optionalOptions.length > 0) {
          output += `      Optional: ${optionalOptions.map(opt => opt.name).join(', ')}\n`;
        }
      }
      
      if (cmd.examples && cmd.examples.length > 0) {
        output += `      Example: ${cmd.examples[0]}\n`;
      }
      
      output += '\n';
    }
  }
  
  const totalCommands = Array.from(categories.values()).reduce((sum, cmds) => sum + cmds.length, 0);
  
  output += `\n📊 Total: ${totalCommands} commands available\n`;
  
  return output.trim();
}

/**
 * Format permission information for human-readable output
 */
export function formatPermissionsOutput(permissionsResult: Result<PermissionInfo[], string>): string {
  if (!permissionsResult.success) {
    return `Error: ${permissionsResult.error || 'Failed to get permission information'}`;
  }

  const permissions = permissionsResult.data;
  let output = '\n🔐 Permission Requirements\n\n';
  
  for (const perm of permissions) {
    const status = perm.required ? '🔴 Required' : '🟡 Optional';
    output += `▼ ${perm.name} (${status})\n`;
    output += `   ${perm.description}\n\n`;
    
    output += '   Purpose:\n';
    for (const purpose of perm.purpose) {
      output += `   • ${purpose}\n`;
    }
    output += '\n';
    
    if (perm.commands.length > 0) {
      output += `   Used by commands: ${perm.commands.join(', ')}\n\n`;
    }
    
    output += `   Setup: ${perm.setupInstructions}\n\n`;
    output += '   ───────────────────────────────────────\n\n';
  }
  
  output += '💡 Tip: Run `mac-chrome-cli doctor` to check your current permission status\n';
  
  return output.trim();
}

/**
 * Format CLI statistics for human-readable output
 */
export function formatStatsOutput(statsResult: Result<CliStats, string>): string {
  if (!statsResult.success) {
    return `Error: ${statsResult.error || 'Failed to get CLI statistics'}`;
  }

  const stats = statsResult.data;
  const uptimeMinutes = Math.floor(stats.uptime / 60);
  const uptimeSeconds = Math.floor(stats.uptime % 60);
  
  // Convert memory usage from bytes to MB
  const memoryMB = {
    rss: Math.round(stats.memoryUsage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(stats.memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(stats.memoryUsage.external / 1024 / 1024 * 100) / 100
  };

  return `
📈 CLI Runtime Statistics

⏱️  Process:
   PID: ${stats.processInfo.pid}
   Parent PID: ${stats.processInfo.ppid}
   Uptime: ${uptimeMinutes}m ${uptimeSeconds}s
   Started: ${new Date(stats.startTime).toLocaleString()}

💾 Memory Usage:
   RSS: ${memoryMB.rss} MB
   Heap Total: ${memoryMB.heapTotal} MB  
   Heap Used: ${memoryMB.heapUsed} MB
   External: ${memoryMB.external} MB

👤 User Context:
   UID: ${stats.processInfo.uid || 'N/A'}
   GID: ${stats.processInfo.gid || 'N/A'}
`.trim();
}