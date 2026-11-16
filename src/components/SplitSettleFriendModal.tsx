import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency } from '../utils/format';
import SelectCombobox from './SelectCombobox';
import type { Friend } from '../pages/Loans';

export interface SettleFriendOptions {
  mode: 'full' | 'partial';
  paidAmount: number;
  forgiveRemainder: boolean;
  accountId: string;
}

interface SplitSettleFriendModalProps {
  isOpen: boolean;
  friend: Friend | null;
  owedToMeTotal: number;
  iOweTotal: number;
  netTotal: number;
  accounts: Array<{ id: string; name: string }>;
  defaultAccountId?: string;
  baseCurrency: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (friendId: string, options: SettleFriendOptions) => void;
}

const SplitSettleFriendModal: React.FC<SplitSettleFriendModalProps> = ({
  isOpen,
  friend,
  owedToMeTotal,
  iOweTotal,
  netTotal,
  accounts,
  defaultAccountId,
  baseCurrency,
  isSubmitting = false,
  onClose,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [forgiveRemainder, setForgiveRemainder] = useState<boolean>(false);
  const [accountId, setAccountId] = useState<string>('');
  const partialAmountMask = useCurrencyMask();

  useEffect(() => {
    if (isOpen && friend) {
      setMode('full');
      setForgiveRemainder(false);
      setAccountId(defaultAccountId || accounts[0]?.id || '');
      partialAmountMask.setValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, friend?.id]);

  if (!isOpen || !friend) return null;

  const isReceiving = netTotal >= 0;
  const absNet = Number(Math.abs(netTotal).toFixed(2));
  const paidNumeric = partialAmountMask.numericValue;
  const remainderAfterPartial = Math.max(
    0,
    Number((absNet - paidNumeric).toFixed(2))
  );
  const isPartialValid = paidNumeric > 0 && paidNumeric < absNet;

  const chosenAccountName =
    accounts.find((a) => a.id === accountId)?.name ||
    accounts[0]?.name ||
    'Conta principal';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const selectedAccountId = accountId || accounts[0]?.id || '';
    if (mode === 'full') {
      onConfirm(friend.id, {
        mode: 'full',
        paidAmount: absNet,
        forgiveRemainder: false,
        accountId: selectedAccountId,
      });
      return;
    }

    if (!isPartialValid) return;

    onConfirm(friend.id, {
      mode: 'partial',
      paidAmount: paidNumeric,
      forgiveRemainder: isReceiving ? forgiveRemainder : false,
      accountId: selectedAccountId,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[440px] max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
                {isReceiving ? `Acerto com ${friend.name}` : `Pagar ${friend.name}`}
              </h3>
              <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-0.5">
                Saldo líquido:{' '}
                <span
                  className={`font-medium ${
                    isReceiving
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(absNet, baseCurrency)}
                </span>
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
            {owedToMeTotal > 0 && iOweTotal > 0 && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 text-xs space-y-1">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>{friend.name} te deve</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(owedToMeTotal, baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Você deve a {friend.name}</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    - {formatCurrency(iOweTotal, baseCurrency)}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-gray-200 dark:border-gray-700 font-medium text-gray-900 dark:text-white">
                  <span>Compensação líquida</span>
                  <span>{formatCurrency(absNet, baseCurrency)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-2">
                {isReceiving
                  ? 'Vai quitar o saldo líquido todo?'
                  : 'Vai pagar o saldo líquido todo?'}
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
                  Sim, quitar tudo
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
            </div>

            {mode === 'partial' && (
              <>
                <div>
                  <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-1.5">
                    {isReceiving
                      ? 'Quanto foi recebido agora? (abatimento FIFO)'
                      : 'Quanto será pago agora? (abatimento FIFO)'}
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
                  {paidNumeric > 0 && paidNumeric < absNet && (
                    <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-1.5">
                      Restante em aberto:{' '}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(remainderAfterPartial, baseCurrency)}
                      </span>
                    </p>
                  )}
                  {paidNumeric >= absNet && (
                    <p className="text-xs font-light text-amber-600 dark:text-amber-400 mt-1.5">
                      Para quitar o valor total, selecione &quot;Sim, quitar tudo&quot;.
                    </p>
                  )}
                </div>

                {isReceiving && (
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
                        Não, manter em aberto
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
                    {forgiveRemainder && remainderAfterPartial > 0 && (
                      <p className="text-xs font-light text-gray-500 dark:text-gray-400 mt-2">
                        Será lançada 1 despesa na categoria{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          Abonos
                        </span>{' '}
                        no valor de{' '}
                        {formatCurrency(remainderAfterPartial, baseCurrency)} e o
                        saldo será encerrado.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {accounts.length > 0 && absNet > 0 && (
              <div>
                <label className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-1.5">
                  {isReceiving ? 'Conta de recebimento' : 'Conta de pagamento'}
                </label>
                <SelectCombobox
                  value={accountId || accounts[0]?.id || ''}
                  onValueChange={setAccountId}
                  options={accounts.map((acc) => ({
                    value: acc.id,
                    label: acc.name,
                  }))}
                  placeholder="Selecione a conta"
                />
                <p className="text-[11px] font-light text-gray-400 dark:text-gray-500 mt-1.5">
                  {isReceiving
                    ? `Gera 1 única transação de Reembolso em ${chosenAccountName}.`
                    : `Gera 1 única transação de Pagamento em ${chosenAccountName}.`}
                </p>
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
                disabled={isSubmitting || (mode === 'partial' && !isPartialValid)}
                className="px-4 py-2 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isSubmitting ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SplitSettleFriendModal;
