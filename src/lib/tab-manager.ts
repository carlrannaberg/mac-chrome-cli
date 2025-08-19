/**
 * @fileoverview Dedicated tab management utilities
 * 
 * This module provides specialized tab management functions using AppleScript,
 * with clean abstractions for tab enumeration, pattern matching, and focusing.
 * 
 * @author mac-chrome-cli
 * @version 1.0.0
 */

import type { ChromeTab } from './apple.js';
import { appleScriptService } from '../services/AppleScriptService.js';
import { ERROR_CODES } from './util.js';
import type { Result } from '../core/Result.js';

/**
 * Tab pattern matching options
 */
export interface TabMatchOptions {
  /** Pattern to match against */
  pattern: string;
  /** Whether to use exact matching */
  exactMatch?: boolean;
  /** Whether to match case-sensitively */
  caseSensitive?: boolean;
}

/**
 * Tab matching result
 */
export interface TabMatchResult {
  /** Matched tab */
  tab: ChromeTab;
  /** 1-based index of the matched tab */
  index: number;
  /** Which field matched (title, url, or both) */
  matchedField: 'title' | 'url' | 'both';
}

/**
 * Find tabs matching a pattern
 * 
 * @param tabs Array of tabs to search
 * @param options Pattern matching options
 * @returns Array of matching tabs with their indices
 */
export function findMatchingTabs(
  tabs: ChromeTab[], 
  options: TabMatchOptions
): TabMatchResult[] {
  const { pattern, exactMatch = false, caseSensitive = false } = options;
  const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
  const matches: TabMatchResult[] = [];

  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    if (!tab) continue;

    const title = caseSensitive ? tab.title : tab.title.toLowerCase();
    const url = caseSensitive ? tab.url : tab.url.toLowerCase();

    const titleMatch = exactMatch 
      ? title === searchPattern
      : title.includes(searchPattern);
    const urlMatch = exactMatch
      ? url === searchPattern  
      : url.includes(searchPattern);

    if (titleMatch || urlMatch) {
      let matchedField: 'title' | 'url' | 'both';
      if (titleMatch && urlMatch) {
        matchedField = 'both';
      } else if (titleMatch) {
        matchedField = 'title';
      } else {
        matchedField = 'url';
      }

      matches.push({
        tab,
        index: i + 1, // Convert to 1-based index
        matchedField
      });
    }
  }

  return matches;
}

/**
 * Generate AppleScript for tab enumeration with improved error handling
 * 
 * @param windowIndex Target window index (1-based)
 * @returns AppleScript code for tab enumeration
 */
export function generateTabEnumerationScript(windowIndex: number): string {
  return `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    set targetWindow to window ${windowIndex}
    set allTabs to every tab of targetWindow
    set tabList to {}
    
    repeat with i from 1 to count of allTabs
      set currentTab to item i of allTabs
      set tabInfo to "{" & ¬
        "\\"id\\": " & i & ", " & ¬
        "\\"title\\": \\"" & (my escapeForJSON(title of currentTab)) & "\\", " & ¬
        "\\"url\\": \\"" & (my escapeForJSON(URL of currentTab)) & "\\", " & ¬
        "\\"loading\\": " & (loading of currentTab) & ", " & ¬
        "\\"windowId\\": " & ${windowIndex} & ¬
        "}"
      set end of tabList to tabInfo
    end repeat
    
    return "[" & (my joinList(tabList, ",")) & "]"
    
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell

on escapeForJSON(textValue)
  set escapedText to textValue
  set escapedText to (my replaceText(escapedText, "\\\\", "\\\\\\\\"))
  set escapedText to (my replaceText(escapedText, "\\"", "\\\\\\""))
  set escapedText to (my replaceText(escapedText, return, "\\\\n"))
  set escapedText to (my replaceText(escapedText, tab, "\\\\t"))
  return escapedText
end escapeForJSON

on replaceText(originalText, searchString, replacementString)
  set AppleScript's text item delimiters to searchString
  set textItems to text items of originalText
  set AppleScript's text item delimiters to replacementString
  set replacedText to textItems as string
  set AppleScript's text item delimiters to ""
  return replacedText
end replaceText

on joinList(theList, delimiter)
  set AppleScript's text item delimiters to delimiter
  set joinedString to theList as string
  set AppleScript's text item delimiters to ""
  return joinedString
end joinList`;
}

/**
 * Generate AppleScript for tab focusing with improved error handling
 * 
 * @param tabIndex Target tab index (1-based)
 * @param windowIndex Target window index (1-based)
 * @returns AppleScript code for tab focusing
 */
export function generateTabFocusScript(tabIndex: number, windowIndex: number): string {
  return `
tell application "Google Chrome"
  if not running then
    return "ERROR: Chrome is not running"
  end if
  
  try
    activate
    set targetWindow to window ${windowIndex}
    
    -- Check if tab index is valid
    set tabCount to count of tabs of targetWindow
    if ${tabIndex} > tabCount or ${tabIndex} < 1 then
      return "ERROR: Tab index ${tabIndex} is out of range (1-" & tabCount & ")"
    end if
    
    set targetTab to tab ${tabIndex} of targetWindow
    set active tab index of targetWindow to ${tabIndex}
    
    -- Get updated tab info
    set tabInfo to "{" & ¬
      "\\"id\\": " & ${tabIndex} & ", " & ¬
      "\\"title\\": \\"" & (my escapeForJSON(title of targetTab)) & "\\", " & ¬
      "\\"url\\": \\"" & (my escapeForJSON(URL of targetTab)) & "\\", " & ¬
      "\\"loading\\": " & (loading of targetTab) & ", " & ¬
      "\\"windowId\\": " & ${windowIndex} & ¬
      "}"
    
    return tabInfo
    
  on error errorMessage
    return "ERROR: " & errorMessage
  end try
end tell

on escapeForJSON(textValue)
  set escapedText to textValue
  set escapedText to (my replaceText(escapedText, "\\\\", "\\\\\\\\"))
  set escapedText to (my replaceText(escapedText, "\\"", "\\\\\\""))
  set escapedText to (my replaceText(escapedText, return, "\\\\n"))
  set escapedText to (my replaceText(escapedText, tab, "\\\\t"))
  return escapedText
end escapeForJSON

on replaceText(originalText, searchString, replacementString)
  set AppleScript's text item delimiters to searchString
  set textItems to text items of originalText
  set AppleScript's text item delimiters to replacementString
  set replacedText to textItems as string
  set AppleScript's text item delimiters to ""
  return replacedText
end replaceText`;
}

/**
 * Enhanced tab enumeration with better error handling
 * 
 * @param windowIndex Target window index (1-based)
 * @returns Promise resolving to array of tabs or error
 */
export async function getAllTabsEnhanced(windowIndex: number = 1): Promise<Result<ChromeTab[], string>> {
  const script = generateTabEnumerationScript(windowIndex);
  const result = await appleScriptService.executeScript(script, 15000);
  
  if (!result.success) {
    return result as Result<ChromeTab[], string>;
  }
  
  try {
    const tabs = JSON.parse(result.data || '[]') as ChromeTab[];
    return { ...result, data: tabs };
  } catch (parseError) {
    return {
      success: false,
      error: `Failed to parse tab data: ${parseError}`,
      code: result.code,
      timestamp: result.timestamp,
      context: result.context
    };
  }
}

/**
 * Enhanced tab focusing with better error handling
 * 
 * @param tabIndex Target tab index (1-based)
 * @param windowIndex Target window index (1-based)
 * @returns Promise resolving to focused tab info or error
 */
export async function focusTabByIndexEnhanced(
  tabIndex: number, 
  windowIndex: number = 1
): Promise<Result<ChromeTab, string>> {
  const script = generateTabFocusScript(tabIndex, windowIndex);
  const result = await appleScriptService.executeScript(script, 10000);
  
  if (!result.success) {
    return result as Result<ChromeTab, string>;
  }
  
  try {
    const tab = JSON.parse(result.data || '{}') as ChromeTab;
    return { ...result, data: tab };
  } catch (parseError) {
    return {
      success: false,
      error: `Failed to parse tab data: ${parseError}`,
      code: result.code,
      timestamp: result.timestamp,
      context: result.context
    };
  }
}