import { execChromeJS, type JavaScriptResult } from '../lib/apple.js';
import { formatJSONResult, ERROR_CODES, type JSONResult } from '../lib/util.js';

export interface ElementRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementState {
  editable?: boolean;
  disabled?: boolean;
  value?: string;
  checked?: boolean;
  expanded?: boolean;
  selected?: boolean;
  hidden?: boolean;
  focused?: boolean;
}

export interface SnapshotNode {
  role: string;
  name: string;
  selector: string;
  rect: ElementRect;
  state: ElementState;
  tagName?: string;
  id?: string;
  className?: string;
  href?: string;
  src?: string;
  alt?: string;
  title?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  ariaRole?: string;
  level?: number; // for DOM-lite hierarchy
  parent?: string; // parent selector for DOM-lite
}

export interface SnapshotResult {
  ok: boolean;
  cmd: string;
  nodes: SnapshotNode[];
  meta?: {
    url: string;
    title: string;
    timestamp: string;
    durationMs: number;
    visibleOnly: boolean;
    maxDepth?: number;
  };
}

export interface SnapshotOptions {
  visibleOnly?: boolean;
  maxDepth?: number;
  mode: 'outline' | 'dom-lite';
}

/**
 * Get unique CSS selector for an element
 * Priority: id > data-testid > data-test > unique class > path
 */
const getSelectorScript = `
function getUniqueSelector(element) {
  // Try ID first
  if (element.id) {
    const idSelector = '#' + CSS.escape(element.id);
    if (document.querySelectorAll(idSelector).length === 1) {
      return idSelector;
    }
  }
  
  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    const testIdSelector = '[data-testid="' + CSS.escape(testId) + '"]';
    if (document.querySelectorAll(testIdSelector).length === 1) {
      return testIdSelector;
    }
  }
  
  // Try data-test
  const dataTest = element.getAttribute('data-test');
  if (dataTest) {
    const dataTestSelector = '[data-test="' + CSS.escape(dataTest) + '"]';
    if (document.querySelectorAll(dataTestSelector).length === 1) {
      return dataTestSelector;
    }
  }
  
  // Try unique class combination
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\\s+/).filter(Boolean);
    if (classes.length > 0) {
      const classSelector = '.' + classes.map(c => CSS.escape(c)).join('.');
      if (document.querySelectorAll(classSelector).length === 1) {
        return classSelector;
      }
    }
  }
  
  // Fall back to path-based selector
  const path = [];
  let current = element;
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += '#' + CSS.escape(current.id);
      path.unshift(selector);
      break;
    }
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\\s+/).filter(Boolean);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
      }
    }
    
    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(child => 
        child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += ':nth-child(' + index + ')';
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}
`;

/**
 * Check if element is visible in viewport
 */
const isVisibleScript = `
function isElementVisible(element) {
  if (!element || !element.offsetParent) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && 
         rect.top < window.innerHeight && rect.bottom > 0 &&
         rect.left < window.innerWidth && rect.right > 0;
}
`;

/**
 * Get element role and accessible name
 */
const getAccessibilityInfoScript = `
function getAccessibilityInfo(element) {
  // Get role (explicit or implicit)
  let role = element.getAttribute('role');
  if (!role) {
    // Map common tag names to implicit roles
    const tagRoleMap = {
      'button': 'button',
      'input': element.type === 'button' || element.type === 'submit' || element.type === 'reset' ? 'button' : 'textbox',
      'textarea': 'textbox',
      'select': 'combobox',
      'a': element.href ? 'link' : 'generic',
      'img': 'img',
      'h1': 'heading', 'h2': 'heading', 'h3': 'heading', 'h4': 'heading', 'h5': 'heading', 'h6': 'heading',
      'nav': 'navigation',
      'main': 'main',
      'article': 'article',
      'section': 'region',
      'aside': 'complementary',
      'header': 'banner',
      'footer': 'contentinfo',
      'form': 'form',
      'table': 'table',
      'td': 'cell',
      'th': 'columnheader',
      'tr': 'row',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
      'dl': 'list',
      'dt': 'term',
      'dd': 'definition'
    };
    role = tagRoleMap[element.tagName.toLowerCase()] || 'generic';
    
    // Special cases for input types
    if (element.tagName.toLowerCase() === 'input') {
      const inputRoleMap = {
        'checkbox': 'checkbox',
        'radio': 'radio',
        'range': 'slider',
        'search': 'searchbox',
        'email': 'textbox',
        'tel': 'textbox',
        'url': 'textbox',
        'password': 'textbox',
        'number': 'spinbutton',
        'date': 'textbox',
        'time': 'textbox',
        'datetime-local': 'textbox',
        'month': 'textbox',
        'week': 'textbox',
        'color': 'textbox',
        'file': 'button'
      };
      role = inputRoleMap[element.type] || 'textbox';
    }
  }
  
  // Get accessible name using aria-label, aria-labelledby, label, title, placeholder, or text content
  let name = '';
  
  // 1. aria-label
  name = element.getAttribute('aria-label');
  if (name) return { role, name: name.trim() };
  
  // 2. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      name = labelElement.textContent || labelElement.innerText || '';
      if (name.trim()) return { role, name: name.trim() };
    }
  }
  
  // 3. Associated label (for form controls)
  if (element.id) {
    const label = document.querySelector('label[for="' + CSS.escape(element.id) + '"]');
    if (label) {
      name = label.textContent || label.innerText || '';
      if (name.trim()) return { role, name: name.trim() };
    }
  }
  
  // 4. Parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    name = parentLabel.textContent || parentLabel.innerText || '';
    if (name.trim()) return { role, name: name.trim() };
  }
  
  // 5. Title attribute
  name = element.getAttribute('title');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 6. Placeholder (for inputs)
  name = element.getAttribute('placeholder');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 7. Alt text (for images)
  name = element.getAttribute('alt');
  if (name && name.trim()) return { role, name: name.trim() };
  
  // 8. Value (for buttons and inputs)
  if (element.value && typeof element.value === 'string' && element.value.trim()) {
    return { role, name: element.value.trim() };
  }
  
  // 9. Text content (but truncate for long content)
  name = element.textContent || element.innerText || '';
  name = name.trim().replace(/\\s+/g, ' ');
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }
  
  return { role, name: name || element.tagName.toLowerCase() };
}
`;

/**
 * Get element state information
 */
const getElementStateScript = `
function getElementState(element) {
  const state = {};
  
  // Check if editable
  if (element.isContentEditable || 
      (element.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName.toUpperCase()))) {
    state.editable = true;
  }
  
  // Check if disabled
  if (element.disabled !== undefined) {
    state.disabled = element.disabled;
  }
  
  // Get value for form elements
  if (element.value !== undefined && typeof element.value === 'string') {
    // Mask passwords
    if (element.type === 'password') {
      state.value = element.value ? '***' : '';
    } else {
      state.value = element.value;
    }
  }
  
  // Check if checked (checkboxes, radio buttons)
  if (element.checked !== undefined) {
    state.checked = element.checked;
  }
  
  // Check if selected (option elements)
  if (element.selected !== undefined) {
    state.selected = element.selected;
  }
  
  // Check if expanded (for expandable elements)
  const ariaExpanded = element.getAttribute('aria-expanded');
  if (ariaExpanded !== null) {
    state.expanded = ariaExpanded === 'true';
  }
  
  // Check if hidden
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    state.hidden = true;
  }
  
  // Check if focused
  state.focused = document.activeElement === element;
  
  return state;
}
`;

/**
 * Main snapshot extraction script
 */
function generateSnapshotScript(options: SnapshotOptions): string {
  return `
${getSelectorScript}
${isVisibleScript}
${getAccessibilityInfoScript}
${getElementStateScript}

(function() {
  try {
    const startTime = Date.now();
    const nodes = [];
    const { visibleOnly = false, maxDepth = 10, mode = 'outline' } = ${JSON.stringify(options)};
    
    // Define interactive element selectors
    const interactiveSelectors = [
      'button',
      'input',
      'textarea',
      'select',
      'a[href]',
      '[role="button"]',
      '[role="link"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="menuitemradio"]',
      '[role="option"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="slider"]',
      '[role="spinbutton"]',
      '[role="tab"]',
      '[role="treeitem"]',
      '[onclick]',
      '[onmousedown]',
      '[onmouseup]',
      '[onchange]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    
    if (mode === 'outline') {
      // Outline mode: flat list of interactive elements
      const elements = document.querySelectorAll(interactiveSelectors);
      
      for (const element of elements) {
        // Skip if visibility filtering is enabled and element is not visible
        if (visibleOnly && !isElementVisible(element)) continue;
        
        try {
          const rect = element.getBoundingClientRect();
          const { role, name } = getAccessibilityInfo(element);
          const state = getElementState(element);
          const selector = getUniqueSelector(element);
          
          const node = {
            role,
            name,
            selector,
            rect: {
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              w: Math.round(rect.width),
              h: Math.round(rect.height)
            },
            state,
            tagName: element.tagName.toLowerCase()
          };
          
          // Add optional properties
          if (element.id) node.id = element.id;
          if (element.className && typeof element.className === 'string') {
            node.className = element.className;
          }
          if (element.href) node.href = element.href;
          if (element.src) node.src = element.src;
          if (element.alt) node.alt = element.alt;
          if (element.title) node.title = element.title;
          if (element.type) node.type = element.type;
          if (element.placeholder) node.placeholder = element.placeholder;
          if (element.getAttribute('aria-label')) {
            node.ariaLabel = element.getAttribute('aria-label');
          }
          if (element.getAttribute('role')) {
            node.ariaRole = element.getAttribute('role');
          }
          
          nodes.push(node);
        } catch (nodeError) {
          // Skip problematic elements
          continue;
        }
      }
    } else if (mode === 'dom-lite') {
      // DOM-lite mode: pruned hierarchy
      function traverseElement(element, level = 0, parentSelector = '') {
        if (level > maxDepth) return;
        
        // Skip if visibility filtering is enabled and element is not visible
        if (visibleOnly && !isElementVisible(element)) return;
        
        try {
          const isInteractive = element.matches && element.matches(interactiveSelectors);
          const hasInteractiveChildren = element.querySelector && element.querySelector(interactiveSelectors);
          
          // Include if interactive or has interactive descendants
          if (isInteractive || hasInteractiveChildren || level === 0) {
            const rect = element.getBoundingClientRect();
            const { role, name } = getAccessibilityInfo(element);
            const state = getElementState(element);
            const selector = getUniqueSelector(element);
            
            const node = {
              role,
              name,
              selector,
              rect: {
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
              },
              state,
              tagName: element.tagName.toLowerCase(),
              level
            };
            
            if (parentSelector) {
              node.parent = parentSelector;
            }
            
            // Add optional properties for interactive elements
            if (isInteractive) {
              if (element.id) node.id = element.id;
              if (element.className && typeof element.className === 'string') {
                node.className = element.className;
              }
              if (element.href) node.href = element.href;
              if (element.src) node.src = element.src;
              if (element.alt) node.alt = element.alt;
              if (element.title) node.title = element.title;
              if (element.type) node.type = element.type;
              if (element.placeholder) node.placeholder = element.placeholder;
              if (element.getAttribute('aria-label')) {
                node.ariaLabel = element.getAttribute('aria-label');
              }
              if (element.getAttribute('role')) {
                node.ariaRole = element.getAttribute('role');
              }
            }
            
            nodes.push(node);
            
            // Traverse children
            for (const child of element.children) {
              traverseElement(child, level + 1, selector);
            }
          }
        } catch (nodeError) {
          // Skip problematic elements
          return;
        }
      }
      
      traverseElement(document.body);
    }
    
    const endTime = Date.now();
    
    return {
      ok: true,
      cmd: 'snapshot.' + mode,
      nodes,
      meta: {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        durationMs: endTime - startTime,
        visibleOnly,
        maxDepth: mode === 'dom-lite' ? maxDepth : undefined
      }
    };
  } catch (error) {
    return {
      ok: false,
      cmd: 'snapshot.' + ${JSON.stringify(options.mode)},
      nodes: [],
      error: error.message || 'Unknown error during snapshot'
    };
  }
})();
`;
}

/**
 * Capture page snapshot in outline mode (flat list of interactive elements)
 */
export async function captureOutline(options: { visibleOnly?: boolean } = {}): Promise<JavaScriptResult<SnapshotResult>> {
  const snapshotOptions: SnapshotOptions = {
    mode: 'outline',
    visibleOnly: options.visibleOnly || false
  };
  
  const script = generateSnapshotScript(snapshotOptions);
  return execChromeJS<SnapshotResult>(script, 1, 1, 15000); // 15 second timeout
}

/**
 * Capture page snapshot in DOM-lite mode (pruned hierarchy)
 */
export async function captureDomLite(options: { maxDepth?: number; visibleOnly?: boolean } = {}): Promise<JavaScriptResult<SnapshotResult>> {
  const snapshotOptions: SnapshotOptions = {
    mode: 'dom-lite',
    maxDepth: options.maxDepth || 10,
    visibleOnly: options.visibleOnly || false
  };
  
  const script = generateSnapshotScript(snapshotOptions);
  return execChromeJS<SnapshotResult>(script, 1, 1, 20000); // 20 second timeout for more complex traversal
}

/**
 * Format snapshot result for CLI output
 */
export function formatSnapshotResult(result: JavaScriptResult<SnapshotResult>): SnapshotResult | JSONResult<null> {
  if (!result.success) {
    return formatJSONResult(
      null,
      result.error || 'Failed to capture page snapshot',
      result.code
    );
  }
  
  if (!result.result) {
    return formatJSONResult(
      null,
      'No snapshot data returned',
      ERROR_CODES.UNKNOWN_ERROR
    );
  }
  
  return result.result;
}