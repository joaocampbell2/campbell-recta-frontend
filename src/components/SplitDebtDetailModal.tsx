import React from 'react';
import { X } from 'lucide-react';
import { isSameMonth, parseISO } from 'date-fns';
import { formatCurrency, formatDate } from '../utils/format';
import type { Friend, SplitGroup, SplitDebt } from '../pages/Loans';

interface SplitDebtDetailModalProps {
  debt: SplitDebt | null;
  onClose: () => void;
  onDelete: (debtId: string) => void;
  onPayMonth?: (debtId: string, installmentId: string) => void;
  onSettleAll?: (debtId: string) => void;
  selectedMonth: Date;
  friend?: Friend;
  group?: SplitGroup;
  accountName: string;
  categoryLabel: string | null;
  baseCurrency: string;
}

const SplitDebtDetailModal: React.FC<SplitDebtDetailModalProps> = ({
  debt,
  onClose,
  onDelete,
  onPayMonth,
  onSettleAll,
  selectedMonth,
  friend,
  group,
  accountName,
  categoryLabel,
  baseCurrency,
}) => {
  if (!debt) return null;

  const paidCount = debt.installments.filter((i) => i.paid).length;
  const paidSum = debt.installments
    .filter((i) => i.paid)
    .reduce((s, i) => s + i.amount, 0);
  const unpaidInstallments = debt.installments.filter((i) => !i.paid);
  const remainingSum = unpaidInstallments.reduce((s, i) => s + i.amount, 0);
  const lastPaidInstallment = [...debt.installments]
    .reverse()
    .find((i) => i.paid && i.paidAt);
  const monthInstallment = debt.installments.find(
    (i) => !i.paid && isSameMonth(parseISO(i.dueDate), selectedMonth)
  );
  const initials = (friend?.name || 'A')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[420px] max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
              {debt.description}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              {friend?.avatarUrl ? (
                <img
                  src={friend.avatarUrl}
                  alt={friend.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full ${
                    friend?.avatarColor || 'bg-primary-600'
                  } text-white font-bold text-xs flex items-center justify-center flex-shrink-0`}
                >
                  {initials}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {friend?.name || 'Amigo'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {debt.direction === 'THEY_OWE_ME'
                    ? 'Deve para você'
                    : 'Você deve'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              {remainingSum > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Restante
                  </span>
                  <span
                    className={`font-medium ${
                      debt.direction === 'THEY_OWE_ME'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatCurrency(remainingSum, baseCurrency)}
                  </span>
                </div>
              )}

              {monthInstallment && debt.totalInstallments > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Parcela do mês
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(monthInstallment.amount, baseCurrency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-light">
                  Valor pago
                </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(paidSum, baseCurrency)}
                </span>
              </div>

              {debt.forgivenAmount && debt.forgivenAmount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Valor abonado (despesa)
                  </span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {formatCurrency(debt.forgivenAmount, baseCurrency)}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-light">
                  Valor total da pessoa
                </span>
                <span className="font-light text-gray-900 dark:text-white">
                  {formatCurrency(debt.debtTotalAmount, baseCurrency)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-light">
                  Conta
                </span>
                <span className="font-light text-gray-900 dark:text-white">
                  {accountName}
                </span>
              </div>

              {categoryLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Categoria
                  </span>
                  <span className="font-light text-gray-900 dark:text-white">
                    {categoryLabel}
                  </span>
                </div>
              )}

              {group && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Grupo
                  </span>
                  <span className="font-light text-gray-900 dark:text-white">
                    {group.name}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-light">
                  Parcelas
                </span>
                <span className="font-light text-gray-900 dark:text-white">
                  {paidCount}/{debt.totalInstallments} pagas
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400 font-light">
                  Data da dívida
                </span>
                <span className="font-light text-gray-900 dark:text-white">
                  {formatDate(debt.createdAt)}
                </span>
              </div>

              {lastPaidInstallment?.paidAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400 font-light">
                    Pago em
                  </span>
                  <span className="font-light text-emerald-600 dark:text-emerald-400">
                    {formatDate(lastPaidInstallment.paidAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => onDelete(debt.id)}
                className="text-xs font-light text-rose-500 hover:opacity-70 transition-opacity"
              >
                Excluir registro
              </button>

              {unpaidInstallments.length > 0 && (
                <div className="flex items-center gap-2">
                  {debt.totalInstallments > 1 && monthInstallment && onPayMonth && (
                    <button
                      type="button"
                      onClick={() => onPayMonth(debt.id, monthInstallment.id)}
                      className="px-4 py-2 rounded-md text-sm font-light tracking-tight bg-emerald-600 hover:opacity-80 text-white transition-opacity"
                    >
                      Pagar mês
                    </button>
                  )}
                  {onSettleAll && (
                    <button
                      type="button"
                      onClick={() => onSettleAll(debt.id)}
                      className="px-4 py-2 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitDebtDetailModal;
