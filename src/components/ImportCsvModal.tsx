import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileSpreadsheet, Trash2, ArrowLeft, AlertCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Account } from '../types';
import { AccountType, CategoryName, TransactionType } from '../lib/enums';
import { useI18n } from '../context/I18nContext';
import { useCurrency } from '../context/CurrencyContext';
import { useToastContext } from '../context/ToastContext';
import { useBatchCreateTransactions } from '../hooks/api/useTransactions';
import { formatCurrency, formatDate, formatDateForAPI } from '../utils/format';
import { parseNubankCsv, ParsedCsvTransaction } from '../utils/csvImport';
import { DatePicker } from './DatePicker';
import SelectCombobox from './SelectCombobox';
import CategoryCombobox from './CategoryCombobox';
import SplitDebtWizardModal from './SplitDebtWizardModal';
import { LoadingSpinner } from './LoadingSpinner';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  householdId?: string;
  defaultAccountId?: string | null;
}

interface ReviewTransactionItem extends ParsedCsvTransaction {
  categoryName: string;
}

type ModalStep = 'setup' | 'loading' | 'review';

export const ImportCsvModal = ({
  isOpen,
  onClose,
  accounts,
  householdId,
  defaultAccountId,
}: ImportCsvModalProps) => {
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const { success, error: showError } = useToastContext();
  const batchCreateTransactions = useBatchCreateTransactions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  const [step, setStep] = useState<ModalStep>('setup');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [items, setItems] = useState<ReviewTransactionItem[]>([]);
  const [showValidationErrors, setShowValidationErrors] = useState<boolean>(false);
  const [splitTargetItem, setSplitTargetItem] = useState<ReviewTransactionItem | null>(null);

  const availableAccounts = useMemo(
    () =>
      accounts.filter(
        (account): account is Account & { id: string } =>
          Boolean(account.id) && account.type !== AccountType.INVESTMENT
      ),
    [accounts]
  );

  const accountOptions = useMemo(
    () =>
      availableAccounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    [availableAccounts]
  );

  const selectedAccount = useMemo(
    () => availableAccounts.find((a) => a.id === accountId),
    [availableAccounts, accountId]
  );

  // Reset state only when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStep('setup');
      setSelectedFile(null);
      setStartDate(null);
      const hasDefault =
        defaultAccountId && availableAccounts.some((a) => a.id === defaultAccountId);
      setAccountId(
        hasDefault
          ? defaultAccountId!
          : availableAccounts.length === 1
          ? availableAccounts[0].id
          : ''
      );
      setSetupError(null);
      setItems([]);
      setShowValidationErrors(false);
      setSplitTargetItem(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, availableAccounts, defaultAccountId]);

  // Body scroll lock & Escape handler
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !batchCreateTransactions.isPending &&
        step !== 'loading' &&
        !splitTargetItem
      ) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, batchCreateTransactions.isPending, step, splitTargetItem]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File | null) => {
    setSetupError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isCsv =
      file.name.toLowerCase().endsWith('.csv') ||
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel';

    if (!isCsv) {
      setSetupError('Por favor, selecione um arquivo .csv válido.');
      return;
    }

    setSelectedFile(file);
  };

  const handleContinue = async () => {
    setSetupError(null);

    if (!selectedFile) {
      setSetupError('Selecione um arquivo CSV para continuar.');
      return;
    }
    if (!startDate) {
      setSetupError('Selecione a data inicial para importar as transações.');
      return;
    }
    if (!accountId) {
      setSetupError('Selecione a conta de destino.');
      return;
    }

    setStep('loading');

    try {
      const [fileContent] = await Promise.all([
        selectedFile.text(),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);

      const parsedRows = parseNubankCsv(fileContent);

      const normalizedStart = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0,
        0,
        0,
        0
      );

      const filteredRows = parsedRows.filter((row) => row.date >= normalizedStart);

      if (filteredRows.length === 0) {
        setSetupError(
          `Nenhuma transação encontrada a partir de ${formatDate(normalizedStart)}.`
        );
        setStep('setup');
        return;
      }

      setItems(
        filteredRows.map((row) => ({
          ...row,
          categoryName: row.suggestedCategoryName || '',
        }))
      );
      setShowValidationErrors(false);
      setStep('review');
    } catch (err: any) {
      setSetupError(err?.message || 'Não foi possível processar o arquivo CSV.');
      setStep('setup');
    }
  };

  const handleUpdateDescription = (id: string, description: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description } : item))
    );
  };

  const handleUpdateCategory = (id: string, categoryName: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, categoryName } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleShiftDate = (id: string, deltaDays: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextDate = new Date(item.date);
        nextDate.setDate(nextDate.getDate() + deltaDays);
        return { ...item, date: nextDate };
      })
    );
  };

  const categorizedItems = items.filter((item) => Boolean(item.categoryName));
  const remainingItems = items.filter((item) => !item.categoryName);

  const totalExpenses = items
    .filter((item) => item.type === TransactionType.EXPENSE)
    .reduce((acc, item) => acc + item.amount, 0);

  const totalIncome = items
    .filter((item) => item.type === TransactionType.INCOME)
    .reduce((acc, item) => acc + item.amount, 0);

  const handleImport = async () => {
    if (items.length === 0) return;

    if (categorizedItems.length === 0) {
      setShowValidationErrors(true);
      showError('Selecione a categoria de pelo menos uma transação para importar.');
      return;
    }

    try {
      await batchCreateTransactions.mutateAsync({
        ...(householdId && { householdId }),
        transactions: categorizedItems.map((item) => ({
          description: item.description.trim() || 'Transação importada',
          amount: item.amount,
          categoryName: item.categoryName,
          accountId,
          date: formatDateForAPI(item.date),
          paid: true,
        })),
      });

      success(
        `${categorizedItems.length} ${categorizedItems.length === 1 ? 'transação importada' : 'transações importadas'} com sucesso!`
      );

      if (remainingItems.length > 0) {
        setItems(remainingItems);
        setShowValidationErrors(false);
      } else {
        onClose();
      }
    } catch (err: any) {
      showError(err?.message || 'Erro ao importar transações.');
    }
  };

  return createPortal(
    <>
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={() => {
          if (!batchCreateTransactions.isPending && step !== 'loading') {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full ${
            step === 'review' ? 'max-w-3xl' : 'max-w-lg'
          } p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-xl transition-all`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                Importar CSV (Nubank)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {step === 'setup' && 'Selecione o arquivo, a data inicial e a conta de destino'}
                {step === 'loading' && 'Lendo e filtrando transações do arquivo...'}
                {step === 'review' && 'Revise, categorize ou exclua transações antes de importar'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={batchCreateTransactions.isPending || step === 'loading'}
              aria-label="Fechar modal"
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1 disabled:opacity-30"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Step 1: Setup */}
          {step === 'setup' && (
            <div className="space-y-5">
              {/* File dropzone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Arquivo CSV *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileSelect(e.dataTransfer.files?.[0] || null);
                  }}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                      : selectedFile
                        ? 'border-primary-400 dark:border-primary-600 bg-primary-50/30 dark:bg-primary-900/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between gap-3 text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileSpreadsheet className="h-8 w-8 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(selectedFile.size / 1024).toFixed(1)} KB • Clique para trocar
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Upload className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Clique ou arraste o arquivo CSV da Nubank aqui
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Formato esperado: Cartão (date, title, amount) ou Conta (Data, Valor, Identificador, Descrição) (.csv)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Importar a partir de *
                </label>
                <DatePicker
                  value={startDate}
                  onChange={(date) => {
                    setStartDate(date);
                    setSetupError(null);
                  }}
                  placeholder="Selecionar data inicial"
                  useModal
                />
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Conta de destino *
                </label>
                <SelectCombobox
                  value={accountId}
                  onValueChange={(val) => {
                    setAccountId(val);
                    setSetupError(null);
                  }}
                  options={accountOptions}
                  placeholder={t.selectAccount || 'Selecione a conta'}
                />
                {availableAccounts.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                    Nenhuma conta disponível para importação.
                  </p>
                )}
              </div>

              {/* Setup Error */}
              {setupError && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{setupError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {t.cancel || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!selectedFile || !startDate || !accountId}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Loading */}
          {step === 'loading' && (
            <div className="py-14 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner size={56} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Processando transações do CSV...
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Filtrando registros a partir de {startDate ? formatDate(startDate) : ''}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    <strong className="font-medium text-gray-900 dark:text-white">Conta:</strong>{' '}
                    {selectedAccount?.name || '-'}
                  </span>
                  <span>
                    <strong className="font-medium text-gray-900 dark:text-white">A partir de:</strong>{' '}
                    {startDate ? formatDate(startDate) : '-'}
                  </span>
                  <span>
                    <strong className="font-medium text-gray-900 dark:text-white">Transações:</strong>{' '}
                    {items.length}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {totalExpenses > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Despesas: {formatCurrency(totalExpenses, baseCurrency)}
                    </span>
                  )}
                  {totalIncome > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Créditos: {formatCurrency(totalIncome, baseCurrency)}
                    </span>
                  )}
                </div>
              </div>

              {/* Validation notice */}
              {showValidationErrors && remainingItems.length > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    Selecione uma categoria para todas as {remainingItems.length} transação(ões) destacada(s).
                  </span>
                </div>
              )}

              {/* Transactions List */}
              {items.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Todas as transações foram removidas da lista.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep('setup')}
                    className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Voltar e selecionar outro arquivo
                  </button>
                </div>
              ) : (
                <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-2.5">
                  {items.map((item) => {
                    const isMissingCategory = showValidationErrors && !item.categoryName;
                    const isCredit = item.type === TransactionType.INCOME;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          isMissingCategory
                            ? 'border-red-400 dark:border-red-500 bg-red-50/40 dark:bg-red-900/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          {/* Date + Value (mobile top row, desktop split) */}
                          <div className="sm:col-span-5 flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleShiftDate(item.id, -1)}
                                  title="Diminuir 1 dia"
                                  aria-label="Diminuir 1 dia"
                                  className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                  {formatDate(item.date)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleShiftDate(item.id, 1)}
                                  title="Avançar 1 dia"
                                  aria-label="Avançar 1 dia"
                                  className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {isCredit && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  Crédito / Estorno
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdateDescription(item.id, e.target.value)}
                              placeholder="Descrição"
                              className="w-full h-9 px-2.5 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>

                          {/* Amount (clickable to split) */}
                          <div className="sm:col-span-2 flex sm:justify-end items-center">
                            <button
                              type="button"
                              onClick={() => setSplitTargetItem(item)}
                              title="Dividir esta transação"
                              className={`text-sm font-medium whitespace-nowrap hover:underline cursor-pointer ${
                                isCredit
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {isCredit ? '+ ' : ''}
                              {formatCurrency(item.amount, baseCurrency)}
                            </button>
                          </div>

                          {/* Category Combobox */}
                          <div className="sm:col-span-3 min-w-0">
                            <CategoryCombobox
                              value={item.categoryName}
                              onValueChange={(val) => handleUpdateCategory(item.id, val)}
                              type={item.type}
                              householdId={householdId}
                              placeholder="Selecionar categoria..."
                            />
                          </div>

                          {/* Actions: Split + Delete row */}
                          <div className="sm:col-span-2 flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSplitTargetItem(item)}
                              title="Dividir conta"
                              aria-label="Dividir conta"
                              className="p-2 text-gray-400 hover:text-primary-600 dark:text-gray-500 dark:hover:text-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            >
                              <Users className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              title="Excluir transação da importação"
                              aria-label="Excluir transação da importação"
                              className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setStep('setup')}
                  disabled={batchCreateTransactions.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={batchCreateTransactions.isPending}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {t.cancel || 'Cancelar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={categorizedItems.length === 0 || batchCreateTransactions.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {batchCreateTransactions.isPending ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Importando...
                      </>
                    ) : (
                      `Importar ${categorizedItems.length} ${categorizedItems.length === 1 ? 'transação' : 'transações'}`
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <SplitDebtWizardModal
      isOpen={Boolean(splitTargetItem)}
      onClose={() => setSplitTargetItem(null)}
      defaultAccountId={accountId}
      initialDescription={splitTargetItem?.description}
      initialAmount={splitTargetItem?.amount}
      initialCategory={splitTargetItem?.categoryName || CategoryName.FOOD}
      initialDirection={
        splitTargetItem?.type === TransactionType.INCOME ? 'I_OWE_THEM' : 'THEY_OWE_ME'
      }
      initialDate={splitTargetItem?.date}
      onCreated={() => {
        if (splitTargetItem) {
          const remaining = items.filter((i) => i.id !== splitTargetItem.id);
          setItems(remaining);
          if (remaining.length === 0) {
            setSplitTargetItem(null);
            onClose();
            return;
          }
        }
        setSplitTargetItem(null);
      }}
    />
    </>,
    document.body
  );
};

export default ImportCsvModal;
