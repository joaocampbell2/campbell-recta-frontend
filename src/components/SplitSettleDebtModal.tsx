import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency } from '../utils/format';
import SelectCombobox from './SelectCombobox';
import type { SplitDebt } from '../pages/Loans';

export interface SettleDebtOptions {
  mode: 'full' | 'partial';
  paidAmount: number;
  forgiveRemainder: boolean;
  forgiveAmount?: number;
  accountId?: string;
}

interface SplitSettleDebtModalProps {
  debt: SplitDebt | null;
  accountName: string;
  reimbursementAccountName?: string;
  accounts?: Array<{ id: string; name: string }>;
  baseCurrency: string;
  onClose: () => void;
  onConfirm: (debtId: string, options: SettleDebtOptions) => void;
}

const SplitSettleDebtModal: React.FC<SplitSettleDebtModalProps> = ({
  debt,
  accountName: _accountName,
  reimbursementAccountName,
  accounts = [],
  baseCurrency,
  onClose,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'full' | 'partial' | 'forgive'>('full');
  const [forgiveRemainder, setForgiveRemainder] = useState<boolean>(false);
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const partialAmountMask = useCurrencyMask();
  const forgiveAmountMask = useCurrencyMask();

  useEffect(() => {
    if (debt) {
      setMode('full');
      setForgiveRemainder(false);
      setPaymentAccountId(accounts[0]?.id || '');
      partialAmountMask.setValue('');
      forgiveAmountMask.setValue('');
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

  const forgiveNumeric = forgiveAmountMask.numericValue;
  const remainderAfterForgive = Math.max(
    0,
    Number((remainingSum - forgiveNumeric).toFixed(2))
  );
  const isForgiveValid =
    forgiveNumeric > 0 && forgiveNumeric <= remainingSum + 0.009;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgive') {
      if (!isForgiveValid) return;
      const clampedForgive = Math.min(remainingSum, forgiveNumeric);
      onConfirm(debt.id, {
        mode: 'partial',
        paidAmount: 0,
        forgiveRemainder: clampedForgive >= remainingSum - 0.009,
        forgiveAmount: clampedForgive,
      });
      onClose();
      return;
    }

    if (mode === 'full') {
      onConfirm(debt.id, {
        mode: 'full',
        paidAmount: remainingSum,
        forgiveRemainder: false,
        ...(debt.direction === 'I_OWE_THEM' && paymentAccountId
          ? { accountId: paymentAccountId }
          : {}),
      });
      onClose();
      return;
    }

    if (!isPartialValid) return;

    onConfirm(debt.id, {
      mode: 'partial',
      paidAmount: paidNumeric,
      forgiveRemainder,
      ...(debt.direction === 'I_OWE_THEM' && paymentAccountId
        ? { accountId: paymentAccountId }
        : {}),
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
              <div
                className={`grid gap-2 ${
                  debt.direction === 'THEY_OWE_ME' ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
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
                {debt.direction === 'THEY_OWE_ME' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgive');
                      if (forgiveAmountMask.numericValue <= 0) {
                        forgiveAmountMask.setValue(remainingSum);
                      }
                    }}
                    className={`py-2.5 px-3 rounded-md text-xs font-light border transition-all ${
                      mode === 'forgive'
                        ? 'border-amber-600 dark:border-amber-400 bg-amber-50/30 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-medium'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Abonar
                  </button>
                )}
              </div>
              {mode === 'full' && debt.direction === 'THEY_OWE_ME' && reimbursementAccountName && (
                <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-2">
                  Ao quitar, será lançada uma transação de reembolso ({formatCurrency(remainingSum, baseCurrency)}) na conta{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{reimbursementAccountName}</span>.
                </p>
              )}
              {mode === 'forgive' && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-light text-gray-500 dark:text-gray-400">
                      Quanto deseja abonar?
                    </label>
                    <button
                      type="button"
                      onClick={() => forgiveAmountMask.setValue(remainingSum)}
                      className="text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:underline"
                    >
                      Abonar tudo ({formatCurrency(remainingSum, baseCurrency)})
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={forgiveAmountMask.value}
                    onChange={forgiveAmountMask.onChange}
                    placeholder={formatCurrency(remainingSum, baseCurrency)}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 sm:text-sm font-light tracking-tight"
                  />
                  {forgiveNumeric > remainingSum + 0.009 && (
                    <p className="text-[11px] text-red-500">
                      O valor abonado não pode ser maior que {formatCurrency(remainingSum, baseCurrency)}.
                    </p>
                  )}
                  {isForgiveValid && (
                    <p className="text-xs font-light text-amber-700 dark:text-amber-300">
                      {remainderAfterForgive <= 0.009
                        ? `Todo o saldo restante (${formatCurrency(remainingSum, baseCurrency)}) será abonado e a dívida será encerrada sem criar nenhuma transação.`
                        : `Será abonado ${formatCurrency(forgiveNumeric, baseCurrency)} e a dívida continuará aberta com saldo de ${formatCurrency(remainderAfterForgive, baseCurrency)} (sem criar nenhuma transação).`}
                    </p>
                  )}
                </div>
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
                        )}) será abonado sem criar nova transação.`
                      : `A dívida continuará aberta com o saldo restante de ${formatCurrency(
                          remainderAfterPartial,
                          baseCurrency
                        )}.`}
                  </p>
                </div>
              </>
            )}

            {debt.direction === 'I_OWE_THEM' && accounts.length > 0 && (
              <div>
                <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-1.5">
                  Conta de pagamento
                </label>
                <SelectCombobox
                  value={paymentAccountId || accounts[0]?.id || ''}
                  onValueChange={setPaymentAccountId}
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: acc.name,
                  }))}
                  placeholder="Selecione a conta"
                />
              </div>
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
                disabled={
                  (mode === 'partial' && !isPartialValid) ||
                  (mode === 'forgive' && !isForgiveValid)
                }
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
