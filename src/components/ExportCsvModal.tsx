import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from 'date-fns';
import { Account } from '../types';
import { CustomCategoryInfo, getCategoryDisplayName, TransactionType } from '../lib/enums';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { apiClient } from '../utils/api';
import { formatDate, formatDateForAPI, parseDateFromAPI } from '../utils/format';
import { analyticsHelpers } from '../utils/analytics';
import { DatePicker } from './DatePicker';
import SelectCombobox from './SelectCombobox';
import type { Transaction as ApiTransaction } from '../hooks/api/useTransactions';

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  householdId?: string;
  customCategories?: CustomCategoryInfo[];
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export const ExportCsvModal = ({
  isOpen,
  onClose,
  accounts,
  householdId,
  customCategories = [],
}: ExportCsvModalProps) => {
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();

  const [startDate, setStartDate] = useState<Date | null>(() => startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(() => new Date());
  const [accountId, setAccountId] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStartDate(startOfMonth(new Date()));
      setEndDate(new Date());
      setAccountId('');
      setIsExporting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isExporting, onClose]);

  const accountOptions = useMemo(
    () => [
      { value: '', label: 'Todas as contas' },
      ...accounts
        .filter((a): a is Account & { id: string } => Boolean(a.id))
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [accounts]
  );

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => {
      if (a.id) map.set(a.id, a.name);
    });
    return map;
  }, [accounts]);

  if (!isOpen) return null;

  const applyPreset = (preset: 'thisMonth' | 'last30' | 'lastMonth' | 'thisYear' | 'all') => {
    const now = new Date();
    if (preset === 'thisMonth') {
      setStartDate(startOfMonth(now));
      setEndDate(now);
    } else if (preset === 'last30') {
      setStartDate(subDays(now, 30));
      setEndDate(now);
    } else if (preset === 'lastMonth') {
      const prev = subMonths(now, 1);
      setStartDate(startOfMonth(prev));
      setEndDate(endOfMonth(prev));
    } else if (preset === 'thisYear') {
      setStartDate(startOfYear(now));
      setEndDate(now);
    } else {
      setStartDate(null);
      setEndDate(null);
    }
  };

  const handleExport = async () => {
    if (!householdId) {
      showError('Household não encontrado.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      showError('A data inicial não pode ser maior que a data final.');
      return;
    }

    setIsExporting(true);
    try {
      const allTransactions: ApiTransaction[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      let pageCount = 0;
      const MAX_PAGES = 50;

      while (hasMore && pageCount < MAX_PAGES) {
        pageCount++;
        const queryParams: Record<string, unknown> = {
          householdId,
          limit: 100,
          ...(accountId ? { accountId } : {}),
          ...(startDate ? { startDate: formatDateForAPI(startDate) } : {}),
          ...(endDate ? { endDate: formatDateForAPI(endDate) } : {}),
          ...(cursor ? { cursor } : {}),
        };

        const response = await apiClient.get<ApiTransaction[]>('/transactions', queryParams);
        const batch = Array.isArray(response.data) ? response.data : [];
        allTransactions.push(...batch);

        const pagination = (response as any).pagination;
        if (pagination?.hasMore && pagination?.nextCursor) {
          cursor = pagination.nextCursor;
        } else {
          hasMore = false;
        }
      }

      if (allTransactions.length === 0) {
        showError('Nenhuma transação encontrada para os filtros selecionados.');
        setIsExporting(false);
        return;
      }

      const typeLabelMap: Record<string, string> = {
        [TransactionType.INCOME]: t.income || 'Receita',
        [TransactionType.EXPENSE]: t.expense || 'Despesa',
        [TransactionType.TRANSFER]: t.transfer || 'Transferência',
        [TransactionType.ALLOCATION]: 'Alocação',
      };

      const headers = [
        t.date || 'Data',
        t.description || 'Descrição',
        t.type || 'Tipo',
        t.category || 'Categoria',
        t.amount || 'Valor',
        t.account || 'Conta',
        'Pago',
      ];

      const rows = allTransactions.map((tx) => {
        const parsedDate = tx.date ? parseDateFromAPI(tx.date) : null;
        const dateStr = parsedDate ? formatDate(parsedDate) : String(tx.date || '');

        const typeStr = (tx.type && typeLabelMap[tx.type]) || tx.type || '';

        const categoryStr = tx.categoryName
          ? getCategoryDisplayName(tx.categoryName, t, customCategories)
          : tx.type === TransactionType.TRANSFER
          ? t.transfer || 'Transferência'
          : t.noCategory || 'Sem categoria';

        let accountStr = '';
        if (tx.type === TransactionType.TRANSFER) {
          const fromName = tx.fromAccountId ? accountNameMap.get(tx.fromAccountId) || '' : '';
          const toName = tx.toAccountId ? accountNameMap.get(tx.toAccountId) || '' : '';
          accountStr = fromName && toName ? `${fromName} -> ${toName}` : fromName || toName;
        } else if (tx.accountId) {
          accountStr = accountNameMap.get(tx.accountId) || '';
        }

        const amountStr = Number(tx.amount || 0).toFixed(2);
        const paidStr = tx.paid ? 'Sim' : 'Não';

        return [
          dateStr,
          tx.description || '',
          typeStr,
          categoryStr,
          amountStr,
          accountStr,
          paidStr,
        ]
          .map(escapeCsvCell)
          .join(',');
      });

      const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const accountSlug = accountId
        ? `_${(accountNameMap.get(accountId) || 'conta')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')}`
        : '';
      const startSlug = startDate ? `_${formatDateForAPI(startDate)}` : '';
      const endSlug = endDate ? `_${formatDateForAPI(endDate)}` : '';
      const filename = `transacoes${accountSlug}${startSlug}${endSlug}.csv`;

      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      analyticsHelpers.logTransactionExported();
      success(
        `${allTransactions.length} ${allTransactions.length === 1 ? 'transação exportada' : 'transações exportadas'} com sucesso!`
      );
      onClose();
    } catch (err: any) {
      showError(err?.message || 'Erro ao exportar transações.');
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={() => {
          if (!isExporting) onClose();
        }}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-xl">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <Download className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                Exportar Transações (CSV)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Escolha o período e a conta que deseja extrair
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isExporting) onClose();
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Atalhos de período */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Atalhos de período
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'thisMonth', label: 'Este mês' },
                  { id: 'last30', label: 'Últimos 30 dias' },
                  { id: 'lastMonth', label: 'Mês passado' },
                  { id: 'thisYear', label: 'Este ano' },
                  { id: 'all', label: 'Todo o período' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id as any)}
                    className="px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data inicial */}
            <div>
              <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
                Data inicial
              </label>
              <DatePicker
                value={startDate}
                onChange={(d) => setStartDate(d)}
                placeholder="Sem limite inicial"
              />
            </div>

            {/* Data final */}
            <div>
              <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
                Data final
              </label>
              <DatePicker
                value={endDate}
                onChange={(d) => setEndDate(d)}
                placeholder="Sem limite final"
              />
            </div>

            {/* Conta */}
            <div>
              <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-1.5">
                Conta
              </label>
              <SelectCombobox
                value={accountId}
                onValueChange={setAccountId}
                options={accountOptions}
                placeholder="Todas as contas"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {t.cancel || 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExportCsvModal;
