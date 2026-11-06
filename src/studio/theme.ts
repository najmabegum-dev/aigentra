/**
 * AG Studio Custom Theming & License Initializer (PRD §10.1, §10.4)
 *
 * Implements light and dark themes matching AIGENTRA design tokens:
 * - Light: Background #F7F8FA, Surface #FFFFFF, Ink #0B1220, Primary #2F5BFF
 * - Dark: Background #0B1220, Surface #131C2E, Ink #F7F8FA, Primary #3B82F6
 */

import { LicenseManager } from "ag-grid-enterprise";

let licenseInitialized = false;

export function initStudioLicense(): void {
  if (licenseInitialized) return;

  const key = process.env.NEXT_PUBLIC_AG_LICENSE_KEY;
  if (key && key.trim().length > 0) {
    try {
      LicenseManager.setLicenseKey(key);
    } catch (e) {
      console.warn("Failed to set AG Grid/Studio license key:", e);
    }
  }
  licenseInitialized = true;
}

export const aigentraStudioThemeCss = `
  .ag-theme-aigentra {
    --ag-background-color: var(--surface, #FFFFFF);
    --ag-foreground-color: var(--ink, #0B1220);
    --ag-header-background-color: var(--muted, #F1F3F7);
    --ag-header-foreground-color: var(--muted-foreground, #5B6475);
    --ag-border-color: var(--border, #E2E8F0);
    --ag-row-hover-color: var(--muted, #F1F3F7);
    --ag-selected-row-background-color: rgba(47, 91, 255, 0.08);
    --ag-font-family: inherit;
    --ag-font-size: 13px;
    --ag-grid-size: 6px;
    --ag-borders: solid 1px;
    --ag-border-radius: 8px;
    border-radius: 8px;
    font-family: inherit;
  }

  .dark .ag-theme-aigentra {
    --ag-background-color: var(--surface, #131C2E);
    --ag-foreground-color: var(--ink, #F7F8FA);
    --ag-header-background-color: var(--muted, #1E293B);
    --ag-header-foreground-color: var(--muted-foreground, #94A3B8);
    --ag-border-color: var(--border, #23314D);
    --ag-row-hover-color: var(--muted, #1E293B);
    --ag-selected-row-background-color: rgba(59, 130, 246, 0.15);
    border-radius: 8px;
  }

  .ag-theme-aigentra .ag-header-cell-label {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
`;
