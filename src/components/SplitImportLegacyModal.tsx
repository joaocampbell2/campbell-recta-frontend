import React, { useState, useMemo, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, formatDate } from '../utils/format';
import { CategoryName, TransactionType } from '../lib/enums';
import type { Transaction } from '../types';
import type { Friend } from '../pages/Loans';
import {
  useSplitLegacyCandidates,
  type LegacyImportItem,
} from '../hooks/api/useSplitwise';

interface SplitImportLegacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId?: string | null;
  friends: Friend[];
  transactions: Transaction[];
  accountMap: Map<string, string>;
  baseCurrency: string;
  importedTxIds: string[];
  onImport: (
    items: LegacyImportItem[],
    deleteOriginals: boolean,
    hideToolAfter: boolean
  ) => void;
}

interface CandidateTx {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  categoryName?: string;
  type: TransactionType;
  accountId?: string;
  accountName: string;
}

const SplitImportLegacyModal: React.FC<SplitImportLegacyModalProps> = ({
  isOpen,
  onClose,
  householdId,
  friends,
  transactions,
  accountMap,
  baseCurrency,
  importedTxIds,
  onImport,
}) => {
  const [filterMode, setFilterMode] = useState<'legacy_only' | 'all'>('legacy_only');
  const { data: backendLegacyCandidates } = useSplitLegacyCandidates(
    householdId || undefined,
    filterMode === 'all',
    isOpen
  );
  const [showReimbursementsList, setShowReimbursementsList] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [friendByTx, setFriendByTx] = useState<Record<string, string>>({});
  const [statusByTx, setStatusByTx] = useState<Record<string, 'open' | 'reimbursed'>>({});
  const [reimbursementTxsByDebtTx, setReimbursementTxsByDebtTx] = useState<
    Record<string, string[]>
  >({});
  const [openDropdownTxId, setOpenDropdownTxId] = useState<string | null>(null);
  const [manualPaidDateByTx, setManualPaidDateByTx] = useState<Record<string, string>>({});
  const [forgiveRemainderByTx, setForgiveRemainderByTx] = useState<Record<string, boolean>>({});
  const [deleteOriginals, setDeleteOriginals] = useState<boolean>(false);
  const [hideToolAfter, setHideToolAfter] = useState<boolean>(false);

  const allCandidates = useMemo<CandidateTx[]>(() => {
    if (
      backendLegacyCandidates &&
      (backendLegacyCandidates.debts?.length > 0 ||
        backendLegacyCandidates.reimbursements?.length > 0)
    ) {
      const fromBackend: CandidateTx[] = [
        ...(backendLegacyCandidates.debts || []),
        ...(backendLegacyCandidates.reimbursements || []),
      ].map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: Number(tx.amount),
        date: tx.date,
        category: tx.category || '',
        categoryName: tx.categoryName,
        type:
          tx.type === 'INCOME'
            ? TransactionType.INCOME
            : TransactionType.EXPENSE,
        accountId: tx.accountId,
        accountName:
          tx.accountName ||
          (tx.accountId && accountMap.get(tx.accountId)) ||
          'Conta Principal',
      }));
      return fromBackend.filter((c) => !importedTxIds.includes(c.id));
    }

    const realMapped: CandidateTx[] = transactions.map((tx) => {
      const dateObj = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const safeDate = !isNaN(dateObj.getTime())
        ? format(dateObj, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');
      return {
        id: tx.id || `tx-${safeDate}-${tx.amount}`,
        description: tx.description,
        amount: tx.amount,
        date: safeDate,
        category: tx.category || '',
        categoryName: tx.categoryName,
        type: tx.type,
        accountId: tx.accountId,
        accountName:
          (tx.accountId && accountMap.get(tx.accountId)) ||
          'Conta Principal',
      };
    });

    return realMapped.filter((c) => !importedTxIds.includes(c.id));
  }, [backendLegacyCandidates, transactions, accountMap, importedTxIds]);

  const isReimbursementTx = (c: CandidateTx) => {
    const catLower = c.category.toLowerCase();
    const descLower = c.description.toLowerCase();
    return (
      catLower.includes('reembolso') ||
      descLower.includes('reembolso') ||
      (c.type === TransactionType.INCOME &&
        (filterMode === 'all' ||
          catLower.includes('dívida') ||
          catLower.includes('divida') ||
          descLower.includes('pix')))
    );
  };

  // Lista reembolsos ordenados por data (no modo padrão só Reembolso; em "Todas" inclui qualquer entrada)
  const reimbursementCandidates = useMemo(() => {
    const list = allCandidates.filter((c) => {
      const catLower = c.category.toLowerCase();
      const descLower = c.description.toLowerCase();
      const isReimb =
        catLower.includes('reembolso') || descLower.includes('reembolso');
      if (filterMode === 'all') {
        return isReimb || c.type === TransactionType.INCOME;
      }
      return isReimb;
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [allCandidates, filterMode]);

  // Lista as dívidas candidatas ordenadas mantendo suas datas originais
  const debtCandidates = useMemo(() => {
    const list = allCandidates.filter((c) => {
      if (c.type !== TransactionType.EXPENSE) {
        return false;
      }

      if (filterMode === 'all') {
        return true;
      }

      const catLower = c.category.toLowerCase().trim();
      return (
        c.categoryName === CategoryName.DEBTS ||
        c.category === CategoryName.DEBTS ||
        catLower === 'dívidas' ||
        catLower === 'dividas' ||
        catLower === 'dívida' ||
        catLower === 'divida'
      );
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [allCandidates, filterMode]);

  useEffect(() => {
    if (!isOpen) return;
    const defaultFriendId = friends[0]?.id || '';
    const nextFriendMap: Record<string, string> = {};
    const nextStatusMap: Record<string, 'open' | 'reimbursed'> = {};
    const nextReimbMap: Record<string, string[]> = {};
    const nextManualDateMap: Record<string, string> = {};

    debtCandidates.forEach((tx) => {
      const matchedFriend = friends.find((f) =>
        tx.description
          .toLowerCase()
          .includes(f.name.split(' ')[0].toLowerCase())
      );
      nextFriendMap[tx.id] = matchedFriend?.id || defaultFriendId;
      nextManualDateMap[tx.id] = tx.date;

      const firstWordFriend = matchedFriend?.name.split(' ')[0].toLowerCase();
      const exactReimb = reimbursementCandidates.find(
        (r) => Math.abs(r.amount - tx.amount) < 0.01
      );
      const nameReimbs = firstWordFriend
        ? reimbursementCandidates.filter((r) =>
            r.description.toLowerCase().includes(firstWordFriend)
          )
        : [];

      if (exactReimb) {
        nextStatusMap[tx.id] = 'reimbursed';
        nextReimbMap[tx.id] = [exactReimb.id];
      } else if (nameReimbs.length > 0) {
        nextStatusMap[tx.id] = 'reimbursed';
        nextReimbMap[tx.id] = nameReimbs.map((r) => r.id);
      } else {
        nextStatusMap[tx.id] = 'open';
        nextReimbMap[tx.id] = [];
      }
    });

    setFriendByTx((prev) => ({ ...nextFriendMap, ...prev }));
    setStatusByTx((prev) => ({ ...nextStatusMap, ...prev }));
    setReimbursementTxsByDebtTx((prev) => ({ ...nextReimbMap, ...prev }));
    setManualPaidDateByTx((prev) => ({ ...nextManualDateMap, ...prev }));
  }, [isOpen, debtCandidates, reimbursementCandidates, friends]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleReimbursementForDebt = (debtTxId: string, reimbTxId: string) => {
    setReimbursementTxsByDebtTx((prev) => {
      const current = prev[debtTxId] || [];
      const next = current.includes(reimbTxId)
        ? current.filter((id) => id !== reimbTxId)
        : [...current, reimbTxId];
      return { ...prev, [debtTxId]: next };
    });
  };

  // Mapa de quais reembolsos estão vinculados a qual dívida selecionada
  const linkedDebtByReimbId = new Map<string, CandidateTx>();
  selectedIds.forEach((debtId) => {
    if (statusByTx[debtId] === 'reimbursed') {
      const reimbIds = reimbursementTxsByDebtTx[debtId] || [];
      const debtTx = debtCandidates.find((d) => d.id === debtId);
      if (debtTx) {
        reimbIds.forEach((rId) => linkedDebtByReimbId.set(rId, debtTx));
      }
    }
  });

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const items: LegacyImportItem[] = selectedIds
      .map((txId): LegacyImportItem | null => {
        const tx = debtCandidates.find((c) => c.id === txId);
        const friendId = friendByTx[txId] || friends[0]?.id;
        if (!tx || !friendId) return null;

        const isPaid = statusByTx[txId] === 'reimbursed';
        const reimbIds = isPaid ? reimbursementTxsByDebtTx[txId] || [] : [];
        const selectedReimbs = reimbIds
          .map((id) => reimbursementCandidates.find((r) => r.id === id))
          .filter((r): r is CandidateTx => Boolean(r))
          .sort((a, b) => a.date.localeCompare(b.date));

        const totalReimbAmount = selectedReimbs.reduce((s, r) => s + r.amount, 0);
        const paidAmount = isPaid
          ? selectedReimbs.length > 0
            ? Number(totalReimbAmount.toFixed(2))
            : tx.amount
          : undefined;

        const latestReimbDate =
          selectedReimbs.length > 0
            ? selectedReimbs[selectedReimbs.length - 1].date
            : undefined;

        const paidAt = isPaid
          ? latestReimbDate || manualPaidDateByTx[txId] || tx.date
          : undefined;

        return {
          transactionId: tx.id,
          reimbursementTransactionId: reimbIds[0] || undefined,
          reimbursementTransactionIds: reimbIds.length > 0 ? reimbIds : undefined,
          reimbursements:
            selectedReimbs.length > 0
              ? selectedReimbs.map((r) => ({
                  id: r.id,
                  description: r.description,
                  amount: r.amount,
                  date: r.date,
                }))
              : undefined,
          friendId,
          description: tx.description.trim(),
          amount: tx.amount,
          date: tx.date, // Mantém a data original da dívida!
          accountId: tx.accountId,
          accountName: tx.accountName,
          paid: isPaid,
          paidAmount,
          paidAt, // Mantém a data original do reembolso!
          forgiveRemainder: Boolean(forgiveRemainderByTx[txId]),
        };
      })
      .filter((item): item is LegacyImportItem => item !== null);

    if (items.length === 0) return;
    onImport(items, deleteOriginals, hideToolAfter);
    setSelectedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[600px] max-w-2xl p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
                Converter transações de Dívidas & Reembolsos
              </h3>
              <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-0.5">
                Mantém as datas originais tanto da dívida quanto dos reembolsos
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleConfirm} className="space-y-4">
            {/* Lista de Reembolsos encontrados para conferência */}
            <div className="border border-gray-100 dark:border-gray-800 rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50/60 dark:bg-gray-800/50">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Reembolsos encontrados ({reimbursementCandidates.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowReimbursementsList((prev) => !prev)}
                  className="text-[11px] font-light text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {showReimbursementsList ? 'Ocultar lista' : 'Mostrar lista'}
                </button>
              </div>

              {showReimbursementsList && (
                <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {reimbursementCandidates.length === 0 ? (
                    <div className="py-4 text-center text-xs font-light text-gray-400">
                      Nenhuma transação de reembolso encontrada.
                    </div>
                  ) : (
                    reimbursementCandidates.map((reimb) => {
                      const linkedDebt = linkedDebtByReimbId.get(reimb.id);
                      const isExplicitReimb = isReimbursementTx(reimb);
                      return (
                        <div
                          key={reimb.id}
                          className="px-3.5 py-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white truncate">
                                {reimb.description}
                              </span>
                              {isExplicitReimb && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                  Reembolso
                                </span>
                              )}
                              {linkedDebt && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 truncate max-w-[180px]">
                                  Vinculado a: {linkedDebt.description}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-light text-gray-400">
                              Data: {formatDate(reimb.date)} • {reimb.accountName}
                            </p>
                          </div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                            +{formatCurrency(reimb.amount, baseCurrency)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Filtros da lista de Dívidas */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('legacy_only')}
                  className={`px-3 py-1.5 rounded-md text-xs font-light border transition-all ${
                    filterMode === 'legacy_only'
                      ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50/20 dark:bg-primary-950/20 font-medium'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Categoria Dívidas ({debtCandidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-light border transition-all ${
                    filterMode === 'all'
                      ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50/20 dark:bg-primary-950/20 font-medium'
                      : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Todas as despesas
                </button>
              </div>

              {debtCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === debtCandidates.length
                        ? []
                        : debtCandidates.map((c) => c.id)
                    )
                  }
                  className="text-xs font-light text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {selectedIds.length === debtCandidates.length
                    ? 'Desmarcar todas'
                    : 'Selecionar todas'}
                </button>
              )}
            </div>

            {/* Lista de Dívidas para converter */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-md">
              {debtCandidates.length === 0 ? (
                <div className="py-10 text-center text-xs font-light text-gray-400">
                  Nenhuma transação de dívida encontrada.
                </div>
              ) : (
                debtCandidates.map((tx) => {
                  const isChecked = selectedIds.includes(tx.id);
                  const currentStatus = statusByTx[tx.id] || 'open';
                  const linkedReimbIds = reimbursementTxsByDebtTx[tx.id] || [];
                  const linkedReimbs = linkedReimbIds
                    .map((id) => reimbursementCandidates.find((r) => r.id === id))
                    .filter((r): r is CandidateTx => Boolean(r));
                  const totalReimbursed = Number(
                    linkedReimbs.reduce((s, r) => s + r.amount, 0).toFixed(2)
                  );
                  const isPartialReimb =
                    currentStatus === 'reimbursed' &&
                    linkedReimbs.length > 0 &&
                    totalReimbursed < tx.amount - 0.01;
                  const remainderAmount = isPartialReimb
                    ? Number((tx.amount - totalReimbursed).toFixed(2))
                    : 0;
                  const forgiveRemainder = Boolean(forgiveRemainderByTx[tx.id]);
                  const isDropdownOpen = openDropdownTxId === tx.id;

                  return (
                    <div key={tx.id} className="p-3.5 space-y-3">
                      <div
                        onClick={() => toggleSelect(tx.id)}
                        className="flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isChecked
                                ? 'bg-primary-600 border-primary-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {tx.description}
                            </p>
                            <p className="text-xs font-light text-gray-400">
                              Data da dívida: {formatDate(tx.date)} • {tx.accountName}
                            </p>
                          </div>
                        </div>

                        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
                          {formatCurrency(tx.amount, baseCurrency)}
                        </span>
                      </div>

                      {isChecked && (
                        <div className="pl-7 space-y-2.5 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-light text-gray-400 mb-1">
                                Amigo
                              </label>
                              <select
                                value={friendByTx[tx.id] || ''}
                                onChange={(e) =>
                                  setFriendByTx((prev) => ({
                                    ...prev,
                                    [tx.id]: e.target.value,
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              >
                                {friends.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-light text-gray-400 mb-1">
                                Já teve reembolso?
                              </label>
                              <select
                                value={currentStatus}
                                onChange={(e) =>
                                  setStatusByTx((prev) => ({
                                    ...prev,
                                    [tx.id]: e.target.value as 'open' | 'reimbursed',
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              >
                                <option value="open">Não (Ainda me deve)</option>
                                <option value="reimbursed">
                                  Sim (Vincular reembolso / Pago)
                                </option>
                              </select>
                            </div>
                          </div>

                          {currentStatus === 'reimbursed' && (
                            <div className="space-y-2.5">
                              {/* Multi-select de Reembolsos (permite selecionar 1 ou mais!) */}
                              <div className="relative">
                                <label className="block text-[11px] font-light text-gray-400 mb-1">
                                  Vincular Reembolso(s) (pode selecionar mais de um)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenDropdownTxId(isDropdownOpen ? null : tx.id)
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-between text-left"
                                >
                                  <span className="truncate">
                                    {linkedReimbs.length === 0
                                      ? 'Sem transação vinculada (marcar pago integralmente)'
                                      : linkedReimbs.length === 1
                                      ? `${linkedReimbs[0].description} (${formatCurrency(
                                          linkedReimbs[0].amount,
                                          baseCurrency
                                        )} em ${formatDate(linkedReimbs[0].date)})`
                                      : `${linkedReimbs.length} reembolsos selecionados — Total: ${formatCurrency(
                                          totalReimbursed,
                                          baseCurrency
                                        )}`}
                                  </span>
                                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2" />
                                </button>

                                {isDropdownOpen && (
                                  <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 shadow-lg max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 z-20">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReimbursementTxsByDebtTx((prev) => ({
                                          ...prev,
                                          [tx.id]: [],
                                        }));
                                        setOpenDropdownTxId(null);
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between"
                                    >
                                      <span>
                                        Nenhum reembolso (marcar pago manualmente)
                                      </span>
                                      {linkedReimbs.length === 0 && (
                                        <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                                      )}
                                    </button>
                                    {reimbursementCandidates.map((r) => {
                                      const isReimbSelected = linkedReimbIds.includes(r.id);
                                      return (
                                        <button
                                          key={r.id}
                                          type="button"
                                          onClick={() =>
                                            toggleReimbursementForDebt(tx.id, r.id)
                                          }
                                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                                            isReimbSelected
                                              ? 'bg-primary-50/30 dark:bg-primary-900/20'
                                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 min-w-0">
                                            <div
                                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                                                isReimbSelected
                                                  ? 'bg-primary-600 border-primary-600 text-white'
                                                  : 'border-gray-300 dark:border-gray-600'
                                              }`}
                                            >
                                              {isReimbSelected && (
                                                <Check className="w-2.5 h-2.5" />
                                              )}
                                            </div>
                                            <span className="truncate text-gray-900 dark:text-white">
                                              {r.description}
                                            </span>
                                            <span className="text-[11px] text-gray-400 flex-shrink-0">
                                              ({formatDate(r.date)})
                                            </span>
                                          </div>
                                          <span className="font-medium text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                            +{formatCurrency(r.amount, baseCurrency)}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Tags dos reembolsos selecionados */}
                                {linkedReimbs.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {linkedReimbs.map((r) => (
                                      <span
                                        key={r.id}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-[11px] text-gray-700 dark:text-gray-300"
                                      >
                                        <span>
                                          {r.description}:{' '}
                                          <strong className="text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(r.amount, baseCurrency)}
                                          </strong>{' '}
                                          ({formatDate(r.date)})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleReimbursementForDebt(tx.id, r.id)
                                          }
                                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Se não vinculou transação de reembolso, permite escolher a data do pagamento */}
                              {linkedReimbs.length === 0 && (
                                <div>
                                  <label className="block text-[11px] font-light text-gray-400 mb-1">
                                    Data em que foi pago
                                  </label>
                                  <input
                                    type="date"
                                    value={manualPaidDateByTx[tx.id] || tx.date}
                                    onChange={(e) =>
                                      setManualPaidDateByTx((prev) => ({
                                        ...prev,
                                        [tx.id]: e.target.value,
                                      }))
                                    }
                                    className="w-full sm:w-48 px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                  />
                                </div>
                              )}

                              {/* Se a soma dos reembolsos vinculados for menor que a dívida: pergunta se deixa o resto em aberto ou abona */}
                              {isPartialReimb && (
                                <div className="p-3 rounded-md border border-gray-100 dark:border-gray-800 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-light text-gray-500 dark:text-gray-400">
                                      Soma dos reembolsos:{' '}
                                      <strong className="text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(totalReimbursed, baseCurrency)}
                                      </strong>
                                    </span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      Restante: {formatCurrency(remainderAmount, baseCurrency)}
                                    </span>
                                  </div>

                                  <p className="text-[11px] font-light text-gray-500 dark:text-gray-400">
                                    A soma dos reembolsos é menor que a dívida. O que fazer com os{' '}
                                    {formatCurrency(remainderAmount, baseCurrency)} restantes?
                                  </p>

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setForgiveRemainderByTx((prev) => ({
                                          ...prev,
                                          [tx.id]: false,
                                        }))
                                      }
                                      className={`py-2 px-2.5 rounded border text-xs font-light transition-all ${
                                        !forgiveRemainder
                                          ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50/20 dark:bg-primary-950/20 font-medium'
                                          : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                      }`}
                                    >
                                      Deixar resto da dívida em aberto
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setForgiveRemainderByTx((prev) => ({
                                          ...prev,
                                          [tx.id]: true,
                                        }))
                                      }
                                      className={`py-2 px-2.5 rounded border text-xs font-light transition-all ${
                                        forgiveRemainder
                                          ? 'border-rose-600 dark:border-rose-400 text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/20 font-medium'
                                          : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                                      }`}
                                    >
                                      Abonar (vira despesa)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-light text-gray-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteOriginals}
                  onChange={(e) => setDeleteOriginals(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                Remover as transações antigas de Dívida/Reembolso do extrato após converter
              </label>

              <label className="flex items-center gap-2 text-xs font-light text-gray-500 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideToolAfter}
                  onChange={(e) => setHideToolAfter(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-700"
                />
                Não mostrar mais esta opção de migração após concluir
              </label>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={selectedIds.length === 0 || friends.length === 0}
                className="px-4 py-2 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Converter ({selectedIds.length})
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SplitImportLegacyModal;
