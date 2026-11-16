import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarClock,
  Layers,
  Users,
  PiggyBank,
  GitCompareArrows,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Transaction, RecurringTransaction, Account } from '../../types';
import {
  AccountType,
  CategoryName,
  TransactionType,
} from '../../lib/enums';
import {
  getTotalIncome,
  getTotalExpense,
  getBalance,
  getTransactionsByMonth,
  getTransactionsByCategory,
  isCreditCardInvoiceTransaction,
} from '../../utils/calculations';
import { formatCurrency } from '../../utils/format';
import type { SplitDebt } from '../../pages/Loans';

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
}

const ExtraChartTooltip = ({
  active,
  payload,
  label,
  baseCurrency,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
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

// ============================================================================
// #3 Fixos vs. Variáveis + #5 Impacto da Divisão de Contas
// ============================================================================

interface FixedVsVariableAndSplitProps {
  currentData: Transaction[];
  splitDebts: SplitDebt[];
  dateRange: { startDate: Date; endDate: Date };
  baseCurrency: string;
}

export const FixedVsVariableAndSplitRow: React.FC<
  FixedVsVariableAndSplitProps
> = ({ currentData, splitDebts, dateRange, baseCurrency }) => {
  const expenseMix = useMemo(() => {
    let recurringTotal = 0;
    let installmentTotal = 0;
    let variableTotal = 0;

    currentData.forEach((tx) => {
      if (
        tx.type !== TransactionType.EXPENSE ||
        tx.categoryName === CategoryName.TRANSFER ||
        isCreditCardInvoiceTransaction(tx)
      ) {
        return;
      }
      const amt = tx.amount || 0;
      if (tx.recurringTransactionId) {
        recurringTotal += amt;
      } else if (tx.installmentId || (tx.totalInstallments && tx.totalInstallments > 1)) {
        installmentTotal += amt;
      } else {
        variableTotal += amt;
      }
    });

    const grandTotal = recurringTotal + installmentTotal + variableTotal;
    const pct = (v: number) => (grandTotal > 0 ? (v / grandTotal) * 100 : 0);

    return {
      grandTotal,
      items: [
        {
          label: 'Fixas / Recorrentes',
          value: recurringTotal,
          pct: pct(recurringTotal),
          color: 'bg-sky-500',
          dot: 'bg-sky-500',
        },
        {
          label: 'Parcelamentos',
          value: installmentTotal,
          pct: pct(installmentTotal),
          color: 'bg-amber-500',
          dot: 'bg-amber-500',
        },
        {
          label: 'Avulsas / Variáveis',
          value: variableTotal,
          pct: pct(variableTotal),
          color: 'bg-rose-500',
          dot: 'bg-rose-500',
        },
      ],
    };
  }, [currentData]);

  const splitImpact = useMemo(() => {
    const startStr = format(dateRange.startDate, 'yyyy-MM-dd');
    const endStr = format(dateRange.endDate, 'yyyy-MM-dd');

    let lentInPeriod = 0;
    let reimbursedInPeriod = 0;
    let openReceivableTotal = 0;
    let openPayableTotal = 0;

    splitDebts.forEach((debt) => {
      const createdYmd = (debt.createdAt || '').slice(0, 10);
      if (debt.direction === 'THEY_OWE_ME') {
        if (createdYmd >= startStr && createdYmd <= endStr) {
          lentInPeriod += debt.debtTotalAmount || 0;
        }
        debt.installments.forEach((inst) => {
          if (inst.paid && inst.paidAt) {
            const paidYmd = inst.paidAt.slice(0, 10);
            if (paidYmd >= startStr && paidYmd <= endStr) {
              reimbursedInPeriod += inst.amount || 0;
            }
          } else if (!inst.paid) {
            openReceivableTotal += inst.amount || 0;
          }
        });
      } else if (debt.direction === 'I_OWE_THEM') {
        debt.installments.forEach((inst) => {
          if (!inst.paid) {
            openPayableTotal += inst.amount || 0;
          }
        });
      }
    });

    return {
      lentInPeriod,
      reimbursedInPeriod,
      openReceivableTotal,
      openPayableTotal,
    };
  }, [splitDebts, dateRange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* #3 Fixos vs. Variáveis */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-500" />
            Fixas vs. Variáveis
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {formatCurrency(expenseMix.grandTotal, baseCurrency)}
          </span>
        </div>

        {expenseMix.grandTotal === 0 ? (
          <div className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
            Nenhuma despesa registrada neste período.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Barra empilhada */}
            <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex">
              {expenseMix.items.map(
                (item) =>
                  item.pct > 0 && (
                    <div
                      key={item.label}
                      className={`${item.color} h-full transition-all`}
                      style={{ width: `${item.pct}%` }}
                      title={`${item.label}: ${item.pct.toFixed(1)}%`}
                    />
                  )
              )}
            </div>

            <div className="space-y-3 pt-1">
              {expenseMix.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                    <span className="text-gray-700 dark:text-gray-300">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.pct.toFixed(1)}%
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(item.value, baseCurrency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* #5 Impacto da Divisão de Contas */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            Impacto da Divisão de Contas
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            No período &amp; em aberto
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-violet-50/60 dark:bg-violet-900/20 border border-violet-200/60 dark:border-violet-800/40">
            <span className="text-[11px] text-violet-700 dark:text-violet-300">
              Pago por amigos (período)
            </span>
            <p className="text-lg font-medium text-gray-900 dark:text-white mt-0.5 tabular-nums">
              {formatCurrency(splitImpact.lentInPeriod, baseCurrency)}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Reembolsado (período)
            </span>
            <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
              {formatCurrency(splitImpact.reimbursedInPeriod, baseCurrency)}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-700/40">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Total a receber (aberto)
            </span>
            <p className="text-base font-medium text-gray-900 dark:text-white mt-0.5 tabular-nums">
              {formatCurrency(splitImpact.openReceivableTotal, baseCurrency)}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-700/40">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Total que você deve (aberto)
            </span>
            <p className="text-base font-medium text-red-600 dark:text-red-400 mt-0.5 tabular-nums">
              {formatCurrency(splitImpact.openPayableTotal, baseCurrency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// #2 Comprometimento Futuro (6 meses) + #6 Evolução da Poupança (12 meses)
// ============================================================================

interface FutureAndSavingsChartsProps {
  futureTransactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  selectedAccountIds: string[];
  selectableAccountsCount: number;
  rawComparisonTransactions: Transaction[];
  accountMap: Map<string, Account>;
  baseCurrency: string;
}

export const FutureAndSavingsChartsRow: React.FC<
  FutureAndSavingsChartsProps
> = ({
  futureTransactions,
  recurringTransactions,
  selectedAccountIds,
  selectableAccountsCount,
  rawComparisonTransactions,
  accountMap,
  baseCurrency,
}) => {
  const futureCommitmentData = useMemo(() => {
    const now = new Date();
    const allowedSet = new Set(selectedAccountIds);
    const filterBySelected =
      selectedAccountIds.length > 0 &&
      selectedAccountIds.length < selectableAccountsCount;

    const activeRecurringExpenses = recurringTransactions.filter((r) => {
      if (!r.isActive || r.type !== TransactionType.EXPENSE) return false;
      if (filterBySelected && r.accountId && !allowedSet.has(r.accountId)) {
        return false;
      }
      return true;
    });

    const months = [];
    for (let i = 1; i <= 6; i++) {
      const target = addMonths(startOfMonth(now), i);
      const mStart = startOfMonth(target);
      const mEnd = endOfMonth(target);

      const installmentsSum = futureTransactions
        .filter((tx) => {
          if (tx.type !== TransactionType.EXPENSE) return false;
          if (!tx.date || tx.date < mStart || tx.date > mEnd) return false;
          if (isCreditCardInvoiceTransaction(tx)) return false;
          if (!tx.installmentId && !(tx.totalInstallments && tx.totalInstallments > 1)) {
            return false;
          }
          if (
            filterBySelected &&
            tx.accountId &&
            !allowedSet.has(tx.accountId)
          ) {
            return false;
          }
          return true;
        })
        .reduce((s, tx) => s + (tx.amount || 0), 0);

      let recurringSum = 0;
      activeRecurringExpenses.forEach((r) => {
        if (r.startDate && new Date(r.startDate) > mEnd) return;
        if (r.endDate && new Date(r.endDate) < mStart) return;
        const amt = Number(r.amount || 0);
        if (r.frequency === 'monthly') recurringSum += amt;
        else if (r.frequency === 'biweekly') recurringSum += amt * 2;
        else if (r.frequency === 'weekly') recurringSum += amt * 4.33;
        else if (r.frequency === 'daily') recurringSum += amt * 30;
        else if (r.frequency === 'yearly') {
          const startM = r.startDate ? new Date(r.startDate).getMonth() : 0;
          if (startM === target.getMonth()) recurringSum += amt;
        }
      });

      months.push({
        month: format(target, 'MMM/yy', { locale: ptBR }),
        parcelas: Number(installmentsSum.toFixed(2)),
        recorrentes: Number(recurringSum.toFixed(2)),
      });
    }

    return months;
  }, [
    futureTransactions,
    recurringTransactions,
    selectedAccountIds,
    selectableAccountsCount,
  ]);

  const savingsEvolutionData = useMemo(() => {
    const now = new Date();
    let cumulative = 0;
    const rows = [];

    for (let i = 11; i >= 0; i--) {
      const mStart = startOfMonth(subMonths(now, i));
      const mEnd = endOfMonth(mStart);
      let aportes = 0;
      let resgates = 0;

      rawComparisonTransactions.forEach((tx) => {
        if (!tx.date || tx.date < mStart || tx.date > mEnd) return;
        const amount = Math.abs(tx.amount || 0);

        if (tx.type === TransactionType.TRANSFER) {
          const fromIsSavings =
            tx.fromAccountId &&
            accountMap.get(tx.fromAccountId)?.type === AccountType.SAVINGS;
          const toIsSavings =
            tx.toAccountId &&
            accountMap.get(tx.toAccountId)?.type === AccountType.SAVINGS;
          if (!fromIsSavings && toIsSavings) aportes += amount;
          else if (fromIsSavings && !toIsSavings) resgates += amount;
        } else if (
          tx.accountId &&
          accountMap.get(tx.accountId)?.type === AccountType.SAVINGS
        ) {
          if (tx.type === TransactionType.INCOME) aportes += amount;
          else if (
            tx.type === TransactionType.EXPENSE &&
            !isCreditCardInvoiceTransaction(tx)
          ) {
            resgates += amount;
          }
        }
      });

      const netMonth = Number((aportes - resgates).toFixed(2));
      cumulative = Number((cumulative + netMonth).toFixed(2));
      rows.push({
        month: format(mStart, 'MMM/yy', { locale: ptBR }),
        saldoMes: netMonth,
        acumulado: cumulative,
      });
    }

    return rows;
  }, [rawComparisonTransactions, accountMap]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* #2 Comprometimento Futuro */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            Comprometimento futuro (6 meses)
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Parcelas + Recorrentes
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={futureCommitmentData}>
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
            <Tooltip content={<ExtraChartTooltip baseCurrency={baseCurrency} />} />
            <Legend wrapperStyle={{ paddingTop: '12px' }} iconType="circle" />
            <Bar
              dataKey="parcelas"
              stackId="a"
              fill="#f59e0b"
              name="Parcelas"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="recorrentes"
              stackId="a"
              fill="#0ea5e9"
              name="Recorrentes"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* #6 Evolução da Poupança */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-emerald-500" />
            Evolução da poupança (12 meses)
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Aportes líquidos acumulados
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={savingsEvolutionData}>
            <defs>
              <linearGradient id="colorSavingsAcc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
            <Tooltip content={<ExtraChartTooltip baseCurrency={baseCurrency} />} />
            <Legend wrapperStyle={{ paddingTop: '12px' }} iconType="circle" />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="acumulado"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorSavingsAcc)"
              name="Acumulado (12m)"
            />
            <Area
              type="monotone"
              dataKey="saldoMes"
              stroke="#0ea5e9"
              strokeWidth={1.75}
              fillOpacity={0}
              name="Aporte líquido no mês"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ============================================================================
// #8 Comparação Mês A vs. Mês B
// ============================================================================

interface MonthComparisonSectionProps {
  comparisonTransactions: Transaction[];
  resolveCategoryName: (categoryName: string) => string;
  baseCurrency: string;
}

export const MonthComparisonSection: React.FC<MonthComparisonSectionProps> = ({
  comparisonTransactions,
  resolveCategoryName,
  baseCurrency,
}) => {
  const monthOptions = useMemo(() => {
    const now = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, idx) => {
      const m = subMonths(now, idx);
      return {
        key: format(m, 'yyyy-MM'),
        label: format(m, 'MMMM/yyyy', { locale: ptBR }),
        date: m,
      };
    });
  }, []);

  const [monthAKey, setMonthAKey] = useState<string>(() =>
    format(startOfMonth(new Date()), 'yyyy-MM')
  );
  const [monthBKey, setMonthBKey] = useState<string>(() =>
    format(subMonths(startOfMonth(new Date()), 1), 'yyyy-MM')
  );

  const comparison = useMemo(() => {
    const optA = monthOptions.find((m) => m.key === monthAKey) || monthOptions[0];
    const optB = monthOptions.find((m) => m.key === monthBKey) || monthOptions[1];

    const txA = getTransactionsByMonth(comparisonTransactions, optA.date);
    const txB = getTransactionsByMonth(comparisonTransactions, optB.date);

    const incA = getTotalIncome(txA);
    const incB = getTotalIncome(txB);
    const expA = getTotalExpense(txA);
    const expB = getTotalExpense(txB);
    const balA = getBalance(txA);
    const balB = getBalance(txB);

    const catsA = getTransactionsByCategory(txA);
    const catsB = getTransactionsByCategory(txB);
    const mapA = new Map(catsA.map((c) => [c.name, c.despesa]));
    const mapB = new Map(catsB.map((c) => [c.name, c.despesa]));
    const allCatNames = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

    const diffs = allCatNames
      .map((name) => {
        const valA = mapA.get(name) || 0;
        const valB = mapB.get(name) || 0;
        const delta = valA - valB;
        const pct = valB > 0 ? (delta / valB) * 100 : valA > 0 ? 100 : 0;
        return { name, valA, valB, delta, pct };
      })
      .filter((d) => d.valA > 0 || d.valB > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);

    return {
      labelA: optA.label,
      labelB: optB.label,
      incA,
      incB,
      expA,
      expB,
      balA,
      balB,
      diffs,
    };
  }, [monthOptions, monthAKey, monthBKey, comparisonTransactions]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-light tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary-500" />
          Comparação entre meses
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={monthAKey}
            onChange={(e) => setMonthAKey(e.target.value)}
            className="h-9 px-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white capitalize"
          >
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">vs.</span>
          <select
            value={monthBKey}
            onChange={(e) => setMonthBKey(e.target.value)}
            className="h-9 px-3 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white capitalize"
          >
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          {
            label: 'Receitas',
            a: comparison.incA,
            b: comparison.incB,
            positiveIsGood: true,
          },
          {
            label: 'Despesas',
            a: comparison.expA,
            b: comparison.expB,
            positiveIsGood: false,
          },
          {
            label: 'Saldo',
            a: comparison.balA,
            b: comparison.balB,
            positiveIsGood: true,
          },
        ].map((metric) => {
          const diff = metric.a - metric.b;
          const isGood = metric.positiveIsGood ? diff >= 0 : diff <= 0;
          return (
            <div
              key={metric.label}
              className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/40"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {metric.label}
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-base font-medium text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(metric.a, baseCurrency)}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  vs {formatCurrency(metric.b, baseCurrency)}
                </span>
              </div>
              <div
                className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                  diff === 0
                    ? 'text-gray-500'
                    : isGood
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                }`}
              >
                {diff >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {diff >= 0 ? '+' : ''}
                {formatCurrency(diff, baseCurrency)}
              </div>
            </div>
          );
        })}
      </div>

      {comparison.diffs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">
            Maiores variações de despesa por categoria
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {comparison.diffs.map((d) => {
              const increased = d.delta > 0;
              return (
                <div
                  key={d.name}
                  className="p-3 rounded-lg border border-gray-100 dark:border-gray-700/80 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {resolveCategoryName(d.name)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatCurrency(d.valA, baseCurrency)} vs{' '}
                      {formatCurrency(d.valB, baseCurrency)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap tabular-nums ${
                      increased
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {increased ? '+' : ''}
                    {formatCurrency(d.delta, baseCurrency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
