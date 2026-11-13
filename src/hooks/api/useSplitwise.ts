import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import type {
  Friend,
  SplitGroup,
  SplitDebt,
  SplitDirection,
  SplitRule,
} from '../../pages/Loans';
import type { SettleDebtOptions } from '../../components/SplitSettleDebtModal';

// ============================================================================
// Request / Response Payloads
// ============================================================================

export interface CreateSplitFriendPayload {
  householdId?: string;
  name: string;
  emailOrPix?: string;
  avatarColor: string;
  avatarUrl?: string;
}

export interface ArchiveSplitFriendPayload {
  id: string;
  archived: boolean;
}

export interface CreateSplitGroupPayload {
  householdId?: string;
  name: string;
  category: SplitGroup['category'];
  memberIds: string[];
  avatarUrl?: string;
}

export interface ArchiveSplitGroupPayload {
  id: string;
  archived: boolean;
}

export interface CreateSplitDebtPayload {
  householdId?: string;
  description: string;
  category?: string;
  accountId?: string;
  accountName?: string;
  originalTotalAmount: number;
  direction: SplitDirection;
  payerFriendId?: string;
  splitRule: SplitRule;
  groupId?: string;
  totalInstallments: number;
  shares: Array<{
    friendId: string;
    debtTotalAmount: number;
  }>;
}

export interface ToggleInstallmentPayload {
  debtId: string;
  installmentId: string;
  paid: boolean;
  paidAt?: string;
  paidNote?: string;
}

export interface SettleSplitDebtPayload extends SettleDebtOptions {
  debtId: string;
}

export interface SettleFriendMonthPayload {
  friendId: string;
  month: string; // YYYY-MM
}

// ============================================================================
// Queries (GET)
// ============================================================================

/**
 * GET /split/friends?householdId=...
 * Lista todos os amigos (ativos e arquivados)
 */
export function useSplitFriends(householdId?: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['split', 'friends', { householdId }],
    queryFn: async () => {
      const response = await apiClient.get<Friend[]>('/split/friends', {
        ...(householdId && { householdId }),
      });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * GET /split/groups?householdId=...
 * Lista todos os grupos (ativos e arquivados)
 */
export function useSplitGroups(householdId?: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['split', 'groups', { householdId }],
    queryFn: async () => {
      const response = await apiClient.get<SplitGroup[]>('/split/groups', {
        ...(householdId && { householdId }),
      });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * GET /split/debts?householdId=...
 * Lista todas as dívidas e suas parcelas
 */
export function useSplitDebts(householdId?: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['split', 'debts', { householdId }],
    queryFn: async () => {
      const response = await apiClient.get<SplitDebt[]>('/split/debts', {
        ...(householdId && { householdId }),
      });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

// ============================================================================
// Mutations (POST / PATCH / DELETE)
// ============================================================================

/**
 * POST /split/friends
 * Cria um novo amigo
 */
export function useCreateSplitFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSplitFriendPayload) => {
      const response = await apiClient.post<Friend>('/split/friends', payload);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'friends'] });
    },
  });
}

/**
 * PATCH /split/friends/:id/archive
 * Arquiva ou desarquiva um amigo
 */
export function useArchiveSplitFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: ArchiveSplitFriendPayload) => {
      const response = await apiClient.patch<Friend>(
        `/split/friends/${id}/archive`,
        { archived }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'friends'] });
    },
  });
}

/**
 * DELETE /split/friends/:id
 * Remove um amigo e suas dívidas
 */
export function useDeleteSplitFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendId: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/split/friends/${friendId}`
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'friends'] });
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * POST /split/groups
 * Cria um novo grupo de divisão
 */
export function useCreateSplitGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSplitGroupPayload) => {
      const response = await apiClient.post<SplitGroup>(
        '/split/groups',
        payload
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'groups'] });
    },
  });
}

/**
 * PATCH /split/groups/:id/archive
 * Arquiva ou desarquiva um grupo
 */
export function useArchiveSplitGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archived }: ArchiveSplitGroupPayload) => {
      const response = await apiClient.patch<SplitGroup>(
        `/split/groups/${id}/archive`,
        { archived }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'groups'] });
    },
  });
}

/**
 * DELETE /split/groups/:id
 * Exclui um grupo (mantendo as dívidas sem vínculo de grupo)
 */
export function useDeleteSplitGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/split/groups/${groupId}`
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * POST /split/debts
 * Cria uma nova despesa dividida (podendo gerar dívidas para múltiplos amigos e múltiplas parcelas)
 */
export function useCreateSplitDebts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSplitDebtPayload) => {
      const response = await apiClient.post<SplitDebt[]>(
        '/split/debts',
        payload
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * PATCH /split/debts/:debtId/installments/:installmentId
 * Marca ou desmarca uma parcela específica como paga (ex.: Pagar mês ou aba Parcelas)
 */
export function useToggleSplitInstallment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      debtId,
      installmentId,
      ...body
    }: ToggleInstallmentPayload) => {
      const response = await apiClient.patch<SplitDebt>(
        `/split/debts/${debtId}/installments/${installmentId}`,
        body
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * POST /split/debts/:debtId/settle
 * Quita uma dívida (integralmente ou parcialmente, com opção de abonar ou manter o restante)
 */
export function useSettleSplitDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ debtId, ...body }: SettleSplitDebtPayload) => {
      const response = await apiClient.post<SplitDebt>(
        `/split/debts/${debtId}/settle`,
        body
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * POST /split/friends/:friendId/settle-month
 * Quita todas as parcelas pendentes de um amigo no mês selecionado
 */
export function useSettleFriendMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ friendId, month }: SettleFriendMonthPayload) => {
      const response = await apiClient.post<SplitDebt[]>(
        `/split/friends/${friendId}/settle-month`,
        { month }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

/**
 * DELETE /split/debts/:debtId
 * Exclui o registro de uma dívida
 */
export function useDeleteSplitDebt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debtId: string) => {
      const response = await apiClient.delete<{ id: string }>(
        `/split/debts/${debtId}`
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
    },
  });
}

export interface LegacyCandidateTransaction {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  categoryName?: string;
  type: 'INCOME' | 'EXPENSE';
  accountId?: string;
  accountName?: string;
}

export interface SplitLegacyCandidatesResponse {
  debts: LegacyCandidateTransaction[];
  reimbursements: LegacyCandidateTransaction[];
}

/**
 * GET /split/legacy-candidates?householdId=...&includeAll=...
 * Busca todas as transações antigas de "Dívidas" e "Reembolso" no banco (sem o limite de 25 itens da home)
 * para alimentar o modal de conversão.
 */
export function useSplitLegacyCandidates(
  householdId?: string,
  includeAll: boolean = false,
  enabled: boolean = true
) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['split', 'legacy-candidates', { householdId, includeAll }],
    queryFn: async () => {
      const response = await apiClient.get<SplitLegacyCandidatesResponse>(
        '/split/legacy-candidates',
        {
          ...(householdId && { householdId }),
          includeAll: String(includeAll),
        }
      );
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId && enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export interface LegacyReimbursementEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
}

export interface LegacyImportItem {
  transactionId: string;
  reimbursementTransactionId?: string;
  reimbursementTransactionIds?: string[];
  reimbursements?: LegacyReimbursementEntry[];
  friendId: string;
  description: string;
  amount: number;
  date: string;
  accountId?: string;
  accountName?: string;
  paid: boolean;
  paidAmount?: number;
  paidAt?: string;
  forgiveRemainder?: boolean;
}

export interface ImportLegacySplitDebtsPayload {
  householdId?: string;
  deleteOriginalTransactions: boolean;
  items: LegacyImportItem[];
}

/**
 * POST /split/debts/import-legacy
 * Converte transações antigas (categorias "Dívidas" e "Reembolso") para dívidas do Splitwise
 */
export function useImportLegacySplitDebts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportLegacySplitDebtsPayload) => {
      const response = await apiClient.post<SplitDebt[]>(
        '/split/debts/import-legacy',
        payload
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split', 'debts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
