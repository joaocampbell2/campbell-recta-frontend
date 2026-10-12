import { useState, useMemo } from 'react';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useInstallmentTransactions, InstallmentTransactionItem } from '../hooks/api/useTransactions';
import { formatCurrency, formatDate } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { 
  CreditCard, Search, Calendar, ChevronDown, ChevronUp, CheckCircle2, Clock, 
  TrendingDown, ShoppingBag, Receipt
} from 'lucide-react';

const Installments = () => {
  const { householdId } = useDefaultHousehold();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
    const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch installment transactions
  const { data: responseData, isLoading } = useInstallmentTransactions({
    householdId: householdId || undefined,
    limit: 100, // Fetch a large enough batch to show in memory
  });

  const installments = useMemo(() => responseData?.data || [], [responseData?.data]);

  // Extrair contas únicas das parcelas para o filtro
  const uniqueAccounts = useMemo(() => {
    const accounts = new Map();
    installments.forEach(item => {
      if (item.account) {
        accounts.set(item.account.id, item.account.name);
      }
    });
    return Array.from(accounts.entries());
  }, [installments]);

  // Toggle expanded details of a purchase
  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Filter installment purchases based on search term, status AND account
  const filteredInstallments = useMemo(() => {
    let filtered = installments;

    // Apply Search
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.description.toLowerCase().includes(lowerSearch) ||
        (item.account?.name && item.account.name.toLowerCase().includes(lowerSearch))
      );
    }

    // Apply Status Filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(item => item.paidInstallmentsCount < item.totalInstallments);
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(item => item.paidInstallmentsCount === item.totalInstallments);
    }

    // Apply Account Filter
    if (accountFilter !== 'all') {
      filtered = filtered.filter(item => item.account?.id === accountFilter);
    }

    return filtered;
  }, [installments, searchTerm, statusFilter, accountFilter]);

  // Compute overall stats metrics
  const stats = useMemo(() => {
    const totalPurchasesCount = installments.length;
    let totalRemainingDebt = 0;
    let monthlyCommitment = 0;

    installments.forEach(item => {
      // Monthly commitment is the sum of single installment amounts
      monthlyCommitment += item.installmentAmount;
      
      // Calculate remaining unpaid debt for this group
      const unpaidTransactions = item.transactions.filter(t => !t.paid);
      const remainingForGroup = unpaidTransactions.reduce((sum, t) => sum + t.amount, 0);
      totalRemainingDebt += remainingForGroup;
    });

    return {
      totalPurchasesCount,
      totalRemainingDebt,
      monthlyCommitment,
    };
  }, [installments]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in pb-12">
      <PageHeader
        title={t.installments || "Parcelamentos"}
        description={t.installmentsDescription || "Acompanhe e gerencie todas as suas compras parceladas."}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600 dark:text-purple-400">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total de Compras</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {isLoading ? '...' : stats.totalPurchasesCount}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Saldo Devedor Total</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {isLoading ? '...' : formatCurrency(stats.totalRemainingDebt, baseCurrency)}
            </h3>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Compromisso Mensal</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {isLoading ? '...' : formatCurrency(stats.monthlyCommitment, baseCurrency)}
            </h3>
          </div>
        </div>
      </div>

            {/* Filter and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Pesquisar por descrição ou conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-0 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 placeholder-gray-400 text-sm"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            {(['active', 'completed', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === s 
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-white shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                {s === 'active' ? 'Ativo' : s === 'completed' ? 'Concluído' : 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {/* Account Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Cartões:</span>
          <button
            onClick={() => setAccountFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              accountFilter === 'all' 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200' 
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent'
            }`}
          >
            Todos
          </button>
          {uniqueAccounts.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setAccountFilter(id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                accountFilter === id 
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200' 
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4 font-medium text-sm">Carregando seus parcelamentos...</p>
        </div>
      ) : filteredInstallments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl py-16 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center px-4">
          <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-full text-purple-500 mb-4">
            <Receipt className="w-10 h-10" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">Nenhum parcelamento encontrado</h4>
          <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm text-sm">
            {searchTerm ? "Tente alterar os termos de busca para encontrar o que procura." : "Não há transações parceladas ativas nesta casa."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredInstallments.map((item: InstallmentTransactionItem) => {
            const isExpanded = expandedId === item.id;
            
            // Calculate progress percentages
            const paidPct = item.totalInstallments > 0 ? (item.paidInstallmentsCount / item.totalInstallments) * 100 : 0;
            const passedPct = item.totalInstallments > 0 ? (item.passedInstallmentsCount / item.totalInstallments) * 100 : 0;
            
            // Unpaid remaining balance for this purchase
            const unpaidRemaining = item.transactions
              .filter(t => !t.paid)
              .reduce((sum, t) => sum + t.amount, 0);

            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Header Info */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                        {item.description}
                      </h4>
                      {item.account && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700">
                          <CreditCard className="w-3.5 h-3.5 mr-1" />
                          {item.account.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 block uppercase">Valor Total</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          {formatCurrency(item.totalAmount, baseCurrency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-400 block uppercase">Valor Parcela</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          {item.totalInstallments}x {formatCurrency(item.installmentAmount, baseCurrency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-400 block uppercase">Restante a Pagar</span>
                        <span className="text-base font-bold text-rose-500">
                          {formatCurrency(unpaidRemaining, baseCurrency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-gray-400 block uppercase">Até</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {formatDate(item.endDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Visual Progress Wheel or Details */}
                    <div className="text-right">
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                        Pagas: {item.progress}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        Tempo: {item.passedProgress}
                      </div>
                    </div>

                    <button 
                      aria-label="Expandir detalhes"
                      className="p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar Layer */}
                <div className="px-6 pb-4">
                  <div className="w-full bg-gray-100 dark:bg-gray-700/60 h-2 rounded-full overflow-hidden relative">
                    {/* Passed (Time) Progress underlay */}
                    <div 
                      className="bg-gray-300 dark:bg-gray-600 h-full absolute left-0 top-0 transition-all duration-500" 
                      style={{ width: `${passedPct}%` }}
                    />
                    {/* Paid Progress overlay */}
                    <div 
                      className="bg-purple-600 h-full absolute left-0 top-0 transition-all duration-500" 
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                </div>

                {/* Collapsible Details list */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-6">
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Cronograma de Parcelas</h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-150 dark:divide-gray-800/80">
                        <thead>
                          <tr>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase pb-3">Parcela</th>
                            <th className="text-left text-xs font-semibold text-gray-400 uppercase pb-3">Data Cobrança</th>
                            <th className="text-right text-xs font-semibold text-gray-400 uppercase pb-3">Valor</th>
                            <th className="text-right text-xs font-semibold text-gray-400 uppercase pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                          {item.transactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-white/40 dark:hover:bg-gray-800/20">
                              <td className="py-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                                {tx.installmentNumber}/{item.totalInstallments}
                              </td>
                              <td className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                                {formatDate(tx.date)}
                              </td>
                              <td className="py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                {formatCurrency(tx.amount, baseCurrency)}
                              </td>
                              <td className="py-3 text-right">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  tx.paid 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                                }`}>
                                  {tx.paid ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Pago
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3.5 h-3.5" />
                                      Pendente
                                    </>
                                  )}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Installments;
