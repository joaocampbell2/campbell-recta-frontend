import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Transaction, Account } from '../../types';
import { TransactionType } from '../../lib/enums';
import { formatCurrency, formatDate } from '../../utils/format';

interface ReportsDrilldownModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  transactions: Transaction[];
  accountMap: Map<string, Account>;
  resolveCategoryName: (categoryName: string) => string;
  baseCurrency: string;
  onClose: () => void;
}

export const ReportsDrilldownModal: React.FC<ReportsDrilldownModalProps> = ({
  isOpen,
  title,
  subtitle,
  transactions,
  accountMap,
  resolveCategoryName,
  baseCurrency,
  onClose,
}) => {
  if (!isOpen) return null;

  const totalIncome = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((s, t) => s + (t.amount || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl p-6 border rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-xl">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {subtitle} · {transactions.length}{' '}
                  {transactions.length === 1 ? 'transação' : 'transações'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {(totalIncome > 0 || totalExpense > 0) && (
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/50">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Receitas
                </span>
                <p className="text-base font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatCurrency(totalIncome, baseCurrency)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-50/60 dark:bg-red-900/20 border border-red-200/70 dark:border-red-800/50">
                <span className="text-[11px] text-red-700 dark:text-red-300">
                  Despesas
                </span>
                <p className="text-base font-semibold text-red-700 dark:text-red-300 tabular-nums">
                  {formatCurrency(totalExpense, baseCurrency)}
                </p>
              </div>
            </div>
          )}

          <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pr-1">
            {transactions.length === 0 ? (
              <p className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
                Nenhuma transação encontrada.
              </p>
            ) : (
              transactions.map((tx) => {
                const isIncome = tx.type === TransactionType.INCOME;
                const accName = tx.accountId
                  ? accountMap.get(tx.accountId)?.name
                  : undefined;
                const catName = tx.categoryName
                  ? resolveCategoryName(tx.categoryName)
                  : tx.category;

                return (
                  <div
                    key={tx.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isIncome
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {formatDate(tx.date)}
                          {catName ? ` · ${catName}` : ''}
                          {accName ? ` · ${accName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap tabular-nums ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? '+ ' : '- '}
                      {formatCurrency(tx.amount, baseCurrency)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportsDrilldownModal;
