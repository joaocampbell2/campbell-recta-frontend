import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Plus,
  CheckCircle2,
  Clock,
  TrendingUp,
  Search,
  Trash2,
  Plane,
  Home,
  Utensils,
  PartyPopper,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  History,
  BarChart3,
  Wallet,
  Archive,
  ArchiveRestore,
  Settings,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { format, addMonths, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { useTransactions } from '../context/TransactionsContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useAccounts } from '../hooks/api/useAccounts';
import {
  useSplitFriends,
  useSplitGroups,
  useSplitDebts,
  useCreateSplitFriend,
  useArchiveSplitFriend,
  useDeleteSplitFriend,
  useCreateSplitGroup,
  useArchiveSplitGroup,
  useDeleteSplitGroup,
  useCreateSplitDebts,
  useToggleSplitInstallment,
  useSettleSplitDebt,
  useSettleFriendMonth,
  useDeleteSplitDebt,
  useImportLegacySplitDebts,
  type LegacyImportItem,
} from '../hooks/api/useSplitwise';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { PageButton } from '../components/PageButton';
import SplitContactModal from '../components/SplitContactModal';
import SplitDebtModal from '../components/SplitDebtModal';
import SplitDebtDetailModal from '../components/SplitDebtDetailModal';
import SplitSettleDebtModal, {
  type SettleDebtOptions,
} from '../components/SplitSettleDebtModal';
import SplitImportLegacyModal from '../components/SplitImportLegacyModal';
import ConfirmModal from '../components/ConfirmModal';
import {
  CategoryName,
  TransactionType,
  getCategoryDisplayName,
} from '../lib/enums';

// ============================================================================
// Types
// ============================================================================

export interface Friend {
  id: string;
  name: string;
  emailOrPix?: string;
  avatarColor: string;
  avatarUrl?: string;
  archived?: boolean;
}

export interface SplitGroup {
  id: string;
  name: string;
  category: 'trip' | 'home' | 'food' | 'party' | 'other';
  memberIds: string[]; // friend IDs
  avatarUrl?: string;
  archived?: boolean;
}

export interface DebtInstallment {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number; // Valor que a pessoa deve (ou que eu devo) nesta parcela
  dueDate: string; // YYYY-MM-DD
  paid: boolean;
  paidAt?: string;
  paidNote?: string;
}

export type SplitDirection = 'THEY_OWE_ME' | 'I_OWE_THEM';
export type SplitRule =
  | 'EQUAL'
  | 'PERCENTAGE'
  | 'UNEQUAL'
  | 'FIFTY_FIFTY'
  | 'FULL_AMOUNT'
  | 'EQUAL_GROUP'
  | 'CUSTOM';

export interface SplitDebt {
  id: string;
  description: string;
  category?: string;
  accountId?: string;
  accountName?: string;
  originalTotalAmount: number;
  debtTotalAmount: number;
  direction: SplitDirection;
  splitRule: SplitRule;
  friendId: string;
  groupId?: string;
  createdAt: string; // YYYY-MM-DD
  totalInstallments: number;
  installments: DebtInstallment[];
  forgivenAmount?: number;
}

const AVATAR_COLORS = [
  'bg-purple-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
];

const CHART_COLORS = [
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#6366f1',
  '#14b8a6',
  '#ec4899',
];

const STORAGE_KEYS = {
  IMPORTED_TX_IDS: 'recta_split_imported_tx_ids_v1',
  HIDE_LEGACY_TOOL: 'recta_split_hide_legacy_tool_v1',
  DEFAULT_REIMBURSEMENT_ACCOUNT: 'recta_split_default_reimbursement_account_v1',
  LAST_DEBT_ACCOUNT: 'recta_split_last_debt_account_v1',
};

// ============================================================================
// Component
// ============================================================================

const Loans: React.FC = () => {
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { error: showError, success: showSuccess } = useToastContext();
  const { householdId } = useDefaultHousehold();
  const {
    accounts: contextAccounts,
    transactions,
    customCategories,
    addTransaction,
    createInstallments,
    deleteTransaction,
  } = useTransactions();
  const { data: regularAccountsData } = useAccounts({ householdId: householdId || '' });

  // Queries & Mutations do Backend
  const { data: backendFriends } = useSplitFriends(householdId || undefined);
  const { data: backendGroups } = useSplitGroups(householdId || undefined);
  const { data: backendDebts } = useSplitDebts(householdId || undefined);

  const createFriendMutation = useCreateSplitFriend();
  const archiveFriendMutation = useArchiveSplitFriend();
  const deleteFriendMutation = useDeleteSplitFriend();
  const createGroupMutation = useCreateSplitGroup();
  const archiveGroupMutation = useArchiveSplitGroup();
  const deleteGroupMutation = useDeleteSplitGroup();
  const createDebtsMutation = useCreateSplitDebts();
  const toggleInstallmentMutation = useToggleSplitInstallment();
  const settleDebtMutation = useSettleSplitDebt();
  const settleFriendMonthMutation = useSettleFriendMonth();
  const deleteDebtMutation = useDeleteSplitDebt();
  const importLegacyMutation = useImportLegacySplitDebts();

  const userAccounts = useMemo(() => {
    const raw = regularAccountsData?.accounts?.length
      ? regularAccountsData.accounts
      : contextAccounts || [];
    return raw.map((acc) => ({
      id: acc.id || acc.name,
      name: acc.name,
    }));
  }, [regularAccountsData, contextAccounts]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    userAccounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [userAccounts]);

  const friends = useMemo(() => backendFriends ?? [], [backendFriends]);
  const groups = useMemo(() => backendGroups ?? [], [backendGroups]);
  const debts = useMemo(() => backendDebts ?? [], [backendDebts]);

  // Filters & Navigation State
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedFriendId, setSelectedFriendId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showArchivedGroups, setShowArchivedGroups] = useState<boolean>(false);
  const [showArchivedFriends, setShowArchivedFriends] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'open' | 'installments' | 'history'>('open');
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  // Modals State
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [addContactTab, setAddContactTab] = useState<'friend' | 'group'>('friend');
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);
  const [isImportLegacyOpen, setIsImportLegacyOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [defaultReimbursementAccountId, setDefaultReimbursementAccountId] = useState<string>(() => {
    try {
      const key = `${STORAGE_KEYS.DEFAULT_REIMBURSEMENT_ACCOUNT}_${householdId || 'default'}`;
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  });

  // Sync default reimbursement account when household or accounts change
  useEffect(() => {
    const key = `${STORAGE_KEYS.DEFAULT_REIMBURSEMENT_ACCOUNT}_${householdId || 'default'}`;
    let saved = '';
    try {
      saved = localStorage.getItem(key) || '';
    } catch {
      saved = '';
    }
    const isValidSaved = saved && userAccounts.some((acc) => acc.id === saved);
    if (isValidSaved) {
      setDefaultReimbursementAccountId(saved);
    } else if (userAccounts[0]?.id) {
      setDefaultReimbursementAccountId(userAccounts[0].id);
    } else {
      setDefaultReimbursementAccountId('');
    }
  }, [householdId, userAccounts]);

  const handleSelectDefaultReimbursementAccount = (accountId: string) => {
    setDefaultReimbursementAccountId(accountId);
    setIsMoreMenuOpen(false);
    try {
      const key = `${STORAGE_KEYS.DEFAULT_REIMBURSEMENT_ACCOUNT}_${householdId || 'default'}`;
      localStorage.setItem(key, accountId);
    } catch {
      // Ignore storage errors
    }
  };

  const defaultReimbursementAccountName = useMemo(() => {
    return (
      accountMap.get(defaultReimbursementAccountId) ||
      userAccounts[0]?.name ||
      'Conta padrão'
    );
  }, [accountMap, defaultReimbursementAccountId, userAccounts]);
  const [importedTxIds, setImportedTxIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.IMPORTED_TX_IDS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLegacyToolHidden, setIsLegacyToolHidden] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.HIDE_LEGACY_TOOL) === 'true';
  });
  const [selectedDebtDetailId, setSelectedDebtDetailId] = useState<string | null>(null);
  const [settleModalDebtId, setSettleModalDebtId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const selectedDebtDetail = useMemo(
    () => debts.find((d) => d.id === selectedDebtDetailId) || null,
    [debts, selectedDebtDetailId]
  );

  const settleModalDebt = useMemo(
    () => debts.find((d) => d.id === settleModalDebtId) || null,
    [debts, settleModalDebtId]
  );

  const openContactModal = (tab: 'friend' | 'group' = 'friend') => {
    setAddContactTab(tab);
    setIsAddFriendOpen(true);
  };

  // New Friend Form State
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendContact, setNewFriendContact] = useState('');
  const [newFriendPhoto, setNewFriendPhoto] = useState<string>('');

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory] = useState<SplitGroup['category']>('trip');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupPhoto, setNewGroupPhoto] = useState<string>('');

  // New Debt Form State
  const [addDebtStep, setAddDebtStep] = useState<1 | 2 | 3>(1);
  const [debtDesc, setDebtDesc] = useState('');
  const [debtCategory, setDebtCategory] = useState<string>(CategoryName.FOOD);
  const [debtAccountId, setDebtAccountId] = useState<string>('');
  const totalAmountMask = useCurrencyMask();
  const [debtDirection, setDebtDirection] = useState<SplitDirection>('THEY_OWE_ME');
  const [debtPayerFriendId, setDebtPayerFriendId] = useState<string>('');
  const [debtSplitRule, setDebtSplitRule] = useState<SplitRule>('EQUAL');
  const [debtGroupId, setDebtGroupId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [debtInstallmentsCount, setDebtInstallmentsCount] = useState<string>('1');
  const [equalIncludedIds, setEqualIncludedIds] = useState<string[]>([]);
  const [percentageByParticipant, setPercentageByParticipant] = useState<Record<string, string>>({});
  const [amountByParticipant, setAmountByParticipant] = useState<Record<string, string>>({});

  // Helper maps
  const friendMap = useMemo(() => {
    const map = new Map<string, Friend>();
    friends.forEach((f) => map.set(f.id, f));
    return map;
  }, [friends]);

  const groupMap = useMemo(() => {
    const map = new Map<string, SplitGroup>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const activeGroups = useMemo(
    () => groups.filter((g) => !g.archived),
    [groups]
  );

  const archivedGroups = useMemo(
    () => groups.filter((g) => g.archived),
    [groups]
  );

  const visibleGroups = showArchivedGroups ? archivedGroups : activeGroups;

  const activeFriends = useMemo(
    () => friends.filter((f) => !f.archived),
    [friends]
  );

  const archivedFriends = useMemo(
    () => friends.filter((f) => f.archived),
    [friends]
  );

  // ============================================================================
  // Per-Friend & Overall Financial Calculations (Mês vs Total!)
  // ============================================================================

  const friendStats = useMemo(() => {
    return friends.map((friend) => {
      let owedToMeTotal = 0;
      let owedToMeMonth = 0;
      let iOweTotal = 0;
      let iOweMonth = 0;

      debts
        .filter((d) => d.friendId === friend.id)
        .forEach((debt) => {
          debt.installments.forEach((inst) => {
            if (!inst.paid) {
              const instDate = parseISO(inst.dueDate);
              const isInSelectedMonth = isSameMonth(instDate, selectedMonth);

              if (debt.direction === 'THEY_OWE_ME') {
                owedToMeTotal += inst.amount;
                if (isInSelectedMonth) {
                  owedToMeMonth += inst.amount;
                }
              } else {
                iOweTotal += inst.amount;
                if (isInSelectedMonth) {
                  iOweMonth += inst.amount;
                }
              }
            }
          });
        });

      return {
        friend,
        owedToMeTotal,
        owedToMeMonth,
        iOweTotal,
        iOweMonth,
        netTotal: owedToMeTotal - iOweTotal,
        netMonth: owedToMeMonth - iOweMonth,
      };
    });
  }, [friends, debts, selectedMonth]);

  const visibleFriendStats = useMemo(
    () =>
      friendStats.filter((st) =>
        showArchivedFriends ? Boolean(st.friend.archived) : !st.friend.archived
      ),
    [friendStats, showArchivedFriends]
  );

  const overallTotals = useMemo(() => {
    return friendStats.reduce(
      (acc, curr) => {
        if (curr.netTotal > 0) acc.owedToMeTotal += curr.netTotal;
        if (curr.netTotal < 0) acc.iOweTotal += Math.abs(curr.netTotal);
        if (curr.netMonth > 0) acc.owedToMeMonth += curr.netMonth;
        if (curr.netMonth < 0) acc.iOweMonth += Math.abs(curr.netMonth);
        return acc;
      },
      { owedToMeTotal: 0, owedToMeMonth: 0, iOweTotal: 0, iOweMonth: 0 }
    );
  }, [friendStats]);

  // Chart data (quanto cada amigo me deve de saldo líquido no mês)
  const chartData = useMemo(() => {
    return friendStats
      .map((st, index) => ({
        name: st.friend.name,
        value: Number(Math.max(0, st.netMonth).toFixed(2)),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((item) => item.value > 0);
  }, [friendStats]);

  // Filtered Debts
  const filteredDebts = useMemo(() => {
    return debts.filter((debt) => {
      if (selectedFriendId !== 'all' && debt.friendId !== selectedFriendId) return false;
      if (selectedGroupId !== 'all' && debt.groupId !== selectedGroupId) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const fName = friendMap.get(debt.friendId)?.name.toLowerCase() || '';
        const gName = debt.groupId ? groupMap.get(debt.groupId)?.name.toLowerCase() || '' : '';
        if (
          !debt.description.toLowerCase().includes(q) &&
          !fName.includes(q) &&
          !gName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [debts, selectedFriendId, selectedGroupId, searchTerm, friendMap, groupMap]);

  const openDebts = useMemo(
    () => filteredDebts.filter((d) => d.installments.some((i) => !i.paid)),
    [filteredDebts]
  );

  const installmentDebts = useMemo(
    () => filteredDebts.filter((d) => d.totalInstallments > 1),
    [filteredDebts]
  );

  const historyDebts = useMemo(
    () => filteredDebts.filter((d) => d.installments.some((i) => i.paid)),
    [filteredDebts]
  );

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleFriendPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewFriendPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim() || createFriendMutation.isPending) return;
    const avatarColor = AVATAR_COLORS[friends.length % AVATAR_COLORS.length];
    try {
      await createFriendMutation.mutateAsync({
        householdId: householdId || undefined,
        name: newFriendName.trim(),
        emailOrPix: newFriendContact.trim() || undefined,
        avatarColor,
        avatarUrl: newFriendPhoto || undefined,
      });
      setNewFriendName('');
      setNewFriendContact('');
      setNewFriendPhoto('');
      setIsAddFriendOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao adicionar amigo');
    }
  };

  const handleToggleArchiveFriend = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = friends.find((f) => f.id === id);
    const nextArchived = !target?.archived;
    setConfirmDialog({
      title: nextArchived ? 'Arquivar amigo' : 'Desarquivar amigo',
      message: nextArchived
        ? `Deseja arquivar ${target?.name || 'este amigo'}? Ele sairá da lista principal, mas todo o histórico de dívidas continuará salvo.`
        : `Deseja reativar ${target?.name || 'este amigo'} na lista principal?`,
      confirmText: nextArchived ? 'Arquivar' : 'Desarquivar',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await archiveFriendMutation.mutateAsync({ id, archived: nextArchived });
          if (selectedFriendId === id) setSelectedFriendId('all');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao atualizar amigo');
        }
      },
    });
  };

  const handleRemoveFriend = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = friends.find((f) => f.id === id);
    setConfirmDialog({
      title: 'Excluir amigo',
      message: `Tem certeza que deseja excluir ${target?.name || 'este amigo'}? Todas as dívidas associadas a ele também serão apagadas. Se quiser manter o histórico, use a opção de arquivar.`,
      confirmText: 'Excluir amigo',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteFriendMutation.mutateAsync(id);
          if (selectedFriendId === id) setSelectedFriendId('all');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao excluir amigo');
        }
      },
    });
  };

  const handleGroupPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewGroupPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || createGroupMutation.isPending) return;
    try {
      await createGroupMutation.mutateAsync({
        householdId: householdId || undefined,
        name: newGroupName.trim(),
        category: newGroupCategory,
        memberIds: newGroupMembers,
        avatarUrl: newGroupPhoto || undefined,
      });
      setNewGroupName('');
      setNewGroupMembers([]);
      setNewGroupPhoto('');
      setIsAddFriendOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar grupo');
    }
  };

  const handleToggleArchiveGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = groups.find((g) => g.id === id);
    const nextArchived = !target?.archived;
    setConfirmDialog({
      title: nextArchived ? 'Arquivar grupo' : 'Desarquivar grupo',
      message: nextArchived
        ? `Deseja arquivar o grupo "${target?.name || ''}"? Ele ficará guardado nos arquivados com todo o histórico.`
        : `Deseja reativar o grupo "${target?.name || ''}" na lista principal?`,
      confirmText: nextArchived ? 'Arquivar' : 'Desarquivar',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await archiveGroupMutation.mutateAsync({ id, archived: nextArchived });
          if (selectedGroupId === id) setSelectedGroupId('all');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao atualizar grupo');
        }
      },
    });
  };

  const handleRemoveGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = groups.find((g) => g.id === id);
    setConfirmDialog({
      title: 'Excluir grupo',
      message: `Tem certeza que deseja excluir o grupo "${target?.name || ''}"? Se quiser guardar como histórico de viagem/evento, use a opção de arquivar.`,
      confirmText: 'Excluir grupo',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteGroupMutation.mutateAsync(id);
          if (selectedGroupId === id) setSelectedGroupId('all');
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao excluir grupo');
        }
      },
    });
  };

  const createReimbursementTransaction = (debt: SplitDebt, amount: number) => {
    if (debt.direction !== 'THEY_OWE_ME' || amount <= 0) return;

    const friend = friendMap.get(debt.friendId);
    const reimbursementCat = customCategories?.find((c) =>
      c.name.toLowerCase().includes('reembolso')
    );
    const categoryValue = reimbursementCat
      ? `CUSTOM:${reimbursementCat.id}`
      : getCategoryDisplayName(
          CategoryName.OTHER_INCOME,
          t as unknown as Record<string, string>
        );

    const chosenAccId = defaultReimbursementAccountId || debt.accountId;
    const validAccountId =
      chosenAccId && !chosenAccId.startsWith('acc-') ? chosenAccId : undefined;

    addTransaction({
      description: `Reembolso: ${debt.description}${friend ? ` (${friend.name})` : ''}`,
      amount: Number(amount.toFixed(2)),
      type: TransactionType.INCOME,
      category: categoryValue,
      date: new Date(),
      accountId: validAccountId,
      paid: true,
    }).catch(() => {
      // Mantém funcionamento local caso backend não esteja ativo
    });
  };

  const toggleInstallmentPaid = (debtId: string, installmentId: string, paidNote?: string) => {
    const targetDebt = debts.find((d) => d.id === debtId);
    const targetInst = targetDebt?.installments.find((i) => i.id === installmentId);
    if (!targetDebt || !targetInst) return;
    const nextPaid = !targetInst.paid;
    const paidAt = nextPaid ? format(new Date(), 'yyyy-MM-dd') : undefined;
    const note = nextPaid ? paidNote || 'Marcado como pago' : undefined;

    setConfirmDialog({
      title: nextPaid ? 'Confirmar pagamento da parcela' : 'Reabrir parcela',
      message: nextPaid
        ? `Deseja marcar a parcela ${targetInst.installmentNumber}/${targetInst.totalInstallments} de "${targetDebt.description}" (${formatCurrency(targetInst.amount, baseCurrency)}) como paga?`
        : `Deseja desmarcar o pagamento da parcela ${targetInst.installmentNumber}/${targetInst.totalInstallments} de "${targetDebt.description}" e deixá-la pendente novamente?`,
      confirmText: nextPaid ? 'Marcar como paga' : 'Reabrir parcela',
      variant: nextPaid ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          await toggleInstallmentMutation.mutateAsync({
            debtId,
            installmentId,
            paid: nextPaid,
            paidAt,
            paidNote: note,
          });

          if (nextPaid && targetDebt.direction === 'THEY_OWE_ME') {
            const otherUnpaidCount = targetDebt.installments.filter(
              (i) => i.id !== installmentId && !i.paid
            ).length;
            if (otherUnpaidCount === 0) {
              createReimbursementTransaction(targetDebt, targetDebt.debtTotalAmount);
            }
          }
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao atualizar parcela');
        }
      },
    });
  };

  const handleSettleAllDebt = (debtId: string) => {
    setSettleModalDebtId(debtId);
  };

  const handleConfirmSettleDebt = async (debtId: string, options: SettleDebtOptions) => {
    const targetDebt = debts.find((d) => d.id === debtId);
    if (!targetDebt) return;

    try {
      await settleDebtMutation.mutateAsync({
        debtId,
        ...options,
      });

      if (options.mode === 'full') {
        const unpaidSum = targetDebt.installments
          .filter((i) => !i.paid)
          .reduce((s, i) => s + i.amount, 0);

        createReimbursementTransaction(targetDebt, unpaidSum);
        setSelectedDebtDetailId(null);
        return;
      }

      const unpaid = targetDebt.installments.filter((i) => !i.paid);
      const remainingSum = unpaid.reduce((s, i) => s + i.amount, 0);
      const paidAmount = Number(options.paidAmount.toFixed(2));
      const remainder = Math.max(0, Number((remainingSum - paidAmount).toFixed(2)));

      if (paidAmount > 0) {
        createReimbursementTransaction(targetDebt, paidAmount);
      }

      if (options.forgiveRemainder) {
        if (remainder > 0) {
          const legacyMap: Record<string, CategoryName> = {
            food: CategoryName.FOOD,
            trip: CategoryName.TRANSPORTATION,
            market: CategoryName.GROCERIES,
            transport: CategoryName.TRANSPORTATION,
            leisure: CategoryName.ENTERTAINMENT,
            home: CategoryName.HOUSING,
            other: CategoryName.OTHER_EXPENSES,
          };
          const normalizedCat =
            (targetDebt.category && legacyMap[targetDebt.category]) ||
            targetDebt.category ||
            CategoryName.OTHER_EXPENSES;
          const catDisplay = getCategoryDisplayName(
            normalizedCat,
            t as unknown as Record<string, string>
          );
          const validAccountId =
            targetDebt.accountId && !targetDebt.accountId.startsWith('acc-')
              ? targetDebt.accountId
              : undefined;

          addTransaction({
            description: `Abono de dívida: ${targetDebt.description}`,
            amount: remainder,
            type: TransactionType.EXPENSE,
            category: catDisplay,
            date: new Date(),
            accountId: validAccountId,
            paid: true,
          }).catch(() => {});
        }

        setSelectedDebtDetailId(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao quitar dívida');
    }
  };

  const handleSettleFriendMonth = (friendId: string) => {
    const friend = friendMap.get(friendId);
    const monthLabel = format(selectedMonth, 'MMMM/yyyy', { locale: ptBR });
    setConfirmDialog({
      title: 'Quitar parcelas do mês',
      message: `Deseja marcar todas as parcelas pendentes de ${friend?.name || 'este amigo'} vencendo em ${monthLabel} como pagas?`,
      confirmText: 'Sim, quitar mês',
      variant: 'info',
      onConfirm: async () => {
        const newlySettledDebts = debts.filter((debt) => {
          if (debt.friendId !== friendId || debt.direction !== 'THEY_OWE_ME') return false;
          const wasOpen = debt.installments.some((i) => !i.paid);
          if (!wasOpen) return false;
          return debt.installments.every(
            (inst) => inst.paid || isSameMonth(parseISO(inst.dueDate), selectedMonth)
          );
        });

        try {
          await settleFriendMonthMutation.mutateAsync({
            friendId,
            month: format(selectedMonth, 'yyyy-MM'),
          });

          newlySettledDebts.forEach((debt) => {
            createReimbursementTransaction(debt, debt.debtTotalAmount);
          });
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao quitar parcelas do mês');
        }
      },
    });
  };

  const handleDeleteDebt = (debtId: string) => {
    const target = debts.find((d) => d.id === debtId);
    setConfirmDialog({
      title: 'Excluir registro de dívida',
      message: `Tem certeza que deseja excluir permanentemente o registro "${target?.description || ''}"?`,
      confirmText: 'Excluir registro',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDebtMutation.mutateAsync(debtId);
          setSelectedDebtDetailId(null);
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Erro ao excluir dívida');
        }
      },
    });
  };

  const handleGroupChange = (newGroupId: string) => {
    setDebtGroupId(newGroupId);
    if (!newGroupId) {
      setSelectedMemberIds([]);
    } else {
      const grp = groupMap.get(newGroupId);
      if (grp) {
        setSelectedMemberIds(grp.memberIds);
      }
    }
  };

  const toggleMemberSelection = (friendId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const availableMembersForSplit = useMemo(() => {
    const pool = debtGroupId
      ? activeFriends.filter((f) => groupMap.get(debtGroupId)?.memberIds.includes(f.id))
      : activeFriends;

    if (!memberSearchTerm.trim()) return pool;
    const q = memberSearchTerm.toLowerCase();
    return pool.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.emailOrPix && f.emailOrPix.toLowerCase().includes(q))
    );
  }, [debtGroupId, activeFriends, groupMap, memberSearchTerm]);

  const selectAllAvailable = () => {
    const poolIds = debtGroupId
      ? groupMap.get(debtGroupId)?.memberIds || []
      : activeFriends.map((f) => f.id);
    setSelectedMemberIds(poolIds);
  };

  const deselectAllAvailable = () => {
    setSelectedMemberIds([]);
  };

  const handleOpenAddDebt = () => {
    totalAmountMask.setValue('');
    setDebtDesc('');
    setDebtCategory(CategoryName.FOOD);
    const savedLastAccountId = localStorage.getItem(
      `${STORAGE_KEYS.LAST_DEBT_ACCOUNT}_${householdId || 'default'}`
    );
    const initialAccountId =
      savedLastAccountId && userAccounts.some((a) => a.id === savedLastAccountId)
        ? savedLastAccountId
        : userAccounts[0]?.id || '';
    setDebtAccountId(initialAccountId);
    setAddDebtStep(1);
    setDebtInstallmentsCount('1');
    setDebtDirection('THEY_OWE_ME');
    setDebtPayerFriendId('');
    setDebtSplitRule('EQUAL');
    setDebtGroupId('');
    setMemberSearchTerm('');
    setSelectedMemberIds([]);
    setEqualIncludedIds([]);
    setPercentageByParticipant({});
    setAmountByParticipant({});
    setIsAddDebtOpen(true);
  };

  const handleGoToStep3 = () => {
    const participants = ['me', ...selectedMemberIds];
    const total = totalAmountMask.numericValue;
    const n = participants.length;
    setEqualIncludedIds(participants);

    const pctMap: Record<string, string> = {};
    const amtMap: Record<string, string> = {};
    const basePct = Math.floor((100 / n) * 100) / 100;
    const baseAmt = Math.floor((total / n) * 100) / 100;

    participants.forEach((p, idx) => {
      if (idx === 0) {
        const remPct = Number((100 - basePct * (n - 1)).toFixed(2));
        const remAmt = Number((total - baseAmt * (n - 1)).toFixed(2));
        pctMap[p] = String(remPct);
        amtMap[p] = remAmt.toFixed(2).replace('.', ',');
      } else {
        pctMap[p] = String(basePct);
        amtMap[p] = baseAmt.toFixed(2).replace('.', ',');
      }
    });

    setPercentageByParticipant(pctMap);
    setAmountByParticipant(amtMap);
    setAddDebtStep(3);
  };

  const splitParticipants = useMemo(() => ['me', ...selectedMemberIds], [selectedMemberIds]);

  const participantShares = useMemo(() => {
    const total = totalAmountMask.numericValue;
    const shares: Record<string, number> = {};
    if (total <= 0 || splitParticipants.length === 0) return shares;

    if (debtSplitRule === 'EQUAL') {
      const active = equalIncludedIds.filter((id) => splitParticipants.includes(id));
      if (active.length === 0) return shares;
      const base = Math.floor((total / active.length) * 100) / 100;
      const remainderTargetId = active.includes('me') ? 'me' : active[0];
      active.forEach((id) => {
        if (id === remainderTargetId) {
          shares[id] = Number((total - base * (active.length - 1)).toFixed(2));
        } else {
          shares[id] = base;
        }
      });
    } else if (debtSplitRule === 'PERCENTAGE') {
      splitParticipants.forEach((id) => {
        const raw = (percentageByParticipant[id] || '0').replace(',', '.');
        const pct = parseFloat(raw) || 0;
        shares[id] = Number(((total * pct) / 100).toFixed(2));
      });
    } else {
      splitParticipants.forEach((id) => {
        const raw = (amountByParticipant[id] || '0').replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw) || 0;
        shares[id] = Number(val.toFixed(2));
      });
    }
    return shares;
  }, [
    totalAmountMask.numericValue,
    splitParticipants,
    debtSplitRule,
    equalIncludedIds,
    percentageByParticipant,
    amountByParticipant,
  ]);

  const distributedTotal = useMemo(() => {
    return Number(
      Object.values(participantShares)
        .reduce((acc, v) => acc + v, 0)
        .toFixed(2)
    );
  }, [participantShares]);

  const distributedPct = useMemo(() => {
    return Number(
      splitParticipants
        .reduce((acc, id) => {
          const raw = (percentageByParticipant[id] || '0').replace(',', '.');
          return acc + (parseFloat(raw) || 0);
        }, 0)
        .toFixed(2)
    );
  }, [splitParticipants, percentageByParticipant]);

  const isStep3Valid = useMemo(() => {
    const total = totalAmountMask.numericValue;
    if (total <= 0) return false;
    if (debtDirection === 'THEY_OWE_ME') {
      const anyFriendHasShare = selectedMemberIds.some((id) => (participantShares[id] || 0) > 0);
      if (!anyFriendHasShare) return false;
    } else {
      if ((participantShares['me'] || 0) <= 0) return false;
    }
    if (debtSplitRule === 'PERCENTAGE') {
      return Math.abs(distributedPct - 100) <= 0.5;
    }
    return Math.abs(distributedTotal - total) <= 0.05;
  }, [
    totalAmountMask.numericValue,
    debtDirection,
    selectedMemberIds,
    participantShares,
    debtSplitRule,
    distributedPct,
    distributedTotal,
  ]);

  const getDebtCategoryLabel = (cat?: string) => {
    if (!cat) return null;
    const legacyMap: Record<string, CategoryName> = {
      food: CategoryName.FOOD,
      trip: CategoryName.TRANSPORTATION,
      market: CategoryName.GROCERIES,
      transport: CategoryName.TRANSPORTATION,
      leisure: CategoryName.ENTERTAINMENT,
      home: CategoryName.HOUSING,
      other: CategoryName.OTHER_EXPENSES,
    };
    const normalized = legacyMap[cat] || cat;
    return getCategoryDisplayName(normalized, t as unknown as Record<string, string>);
  };

  const getDebtAccountName = (debt: SplitDebt) => {
    if (debt.accountId && accountMap.get(debt.accountId)) {
      return accountMap.get(debt.accountId)!;
    }
    if (debt.accountName) return debt.accountName;
    return userAccounts[0]?.name || 'Conta Principal';
  };

  const handleCreateDebt = async (e?: React.FormEvent, shouldCreateNew = false) => {
    e?.preventDefault();
    const numericTotal = totalAmountMask.numericValue;
    if (
      !debtDesc.trim() ||
      numericTotal <= 0 ||
      (debtDirection === 'THEY_OWE_ME' && !isStep3Valid) ||
      isSubmittingDebt ||
      createDebtsMutation.isPending
    ) {
      return;
    }

    const count = Math.max(1, parseInt(debtInstallmentsCount, 10) || 1);
    const chosenAccountId = debtAccountId || userAccounts[0]?.id || '';
    const chosenAccountName = accountMap.get(chosenAccountId) || userAccounts[0]?.name || '';
    if (chosenAccountId) {
      localStorage.setItem(
        `${STORAGE_KEYS.LAST_DEBT_ACCOUNT}_${householdId || 'default'}`,
        chosenAccountId
      );
    }

    const targetMemberIds = selectedMemberIds;
    if (targetMemberIds.length === 0) return;

    setIsSubmittingDebt(true);
    try {
      if (debtDirection === 'THEY_OWE_ME') {
        const shares = targetMemberIds
          .map((mId) => ({
            friendId: mId,
            debtTotalAmount: Number((participantShares[mId] || 0).toFixed(2)),
          }))
          .filter((s) => s.debtTotalAmount > 0);

        if (shares.length === 0) return;

        const created = await createDebtsMutation.mutateAsync({
          householdId: householdId || undefined,
          description: debtDesc.trim(),
          category: debtCategory,
          accountId: chosenAccountId,
          accountName: chosenAccountName,
          originalTotalAmount: numericTotal,
          direction: 'THEY_OWE_ME',
          splitRule: debtSplitRule,
          groupId: debtGroupId || undefined,
          totalInstallments: count,
          shares,
        });
        if (created?.[0]?.id) setExpandedDebtId(created[0].id);

        // Cria N transações (1 para a minha parte na categoria selecionada + 1 por amigo na categoria Dívidas)
        const validAccountId =
          chosenAccountId && !chosenAccountId.startsWith('acc-') ? chosenAccountId : undefined;
        const debtsCustomCat = customCategories?.find((c) => {
          const lower = c.name.toLowerCase();
          return lower.includes('dívida') || lower.includes('divida');
        });
        const debtsCategoryValue = debtsCustomCat
          ? `CUSTOM:${debtsCustomCat.id}`
          : CategoryName.DEBTS;
        const txNow = new Date();
        const txPayloads: Array<Parameters<typeof addTransaction>[0]> = [];

        const myShareAmount = Number((participantShares['me'] || 0).toFixed(2));
        if (myShareAmount > 0) {
          txPayloads.push({
            description: debtDesc.trim(),
            amount: myShareAmount,
            type: TransactionType.EXPENSE,
            category: debtCategory,
            date: txNow,
            accountId: validAccountId,
            paid: count === 1,
          });
        }

        shares.forEach((share) => {
          const friend = friendMap.get(share.friendId);
          txPayloads.push({
            description: `${debtDesc.trim()}${friend ? ` (${friend.name})` : ''}`,
            amount: share.debtTotalAmount,
            type: TransactionType.EXPENSE,
            category: debtsCategoryValue,
            date: txNow,
            accountId: validAccountId,
            paid: count === 1,
          });
        });

        if (count > 1) {
          for (const payload of txPayloads) {
            try {
              await createInstallments(payload, count);
            } catch {
              // Não interrompe a criação das demais séries se uma falhar
            }
          }
        } else {
          await Promise.allSettled(txPayloads.map((payload) => addTransaction(payload)));
        }
      } else {
        const payerFriendId =
          debtPayerFriendId && targetMemberIds.includes(debtPayerFriendId)
            ? debtPayerFriendId
            : targetMemberIds[0];
        const myDebtTotal = numericTotal;
        if (!payerFriendId || myDebtTotal <= 0) return;

        const created = await createDebtsMutation.mutateAsync({
          householdId: householdId || undefined,
          description: debtDesc.trim(),
          category: debtCategory,
          accountId: chosenAccountId,
          accountName: chosenAccountName,
          originalTotalAmount: numericTotal,
          direction: 'I_OWE_THEM',
          payerFriendId,
          splitRule: 'FULL_AMOUNT',
          groupId: debtGroupId || undefined,
          totalInstallments: count,
          shares: [
            {
              friendId: payerFriendId,
              debtTotalAmount: Number(myDebtTotal.toFixed(2)),
            },
          ],
        });
        if (created?.[0]?.id) setExpandedDebtId(created[0].id);

        // Cria a transação da minha parte na categoria escolhida (parcelada se count > 1)
        const validAccountId =
          chosenAccountId && !chosenAccountId.startsWith('acc-') ? chosenAccountId : undefined;
        const myTxPayload: Parameters<typeof addTransaction>[0] = {
          description: debtDesc.trim(),
          amount: Number(myDebtTotal.toFixed(2)),
          type: TransactionType.EXPENSE,
          category: debtCategory,
          date: new Date(),
          accountId: validAccountId,
          paid: count === 1,
        };
        try {
          if (count > 1) {
            await createInstallments(myTxPayload, count);
          } else {
            await addTransaction(myTxPayload);
          }
        } catch {
          // Não interrompe o fluxo caso a criação da transação falhe
        }
      }

      // Reset form
      setDebtDesc('');
      totalAmountMask.setValue('');
      setDebtInstallmentsCount('1');
      setPercentageByParticipant({});
      setAmountByParticipant({});
      setAddDebtStep(1);
      if (shouldCreateNew) {
        showSuccess('Dívida criada com sucesso!');
      } else {
        setIsAddDebtOpen(false);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar despesa dividida');
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  const handleImportLegacyDebts = async (
    items: LegacyImportItem[],
    deleteOriginals: boolean,
    hideToolAfter: boolean
  ) => {
    try {
      await importLegacyMutation.mutateAsync({
        householdId: householdId || undefined,
        items,
        deleteOriginalTransactions: deleteOriginals,
      });

      items.forEach((item) => {
        const paidAmt =
          item.paid && item.paidAmount !== undefined ? item.paidAmount : item.amount;
        const isPartial = item.paid && paidAmt < item.amount - 0.01;
        const remainder = isPartial
          ? Number((item.amount - paidAmt).toFixed(2))
          : 0;

        if (isPartial && item.forgiveRemainder && remainder > 0) {
          const catDisplay = getCategoryDisplayName(
            CategoryName.OTHER_EXPENSES,
            t as unknown as Record<string, string>
          );
          const validAccountId =
            item.accountId && !item.accountId.startsWith('acc-')
              ? item.accountId
              : undefined;
          const expenseDate = new Date(`${item.paidAt || item.date}T12:00:00`);

          addTransaction({
            description: `Abono de dívida: ${item.description}`,
            amount: remainder,
            type: TransactionType.EXPENSE,
            category: catDisplay,
            date: !isNaN(expenseDate.getTime()) ? expenseDate : new Date(),
            accountId: validAccountId,
            paid: true,
          }).catch(() => {});
        }
      });

      const newImportedIds = items.flatMap((i) =>
        i.reimbursementTransactionIds && i.reimbursementTransactionIds.length > 0
          ? [i.transactionId, ...i.reimbursementTransactionIds]
          : i.reimbursementTransactionId
          ? [i.transactionId, i.reimbursementTransactionId]
          : [i.transactionId]
      );
      const updatedImportedIds = Array.from(new Set([...importedTxIds, ...newImportedIds]));
      setImportedTxIds(updatedImportedIds);
      localStorage.setItem(STORAGE_KEYS.IMPORTED_TX_IDS, JSON.stringify(updatedImportedIds));

      if (hideToolAfter) {
        setIsLegacyToolHidden(true);
        localStorage.setItem(STORAGE_KEYS.HIDE_LEGACY_TOOL, 'true');
      }

      if (deleteOriginals) {
        newImportedIds.forEach((txId) => {
          if (!txId.startsWith('legacy-')) {
            deleteTransaction(txId).catch(() => {});
          }
        });
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao converter transações antigas');
    }
  };

  const getGroupIcon = (cat?: SplitGroup['category']) => {
    switch (cat) {
      case 'trip':
        return Plane;
      case 'home':
        return Home;
      case 'food':
        return Utensils;
      case 'party':
        return PartyPopper;
      default:
        return Users;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in pb-16 space-y-8">
      {/* Header */}
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5 flex-wrap">
            <span>Divisão de Contas & Amigos</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
              ALPHA
            </span>
          </span>
        }
        description="Gerencie despesas compartilhadas, grupos e acompanhe o saldo mensal e total por amigo."
      >
        <div className="inline-flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400 mr-1">
          <button
            type="button"
            onClick={() => setSelectedMonth((prev) => addMonths(prev, -1))}
            className="p-1 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-medium capitalize text-gray-700 dark:text-gray-300 px-1">
            {format(selectedMonth, 'MMM yy', { locale: ptBR })}
          </span>
          <button
            type="button"
            onClick={() => setSelectedMonth((prev) => addMonths(prev, 1))}
            className="p-1 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <PageButton
          onClick={() => openContactModal('friend')}
          variant="secondary"
          icon={UserPlus}
          mobileLabel="Amigo"
        >
          Novo Amigo
        </PageButton>
        <PageButton
          onClick={handleOpenAddDebt}
          variant="primary"
          icon={Plus}
          mobileLabel="Dividir"
        >
          Nova Despesa
        </PageButton>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Configurações da página"
            aria-label="Configurações da página"
          >
            <Settings className="w-4 h-4" />
          </button>
          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-64 z-40 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-lg py-1.5">
                <div className="px-3.5 py-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  Conta padrão de reembolsos
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {userAccounts.map((acc) => {
                    const isSelected = acc.id === defaultReimbursementAccountId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectDefaultReimbursementAccount(acc.id)}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-primary-50/50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <span className="truncate">{acc.name}</span>
                        {isSelected && <span className="text-xs ml-2">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {!isLegacyToolHidden && (
                  <>
                    <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsImportLegacyOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Converter transações antigas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsLegacyToolHidden(true);
                        localStorage.setItem(STORAGE_KEYS.HIDE_LEGACY_TOOL, 'true');
                      }}
                      className="w-full px-3.5 py-2 text-left text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Ocultar este atalho
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </PageHeader>

      {/* 4 KPI Cards: Separando MÊS vs TOTAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Me devem NO MÊS */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              A Receber no Mês
            </span>
            <ArrowDownLeft className="w-5 h-5 flex-shrink-0" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-3">
            {formatCurrency(overallTotals.owedToMeMonth, baseCurrency)}
          </h3>
        </div>

        {/* Card 2: Me devem NO TOTAL */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              A Receber no Total
            </span>
            <TrendingUp className="w-5 h-5 flex-shrink-0" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-3">
            {formatCurrency(overallTotals.owedToMeTotal, baseCurrency)}
          </h3>
        </div>

        {/* Card 3: Eu devo NO MÊS / TOTAL */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              Eu Devo no Mês
            </span>
            <ArrowUpRight className="w-5 h-5 flex-shrink-0" />
          </div>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-3">
            {formatCurrency(overallTotals.iOweMonth, baseCurrency)}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total acumulado: {formatCurrency(overallTotals.iOweTotal, baseCurrency)}
          </p>
        </div>

        {/* Card 4: Balanço Líquido */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              Saldo Líquido Geral
            </span>
            <Wallet className="w-5 h-5 flex-shrink-0" />
          </div>
          <h3
            className={`text-2xl font-bold mt-3 ${
              overallTotals.owedToMeTotal - overallTotals.iOweTotal >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(overallTotals.owedToMeTotal - overallTotals.iOweTotal, baseCurrency)}
          </h3>
        </div>
      </div>

      {/* Main Grid: Grupos & Amigos (Esquerda) + Gráfico e Dívidas (Direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Coluna 1: Grupos + Lista de Amigos (4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          {/* Card de Grupos Reimaginado (Vertical / Compacto na Sidebar) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Grupos
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {visibleGroups.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedGroupId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedGroupId('all')}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors mr-1"
                  >
                    Ver todos
                  </button>
                )}
                {(archivedGroups.length > 0 || showArchivedGroups) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchivedGroups((prev) => !prev);
                      setSelectedGroupId('all');
                    }}
                    className={`p-2 rounded-xl transition-colors ${
                      showArchivedGroups
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={
                      showArchivedGroups
                        ? 'Voltar para grupos ativos'
                        : 'Ver grupos arquivados'
                    }
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openContactModal('group')}
                  className="p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors"
                  title="Novo grupo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {visibleGroups.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                {showArchivedGroups
                  ? 'Nenhum grupo arquivado.'
                  : 'Nenhum grupo ativo.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibleGroups.map((group) => {
                  const Icon = getGroupIcon(group.category);
                  const isSelected = selectedGroupId === group.id;
                  const groupMembers = group.memberIds
                    .map((id) => friendMap.get(id))
                    .filter((f): f is Friend => Boolean(f));
                  const groupUnpaidTotal = debts
                    .filter((d) => d.groupId === group.id)
                    .reduce(
                      (sum, d) =>
                        sum +
                        d.installments
                          .filter((i) => !i.paid)
                          .reduce(
                            (s, i) =>
                              s + (d.direction === 'THEY_OWE_ME' ? i.amount : -i.amount),
                            0
                          ),
                      0
                    );

                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroupId(isSelected ? 'all' : group.id)}
                      className={`group cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-primary-500 ring-1 ring-primary-500'
                          : 'border-gray-100 dark:border-gray-700/70 hover:border-gray-200 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {group.avatarUrl ? (
                          <img
                            src={group.avatarUrl}
                            alt={group.name}
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Icon className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {group.name}
                          </h4>
                          {/* Avatares empilhados dos membros do grupo */}
                          <div className="flex items-center -space-x-1.5 mt-1">
                            {groupMembers.slice(0, 5).map((member) => {
                              const mInitials = member.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase();
                              return member.avatarUrl ? (
                                <img
                                  key={member.id}
                                  src={member.avatarUrl}
                                  alt={member.name}
                                  title={member.name}
                                  className="w-5 h-5 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                                />
                              ) : (
                                <div
                                  key={member.id}
                                  title={member.name}
                                  className={`w-5 h-5 rounded-full ${member.avatarColor} text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-800`}
                                >
                                  {mInitials}
                                </div>
                              );
                            })}
                            {groupMembers.length > 5 && (
                              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                                +{groupMembers.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`text-xs font-bold mr-1 ${
                            groupUnpaidTotal > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : groupUnpaidTotal < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {groupUnpaidTotal > 0 ? '+' : groupUnpaidTotal < 0 ? '-' : ''}
                          {formatCurrency(Math.abs(groupUnpaidTotal), baseCurrency)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleToggleArchiveGroup(group.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-all"
                          title={
                            group.archived ? 'Desarquivar grupo' : 'Arquivar grupo'
                          }
                        >
                          {group.archived ? (
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveGroup(group.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                          title="Excluir grupo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Amigos
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {visibleFriendStats.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedFriendId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedFriendId('all')}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors mr-1"
                  >
                    Ver todos
                  </button>
                )}
                {(archivedFriends.length > 0 || showArchivedFriends) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchivedFriends((prev) => !prev);
                      setSelectedFriendId('all');
                    }}
                    className={`p-2 rounded-xl transition-colors ${
                      showArchivedFriends
                        ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={
                      showArchivedFriends
                        ? 'Voltar para amigos ativos'
                        : 'Ver amigos arquivados'
                    }
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => openContactModal('friend')}
                  className="p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors"
                  title="Adicionar Amigo"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleFriendStats.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  {showArchivedFriends
                    ? 'Nenhum amigo arquivado.'
                    : 'Nenhum amigo ativo.'}
                </div>
              ) : (
                visibleFriendStats.map(
                  ({
                    friend,
                    owedToMeMonth,
                    netMonth,
                    netTotal,
                  }) => {
                    const isSelected = selectedFriendId === friend.id;
                    const initials = friend.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={friend.id}
                        onClick={() =>
                          setSelectedFriendId(isSelected ? 'all' : friend.id)
                        }
                        className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary-500 ring-1 ring-primary-500'
                            : 'border-gray-100 dark:border-gray-700/70 hover:border-gray-200 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {friend.avatarUrl ? (
                              <img
                                src={friend.avatarUrl}
                                alt={friend.name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                              />
                            ) : (
                              <div
                                className={`w-10 h-10 rounded-full ${friend.avatarColor} text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm`}
                              >
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {friend.name}
                              </h4>
                              {friend.emailOrPix && (
                                <p className="text-xs text-gray-400 truncate">
                                  Pix/Contato: {friend.emailOrPix}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleArchiveFriend(friend.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-all"
                              title={
                                friend.archived
                                  ? 'Desarquivar amigo'
                                  : 'Arquivar amigo'
                              }
                            >
                              {friend.archived ? (
                                <ArchiveRestore className="w-4 h-4" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveFriend(friend.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                              title="Remover amigo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Saldo líquido NO MÊS vs NO TOTAL */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                          <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                            <span className="text-[10px] font-bold uppercase text-gray-400 block">
                              {netMonth >= 0 ? 'Me deve no Mês' : 'Eu devo no Mês'}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                netMonth > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : netMonth < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {formatCurrency(Math.abs(netMonth), baseCurrency)}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                            <span className="text-[10px] font-bold uppercase text-gray-400 block">
                              {netTotal >= 0 ? 'Me deve no Total' : 'Eu devo no Total'}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                netTotal > 0
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : netTotal < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {formatCurrency(Math.abs(netTotal), baseCurrency)}
                            </span>
                          </div>
                        </div>

                        {/* Botão rápido para quitar o mês do amigo */}
                        {(netMonth !== 0 || owedToMeMonth > 0) && (
                          <div className="mt-2.5 flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSettleFriendMonth(friend.id);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Quitar parcelas de{' '}
                              {format(selectedMonth, 'MMM', { locale: ptBR })}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>

        {/* Coluna 2: Gráfico + Lista de Dívidas em Aberto & Histórico (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Gráfico de Círculo: Quanto cada amigo me deve no mês */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Quanto cada um me deve em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
            </div>

            {chartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-gray-400">
                Nenhum valor a receber neste mês.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          formatCurrency(value, baseCurrency),
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          borderColor: '#374151',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2.5">
                  {chartData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCurrency(item.value, baseCurrency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Abas e Busca: Dívidas em Aberto | Parcelas | Histórico */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              {/* Tabs */}
              <div className="flex bg-gray-100 dark:bg-gray-700/70 p-1 rounded-xl w-full sm:w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('open')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'open'
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Dívidas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('installments')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'installments'
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Histórico
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Indicador claro quando um amigo ou grupo está selecionado */}
            {(selectedFriendId !== 'all' || selectedGroupId !== 'all') && (
              <div className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400">
                <span>Dívidas de:</span>

                {selectedGroupId !== 'all' &&
                  (() => {
                    const selGroup = groupMap.get(selectedGroupId);
                    if (!selGroup) return null;
                    const GroupIcon = getGroupIcon(selGroup.category);
                    return (
                      <div className="inline-flex items-center gap-1.5">
                        {selGroup.avatarUrl ? (
                          <img
                            src={selGroup.avatarUrl}
                            alt={selGroup.name}
                            title={selGroup.name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            title={selGroup.name}
                            className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 text-primary-600 dark:text-primary-400 flex items-center justify-center"
                          >
                            <GroupIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedGroupId('all')}
                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5"
                          title="Remover filtro de grupo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}

                {selectedFriendId !== 'all' &&
                  (() => {
                    const selFriend = friendMap.get(selectedFriendId);
                    if (!selFriend) return null;
                    const fInitials = selFriend.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div className="inline-flex items-center gap-1.5">
                        {selFriend.avatarUrl ? (
                          <img
                            src={selFriend.avatarUrl}
                            alt={selFriend.name}
                            title={selFriend.name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            title={selFriend.name}
                            className={`w-7 h-7 rounded-full ${selFriend.avatarColor} text-white font-bold text-[10px] flex items-center justify-center`}
                          >
                            {fInitials}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedFriendId('all')}
                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5"
                          title="Remover filtro de amigo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* TAB 1: DÍVIDAS QUE AINDA NÃO FORAM PAGAS */}
            {activeTab === 'open' && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {openDebts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Nenhuma dívida pendente
                    </h4>
                  </div>
                ) : (
                  openDebts.map((debt) => {
                    const friend = friendMap.get(debt.friendId);
                    const unpaidInstallments = debt.installments.filter((i) => !i.paid);
                    const remainingAmount = unpaidInstallments.reduce(
                      (s, i) => s + i.amount,
                      0
                    );
                    const isTheyOweMe = debt.direction === 'THEY_OWE_ME';
                    const initials = (friend?.name || 'A')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={debt.id}
                        onClick={() => setSelectedDebtDetailId(debt.id)}
                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/20 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {friend?.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.name}
                              title={friend.name}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              title={friend?.name}
                              className={`w-9 h-9 rounded-full ${
                                friend?.avatarColor || 'bg-primary-600'
                              } text-white font-bold text-xs flex items-center justify-center flex-shrink-0`}
                            >
                              {initials}
                            </div>
                          )}

                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {debt.description}
                          </span>
                        </div>

                        <span
                          className={`text-sm font-semibold flex-shrink-0 ${
                            isTheyOweMe
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isTheyOweMe ? '+' : '-'}
                          {formatCurrency(remainingAmount, baseCurrency)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: PARCELAS (TODAS AS DIVISÕES QUE SÃO PARCELADAS) */}
            {activeTab === 'installments' && (
              <div className="space-y-4">
                {installmentDebts.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma divisão parcelada encontrada.
                  </div>
                ) : (
                  installmentDebts.map((debt) => {
                    const friend = friendMap.get(debt.friendId);
                    const group = debt.groupId ? groupMap.get(debt.groupId) : undefined;
                    const isExpanded = expandedDebtId === debt.id;
                    const isTheyOweMe = debt.direction === 'THEY_OWE_ME';
                    const paidCount = debt.installments.filter((i) => i.paid).length;
                    const paidPct =
                      debt.totalInstallments > 0
                        ? (paidCount / debt.totalInstallments) * 100
                        : 0;
                    const remainingAmount = debt.installments
                      .filter((i) => !i.paid)
                      .reduce((s, i) => s + i.amount, 0);
                    const installmentValue = debt.installments[0]?.amount || 0;

                    return (
                      <div
                        key={debt.id}
                        className="rounded-xl border border-gray-100 dark:border-gray-700/80 bg-gray-50/40 dark:bg-gray-800/40 overflow-hidden"
                      >
                        <div
                          onClick={() =>
                            setExpandedDebtId(isExpanded ? null : debt.id)
                          }
                          className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {debt.description}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  isTheyOweMe
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {isTheyOweMe
                                  ? `${friend?.name || 'Amigo'} me deve`
                                  : `Eu devo para ${friend?.name || 'Amigo'}`}
                              </span>
                              {group && (
                                <span className="text-xs text-gray-400">
                                  • {group.name}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-3">
                              <div>
                                <span className="text-[10px] font-semibold uppercase text-gray-400 block">
                                  Total da Pessoa
                                </span>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(debt.debtTotalAmount, baseCurrency)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold uppercase text-gray-400 block">
                                  Parcelas
                                </span>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                  {debt.totalInstallments}x{' '}
                                  {formatCurrency(installmentValue, baseCurrency)}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-semibold uppercase text-gray-400 block">
                                  Restante
                                </span>
                                <span
                                  className={`text-xs font-bold ${
                                    isTheyOweMe
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {formatCurrency(remainingAmount, baseCurrency)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                              {paidCount}/{debt.totalInstallments} pagas
                            </span>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Barra de progresso */}
                        <div className="px-4 pb-3">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-primary-600 h-full transition-all duration-300"
                              style={{ width: `${paidPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Lista de parcelas */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-gray-700/80 bg-white dark:bg-gray-900/50 p-4">
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                              {debt.installments.map((inst) => {
                                const isCurrentMonth = isSameMonth(
                                  parseISO(inst.dueDate),
                                  selectedMonth
                                );
                                return (
                                  <div
                                    key={inst.id}
                                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-10">
                                        {inst.installmentNumber}/{inst.totalInstallments}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                        {format(parseISO(inst.dueDate), 'MMM yyyy', {
                                          locale: ptBR,
                                        })}
                                      </span>
                                      {isCurrentMonth && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                                          Mês selecionado
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(inst.amount, baseCurrency)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleInstallmentPaid(debt.id, inst.id)
                                        }
                                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                                          inst.paid
                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                      >
                                        {inst.paid ? (
                                          <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Pago
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="w-3.5 h-3.5" />
                                            Pendente
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: HISTÓRICO */}
            {activeTab === 'history' && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {historyDebts.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                    Nenhum pagamento registrado no histórico.
                  </div>
                ) : (
                  historyDebts.map((debt) => {
                    const friend = friendMap.get(debt.friendId);
                    const paidSum = debt.installments
                      .filter((i) => i.paid)
                      .reduce((s, i) => s + i.amount, 0);
                    const initials = (friend?.name || 'A')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={debt.id}
                        onClick={() => setSelectedDebtDetailId(debt.id)}
                        className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/20 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {friend?.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.name}
                              title={friend.name}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              title={friend?.name}
                              className={`w-9 h-9 rounded-full ${
                                friend?.avatarColor || 'bg-primary-600'
                              } text-white font-bold text-xs flex items-center justify-center flex-shrink-0`}
                            >
                              {initials}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {debt.description}
                          </span>
                        </div>

                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          {formatCurrency(paidSum, baseCurrency)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SplitContactModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        activeTab={addContactTab}
        onTabChange={setAddContactTab}
        friends={activeFriends}
        newFriendName={newFriendName}
        onFriendNameChange={setNewFriendName}
        newFriendContact={newFriendContact}
        onFriendContactChange={setNewFriendContact}
        newFriendPhoto={newFriendPhoto}
        onFriendPhotoChange={handleFriendPhotoChange}
        onRemoveFriendPhoto={() => setNewFriendPhoto('')}
        onAddFriend={handleAddFriend}
        newGroupName={newGroupName}
        onGroupNameChange={setNewGroupName}
        newGroupMembers={newGroupMembers}
        onToggleGroupMember={(friendId) =>
          setNewGroupMembers((prev) =>
            prev.includes(friendId)
              ? prev.filter((id) => id !== friendId)
              : [...prev, friendId]
          )
        }
        newGroupPhoto={newGroupPhoto}
        onGroupPhotoChange={handleGroupPhotoChange}
        onRemoveGroupPhoto={() => setNewGroupPhoto('')}
        onAddGroup={handleAddGroup}
        isSubmitting={createFriendMutation.isPending || createGroupMutation.isPending}
      />

      <SplitDebtModal
        isOpen={isAddDebtOpen}
        onClose={() => setIsAddDebtOpen(false)}
        step={addDebtStep}
        onStepChange={setAddDebtStep}
        baseCurrency={baseCurrency}
        householdId={householdId}
        groups={activeGroups}
        debtGroupId={debtGroupId}
        onGroupChange={handleGroupChange}
        memberSearchTerm={memberSearchTerm}
        onMemberSearchTermChange={setMemberSearchTerm}
        availableMembersForSplit={availableMembersForSplit}
        selectedMemberIds={selectedMemberIds}
        onToggleMemberSelection={toggleMemberSelection}
        onSelectAllAvailable={selectAllAvailable}
        onDeselectAllAvailable={deselectAllAvailable}
        debtDirection={debtDirection}
        onDirectionChange={setDebtDirection}
        payerFriendId={debtPayerFriendId}
        onPayerFriendChange={setDebtPayerFriendId}
        debtCategory={debtCategory}
        onCategoryChange={setDebtCategory}
        userAccounts={userAccounts}
        debtAccountId={debtAccountId}
        onAccountChange={(accountId) => {
          setDebtAccountId(accountId);
          if (accountId) {
            localStorage.setItem(
              `${STORAGE_KEYS.LAST_DEBT_ACCOUNT}_${householdId || 'default'}`,
              accountId
            );
          }
        }}
        debtDesc={debtDesc}
        onDescChange={setDebtDesc}
        totalAmountValue={totalAmountMask.value}
        totalAmountNumeric={totalAmountMask.numericValue}
        onTotalAmountChange={totalAmountMask.onChange}
        debtInstallmentsCount={debtInstallmentsCount}
        onInstallmentsCountChange={setDebtInstallmentsCount}
        onGoToStep3={handleGoToStep3}
        debtSplitRule={debtSplitRule}
        onSplitRuleChange={setDebtSplitRule}
        splitParticipants={splitParticipants}
        friendMap={friendMap}
        participantShares={participantShares}
        equalIncludedIds={equalIncludedIds}
        onToggleEqualIncluded={(id) =>
          setEqualIncludedIds((prev) =>
            prev.includes(id)
              ? prev.filter((item) => item !== id)
              : [...prev, id]
          )
        }
        percentageByParticipant={percentageByParticipant}
        onPercentageChange={(id, val) => {
          if (splitParticipants.length === 2) {
            const otherId = splitParticipants.find((p) => p !== id);
            const rawNum = parseFloat(val.replace(',', '.'));
            const num = Number.isNaN(rawNum) ? 0 : Math.max(0, rawNum);
            if (num > 100) {
              setPercentageByParticipant((prev) => ({
                ...prev,
                [id]: '100',
                ...(otherId ? { [otherId]: '0' } : {}),
              }));
            } else {
              const rem = Number((100 - num).toFixed(2));
              setPercentageByParticipant((prev) => ({
                ...prev,
                [id]: val,
                ...(otherId ? { [otherId]: String(rem) } : {}),
              }));
            }
            return;
          }
          setPercentageByParticipant((prev) => ({
            ...prev,
            [id]: val,
          }));
        }}
        amountByParticipant={amountByParticipant}
        onAmountChange={(id, val) => {
          if (splitParticipants.length === 2) {
            const otherId = splitParticipants.find((p) => p !== id);
            const total = totalAmountMask.numericValue;
            const rawNum = parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
            const clamped = Math.min(total, Math.max(0, rawNum));
            const rem = Math.max(0, Number((total - clamped).toFixed(2)));
            setAmountByParticipant((prev) => ({
              ...prev,
              [id]: clamped.toFixed(2).replace('.', ','),
              ...(otherId ? { [otherId]: rem.toFixed(2).replace('.', ',') } : {}),
            }));
            return;
          }
          setAmountByParticipant((prev) => ({
            ...prev,
            [id]: val,
          }));
        }}
        distributedTotal={distributedTotal}
        distributedPct={distributedPct}
        isStep3Valid={isStep3Valid}
        isSubmitting={isSubmittingDebt || createDebtsMutation.isPending}
        onSubmit={handleCreateDebt}
        onSaveAndCreateNew={() => {
          void handleCreateDebt(undefined, true);
        }}
      />

      <SplitDebtDetailModal
        debt={selectedDebtDetail}
        onClose={() => setSelectedDebtDetailId(null)}
        onDelete={handleDeleteDebt}
        onPayMonth={(debtId, installmentId) =>
          toggleInstallmentPaid(debtId, installmentId, 'Parcela do mês paga')
        }
        onSettleAll={handleSettleAllDebt}
        selectedMonth={selectedMonth}
        friend={
          selectedDebtDetail
            ? friendMap.get(selectedDebtDetail.friendId)
            : undefined
        }
        group={
          selectedDebtDetail?.groupId
            ? groupMap.get(selectedDebtDetail.groupId)
            : undefined
        }
        accountName={
          selectedDebtDetail ? getDebtAccountName(selectedDebtDetail) : ''
        }
        categoryLabel={
          selectedDebtDetail
            ? getDebtCategoryLabel(selectedDebtDetail.category)
            : null
        }
        baseCurrency={baseCurrency}
      />

      <SplitSettleDebtModal
        debt={settleModalDebt}
        accountName={settleModalDebt ? getDebtAccountName(settleModalDebt) : ''}
        reimbursementAccountName={defaultReimbursementAccountName}
        baseCurrency={baseCurrency}
        onClose={() => setSettleModalDebtId(null)}
        onConfirm={handleConfirmSettleDebt}
      />

      <SplitImportLegacyModal
        isOpen={isImportLegacyOpen}
        onClose={() => setIsImportLegacyOpen(false)}
        householdId={householdId}
        friends={activeFriends}
        transactions={transactions}
        accountMap={accountMap}
        baseCurrency={baseCurrency}
        importedTxIds={importedTxIds}
        onImport={handleImportLegacyDebts}
      />

      <ConfirmModal
        isOpen={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.onConfirm()}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        confirmText={confirmDialog?.confirmText}
        cancelText="Cancelar"
        variant={confirmDialog?.variant || 'danger'}
      />
    </div>
  );
};

export default Loans;
