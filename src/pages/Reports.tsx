import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTransactions as useTransactionsContext } from '../context/TransactionsContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import {
  getTotalIncome,
  getTotalExpense,
  getBalance,
  getTransactionsByMonth,
  getMonthlyComparison,
  getTransactionsByCategory,
  isCreditCardInvoiceTransaction,
} from '../utils/calculations';
import { formatCurrency, formatDate, parseDateFromAPI } from '../utils/format';
import {
  format,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  getDay,
  eachDayOfInterval,
  isSameDay,
  getDaysInMonth,
  isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import { ExpensesByCategoryWidget, IncomeByCategoryWidget } from '../components/widgets';
import { MonthlyComparison, Transaction } from '../types';
import {
  AccountType,
  TransactionType,
  CategoryName,
  getCategoryDisplayName,
  getCategoriesByType,
  CategoryType,
} from '../lib/enums';
import { useAllTransactions } from '../hooks/api/useTransactions';
import { useSplitDebts } from '../hooks/api/useSplitwise';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useCategories } from '../hooks/api/useCategories';
import { PageHeader } from '../components/PageHeader';
import { ReportsSkeleton } from '../components/PageSkeletons';
import { DatePicker } from '../components/DatePicker';
import SelectCombobox from '../components/SelectCombobox';
import ReportsDrilldownModal from '../components/reports/ReportsDrilldownModal';
import {
  FixedVsVariableAndSplitRow,
  FutureAndSavingsChartsRow,
  MonthComparisonSection,
} from '../components/reports/ReportsAnalyticsExtras';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Wallet,
  Flame,
  Search,
  Scale,
  ChevronDown,
  Check,
} from 'lucide-react';

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
}

const ReportChartTooltip = ({
  active,
  payload,
  label,
  baseCurrency,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  baseCurrency: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg p-3 text-xs">
      {label !== undefined && label !== '' && (
        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color || '#6366f1' }}
              />
              {entry.name}
            </span>
            <span className="font-medium text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(Number(entry.value || 0), baseCurrency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Reports = () => {
  const { recurringTransactions, accounts, loading } = useTransactionsContext();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { householdId } = useDefaultHousehold();
  const { data: categoriesData = [] } = useCategories({
    householdId: householdId ?? undefined,
    type: undefined,
    includeArchived: true,
  });

  const [reportType, setReportType] = useState<'mensal' | 'anual'>('mensal');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const hasInitializedAccountsRef = useRef<boolean>(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [tableFilter, setTableFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [drilldownState, setDrilldownState] = useState<{
    title: string;
    subtitle?: string;
    transactions: Transaction[];
  } | null>(null);

  const selectableAccounts = useMemo(
    () =>
      accounts.filter(
        (a): a is typeof a & { id: string } =>
          Boolean(a.id) && a.type !== AccountType.SAVINGS
      ),
    [accounts]
  );

  useEffect(() => {
    if (!hasInitializedAccountsRef.current && selectableAccounts.length > 0) {
      setSelectedAccountIds(selectableAccounts.map((a) => a.id));
      hasInitializedAccountsRef.current = true;
    }
  }, [selectableAccounts]);

  useEffect(() => {
    if (!isAccountDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(e.target as Node)
      ) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountDropdownOpen]);

  // Range de datas do período principal
  const dateRange = useMemo(() => {
    if (reportType === 'mensal') {
      return {
        startDate: startOfMonth(selectedMonth),
        endDate: endOfMonth(selectedMonth),
      };
    }
    return {
      startDate: startOfYear(new Date(selectedYear, 0, 1)),
      endDate: endOfYear(new Date(selectedYear, 11, 31)),
    };
  }, [reportType, selectedMonth, selectedYear]);

  // Últimos 12 meses (para comparativo e mês anterior)
  const comparisonDateRange = useMemo(() => {
    const anchor = reportType === 'mensal' ? selectedMonth : new Date();
    const end = endOfMonth(anchor > new Date() ? anchor : new Date());
    const start = subMonths(startOfMonth(anchor), 11);
    return { startDate: start, endDate: end };
  }, [reportType, selectedMonth]);

  // Últimos 5 anos (para anos disponíveis e ano anterior)
  const yearsDateRange = useMemo(() => {
    const end = endOfYear(new Date());
    const start = startOfYear(new Date(new Date().getFullYear() - 4, 0, 1));
    return { startDate: start, endDate: end };
  }, []);

  // Próximos 6 meses (para comprometimento futuro com parcelas)
  const futureDateRange = useMemo(() => {
    const start = startOfMonth(addMonths(new Date(), 1));
    const end = endOfMonth(addMonths(new Date(), 6));
    return { startDate: start, endDate: end };
  }, []);

  const transactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const comparisonTransactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: comparisonDateRange.startDate,
    endDate: comparisonDateRange.endDate,
  });

  const yearsTransactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: yearsDateRange.startDate,
    endDate: yearsDateRange.endDate,
  });

  const futureTransactionsData = useAllTransactions({
    householdId: householdId || undefined,
    startDate: futureDateRange.startDate,
    endDate: futureDateRange.endDate,
  });

  const { data: splitDebts = [] } = useSplitDebts(householdId || undefined);

  const custom = useMemo(
    () =>
      categoriesData
        .filter((c: { isSystem: boolean }) => !c.isSystem)
        .map(
          (c: {
            id: string;
            name: string;
            type: string;
            color?: string | null;
            icon?: string | null;
          }) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            color: c.color,
            icon: c.icon,
          })
        ),
    [categoriesData]
  );

  const resolveCategoryName = useCallback(
    (categoryName: string): string =>
      getCategoryDisplayName(
        categoryName,
        t as unknown as Record<string, string>,
        custom
      ),
    [t, custom]
  );

  const convertTransactions = useCallback(
    (data: Transaction[] | undefined) => {
      if (!data || data.length === 0) return [];

      return data
        .map((t) => {
          const catName = t.categoryName || 'OTHER_EXPENSES';
          const disp = () =>
            getCategoryDisplayName(
              catName as CategoryName,
              t as unknown as Record<string, string>,
              custom
            );

          const type =
            t.type === 'INCOME'
              ? TransactionType.INCOME
              : t.type === 'EXPENSE'
              ? TransactionType.EXPENSE
              : t.type === 'TRANSFER'
              ? TransactionType.TRANSFER
              : t.type === 'ALLOCATION'
              ? TransactionType.ALLOCATION
              : getCategoriesByType(CategoryType.INCOME).includes(
                  catName as CategoryName
                )
              ? TransactionType.INCOME
              : TransactionType.EXPENSE;

          let parsedDate: Date;
          try {
            if (typeof t.date === 'string') {
              parsedDate = parseDateFromAPI(t.date);
            } else if (
              t.date &&
              typeof t.date === 'object' &&
              'getTime' in t.date
            ) {
              parsedDate = t.date as Date;
            } else {
              parsedDate = new Date(t.date);
            }
            if (isNaN(parsedDate.getTime())) return null;
          } catch {
            return null;
          }

          return {
            id: t.id,
            description: t.description,
            amount: Number(t.amount),
            type,
            category: disp(),
            categoryName: catName as string,
            date: parsedDate,
            paid: t.paid,
            accountId: t.accountId,
            fromAccountId: (t as any).fromAccountId,
            toAccountId: (t as any).toAccountId,
            relatedEntityId: (t as any).relatedEntityId,
            recurringTransactionId: t.recurringTransactionId,
            attachmentUrl: t.attachmentUrl,
            installmentId: t.installmentId,
            installmentNumber: t.installmentNumber,
            totalInstallments: t.totalInstallments,
            notes: (t as any).notes,
            isSplit: (t as any).isSplit || false,
            splits: (t as any).splits
              ? (t as any).splits.map((split: any) => ({
                  userId: split.userId,
                  amount:
                    typeof split.amount === 'number'
                      ? split.amount
                      : split.amount?.toNumber
                      ? split.amount.toNumber()
                      : Number(split.amount),
                  accountId: split.accountId || undefined,
                }))
              : undefined,
          } as Transaction;
        })
        .filter((x): x is Transaction => x !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime());
    },
    [custom]
  );

  const filterByAccount = useCallback(
    (list: Transaction[]) => {
      if (!hasInitializedAccountsRef.current) return list;
      if (selectedAccountIds.length === 0) return [];
      const allowed = new Set(selectedAccountIds);
      return list.filter(
        (tx) =>
          (tx.accountId && allowed.has(tx.accountId)) ||
          (tx.fromAccountId && allowed.has(tx.fromAccountId)) ||
          (tx.toAccountId && allowed.has(tx.toAccountId))
      );
    },
    [selectedAccountIds]
  );

  const rawPeriodTransactions = useMemo(
    () => convertTransactions(transactionsData),
    [transactionsData, convertTransactions]
  );
  const transactions = useMemo(
    () => filterByAccount(rawPeriodTransactions),
    [rawPeriodTransactions, filterByAccount]
  );
  const rawComparisonTransactions = useMemo(
    () => convertTransactions(comparisonTransactionsData),
    [comparisonTransactionsData, convertTransactions]
  );
  const comparisonTransactions = useMemo(
    () => filterByAccount(rawComparisonTransactions),
    [rawComparisonTransactions, filterByAccount]
  );
  const yearsTransactions = useMemo(
    () => filterByAccount(convertTransactions(yearsTransactionsData)),
    [yearsTransactionsData, convertTransactions, filterByAccount]
  );
  const futureTransactions = useMemo(
    () => convertTransactions(futureTransactionsData),
    [futureTransactionsData, convertTransactions]
  );

  const accountMap = useMemo(() => {
    const map = new Map<string, (typeof accounts)[number]>();
    accounts.forEach((a) => {
      if (a.id) map.set(a.id, a);
    });
    return map;
  }, [accounts]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    yearsTransactions.forEach((t) => {
      if (t.date) years.add(t.date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [yearsTransactions]);

  const monthlyComparison = useMemo(
    () =>
      getMonthlyComparison(
        comparisonTransactions,
        12,
        selectedMonth,
        recurringTransactions,
        accounts
      ),
    [comparisonTransactions, selectedMonth, recurringTransactions, accounts]
  );

  const yearTransactions = useMemo(() => {
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 11, 31));
    return transactions.filter((t) => t.date >= start && t.date <= end);
  }, [transactions, selectedYear]);

  const monthTransactions = useMemo(
    () => getTransactionsByMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const currentData =
    reportType === 'mensal' ? monthTransactions : yearTransactions;

  const categoryData = useMemo(
    () => getTransactionsByCategory(currentData),
    [currentData]
  );

  const topCategories = useMemo(
    () =>
      [...categoryData]
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
        .slice(0, 8),
    [categoryData]
  );

  const monthlyData = useMemo((): MonthlyComparison[] => {
    if (reportType !== 'anual') return [];

    const monthly: MonthlyComparison[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = startOfMonth(new Date(selectedYear, i, 1));
      const monthEnd = endOfMonth(new Date(selectedYear, i, 1));
      let monthTrans = transactions.filter(
        (t) => t.date >= monthStart && t.date <= monthEnd
      );

      if (
        accounts &&
        accounts.length > 0 &&
        selectedAccountIds.length === selectableAccounts.length
      ) {
        monthTrans = monthTrans.filter((transaction) => {
          if (!transaction.accountId) return true;
          const account = accountMap.get(transaction.accountId);
          if (
            account?.type === AccountType.CREDIT &&
            transaction.type === TransactionType.EXPENSE
          ) {
            return false;
          }
          return true;
        });
      }

      monthly.push({
        month: format(monthStart, 'MMM', { locale: ptBR }),
        receita: getTotalIncome(monthTrans),
        despesa: getTotalExpense(monthTrans),
        saldo: getBalance(monthTrans),
      });
    }
    return monthly;
  }, [reportType, selectedYear, transactions, accounts, selectedAccountIds, selectableAccounts.length, accountMap]);

  const totalIncome = getTotalIncome(currentData);
  const totalExpense = getTotalExpense(currentData);
  const balance = getBalance(currentData);

  // Período anterior (usando dados reais de comparisonTransactions / yearsTransactions)
  const previousPeriodData = useMemo(() => {
    if (reportType === 'mensal') {
      const prevMonth = subMonths(selectedMonth, 1);
      return getTransactionsByMonth(comparisonTransactions, prevMonth);
    }
    const prevYear = selectedYear - 1;
    const start = startOfYear(new Date(prevYear, 0, 1));
    const end = endOfYear(new Date(prevYear, 11, 31));
    return yearsTransactions.filter((t) => t.date >= start && t.date <= end);
  }, [
    reportType,
    selectedMonth,
    selectedYear,
    comparisonTransactions,
    yearsTransactions,
  ]);

  const previousIncome = getTotalIncome(previousPeriodData);
  const previousExpense = getTotalExpense(previousPeriodData);
  const previousBalance = getBalance(previousPeriodData);

  const incomeChange = useMemo(() => {
    if (previousIncome === 0) return totalIncome > 0 ? 100 : 0;
    return ((totalIncome - previousIncome) / previousIncome) * 100;
  }, [totalIncome, previousIncome]);

  const expenseChange = useMemo(() => {
    if (previousExpense === 0) return totalExpense > 0 ? 100 : 0;
    return ((totalExpense - previousExpense) / previousExpense) * 100;
  }, [totalExpense, previousExpense]);

  const balanceChange = useMemo(() => {
    if (previousBalance === 0)
      return balance !== 0 ? (balance > 0 ? 100 : -100) : 0;
    return ((balance - previousBalance) / Math.abs(previousBalance)) * 100;
  }, [balance, previousBalance]);

  const rawCurrentData = useMemo(() => {
    if (reportType === 'mensal') {
      return getTransactionsByMonth(rawPeriodTransactions, selectedMonth);
    }
    const start = startOfYear(new Date(selectedYear, 0, 1));
    const end = endOfYear(new Date(selectedYear, 11, 31));
    return rawPeriodTransactions.filter((t) => t.date >= start && t.date <= end);
  }, [reportType, rawPeriodTransactions, selectedMonth, selectedYear]);

  const savingsSummary = useMemo(() => {
    let savedIn = 0;
    let withdrawnOut = 0;

    rawCurrentData.forEach((tx) => {
      const amount = Math.abs(tx.amount || 0);
      if (tx.type === TransactionType.TRANSFER) {
        const fromIsSavings =
          tx.fromAccountId && accountMap.get(tx.fromAccountId)?.type === AccountType.SAVINGS;
        const toIsSavings =
          tx.toAccountId && accountMap.get(tx.toAccountId)?.type === AccountType.SAVINGS;

        if (!fromIsSavings && toIsSavings) {
          savedIn += amount;
        } else if (fromIsSavings && !toIsSavings) {
          withdrawnOut += amount;
        }
      } else if (tx.accountId && accountMap.get(tx.accountId)?.type === AccountType.SAVINGS) {
        if (tx.type === TransactionType.INCOME) {
          savedIn += amount;
        } else if (tx.type === TransactionType.EXPENSE && !isCreditCardInvoiceTransaction(tx)) {
          withdrawnOut += amount;
        }
      }
    });

    const netSaved = savedIn - withdrawnOut;
    return { savedIn, withdrawnOut, netSaved };
  }, [rawCurrentData, accountMap]);

  const savingsRate = useMemo(() => {
    if (totalIncome === 0) return 0;
    return (savingsSummary.netSaved / totalIncome) * 100;
  }, [totalIncome, savingsSummary.netSaved]);

  const dailyBurnRate = useMemo(() => {
    if (reportType === 'anual') return totalExpense / 365;
    const daysInSelectedMonth = getDaysInMonth(selectedMonth);
    const today = new Date();
    const elapsedDays = isSameMonth(selectedMonth, today)
      ? Math.max(1, today.getDate())
      : daysInSelectedMonth;
    return totalExpense / elapsedDays;
  }, [reportType, selectedMonth, totalExpense]);

  const monthlyAverage = useMemo(() => {
    if (reportType === 'mensal') return null;
    return {
      income: totalIncome / 12,
      expense: totalExpense / 12,
      balance: balance / 12,
    };
  }, [reportType, totalIncome, totalExpense, balance]);

  const historicalAverage = useMemo(() => {
    const comparisonSlice =
      reportType === 'mensal' ? monthlyComparison.slice(-6) : [];
    if (comparisonSlice.length === 0) return null;

    const avgIncome =
      comparisonSlice.reduce((sum, m) => sum + m.receita, 0) /
      comparisonSlice.length;
    const avgExpense =
      comparisonSlice.reduce((sum, m) => sum + m.despesa, 0) /
      comparisonSlice.length;
    const avgBalance =
      comparisonSlice.reduce((sum, m) => sum + m.saldo, 0) /
      comparisonSlice.length;

    return {
      income: avgIncome,
      expense: avgExpense,
      balance: avgBalance,
      months: comparisonSlice.length,
    };
  }, [reportType, monthlyComparison]);

  // NOVO: Fluxo de Caixa Acumulado no mês
  const dailyCumulativeCashflow = useMemo(() => {
    if (reportType !== 'mensal') return [];
    const days = eachDayOfInterval({
      start: startOfMonth(selectedMonth),
      end: endOfMonth(selectedMonth),
    });

    let accIncome = 0;
    let accExpense = 0;

    return days.map((day) => {
      const dayTxs = monthTransactions.filter((t) => {
        if (!t.date || !isSameDay(t.date, day)) return false;
        if (
          t.type === TransactionType.TRANSFER ||
          t.type === TransactionType.ALLOCATION ||
          isCreditCardInvoiceTransaction(t)
        ) {
          return false;
        }
        return true;
      });

      const dayIncome = dayTxs
        .filter((t) => t.type === TransactionType.INCOME)
        .reduce((s, t) => s + (t.amount || 0), 0);
      const dayExpense = dayTxs
        .filter((t) => t.type === TransactionType.EXPENSE)
        .reduce((s, t) => s + (t.amount || 0), 0);

      accIncome += dayIncome;
      accExpense += dayExpense;

      return {
        day: format(day, 'dd'),
        receitaAcumulada: Number(accIncome.toFixed(2)),
        despesaAcumulada: Number(accExpense.toFixed(2)),
        saldoAcumulado: Number((accIncome - accExpense).toFixed(2)),
      };
    });
  }, [reportType, selectedMonth, monthTransactions]);

  // NOVO: Gastos por Conta / Meio de Pagamento
  const spendingByAccount = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        type?: AccountType;
        total: number;
        count: number;
      }
    >();

    currentData.forEach((tx) => {
      if (
        tx.type !== TransactionType.EXPENSE ||
        tx.categoryName === CategoryName.TRANSFER ||
        isCreditCardInvoiceTransaction(tx)
      ) {
        return;
      }
      const acc = tx.accountId ? accountMap.get(tx.accountId) : undefined;
      const key = acc?.id || 'unassigned';
      const entry = map.get(key) || {
        id: key,
        name: acc?.name || 'Sem conta vinculada',
        type: acc?.type,
        total: 0,
        count: 0,
      };
      entry.total += tx.amount || 0;
      entry.count += 1;
      map.set(key, entry);
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grandTotal = list.reduce((s, item) => s + item.total, 0);
    return { list, grandTotal };
  }, [currentData, accountMap]);

  // NOVO: Top 5 Maiores Despesas individuais
  const topExpenses = useMemo(() => {
    return currentData
      .filter(
        (tx) =>
          tx.type === TransactionType.EXPENSE &&
          tx.categoryName !== CategoryName.TRANSFER &&
          !isCreditCardInvoiceTransaction(tx)
      )
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, 5);
  }, [currentData]);

  // Gastos por Dia da Semana
  const spendingByDayOfWeek = useMemo(() => {
    if (reportType === 'anual') return null;

    const expenses = monthTransactions.filter((t) => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (
        t.categoryName === CategoryName.TRANSFER ||
        isCreditCardInvoiceTransaction(t)
      ) {
        return false;
      }
      return true;
    });

    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const totals = new Array(7).fill(0);
    expenses.forEach((t) => {
      const day = getDay(t.date);
      totals[day] += t.amount || 0;
    });

    return daysOfWeek.map((day, idx) => ({ day, amount: totals[idx] }));
  }, [reportType, monthTransactions]);

  // Gastos por Dia do Mês
  const spendingByDayOfMonth = useMemo(() => {
    if (reportType === 'anual') return null;

    const expenses = monthTransactions.filter((t) => {
      if (t.type !== TransactionType.EXPENSE) return false;
      if (
        t.categoryName === CategoryName.TRANSFER ||
        isCreditCardInvoiceTransaction(t)
      ) {
        return false;
      }
      return true;
    });

    const days = eachDayOfInterval({
      start: startOfMonth(selectedMonth),
      end: endOfMonth(selectedMonth),
    });

    return days.map((day) => {
      const dayExpenses = expenses
        .filter((t) => isSameDay(t.date, day))
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      return {
        day: format(day, 'dd'),
        amount: dayExpenses,
      };
    });
  }, [reportType, selectedMonth, monthTransactions]);

  // Insights automáticos
  const insights = useMemo(() => {
    const result: Array<{
      type: 'success' | 'warning' | 'info';
      icon: typeof TrendingUp;
      title: string;
      description: string;
    }> = [];

    if (totalIncome > 0) {
      if (savingsRate >= 20) {
        result.push({
          type: 'success',
          icon: PiggyBank,
          title: t.reportInsightExcellentSavingsRateTitle,
          description: t.reportInsightExcellentSavingsRateDescription.replace(
            '{percent}',
            savingsRate.toFixed(1)
          ),
        });
      } else if (savingsRate >= 10) {
        result.push({
          type: 'info',
          icon: PiggyBank,
          title: t.reportInsightGoodSavingsRateTitle,
          description: t.reportInsightGoodSavingsRateDescription.replace(
            '{percent}',
            savingsRate.toFixed(1)
          ),
        });
      } else if (savingsRate < 0) {
        result.push({
          type: 'warning',
          icon: AlertCircle,
          title: t.reportInsightNegativeSavingsRateTitle,
          description: t.reportInsightNegativeSavingsRateDescription.replace(
            '{percent}',
            Math.abs(savingsRate).toFixed(1)
          ),
        });
      }
    }

    if (incomeChange > 15 && expenseChange < 5 && previousIncome > 0) {
      result.push({
        type: 'success',
        icon: TrendingUp,
        title: t.reportInsightHealthyGrowthTitle,
        description: t.reportInsightHealthyGrowthDescription
          .replace('{incomePercent}', incomeChange.toFixed(1))
          .replace('{expensePercent}', expenseChange.toFixed(1)),
      });
    }

    if (topCategories.length > 0 && (totalExpense > 0 || totalIncome > 0)) {
      const topExpenseCat = [...categoryData].sort(
        (a, b) => b.despesa - a.despesa
      )[0];
      if (topExpenseCat && topExpenseCat.despesa > 0 && totalExpense > 0) {
        const pct = (topExpenseCat.despesa / totalExpense) * 100;
        if (pct > 35) {
          result.push({
            type: 'info',
            icon: Target,
            title: t.reportInsightDominantCategoryTitle,
            description: t.reportInsightDominantCategoryDescription
              .replace('{category}', resolveCategoryName(topExpenseCat.name))
              .replace('{percent}', pct.toFixed(0)),
          });
        }
      }
    }

    if (topExpenses.length > 0 && result.length < 3) {
      const biggest = topExpenses[0];
      result.push({
        type: 'info',
        icon: Flame,
        title: 'Maior gasto individual',
        description: `"${biggest.description}" representou ${formatCurrency(
          biggest.amount,
          baseCurrency
        )} (${
          totalExpense > 0
            ? ((biggest.amount / totalExpense) * 100).toFixed(1)
            : '0'
        }% das despesas).`,
      });
    }

    return result.slice(0, 3);
  }, [
    savingsRate,
    incomeChange,
    expenseChange,
    previousIncome,
    topCategories,
    categoryData,
    totalExpense,
    totalIncome,
    topExpenses,
    baseCurrency,
    resolveCategoryName,
    t,
  ]);

  const filteredCategoryTable = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return [...categoryData]
      .filter((cat) => {
        if (tableFilter === 'expense' && cat.despesa <= 0) return false;
        if (tableFilter === 'income' && cat.receita <= 0) return false;
        if (q && !resolveCategoryName(cat.name).toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (tableFilter === 'expense') return b.despesa - a.despesa;
        if (tableFilter === 'income') return b.receita - a.receita;
        return Math.abs(b.total) - Math.abs(a.total);
      });
  }, [categoryData, tableFilter, categorySearch, resolveCategoryName]);

  const handleExportReport = useMemo(() => {
    return () => {
      const periodLabel =
        reportType === 'mensal'
          ? format(selectedMonth, 'MMMM yyyy', { locale: ptBR })
          : selectedYear.toString();

      const csvRows: string[] = [];
      csvRows.push(t.reportFinancialReport);
      csvRows.push(
        `Tipo: ${
          reportType === 'mensal' ? t.reportTypeMonthly : t.reportTypeYearly
        }`
      );
      csvRows.push(`Período: ${periodLabel}`);
      csvRows.push('');
      csvRows.push(t.reportSummary);
      csvRows.push(
        `${t.reportTotalIncome},${formatCurrency(totalIncome, baseCurrency)}`
      );
      csvRows.push(
        `${t.reportTotalExpense},${formatCurrency(totalExpense, baseCurrency)}`
      );
      csvRows.push(
        `${t.reportBalance},${formatCurrency(balance, baseCurrency)}`
      );
      csvRows.push(`${t.reportSavingsRate},${savingsRate.toFixed(2)}%`);
      csvRows.push('');
      csvRows.push(t.reportCategories);
      csvRows.push(
        `${t.category},${t.totalIncome},${t.totalExpense},${t.balance},% ${t.totalIncome},% ${t.totalExpense}`
      );

      categoryData.forEach((cat) => {
        const incomePercentage =
          totalIncome > 0 && cat.receita > 0
            ? (cat.receita / totalIncome) * 100
            : 0;
        const expensePercentage =
          totalExpense > 0 && cat.despesa > 0
            ? (cat.despesa / totalExpense) * 100
            : 0;
        csvRows.push(
          `${resolveCategoryName(cat.name)},${formatCurrency(
            cat.receita,
            baseCurrency
          )},${formatCurrency(cat.despesa, baseCurrency)},${formatCurrency(
            cat.total,
            baseCurrency
          )},${incomePercentage > 0 ? `${incomePercentage.toFixed(2)}%` : '-'},${
            expensePercentage > 0 ? `${expensePercentage.toFixed(2)}%` : '-'
          }`
        );
      });

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `relatorio_${reportType}_${
          reportType === 'mensal'
            ? format(selectedMonth, 'yyyy-MM')
            : selectedYear
        }.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
  }, [
    reportType,
    selectedMonth,
    selectedYear,
    totalIncome,
    totalExpense,
    balance,
    savingsRate,
    categoryData,
    baseCurrency,
    resolveCategoryName,
    t,
  ]);

  if (loading) {
    return <ReportsSkeleton />;
  }

  const savingsBadge =
    totalIncome === 0
      ? { label: 'Sem receitas', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', bar: 'bg-gray-400' }
      : savingsRate >= 20
      ? { label: 'Excelente', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', bar: 'bg-emerald-500' }
      : savingsRate >= 10
      ? { label: 'Saudável', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', bar: 'bg-blue-500' }
      : savingsRate >= 0
      ? { label: 'Atenção', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', bar: 'bg-amber-500' }
      : { label: 'Déficit', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', bar: 'bg-red-500' };

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in pb-10">
      <PageHeader title={t.reports} description={t.overview}>
        <button
          onClick={handleExportReport}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t.exportReport}
        </button>
      </PageHeader>

      {/* Barra de Filtros Moderna */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Segmented Toggle Mensal / Anual */}
            <div>
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t.reportType}
              </span>
              <div className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setReportType('mensal')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    reportType === 'mensal'
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t.monthly}
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('anual')}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    reportType === 'anual'
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t.yearly}
                </button>
              </div>
            </div>

            {/* Navegador de Mês / Ano */}
            {reportType === 'mensal' ? (
              <div className="flex items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => startOfMonth(subMonths(m, 1)))}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="w-44">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    {t.month}
                  </label>
                  <DatePicker
                    value={selectedMonth}
                    onChange={(date) => {
                      if (date) setSelectedMonth(startOfMonth(date));
                    }}
                    placeholder={t.month}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => startOfMonth(addMonths(m, 1)))}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {!isSameMonth(selectedMonth, new Date()) && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(startOfMonth(new Date()))}
                    className="h-10 px-3 text-xs font-medium rounded-md border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    Mês atual
                  </button>
                )}
              </div>
            ) : (
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t.year}
                </label>
                <SelectCombobox
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value, 10))}
                  options={availableYears.map((year) => ({
                    value: year.toString(),
                    label: year.toString(),
                  }))}
                  placeholder={t.year}
                />
              </div>
            )}
          </div>

          {/* Filtro Multi-Seleção de Contas */}
          <div className="w-full lg:w-72 relative" ref={accountDropdownRef}>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Contas incluídas
            </label>
            <button
              type="button"
              onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
              className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white flex items-center justify-between gap-2 hover:border-primary-500 transition-colors"
            >
              <span className="truncate">
                {selectedAccountIds.length === 0
                  ? 'Nenhuma conta'
                  : selectedAccountIds.length === selectableAccounts.length
                  ? 'Todas as contas'
                  : selectedAccountIds.length === 1
                  ? accountMap.get(selectedAccountIds[0])?.name || '1 conta'
                  : `${selectedAccountIds.length} contas selecionadas`}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </button>

            {isAccountDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-full min-w-[260px] z-30 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2">
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAccountIds(selectableAccounts.map((a) => a.id))
                      }
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAccountIds([])}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {selectedAccountIds.length}/{selectableAccounts.length}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {selectableAccounts.map((acc) => {
                      const isChecked = selectedAccountIds.includes(acc.id);
                      const typeLabel =
                        acc.type === AccountType.CREDIT
                          ? 'Cartão'
                          : 'Conta';
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() =>
                            setSelectedAccountIds((prev) =>
                              prev.includes(acc.id)
                                ? prev.filter((id) => id !== acc.id)
                                : [...prev, acc.id]
                            )
                          }
                          className={`w-full px-2 py-1.5 rounded-md text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                            isChecked
                              ? 'bg-primary-50/70 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isChecked
                                  ? 'bg-primary-600 border-primary-600 text-white'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="truncate font-medium">{acc.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {typeLabel}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 Cards de Resumo (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Receitas */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t.totalIncomeLabel}
              </span>
            </div>
            {previousIncome > 0 && incomeChange !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  incomeChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                }`}
              >
                {incomeChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {Math.abs(incomeChange).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">
            {formatCurrency(totalIncome, baseCurrency)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {previousIncome > 0
              ? `${reportType === 'mensal' ? t.reportPreviousMonth : t.reportPreviousYear}: ${formatCurrency(previousIncome, baseCurrency)}`
              : 'Sem histórico no período anterior'}
          </p>
        </div>

        {/* Despesas */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t.totalExpenseLabel}
              </span>
            </div>
            {previousExpense > 0 && expenseChange !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  expenseChange > 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {expenseChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {Math.abs(expenseChange).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">
            {formatCurrency(totalExpense, baseCurrency)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Ritmo médio: {formatCurrency(dailyBurnRate, baseCurrency)}/dia
          </p>
        </div>

        {/* Saldo */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-sky-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t.balanceLabel}
              </span>
            </div>
            {previousBalance !== 0 && balanceChange !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                  balanceChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                }`}
              >
                {balanceChange > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {Math.abs(balanceChange).toFixed(1)}%
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-light tracking-tight ${
              balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            }`}
          >
            {formatCurrency(balance, baseCurrency)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {monthlyAverage
              ? `${t.reportMonthlyAverage} ${formatCurrency(monthlyAverage.balance, baseCurrency)}`
              : previousBalance !== 0
              ? `${t.reportPreviousMonth}: ${formatCurrency(previousBalance, baseCurrency)}`
              : 'Resultado líquido do período'}
          </p>
        </div>

        {/* Economia (Poupança) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-primary-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Economia (Poupança)
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${savingsBadge.cls}`}>
              {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : savingsBadge.label}
            </span>
          </div>
          <div
            className={`text-2xl font-light tracking-tight ${
              savingsSummary.netSaved >= 0
                ? 'text-gray-900 dark:text-white'
                : 'text-red-500 dark:text-red-400'
            }`}
          >
            {formatCurrency(savingsSummary.netSaved, baseCurrency)}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            {savingsSummary.withdrawnOut > 0
              ? `Aportes: ${formatCurrency(savingsSummary.savedIn, baseCurrency)} · Resgates: ${formatCurrency(savingsSummary.withdrawnOut, baseCurrency)}`
              : 'Enviado para contas poupança'}
          </p>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${savingsBadge.bar}`}
              style={{
                width: `${Math.max(0, Math.min(100, savingsRate))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {insights.map((insight, idx) => {
            const Icon = insight.icon;
            const bgColors = {
              success:
                'bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
              warning:
                'bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
              info: 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
            };
            const textColors = {
              success: 'text-emerald-700 dark:text-emerald-300',
              warning: 'text-amber-700 dark:text-amber-300',
              info: 'text-blue-700 dark:text-blue-300',
            };
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${bgColors[insight.type]}`}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                      textColors[insight.type]
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-medium mb-0.5 ${
                        textColors[insight.type]
                      }`}
                    >
                      {insight.title}
                    </h3>
                    <p className={`text-xs ${textColors[insight.type]} opacity-90`}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos Principais: Comparativo + Fluxo Acumulado (ou Evolução do Saldo) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-4">
            {reportType === 'mensal'
              ? t.annualComparison
              : t.monthlyComparisonOfYear}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reportType === 'mensal' ? monthlyComparison : monthlyData}>
              <CartesianGrid
                strokeDasharray="0"
                stroke="#e5e7eb"
                strokeOpacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="#9ca3af"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
              <Legend wrapperStyle={{ paddingTop: '14px' }} iconType="circle" />
              <Bar
                dataKey="receita"
                fill="#10b981"
                name={t.totalIncome}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="despesa"
                fill="#ef4444"
                name={t.totalExpense}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-4">
            {reportType === 'mensal'
              ? 'Fluxo de caixa acumulado no mês'
              : t.balanceEvolution}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            {reportType === 'mensal' ? (
              <AreaChart data={dailyCumulativeCashflow}>
                <defs>
                  <linearGradient id="colorAccIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAccExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#e5e7eb"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
                <Legend wrapperStyle={{ paddingTop: '14px' }} iconType="circle" />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="receitaAcumulada"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAccIncome)"
                  name="Receita acumulada"
                />
                <Area
                  type="monotone"
                  dataKey="despesaAcumulada"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAccExpense)"
                  name="Despesa acumulada"
                />
              </AreaChart>
            ) : (
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#e5e7eb"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
                <Legend wrapperStyle={{ paddingTop: '14px' }} iconType="circle" />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                  name={t.balance}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos de Categoria - Despesas e Receitas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ExpensesByCategoryWidget
          expenseByCategory={categoryData.map((cat) => ({
            name: cat.name,
            value: cat.despesa,
          }))}
          blurNumbers={false}
          totalExpense={totalExpense}
        />
        <IncomeByCategoryWidget
          incomeByCategory={categoryData.map((cat) => ({
            name: cat.name,
            value: cat.receita,
          }))}
          blurNumbers={false}
          totalIncome={totalIncome}
        />
      </div>

      {/* NOVO: Gastos por Conta + Top 5 Maiores Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gastos por Conta / Meio de Pagamento */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary-500" />
              Despesas por conta / cartão
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {spendingByAccount.list.length}{' '}
              {spendingByAccount.list.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>

          {spendingByAccount.list.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
              Nenhuma despesa registrada neste período.
            </div>
          ) : (
            <div className="space-y-3.5">
              {spendingByAccount.list.map((acc) => {
                const pct =
                  spendingByAccount.grandTotal > 0
                    ? (acc.total / spendingByAccount.grandTotal) * 100
                    : 0;
                const isCard = acc.type === AccountType.CREDIT;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      const matched = currentData.filter(
                        (tx) =>
                          tx.type === TransactionType.EXPENSE &&
                          tx.categoryName !== CategoryName.TRANSFER &&
                          !isCreditCardInvoiceTransaction(tx) &&
                          (acc.id === 'unassigned' ? !tx.accountId : tx.accountId === acc.id)
                      );
                      setDrilldownState({
                        title: acc.name,
                        subtitle: 'Despesas da conta no período',
                        transactions: matched,
                      });
                    }}
                    className="w-full text-left rounded-lg p-1.5 -mx-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {isCard ? (
                          <CreditCard className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        ) : (
                          <Wallet className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {acc.name}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          ({acc.count})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {pct.toFixed(1)}%
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(acc.total, baseCurrency)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isCard ? 'bg-indigo-500' : 'bg-primary-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 5 Maiores Despesas Individuais */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Maiores despesas do período
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Top 5
            </span>
          </div>

          {topExpenses.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
              Nenhuma despesa registrada neste período.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/70">
              {topExpenses.map((tx, idx) => {
                const accName = tx.accountId
                  ? accountMap.get(tx.accountId)?.name
                  : undefined;
                const catLabel = resolveCategoryName(
                  tx.categoryName || 'OTHER_EXPENSES'
                );
                return (
                  <div
                    key={tx.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {formatDate(tx.date)} · {catLabel}
                          {accName ? ` · ${accName}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums">
                      {formatCurrency(tx.amount, baseCurrency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* #3 Fixas vs. Variáveis + #5 Impacto da Divisão de Contas */}
      <FixedVsVariableAndSplitRow
        currentData={currentData}
        splitDebts={splitDebts}
        dateRange={dateRange}
        baseCurrency={baseCurrency}
      />

      {/* #2 Comprometimento Futuro + #6 Evolução da Poupança */}
      <FutureAndSavingsChartsRow
        futureTransactions={futureTransactions}
        recurringTransactions={recurringTransactions}
        selectedAccountIds={selectedAccountIds}
        selectableAccountsCount={selectableAccounts.length}
        rawComparisonTransactions={rawComparisonTransactions}
        accountMap={accountMap}
        baseCurrency={baseCurrency}
      />

      {/* #8 Comparação Mês A vs. Mês B */}
      <MonthComparisonSection
        comparisonTransactions={comparisonTransactions}
        resolveCategoryName={resolveCategoryName}
        baseCurrency={baseCurrency}
      />

      {/* Comparação com Média Histórica */}
      {historicalAverage && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
              {t.historicalAverageComparison}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t.basedOnLastMonths?.replace(
                '{months}',
                historicalAverage.months.toString()
              ) || `Baseado na média dos últimos ${historicalAverage.months} meses`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t.averageIncome}
              </div>
              <div className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-1">
                {formatCurrency(historicalAverage.income, baseCurrency)}
              </div>
              {historicalAverage.income > 0 && (
                <div
                  className={`text-xs font-medium ${
                    totalIncome >= historicalAverage.income
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {totalIncome >= historicalAverage.income ? '+' : ''}
                  {(
                    ((totalIncome - historicalAverage.income) /
                      historicalAverage.income) *
                    100
                  ).toFixed(1)}
                  % {t.vsAverage}
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t.averageExpense}
              </div>
              <div className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-1">
                {formatCurrency(historicalAverage.expense, baseCurrency)}
              </div>
              {historicalAverage.expense > 0 && (
                <div
                  className={`text-xs font-medium ${
                    totalExpense <= historicalAverage.expense
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {totalExpense <= historicalAverage.expense ? '-' : '+'}
                  {Math.abs(
                    ((totalExpense - historicalAverage.expense) /
                      historicalAverage.expense) *
                      100
                  ).toFixed(1)}
                  % {t.vsAverage}
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t.averageBalance}
              </div>
              <div className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-1">
                {formatCurrency(historicalAverage.balance, baseCurrency)}
              </div>
              <div
                className={`text-xs font-medium ${
                  balance >= historicalAverage.balance
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {balance >= historicalAverage.balance ? '+' : ''}
                {(
                  ((balance - historicalAverage.balance) /
                    (Math.abs(historicalAverage.balance) || 1)) *
                  100
                ).toFixed(1)}
                % {t.vsAverage}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Padrões de Consumo (Dia da Semana + Dia do Mês lado a lado) */}
      {reportType === 'mensal' && spendingByDayOfWeek && spendingByDayOfMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-4">
              {t.spendingByDayOfWeek}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spendingByDayOfWeek}>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#e5e7eb"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
                <Bar
                  dataKey="amount"
                  name={t.totalExpense}
                  fill="#ef4444"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white mb-4">
              {t.spendingByDayOfMonth}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spendingByDayOfMonth}>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#e5e7eb"
                  strokeOpacity={0.3}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
                <Bar
                  dataKey="amount"
                  name={t.totalExpense}
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Categorias */}
      {topCategories.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
              {t.topCategories}
            </h2>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t.reportTopCategories.replace(
                '{count}',
                topCategories.length.toString()
              )}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCategories} layout="vertical">
              <CartesianGrid
                strokeDasharray="0"
                stroke="#e5e7eb"
                strokeOpacity={0.3}
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="#9ca3af"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={130}
                tickFormatter={(val) => resolveCategoryName(val)}
                stroke="#9ca3af"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ReportChartTooltip baseCurrency={baseCurrency} />} />
              <Legend wrapperStyle={{ paddingTop: '14px' }} iconType="circle" />
              <Bar
                dataKey="receita"
                fill="#10b981"
                name={t.totalIncome}
                radius={[0, 6, 6, 0]}
              />
              <Bar
                dataKey="despesa"
                fill="#ef4444"
                name={t.totalExpense}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela Interativa de Categorias */}
      {categoryData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                {t.categoryDetails}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {filteredCategoryTable.length}{' '}
                {filteredCategoryTable.length === 1
                  ? t.reportCategory
                  : t.reportCategoriesPlural}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'expense', label: 'Despesas' },
                  { id: 'income', label: 'Receitas' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTableFilter(tab.id as any)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      tableFilter === tab.id
                        ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Filtrar categoria..."
                  className="h-8 pl-8 pr-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t.category}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t.totalIncome}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t.totalExpense}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t.balance}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    % {t.totalIncome}
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    % {t.totalExpense}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCategoryTable.map((cat) => {
                  const incomePercentage =
                    totalIncome > 0 && cat.receita > 0
                      ? (cat.receita / totalIncome) * 100
                      : 0;
                  const expensePercentage =
                    totalExpense > 0 && cat.despesa > 0
                      ? (cat.despesa / totalExpense) * 100
                      : 0;

                  return (
                    <tr
                      key={cat.name}
                      onClick={() => {
                        const matched = currentData.filter(
                          (tx) =>
                            tx.type !== TransactionType.TRANSFER &&
                            tx.type !== TransactionType.ALLOCATION &&
                            !isCreditCardInvoiceTransaction(tx) &&
                            (tx.category === cat.name ||
                              resolveCategoryName(tx.categoryName || '') ===
                                resolveCategoryName(cat.name))
                        );
                        setDrilldownState({
                          title: resolveCategoryName(cat.name),
                          subtitle: 'Transações desta categoria no período',
                          transactions: matched,
                        });
                      }}
                      title="Clique para ver as transações desta categoria"
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {resolveCategoryName(cat.name)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-right font-light tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {cat.receita > 0
                          ? formatCurrency(cat.receita, baseCurrency)
                          : '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-right font-light tracking-tight text-red-600 dark:text-red-400 tabular-nums">
                        {cat.despesa > 0
                          ? formatCurrency(cat.despesa, baseCurrency)
                          : '-'}
                      </td>
                      <td
                        className={`px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-right font-medium tracking-tight tabular-nums ${
                          cat.total >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {formatCurrency(cat.total, baseCurrency)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-right font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {incomePercentage > 0
                          ? `${incomePercentage.toFixed(1)}%`
                          : '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap text-sm text-right">
                        {expensePercentage > 0 ? (
                          <div className="inline-flex flex-col items-end gap-1 min-w-[72px]">
                            <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">
                              {expensePercentage.toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, expensePercentage)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* #7 Modal de Drill-down por Categoria / Conta */}
      <ReportsDrilldownModal
        isOpen={Boolean(drilldownState)}
        title={drilldownState?.title || ''}
        subtitle={drilldownState?.subtitle}
        transactions={drilldownState?.transactions || []}
        accountMap={accountMap}
        resolveCategoryName={resolveCategoryName}
        baseCurrency={baseCurrency}
        onClose={() => setDrilldownState(null)}
      />
    </div>
  );
};

export default Reports;
