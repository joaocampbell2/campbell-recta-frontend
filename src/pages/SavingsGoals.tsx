import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransactions } from '../context/TransactionsContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { useCommandMenu } from '../context/CommandMenuContext';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { formatCurrency, formatDate } from '../utils/format';
import { parseCurrencyValue } from '../utils/currency';
import { Plus, Target, X, Link2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { SavingsGoalsActionsMenu } from '../components/SavingsGoalsActionsMenu';
import { SavingsGoal, Account } from '../types';
import { differenceInDays } from 'date-fns';
import { createSchemas, SavingsGoalFormData } from '../schemas';
import { PageHeader } from '../components/PageHeader';
import { PageButton } from '../components/PageButton';
import { SavingsGoalsSkeleton } from '../components/PageSkeletons';
import SelectCombobox from '../components/SelectCombobox';
import { DatePicker } from '../components/DatePicker';
import { AccountType } from '../lib/enums';

/**
 * Resolve the currentAmount for display:
 * - If the goal is linked to an investment account, sync to the account balance
 *   so the meta (goal) reflects the money actually stored there.
 * - Otherwise, use the manually tracked currentAmount.
 */
function resolveGoalCurrentAmount(goal: SavingsGoal, accounts: Account[]): number {
  if (goal.accountId) {
    const linkedAccount = accounts.find((a) => a.id === goal.accountId);
    if (linkedAccount && linkedAccount.type === AccountType.INVESTMENT) {
      return Math.max(0, Number(linkedAccount.totalBalance ?? linkedAccount.balance ?? 0));
    }
  }
  return goal.currentAmount;
}

function isGoalSyncedWithInvestment(goal: SavingsGoal, accounts: Account[]): boolean {
  if (!goal.accountId) return false;
  const linkedAccount = accounts.find((a) => a.id === goal.accountId);
  return !!linkedAccount && linkedAccount.type === AccountType.INVESTMENT;
}

const SavingsGoals = () => {
  const { savingsGoals, accounts, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, loading } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { savingsGoalSchema } = createSchemas(t);
  const { registerHandler, unregisterHandler } = useCommandMenu();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; goalId: string | null }>({
    isOpen: false,
    goalId: null,
  });
  const targetAmountMask = useCurrencyMask();
  const currentAmountMask = useCurrencyMask();

  useEffect(() => {
    registerHandler('newGoal', () => {
      setEditingGoal(null);
      setIsModalOpen(true);
    });
    return () => {
      unregisterHandler('newGoal');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handler para fechar modal com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isModalOpen) return;
    
    // Prevenir scroll do body quando modal estiver aberto
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setEditingGoal(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isModalOpen]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
    control,
  } = useForm<SavingsGoalFormData>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      targetDate: undefined,
      accountId: '',
    },
  });

  useEffect(() => {
    if (editingGoal) {
      const targetDate = editingGoal.targetDate 
        ? (editingGoal.targetDate instanceof Date ? editingGoal.targetDate : new Date(editingGoal.targetDate))
        : undefined;
      
      reset({
        name: editingGoal.name,
        targetAmount: editingGoal.targetAmount || 0,
        currentAmount: editingGoal.currentAmount || 0,
        targetDate: targetDate,
        accountId: editingGoal.accountId || '',
      });
      targetAmountMask.setValue(editingGoal.targetAmount || 0);
      currentAmountMask.setValue(editingGoal.currentAmount || 0);
      setValue('targetAmount', editingGoal.targetAmount || 0);
      setValue('currentAmount', editingGoal.currentAmount || 0);
    } else {
      reset({
        name: '',
        targetAmount: 0,
        currentAmount: 0,
        targetDate: undefined,
        accountId: '',
      });
      targetAmountMask.setValue('');
      currentAmountMask.setValue('');
      setValue('targetAmount', 0);
      setValue('currentAmount', 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingGoal?.id, reset, setValue]);

  const onSubmit = async (data: SavingsGoalFormData) => {
    try {
      // When linked to an investment account, currentAmount is auto-derived
      // from the account balance at render time. Send the synced value so
      // server-side views stay consistent until next sync.
      const resolvedCurrentAmount = isLinkedToInvestment
        ? Math.max(0, Number(linkedAccount?.totalBalance ?? linkedAccount?.balance ?? 0))
        : data.currentAmount || 0;

      const goalData: Omit<SavingsGoal, 'id' | 'userId'> = {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: resolvedCurrentAmount,
        targetDate: data.targetDate,
        accountId: data.accountId || undefined,
      };

      if (editingGoal?.id) {
        await updateSavingsGoal(editingGoal.id, goalData);
        success('Meta atualizada com sucesso!');
      } else {
        await addSavingsGoal(goalData);
        success('Meta criada com sucesso!');
      }
      setIsModalOpen(false);
      setEditingGoal(null);
      targetAmountMask.setValue('');
      currentAmountMask.setValue('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar meta';
      showError(errorMessage);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({ isOpen: true, goalId: id });
  };

  const handleConfirmDelete = async () => {
    if (confirmModal.goalId) {
      await deleteSavingsGoal(confirmModal.goalId);
      setConfirmModal({ isOpen: false, goalId: null });
    }
  };

  // Calcula quanto precisa guardar mensalmente
  const watchedTargetAmount = watch('targetAmount');
  const watchedCurrentAmount = watch('currentAmount');
  const watchedTargetDate = watch('targetDate');
  const watchedAccountId = watch('accountId');

  // Detect when the goal is linked to an investment account: in that case
  // currentAmount is auto-synced with the linked account balance.
  const linkedAccount = useMemo(
    () => accounts.find((a) => a.id === watchedAccountId) || null,
    [accounts, watchedAccountId]
  );
  const isLinkedToInvestment =
    !!linkedAccount && linkedAccount.type === AccountType.INVESTMENT;
  
  const monthlySavingsNeeded = useMemo(() => {
    const targetAmount = watchedTargetAmount || 0;
    const currentAmount = watchedCurrentAmount || 0;
    const targetDate = watchedTargetDate;
    
    if (!targetDate || targetAmount <= 0) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const target = targetDate instanceof Date ? targetDate : new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    // Verifica se a data alvo é no futuro
    if (target <= today) {
      return null;
    }

    // Calcula a diferença em dias
    const daysRemaining = differenceInDays(target, today);
    
    // Só mostra se for maior que um mês (mais de 30 dias)
    if (daysRemaining <= 30) {
      return null;
    }

    const remainingAmount = targetAmount - currentAmount;
    
    if (remainingAmount <= 0) {
      return null;
    }

    // Calcula o valor mensal necessário baseado nos dias restantes
    // Converte dias para meses (aproximadamente 30 dias por mês)
    const monthlyRate = (remainingAmount / daysRemaining) * 30;
    return monthlyRate;
  }, [watchedTargetAmount, watchedCurrentAmount, watchedTargetDate]);

  if (loading) {
    return <SavingsGoalsSkeleton />;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in">
      <PageHeader
        title={t.goals}
        description={t.goalsDescription}
      >
        <PageButton
          onClick={() => {
            setEditingGoal(null);
            setIsModalOpen(true);
          }}
          variant="primary"
          icon={Plus}
          aria-label={t.newGoal}
        >
          {t.newGoal}
        </PageButton>
      </PageHeader>

      {/* Lista de metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savingsGoals.length === 0 ? (
          <div className="col-span-full px-6 py-8 text-center font-light text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg">
            {t.noGoalsRegistered}
          </div>
        ) : (
          savingsGoals.map((goal) => {
            const isSynced = isGoalSyncedWithInvestment(goal, accounts);
            const displayCurrentAmount = resolveGoalCurrentAmount(goal, accounts);
            const progress = goal.targetAmount > 0 ? (displayCurrentAmount / goal.targetAmount) * 100 : 0;
            const remaining = goal.targetAmount - displayCurrentAmount;
            const daysRemaining = goal.targetDate 
              ? Math.ceil((goal.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : null;

            // Calcula quanto precisa guardar mensalmente
            const calculateMonthlySavings = () => {
              if (!goal.targetDate || goal.targetAmount <= 0) {
                return null;
              }

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const target = goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate);
              target.setHours(0, 0, 0, 0);
              
              // Verifica se a data alvo é no futuro
              if (target <= today) {
                return null;
              }

              // Calcula a diferença em dias
              const daysRemaining = differenceInDays(target, today);
              
              // Só mostra se for maior que um mês (mais de 30 dias)
              if (daysRemaining <= 30) {
                return null;
              }

              const remainingAmount = goal.targetAmount - displayCurrentAmount;
              
              if (remainingAmount <= 0) {
                return null;
              }

              // Calcula o valor mensal necessário baseado nos dias restantes
              // Converte dias para meses (aproximadamente 30 dias por mês)
              const monthlyRate = (remainingAmount / daysRemaining) * 30;
              return monthlyRate;
            };

            const monthlySavings = calculateMonthlySavings();

            return (
              <div key={goal.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center">
                    <Target className="h-6 w-6 text-primary-600 dark:text-primary-400 mr-2" />
                    <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">{goal.name}</h3>
                  </div>
                  <SavingsGoalsActionsMenu
                    goal={goal}
                    onEdit={(goal) => {
                      setEditingGoal(goal);
                      setIsModalOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                </div>

                <div className="mb-6">
                  <div className="flex justify-between text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                    <span>{formatCurrency(displayCurrentAmount, baseCurrency)}</span>
                    <span>{formatCurrency(goal.targetAmount, baseCurrency)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1">
                    <div
                      className="bg-primary-600 dark:bg-primary-500 h-1 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-sm font-light text-gray-500 dark:text-gray-400">
                    {progress.toFixed(1)}% {t.completed}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500 dark:text-gray-300">{t.remainingAmount}</span>
                    <span className="font-light text-gray-900 dark:text-white">{formatCurrency(remaining, baseCurrency)}</span>
                  </div>
                  {goal.targetDate && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500 dark:text-gray-300">{t.deadline}</span>
                      <span className="font-light text-gray-900 dark:text-white">
                        {formatDate(goal.targetDate)}
                        {daysRemaining !== null && (
                          <span className="ml-2 text-xs font-light text-gray-400 dark:text-gray-500">
                            ({daysRemaining > 0 ? `${daysRemaining} ${daysRemaining === 1 ? (t.day || 'dia') : (t.days || 'dias')}` : t.overdue})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {goal.accountId && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500 dark:text-gray-300">{t.account}:</span>
                      <span className="font-light text-gray-900 dark:text-white inline-flex items-center gap-2">
                        {accounts.find(a => a.id === goal.accountId)?.name || t.notAvailable}
                        {isSynced && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-light text-green-600 dark:text-green-400"
                            title={t.goalSyncedWithAccount || 'Sincronizado com o saldo da conta'}
                          >
                            <Link2 className="h-3 w-3" />
                            {t.synced || 'sync'}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
                {monthlySavings !== null && monthlySavings > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm font-light text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {t.monthlySavingsNeeded}
                        </span>
                        {' '}
                        <span className="font-light text-blue-500 dark:text-blue-400">
                          {formatCurrency(monthlySavings, baseCurrency)}
                        </span>
                        {' '}
                        <span className="text-gray-500 dark:text-gray-500">
                          {t.perMonth} {t.toReachGoal}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full sm:w-96 max-w-md p-4 sm:p-5 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                {editingGoal ? t.editGoal : t.newGoal}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingGoal(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.goalName}
                </label>
                <input
                  type="text"
                  {...register('name')}
                  className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
                    errors.name ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.targetAmount}
                </label>
                <input
                  type="text"
                  value={targetAmountMask.value}
                  onChange={(e) => {
                    targetAmountMask.onChange(e);
                    const numericValue = parseCurrencyValue(e.target.value);
                    setValue('targetAmount', numericValue, { shouldValidate: true });
                  }}
                  placeholder={t.currencyPlaceholder}
                  className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
                    errors.targetAmount ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                  }`}
                />
                <input
                  type="hidden"
                  {...register('targetAmount', {
                    valueAsNumber: true,
                  })}
                />
                {errors.targetAmount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.targetAmount.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.currentAmount}
                </label>
                <input
                  type="text"
                  value={
                    isLinkedToInvestment
                      ? formatCurrency(
                          Math.max(
                            0,
                            Number(linkedAccount?.totalBalance ?? linkedAccount?.balance ?? 0)
                          ),
                          baseCurrency
                        )
                      : currentAmountMask.value
                  }
                  readOnly={isLinkedToInvestment}
                  disabled={isLinkedToInvestment}
                  onChange={(e) => {
                    currentAmountMask.onChange(e);
                    const numericValue = parseCurrencyValue(e.target.value);
                    setValue('currentAmount', numericValue, { shouldValidate: true });
                  }}
                  placeholder={t.currencyPlaceholder}
                  className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
                    isLinkedToInvestment ? 'cursor-not-allowed opacity-70' : ''
                  } ${
                    errors.currentAmount ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                  }`}
                />
                <input
                  type="hidden"
                  {...register('currentAmount', {
                    valueAsNumber: true,
                  })}
                />
                {isLinkedToInvestment ? (
                  <p className="mt-1 text-xs font-light text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    {t.goalSyncedWithAccount ||
                      'Vinculado a uma conta de investimento. O valor atual é sincronizado automaticamente com o saldo da conta.'}
                  </p>
                ) : null}
                {errors.currentAmount && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.currentAmount.message}</p>
                )}
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.targetDate}
                </label>
                <DatePicker
                  value={watch('targetDate') || undefined}
                  onChange={(date) => {
                    setValue('targetDate', date || undefined, { shouldValidate: true, shouldDirty: true });
                  }}
                  placeholder={t.targetDate}
                  minDate={new Date()}
                />
                <input
                  type="hidden"
                  {...register('targetDate')}
                />
              </div>

              <div>
                <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
                  {t.account} ({t.optional})
                </label>
                <Controller
                  name="accountId"
                  control={control}
                  render={({ field }) => (
                    <SelectCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      options={[
                        { value: '', label: t.none },
                        ...accounts.map(account => ({
                          value: account.id || '',
                          label: account.name
                        }))
                      ]}
                      placeholder={t.none}
                    />
                  )}
                />
              </div>

              {/* Rodapé com cálculo mensal */}
              {monthlySavingsNeeded !== null && monthlySavingsNeeded > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm font-light text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {t.monthlySavingsNeeded}
                      </span>
                      {' '}
                      <span className="font-light text-blue-500 dark:text-blue-400">
                        {formatCurrency(monthlySavingsNeeded, baseCurrency)}
                      </span>
                      {' '}
                      <span className="text-gray-500 dark:text-gray-500">
                        {t.perMonth} {t.toReachGoal}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingGoal(null);
                  }}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t.loading : editingGoal ? t.update : t.create}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, goalId: null })}
        onConfirm={handleConfirmDelete}
        title={t.delete}
        message={t.confirmDeleteGoal}
        variant="danger"
      />
    </div>
  );
};

export default SavingsGoals;
