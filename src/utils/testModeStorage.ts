/**
 * Utilities for persisting Household Sandbox (Test Mode) state in localStorage.
 * Ensures test mode survives page reloads, network drops, and server restarts
 * until the user explicitly exits test mode.
 */

const TEST_MODE_STORAGE_KEY = 'recta_test_mode';

export interface TestModeOriginalHousehold {
  id: string;
  name?: string;
  role?: string;
}

export interface TestModeState {
  active: boolean;
  sandboxHouseholdId: string;
  originalHousehold: TestModeOriginalHousehold;
  startedAt: number;
}

export function saveTestModeToLocalStorage(state: TestModeState): void {
  try {
    localStorage.setItem(TEST_MODE_STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('testModeChange', {
          detail: state,
        })
      );
    }
  } catch {
    // Ignore localStorage write errors
  }
}

export function loadTestModeFromLocalStorage(): TestModeState | null {
  try {
    const raw = localStorage.getItem(TEST_MODE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TestModeState;
    if (
      !parsed ||
      !parsed.active ||
      typeof parsed.sandboxHouseholdId !== 'string' ||
      parsed.sandboxHouseholdId.length === 0 ||
      !parsed.originalHousehold ||
      typeof parsed.originalHousehold.id !== 'string' ||
      parsed.originalHousehold.id.length === 0
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function clearTestModeFromLocalStorage(): void {
  try {
    localStorage.removeItem(TEST_MODE_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('testModeChange', {
          detail: null,
        })
      );
    }
  } catch {
    // Ignore localStorage remove errors
  }
}
