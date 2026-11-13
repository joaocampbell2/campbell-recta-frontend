import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency } from '../utils/format';
import type { SplitDebt } from '../pages/Loans';

export interface SettleDebtOptions {
  mode: 'full' | 'partial';
  paidAmount: number;
  forgiveRemainder: boolean;
}

interface SplitSettleDebtModalProps {
  debt: SplitDebt | null;
  accountName: string;
  reimbursementAccountName?: string;
  baseCurrency: string;
  onClose: () => void;
  onConfirm: (debtId: string, options: SettleDebtOptions) => void;
}

const SplitSettleDebtModal: React.FC<SplitSettleDebtModalProps> = ({
  debt,
  accountName,
  reimbursementAccountName,
  baseCurrency,
  onClose,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [forgiveRemainder, setForgiveRemainder] = useState<boolean>(false);
  const partialAmountMask = useCurrencyMask();

  useEffect(() => {
    if (debt) {
      setMode('full');
      setForgiveRemainder(false);
      partialAmountMask.setValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt?.id]);

  if (!debt) return null;

  const remainingSum = Number(
    debt.installments
      .filter((i) => !i.paid)
      .reduce((s, i) => s + i.amount, 0)
      .toFixed(2)
  );

  const paidNumeric = partialAmountMask.numericValue;
  const remainderAfterPartial = Math.max(
    0,
    Number((remainingSum - paidNumeric).toFixed(2))
  );

  const isPartialValid =
    paidNumeric > 0 && paidNumeric < remainingSum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'full') {
      onConfirm(debt.id, {
        mode: 'full',
        paidAmount: remainingSum,
        forgiveRemainder: false,
      });
      onClose();
      return;
    }

    if (!isPartialValid) return;

    onConfirm(debt.id, {
      mode: 'partial',
      paidAmount: paidNumeric,
      forgiveRemainder,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[420px] max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
                Quitar dívida
              </h3>
              <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-0.5">
                {debt.description} • Restante:{' '}
                {formatCurrency(remainingSum, baseCurrency)}
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pergunta 1: Vai quitar toda ou não? */}
            <div>
              <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-2">
                Vai quitar a dívida toda?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className={`py-2.5 px-3 rounded-md text-xs font-light border transition-all ${
                    mode === 'full'
                      ? 'border-primary-600 dark:border-primary-400 bg-primary-50/20 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-medium'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Sim, quitar toda
                </button>
                <button
                  type="button"
                  onClick={() => setMode('partial')}
                  className={`py-2.5 px-3 rounded-md text-xs font-light border transition-all ${
                    mode === 'partial'
                      ? 'border-primary-600 dark:border-primary-400 bg-primary-50/20 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-medium'
                      : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Não, outro valor
                </button>
              </div>
              {mode === 'full' && debt.direction === 'THEY_OWE_ME' && reimbursementAccountName && (
                <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-2">
                  Ao quitar, será lançada uma transação de reembolso ({formatCurrency(remainingSum, baseCurrency)}) na conta{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{reimbursementAccountName}</span>.
                </p>
              )}
            </div>

            {mode === 'partial' && (
              <>
                {/* Quanto vai pagar */}
                <div>
                  <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-1.5">
                    Quanto vai ser pago agora?
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={partialAmountMask.value}
                    onChange={partialAmountMask.onChange}
                    placeholder="R$ 0,00"
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 font-light text-sm"
                  />
                  {paidNumeric > 0 && paidNumeric < remainingSum && (
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-1.5">
                      Valor restante:{' '}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(remainderAfterPartial, baseCurrency)}
                      </span>
                    </p>
                  )}
                  {paidNumeric >= remainingSum && (
                    <p className="text-xs font-light text-amber-600 dark:text-amber-400 mt-1.5">
                      Para pagar o valor total, selecione &quot;Sim, quitar toda&quot;.
                    </p>
                  )}
                </div>

                {/* O resto vai ser abonado? */}
                <div>
                  <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-2">
                    O valor restante será abonado?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForgiveRemainder(false)}
                      className={`py-2.5 px-3 rounded-md text-xs font-light border transition-all ${
                        !forgiveRemainder
                          ? 'border-primary-600 dark:border-primary-400 bg-primary-50/20 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-medium'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Não, manter restante
                    </button>
                    <button
                      type="button"
                      onClick={() => setForgiveRemainder(true)}
                      className={`py-2.5 px-3 rounded-md text-xs font-light border transition-all ${
                        forgiveRemainder
                          ? 'border-primary-600 dark:border-primary-400 bg-primary-50/20 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-medium'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Sim, abonar
                    </button>
                  </div>

                  <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-2">
                    {forgiveRemainder
                      ? `A dívida será encerrada e o restante (${formatCurrency(
                          remainderAfterPartial,
                          baseCurrency
                        )}) virará despesa na conta ${accountName}.`
                      : `A dívida continuará aberta com o saldo restante de ${formatCurrency(
                          remainderAfterPartial,
                          baseCurrency
                        )}.`}
                  </p>
                </div>
              </>
            )}

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
                disabled={mode === 'partial' && !isPartialValid}
                className="px-4 py-2 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SplitSettleDebtModal;
