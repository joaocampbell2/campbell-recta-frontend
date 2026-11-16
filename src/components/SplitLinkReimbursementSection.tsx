import React, { useMemo, useState } from 'react';
import { Link2, Search, X, CheckCircle2, Calendar } from 'lucide-react';
import {
  useSplitLegacyCandidates,
  useLinkReimbursementToDebts,
  type LegacyCandidateTransaction,
} from '../hooks/api/useSplitwise';
import { useToastContext } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import type { Friend, SplitDebt } from '../pages/Loans';

interface SplitLinkReimbursementSectionProps {
  householdId?: string;
  debts: SplitDebt[];
  friendMap: Map<string, Friend>;
  baseCurrency: string;
}

type DaysFilterOption = '7' | '30' | '60' | '90' | 'ALL';

const DAYS_FILTER_OPTIONS: Array<{ value: DaysFilterOption; label: string }> = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'ALL', label: 'Todo o período' },
];

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const SplitLinkReimbursementSection: React.FC<SplitLinkReimbursementSectionProps> = ({
  householdId,
  debts,
  friendMap,
  baseCurrency,
}) => {
  const { success: showSuccess, error: showError } = useToastContext();
  const { data: legacyCandidatesData, isLoading } = useSplitLegacyCandidates(
    householdId,
    false
  );
  const linkReimbursementMutation = useLinkReimbursementToDebts();

  const [daysFilter, setDaysFilter] = useState<DaysFilterOption>('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [linkingTx, setLinkingTx] = useState<LegacyCandidateTransaction | null>(null);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [debtSearch, setDebtSearch] = useState<string>('');
  const [forgiveRemainder, setForgiveRemainder] = useState<boolean>(false);

  const openOwedDebts = useMemo(() => {
    return debts
      .filter((d) => d.direction === 'THEY_OWE_ME')
      .map((d) => {
        const remaining = Number(
          d.installments
            .filter((i) => !i.paid)
            .reduce((sum, i) => sum + i.amount, 0)
            .toFixed(2)
        );
        return { debt: d, remaining };
      })
      .filter((entry) => entry.remaining > 0);
  }, [debts]);

  const filteredReimbursements = useMemo(() => {
    const list = legacyCandidatesData?.reimbursements ?? [];

    let cutoffStr: string | null = null;
    if (daysFilter !== 'ALL') {
      const days = Number(daysFilter);
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - days);
      const y = cutoff.getFullYear();
      const m = String(cutoff.getMonth() + 1).padStart(2, '0');
      const d = String(cutoff.getDate()).padStart(2, '0');
      cutoffStr = `${y}-${m}-${d}`;
    }

    const q = searchTerm.trim().toLowerCase();

    return list.filter((tx) => {
      if (cutoffStr && tx.date < cutoffStr) return false;
      if (q) {
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesAccount = (tx.accountName || '').toLowerCase().includes(q);
        const matchesCategory = (tx.category || '').toLowerCase().includes(q);
        if (!matchesDesc && !matchesAccount && !matchesCategory) return false;
      }
      return true;
    });
  }, [legacyCandidatesData?.reimbursements, daysFilter, searchTerm]);

  const sortedMatchingDebts = useMemo(() => {
    const q = debtSearch.trim().toLowerCase();
    return openOwedDebts
      .filter(({ debt }) => {
        if (!q) return true;
        const friendName = friendMap.get(debt.friendId)?.name || '';
        return (
          debt.description.toLowerCase().includes(q) ||
          friendName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (!linkingTx) return 0;
        const diffA = Math.abs(a.remaining - linkingTx.amount);
        const diffB = Math.abs(b.remaining - linkingTx.amount);
        return diffA - diffB;
      });
  }, [openOwedDebts, debtSearch, friendMap, linkingTx]);

  const selectedDebtEntries = useMemo(
    () =>
      selectedDebtIds
        .map((id) => openOwedDebts.find((e) => e.debt.id === id))
        .filter((e): e is { debt: SplitDebt; remaining: number } => Boolean(e)),
    [openOwedDebts, selectedDebtIds]
  );

  const selectedTotal = useMemo(
    () =>
      Number(
        selectedDebtEntries.reduce((sum, e) => sum + e.remaining, 0).toFixed(2)
      ),
    [selectedDebtEntries]
  );

  const handleOpenLinkModal = (tx: LegacyCandidateTransaction) => {
    setLinkingTx(tx);
    setDebtSearch('');
    setForgiveRemainder(false);
    const exactMatch = openOwedDebts.find(
      (e) => Math.abs(e.remaining - tx.amount) < 0.01
    );
    setSelectedDebtIds(exactMatch ? [exactMatch.debt.id] : []);
  };

  const toggleDebtSelection = (debtId: string) => {
    setForgiveRemainder(false);
    setSelectedDebtIds((prev) => {
      if (prev.includes(debtId)) {
        return prev.filter((id) => id !== debtId);
      }
      if (linkingTx && selectedTotal >= linkingTx.amount - 0.009) {
        return prev;
      }
      return [...prev, debtId];
    });
  };

  const handleConfirmLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !linkingTx ||
      selectedDebtEntries.length === 0 ||
      linkReimbursementMutation.isPending
    ) {
      return;
    }

    try {
      await linkReimbursementMutation.mutateAsync({
        householdId,
        existingTransactionId: linkingTx.id,
        debtIds: selectedDebtIds,
        forgiveRemainder,
      });
      showSuccess(
        selectedDebtIds.length > 1
          ? `Reembolso vinculado a ${selectedDebtIds.length} dívidas com sucesso!`
          : 'Reembolso vinculado à dívida com sucesso!'
      );
      setLinkingTx(null);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Erro ao vincular reembolso à dívida'
      );
    }
  };

  return (
    <div className="mt-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-500" />
            Reembolsos recebidos para vincular
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Entradas recentes ainda não vinculadas a nenhuma dívida ou acerto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar reembolso..."
              className="h-8 pl-8 pr-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="relative flex items-center">
            <Calendar className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value as DaysFilterOption)}
              className="h-8 pl-8 pr-7 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DAYS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Carregando reembolsos disponíveis...
        </div>
      ) : filteredReimbursements.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400">
          Nenhum reembolso não vinculado encontrado neste período.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[360px] overflow-y-auto pr-1">
          {filteredReimbursements.map((tx) => (
            <div
              key={tx.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {formatDateBr(tx.date)}
                  </span>
                  {tx.accountName && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
                      {tx.accountName}
                    </span>
                  )}
                  {tx.category && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {tx.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900 dark:text-white truncate mt-0.5">
                  {tx.description}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  + {formatCurrency(tx.amount, baseCurrency)}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenLinkModal(tx)}
                  disabled={openOwedDebts.length === 0}
                  title={
                    openOwedDebts.length === 0
                      ? 'Nenhuma dívida em aberto para vincular'
                      : 'Vincular este reembolso a uma dívida'
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 bg-primary-50/70 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular a uma dívida
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para escolher a dívida */}
      {linkingTx && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/40 animate-fade-in"
            onClick={() => {
              if (!linkReimbursementMutation.isPending) setLinkingTx(null);
            }}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <form
              onSubmit={handleConfirmLink}
              className="relative w-full max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                  Vincular reembolso à dívida
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (!linkReimbursementMutation.isPending) setLinkingTx(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateBr(linkingTx.date)}
                    {linkingTx.accountName ? ` · ${linkingTx.accountName}` : ''}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    + {formatCurrency(linkingTx.amount, baseCurrency)}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                  {linkingTx.description}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Selecione uma ou mais dívidas em aberto
                  </label>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Selecionado: {formatCurrency(selectedTotal, baseCurrency)}
                  </span>
                </div>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={debtSearch}
                    onChange={(e) => setDebtSearch(e.target.value)}
                    placeholder="Filtrar por amigo ou descrição..."
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {sortedMatchingDebts.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
                      Nenhuma dívida em aberto encontrada.
                    </p>
                  ) : (
                    sortedMatchingDebts.map(({ debt, remaining }) => {
                      const friendName =
                        friendMap.get(debt.friendId)?.name || 'Amigo';
                      const isSelected = selectedDebtIds.includes(debt.id);
                      const isReimbursementCovered =
                        selectedTotal >= linkingTx.amount - 0.009;
                      const isDisabled = !isSelected && isReimbursementCovered;
                      const isExact = Math.abs(remaining - linkingTx.amount) < 0.01;
                      return (
                        <button
                          key={debt.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => toggleDebtSelection(debt.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-900/30'
                              : isDisabled
                              ? 'border-gray-100 dark:border-gray-800 opacity-45 cursor-not-allowed'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                                {friendName}
                              </span>
                              {isExact && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                                  Valor exato
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white truncate">
                              {debt.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                              {formatCurrency(remaining, baseCurrency)}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedDebtIds.length > 0 &&
                  selectedTotal < linkingTx.amount - 0.009 && (
                    <p className="text-[11px] text-primary-600 dark:text-primary-400">
                      Ainda restam{' '}
                      {formatCurrency(
                        Number((linkingTx.amount - selectedTotal).toFixed(2)),
                        baseCurrency
                      )}{' '}
                      do reembolso — você pode selecionar mais dívidas.
                    </p>
                  )}
              </div>

              {selectedDebtEntries.length > 0 &&
                linkingTx.amount < selectedTotal - 0.009 && (
                  <label className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forgiveRemainder}
                      onChange={(e) => setForgiveRemainder(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      Abonar o restante (
                      {formatCurrency(
                        Number((selectedTotal - linkingTx.amount).toFixed(2)),
                        baseCurrency
                      )}
                      ) e quitar totalmente
                    </span>
                  </label>
                )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setLinkingTx(null)}
                  disabled={linkReimbursementMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    selectedDebtEntries.length === 0 ||
                    linkReimbursementMutation.isPending
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white transition-colors disabled:opacity-50"
                >
                  {linkReimbursementMutation.isPending
                    ? 'Vinculando...'
                    : 'Confirmar vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SplitLinkReimbursementSection;
