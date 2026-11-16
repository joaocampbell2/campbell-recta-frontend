import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/api';
import { useAuth } from './AuthContext';
import { useToastContext } from './ToastContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { saveHouseholdToLocalStorage } from '../utils/householdStorage';
import {
  TestModeState,
  TestModeOriginalHousehold,
  loadTestModeFromLocalStorage,
  saveTestModeToLocalStorage,
  clearTestModeFromLocalStorage,
} from '../utils/testModeStorage';

interface StartTestModeResponse {
  sandboxHouseholdId: string;
  originalHouseholdId?: string;
}

interface TestModeContextType {
  isTestMode: boolean;
  sandboxHouseholdId: string | null;
  originalHousehold: TestModeOriginalHousehold | null;
  isStarting: boolean;
  isStopping: boolean;
  isApplying: boolean;
  isApplyModalOpen: boolean;
  startTestMode: () => Promise<void>;
  stopTestMode: () => Promise<void>;
  applyTestMode: () => Promise<void>;
  openApplyModal: () => void;
  closeApplyModal: () => void;
}

const TestModeContext = createContext<TestModeContextType>({} as TestModeContextType);

export const useTestMode = () => useContext(TestModeContext);

const HOUSEHOLD_QUERY_KEYS = [
  ['transactions'],
  ['accounts'],
  ['budgets'],
  ['recurring-transactions'],
  ['savings-goals'],
  ['categories'],
  ['split'],
] as const;

export const TestModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { success, error: showError } = useToastContext();
  const { householdId, household } = useDefaultHousehold();
  const queryClient = useQueryClient();

  const [testModeState, setTestModeState] = useState<TestModeState | null>(() =>
    loadTestModeFromLocalStorage()
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // Sync with localStorage changes across tabs and same-tab events
  useEffect(() => {
    const syncState = () => {
      setTestModeState(loadTestModeFromLocalStorage());
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'recta_test_mode') {
        syncState();
      }
    };

    window.addEventListener('testModeChange', syncState);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('testModeChange', syncState);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Clear local test mode state on logout
  useEffect(() => {
    if (!currentUser && testModeState) {
      clearTestModeFromLocalStorage();
      setTestModeState(null);
    }
  }, [currentUser, testModeState]);

  const refreshHouseholdQueries = useCallback(() => {
    requestAnimationFrame(() => {
      for (const queryKey of HOUSEHOLD_QUERY_KEYS) {
        queryClient.removeQueries({ queryKey: [...queryKey], exact: false });
      }
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      for (const queryKey of HOUSEHOLD_QUERY_KEYS) {
        queryClient.refetchQueries({ queryKey: [...queryKey], exact: false });
      }
    });
  }, [queryClient]);

  const startTestMode = useCallback(async () => {
    if (!currentUser) {
      showError('Você precisa estar autenticado para iniciar o modo teste.');
      return;
    }

    if (testModeState?.active) {
      return;
    }

    if (!householdId) {
      showError('Nenhum ambiente financeiro selecionado.');
      return;
    }

    setIsStarting(true);
    try {
      const response = await apiClient.post<StartTestModeResponse>('/test-mode/start', {
        householdId,
      });

      const sandboxHouseholdId =
        response?.data?.sandboxHouseholdId ??
        (response as unknown as StartTestModeResponse)?.sandboxHouseholdId;

      if (!sandboxHouseholdId || typeof sandboxHouseholdId !== 'string') {
        throw new Error('O servidor não retornou um sandboxHouseholdId válido.');
      }

      const originalHousehold: TestModeOriginalHousehold = {
        id: householdId,
        name: household?.name,
        role: household?.role,
      };

      const nextState: TestModeState = {
        active: true,
        sandboxHouseholdId,
        originalHousehold,
        startedAt: Date.now(),
      };

      saveTestModeToLocalStorage(nextState);
      setTestModeState(nextState);
      refreshHouseholdQueries();
      success('Modo teste ativado! Nada será salvo permanentemente.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao iniciar o modo teste.';
      showError(message);
    } finally {
      setIsStarting(false);
    }
  }, [
    currentUser,
    testModeState?.active,
    householdId,
    household?.name,
    household?.role,
    refreshHouseholdQueries,
    success,
    showError,
  ]);

  const restoreOriginalHouseholdState = useCallback(
    (activeState: TestModeState) => {
      saveHouseholdToLocalStorage(
        activeState.originalHousehold.id,
        activeState.originalHousehold.name,
        activeState.originalHousehold.role
      );
      clearTestModeFromLocalStorage();
      setTestModeState(null);
      setIsApplyModalOpen(false);
      refreshHouseholdQueries();
    },
    [refreshHouseholdQueries]
  );

  const stopTestMode = useCallback(async () => {
    const activeState = testModeState ?? loadTestModeFromLocalStorage();
    if (!activeState?.active) {
      return;
    }

    setIsStopping(true);
    try {
      try {
        await apiClient.post('/test-mode/stop', {
          sandboxHouseholdId: activeState.sandboxHouseholdId,
        });
      } catch (err: unknown) {
        // If sandbox was already deleted/expired on backend (404), still restore locally
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status !== 404) {
          throw err;
        }
      }

      restoreOriginalHouseholdState(activeState);
      success('Modo teste encerrado! Dados originais restaurados.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao encerrar o modo teste.';
      showError(message);
    } finally {
      setIsStopping(false);
    }
  }, [testModeState, restoreOriginalHouseholdState, success, showError]);

  const applyTestMode = useCallback(async () => {
    const activeState = testModeState ?? loadTestModeFromLocalStorage();
    if (!activeState?.active) {
      return;
    }

    setIsApplying(true);
    try {
      await apiClient.post('/test-mode/apply', {
        sandboxHouseholdId: activeState.sandboxHouseholdId,
        originalHouseholdId: activeState.originalHousehold.id,
      });

      restoreOriginalHouseholdState(activeState);
      success('Alterações do modo teste aplicadas com sucesso!');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao aplicar alterações do modo teste.';
      showError(message);
    } finally {
      setIsApplying(false);
    }
  }, [testModeState, restoreOriginalHouseholdState, success, showError]);

  const openApplyModal = useCallback(() => {
    setIsApplyModalOpen(true);
  }, []);

  const closeApplyModal = useCallback(() => {
    if (!isApplying) {
      setIsApplyModalOpen(false);
    }
  }, [isApplying]);

  const isTestMode = Boolean(
    currentUser && testModeState?.active && testModeState.sandboxHouseholdId
  );

  return (
    <TestModeContext.Provider
      value={{
        isTestMode,
        sandboxHouseholdId: isTestMode ? testModeState?.sandboxHouseholdId ?? null : null,
        originalHousehold: isTestMode ? testModeState?.originalHousehold ?? null : null,
        isStarting,
        isStopping,
        isApplying,
        isApplyModalOpen,
        startTestMode,
        stopTestMode,
        applyTestMode,
        openApplyModal,
        closeApplyModal,
      }}
    >
      {children}
    </TestModeContext.Provider>
  );
};
