import { useAuthUser } from './api/useAuth';
import { useHouseholds } from './api/useHouseholds';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { 
  saveHouseholdToLocalStorage, 
  loadHouseholdFromLocalStorage,
  clearHouseholdFromLocalStorage 
} from '../utils/householdStorage';
import {
  loadTestModeFromLocalStorage,
  clearTestModeFromLocalStorage,
  TestModeState,
} from '../utils/testModeStorage';

/**
 * Hook to get the default household for the current user
 * ALWAYS respects user's selection from localStorage
 * Only saves to localStorage when necessary (first time or name/role update)
 */
export function useDefaultHousehold() {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  // Only fetch auth user data if authenticated
  const { data: authUser, isLoading: isAuthUserLoading } = useAuthUser();
  
  // Also fetch households list separately - this is more reliable after reload
  const { data: households, isLoading: isHouseholdsLoading } = useHouseholds();
  
  const isLoading = isAuthUserLoading || isHouseholdsLoading;

  // Use state to store cached household - this forces re-render when localStorage changes
  // We initialize with localStorage value, but also listen for changes
  // IMPORTANT: Initialize synchronously on mount to ensure we have the value immediately
  const [cachedHousehold, setCachedHousehold] = useState<ReturnType<typeof loadHouseholdFromLocalStorage>>(() => 
    loadHouseholdFromLocalStorage()
  );
  const [testModeState, setTestModeState] = useState<TestModeState | null>(() =>
    loadTestModeFromLocalStorage()
  );

  // Listen for localStorage changes (via storage event or custom event)
  useEffect(() => {
    // Function to update cached household from localStorage
    const updateCachedHousehold = () => {
      const newCached = loadHouseholdFromLocalStorage();
      setCachedHousehold((current) => {
        // Only update if something actually changed (to avoid unnecessary re-renders)
        if (!newCached) {
          return current; // Keep current if new is null
        }
        
        // Update if ID changed (most important - user switched households)
        if (newCached.id !== current?.id) {
          return newCached;
        }
        
        // Also update if name or role changed (to reflect API updates, but same ID)
        if (current && (newCached.name !== current.name || newCached.role !== current.role)) {
          return newCached;
        }
        
        return current; // No changes, keep current
      });
    };

    const updateTestMode = () => {
      setTestModeState(loadTestModeFromLocalStorage());
    };

    // Listen for storage events (fired when localStorage changes in other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'household_id' || e.key === 'household_id_timestamp') {
        updateCachedHousehold();
      }
      if (e.key === 'recta_test_mode') {
        updateTestMode();
      }
    };

    // Listen for custom event (fired when we save to localStorage in this tab)
    // This is the key: when HouseholdSelector saves to localStorage, it dispatches this event
    const handleCustomStorageChange = (_e: Event) => {
      // Small delay to ensure localStorage was written to disk
      requestAnimationFrame(() => {
        updateCachedHousehold();
      });
    };

    const handleTestModeChange = (_e: Event) => {
      requestAnimationFrame(() => {
        updateTestMode();
      });
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-tab updates (critical for immediate updates without reload)
    window.addEventListener('householdStorageChange', handleCustomStorageChange);
    window.addEventListener('testModeChange', handleTestModeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('householdStorageChange', handleCustomStorageChange);
      window.removeEventListener('testModeChange', handleTestModeChange);
    };
  }, []); // Empty deps - only set up listeners once

  // Find cached household in households list (more reliable than authUser.households after reload)
  const cachedHouseholdInAPI = useMemo(() => {
    if (!cachedHousehold?.id || !households || households.length === 0) {
      return null;
    }
    return households.find((h) => h?.id === cachedHousehold.id) || null;
  }, [cachedHousehold?.id, households]);

  // Only use personal household (oldest by createdAt) as fallback if there's NO cached household at all
  // NEVER use fallback if cached exists - always respect user's selection
  // IMPORTANT: Personal household is the oldest one (by createdAt), not just households[0]
  const fallbackHousehold = useMemo(() => {
    if (cachedHousehold?.id || !households || households.length === 0) {
      return null;
    }
    
    // Sort households by createdAt to find the personal one (oldest)
    // This ensures we always use the personal household as fallback, not a shared or sandbox one
    const sorted = [...households]
      .filter((h) => !h.isSandbox)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.joinedAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.joinedAt || 0).getTime();
        return dateA - dateB; // Oldest first
      });
    
    return sorted[0] || null;
  }, [cachedHousehold?.id, households]);

  // Save household to localStorage ONLY when:
  // 1. There's NO cached household (first time user) - save first household from API
  // 2. Cached household was found in API and name/role needs updating (keep same ID)
  // CRITICAL: Never overwrite cached household ID - always respect user's selection
  // CRITICAL: This effect should NEVER change the household ID once cached exists
  useEffect(() => {
    if (!isAuthenticated) {
      clearHouseholdFromLocalStorage();
      clearTestModeFromLocalStorage();
      return;
    }

    // CRITICAL: If cached household exists, NEVER overwrite it - respect user's selection
    // This check happens FIRST, before any API loading considerations
    if (cachedHousehold?.id) {
      // Wait for API to finish loading before attempting any updates
      if (isLoading) {
        return; // Don't do anything while loading - keep the cached household exactly as is
      }

      // Only update name/role if cached household was found in API and they differ
      // NEVER change the ID - this is the user's explicit selection
      if (cachedHouseholdInAPI) {
        const nameChanged = cachedHousehold.name !== cachedHouseholdInAPI.name;
        const roleChanged = cachedHousehold.role !== cachedHouseholdInAPI.role;
        
        if (nameChanged || roleChanged) {
          // Update only name/role, NEVER change the ID
          saveHouseholdToLocalStorage(
            cachedHousehold.id, // Keep same ID - user's selection must be preserved
            cachedHouseholdInAPI.name,
            cachedHouseholdInAPI.role
          );
        }
      }
      // If cached household is not in API, DO NOTHING - still respect it
      // The user selected this household, and we must honor that selection
      // Do NOT overwrite with fallback under any circumstances
      return;
    }

    // Only save fallback household if there's NO cached household (first time user)
    // AND API has finished loading (to avoid race conditions)
    // AND we haven't already saved it (prevent infinite loop)
    // This only happens on first load when user has never selected a household
    // IMPORTANT: Double-check localStorage directly to ensure we don't overwrite existing selection
    if (!cachedHousehold?.id && !isLoading && fallbackHousehold?.id) {
      // Double-check localStorage directly - if something exists there, don't overwrite
      // This prevents race conditions where localStorage was updated but state hasn't refreshed yet
      const directCheck = loadHouseholdFromLocalStorage();
      if (!directCheck?.id) {
        // Only save if localStorage is truly empty (first-time user)
        // Save the personal household (fallback) to localStorage
        // This ensures first-time users get their personal household as default
        saveHouseholdToLocalStorage(
          fallbackHousehold.id,
          fallbackHousehold.name,
          fallbackHousehold.role
        );
      }
      // If directCheck has an ID, it means localStorage has a household saved
      // Don't overwrite it - respect what's already there
    } else if (isAuthenticated && !isLoading && households && households.length === 0) {
      // User authenticated but no households found
    }
  }, [isAuthenticated, isLoading, cachedHousehold?.id, cachedHousehold?.name, cachedHousehold?.role, cachedHouseholdInAPI, fallbackHousehold, households, authUser]);

  const isTestMode = Boolean(
    isAuthenticated && testModeState?.active && testModeState.sandboxHouseholdId
  );

  // Use household ID - prioritize active sandbox if in test mode, then cached if it exists
  // This ensures user's selection is NEVER overwritten, even if API hasn't loaded yet
  const householdId = useMemo(() => {
    if (isTestMode && testModeState?.sandboxHouseholdId) {
      return testModeState.sandboxHouseholdId;
    }
    // CRITICAL: Always use cached household ID if it exists - this is the user's explicit selection
    // Do NOT use fallback even if API has loaded - respect user's choice
    if (isAuthenticated && cachedHousehold?.id) {
      return cachedHousehold.id; // Always use cached ID - user's selection
    }
    // Only use fallback if there's NO cached household (first time user)
    return fallbackHousehold?.id || undefined;
  }, [isTestMode, testModeState?.sandboxHouseholdId, isAuthenticated, cachedHousehold?.id, fallbackHousehold?.id]);
  
  // Build household object - prioritize sandbox when in test mode, then cached household from API
  const household = useMemo(() => {
    if (isTestMode && testModeState) {
      return {
        id: testModeState.sandboxHouseholdId,
        name: `${testModeState.originalHousehold.name || 'Minhas Finanças'} (Modo Teste)`,
        role: (testModeState.originalHousehold.role as 'OWNER' | 'EDITOR' | 'VIEWER') || 'OWNER',
        isSandbox: true,
      };
    }

    // If we have a cached household ID, ALWAYS try to use it first
    if (isAuthenticated && cachedHousehold?.id) {
      // First try: cached household found in API (has full data with proper structure)
      if (cachedHouseholdInAPI) {
        return cachedHouseholdInAPI;
      }
      
      // Second try: use cached from localStorage (user's selection, even if not in API yet)
      // This ensures that after a reload, we respect the user's selection immediately
      return {
        id: cachedHousehold.id,
        name: cachedHousehold.name || 'Minhas Finanças',
        role: (cachedHousehold.role as 'OWNER' | 'EDITOR' | 'VIEWER') || 'OWNER',
      };
    }
    
    // Third try: fallback household (first time user, no cached household)
    if (fallbackHousehold) {
      return fallbackHousehold;
    }
    
    // Final try: find by householdId in households list (in case cached was somehow lost but ID exists)
    if (householdId && households && households.length > 0) {
      return households.find(h => h?.id === householdId) || null;
    }
    
    return null;
  }, [cachedHouseholdInAPI, cachedHousehold, isAuthenticated, fallbackHousehold, householdId, households]);

  return {
    householdId: householdId || undefined,
    household: household || undefined,
    isLoading: isAuthenticated ? isLoading : false,
    isTestMode,
  };
}
