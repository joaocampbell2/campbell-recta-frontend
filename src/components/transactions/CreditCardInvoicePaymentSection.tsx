import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { CreditCard, ExternalLink, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { AccountType, CategoryName } from '../../lib/enums';
import type { Account } from '../../types';
import { useI18n } from '../../context/I18nContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useToastContext } from '../../context/ToastContext';
import { useCreditCardInvoice, usePayCreditCardInvoice } from '../../hooks/api/useTransactions';
import { formatCurrency } from '../../utils/format';
import { getAvailableBalance } from '../../utils/accountBalance';
import SelectCombobox from '../SelectCombobox';
import { DatePicker } from '../DatePicker';

interface CreditCardInvoicePaymentSectionProps {
  accounts: Account[];
  householdId?: string;
  onClose: () => void;
  selectedCategoryValue?: string;
}

export const CreditCardInvoicePaymentSection = ({
  accounts,
  householdId,
  onClose,
  selectedCategoryValue,
}: CreditCardInvoicePaymentSectionProps) => {
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const { success, error: showError } = useToastContext();
  const navigate = useNavigate();

  const creditCards = useMemo(
    () => accounts.filter((acc) => acc.type === AccountType.CREDIT),
    [accounts]
  );

  const sourceAccounts = useMemo(
    () => accounts.filter((acc) => acc.type !== AccountType.CREDIT),
    [accounts]
  );

  const [selectedCardId, setSelectedCardId] = useState<string>(creditCards[0]?.id || '');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState<string>(
    sourceAccounts[0]?.id || ''
  );
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  useEffect(() => {
    if (!selectedCardId && creditCards.length > 0) {
      setSelectedCardId(creditCards[0].id || '');
    }
  }, [creditCards, selectedCardId]);

  useEffect(() => {
    if (!paymentSourceAccountId && sourceAccounts.length > 0) {
      setPaymentSourceAccountId(sourceAccounts[0].id || '');
    }
  }, [sourceAccounts, paymentSourceAccountId]);

  const selectedMonthKey = format(selectedMonth, 'yyyy-MM');

  const { data: invoiceResponse, isLoading: invoiceLoading } = useCreditCardInvoice({
    accountId: selectedCardId || null,
    month: selectedMonthKey,
    householdId,
    limit: 100,
  });

  const invoiceData = invoiceResponse?.data;
  const invoiceTotal = Math.max(0, invoiceData?.total ?? 0);
  const isPaid = Boolean(invoiceData?.isPaid);

  useEffect(() => {
    setPaymentAmount(invoiceTotal);
  }, [invoiceTotal, selectedCardId, selectedMonthKey]);

  const payInvoiceMutation = usePayCreditCardInvoice();

  const selectedSourceAccount = useMemo(
    () => sourceAccounts.find((acc) => acc.id === paymentSourceAccountId),
    [sourceAccounts, paymentSourceAccountId]
  );

  const handleGoToStatement = () => {
    if (!selectedCardId) return;
    onClose();
    navigate(`/app/credit-cards?accountId=${selectedCardId}&month=${selectedMonthKey}`);
  };

  const handleConfirmPayment = async () => {
    if (!selectedCardId || !paymentSourceAccountId || paymentAmount <= 0) return;

    try {
      const monthName = format(selectedMonth, 'MMMM', { locale: ptBR });
      const yearName = format(selectedMonth, 'yyyy');
      const description = `${t.invoicePaymentDescription || 'Pagamento de fatura'} - ${monthName}/${yearName}`;

      await payInvoiceMutation.mutateAsync({
        accountId: selectedCardId,
        sourceAccountId: paymentSourceAccountId,
        amount: paymentAmount,
        month: selectedMonthKey,
        description,
        householdId,
        categoryName:
          (selectedCategoryValue as CategoryName) || CategoryName.CREDIT_CARD_INVOICE,
        date: paymentDate,
      });

      success(t.confirmInvoicePayment || 'Pagamento da fatura confirmado!');
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.errorPayingInvoice || 'Erro ao pagar fatura';
      showError(message);
    }
  };

  if (creditCards.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Nenhum cartão de crédito cadastrado para pagar fatura.
        </p>
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/app/credit-cards');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-md hover:bg-primary-50/40 dark:hover:bg-primary-950/30"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Ir para Cartões de Crédito
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Cartão de Crédito + Mês da Fatura */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
            Cartão de Crédito
          </label>
          <SelectCombobox
            value={selectedCardId}
            onValueChange={setSelectedCardId}
            options={creditCards.map((card) => ({
              value: card.id || '',
              label: card.name,
            }))}
            placeholder="Selecione o cartão"
          />
        </div>

        <div>
          <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
            Mês da fatura
          </label>
          <div className="flex items-center justify-between h-10 px-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => subMonths(prev, 1))}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-light text-gray-900 dark:text-white capitalize">
              {format(selectedMonth, 'MMM / yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => addMonths(prev, 1))}
              className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Resumo da Fatura + Botão direto para o extrato */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-light text-gray-500 dark:text-gray-400">
              Valor da fatura
            </span>
            {isPaid && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                Paga
              </span>
            )}
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mt-0.5">
            {invoiceLoading ? 'Carregando...' : formatCurrency(invoiceTotal, baseCurrency)}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoToStatement}
          disabled={!selectedCardId}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-md bg-white dark:bg-gray-900 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-colors flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver extrato do cartão
        </button>
      </div>

      {/* Conta de Pagamento */}
      <div>
        <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
          {t.paymentAccount || 'Conta de pagamento'}
        </label>
        <SelectCombobox
          value={paymentSourceAccountId}
          onValueChange={setPaymentSourceAccountId}
          options={[
            { value: '', label: t.selectAccount || 'Selecione uma conta' },
            ...sourceAccounts.map((acc) => ({
              value: acc.id || '',
              label: acc.name,
            })),
          ]}
          placeholder={t.selectAccount || 'Selecione uma conta'}
        />
        {selectedSourceAccount && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t.availableBalance}:{' '}
            {formatCurrency(getAvailableBalance(selectedSourceAccount), baseCurrency)}
          </p>
        )}
      </div>

      {/* Valor a Pagar */}
      <div>
        <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
          {t.amount || 'Valor'}
        </label>
        <input
          type="text"
          value={
            paymentAmount > 0
              ? formatCurrency(paymentAmount, baseCurrency)
                  .replace(/[^\d,.-]/g, '')
                  .trim()
              : ''
          }
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setPaymentAmount(Number(val) / 100);
          }}
          placeholder={formatCurrency(invoiceTotal, baseCurrency)}
          className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight"
        />
        {t.paymentAmountHint && (
          <p className="mt-1 text-[10px] font-light text-gray-400 dark:text-gray-500">
            {t.paymentAmountHint}
          </p>
        )}
      </div>

      {/* Data do Pagamento */}
      <div>
        <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
          {t.date || 'Data'}
        </label>
        <DatePicker
          value={paymentDate}
          onChange={(d) => d && setPaymentDate(d)}
          placeholder={t.date || 'Selecione a data'}
        />
      </div>

      {/* Rodapé de Ações */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
        >
          {t.cancel || 'Cancelar'}
        </button>
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={
            !selectedCardId ||
            !paymentSourceAccountId ||
            paymentAmount <= 0 ||
            payInvoiceMutation.isPending
          }
          className="px-4 py-2 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {payInvoiceMutation.isPending
            ? 'Pagando...'
            : t.confirmInvoicePayment || 'Confirmar Pagamento'}
        </button>
      </div>
    </div>
  );
};
