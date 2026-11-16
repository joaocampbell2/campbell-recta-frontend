import React from 'react';
import { X, Search, Check, UserPlus } from 'lucide-react';
import CategoryCombobox from './CategoryCombobox';
import SelectCombobox from './SelectCombobox';
import { DatePicker } from './DatePicker';
import { TransactionType } from '../lib/enums';
import { formatCurrency } from '../utils/format';
import type { Friend, SplitGroup, SplitDirection, SplitRule } from '../pages/Loans';

interface SplitDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  baseCurrency: string;
  householdId?: string | null;
  // Step 1
  groups: SplitGroup[];
  debtGroupId: string;
  onGroupChange: (groupId: string) => void;
  memberSearchTerm: string;
  onMemberSearchTermChange: (val: string) => void;
  availableMembersForSplit: Friend[];
  selectedMemberIds: string[];
  onToggleMemberSelection: (friendId: string) => void;
  onSelectAllAvailable: () => void;
  onDeselectAllAvailable: () => void;
  // Step 2
  debtDirection: SplitDirection;
  onDirectionChange: (dir: SplitDirection) => void;
  payerFriendId: string;
  onPayerFriendChange: (friendId: string) => void;
  debtCategory: string;
  onCategoryChange: (cat: string) => void;
  userAccounts: Array<{ id: string; name: string }>;
  debtAccountId: string;
  onAccountChange: (accId: string) => void;
  debtDesc: string;
  onDescChange: (val: string) => void;
  totalAmountValue: string;
  totalAmountNumeric: number;
  onTotalAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  debtInstallmentsCount: string;
  onInstallmentsCountChange: (val: string) => void;
  debtDate?: Date | null;
  onDateChange?: (date: Date | null) => void;
  onGoToStep3: () => void;
  // Step 3
  debtSplitRule: SplitRule;
  onSplitRuleChange: (rule: SplitRule) => void;
  splitParticipants: string[];
  friendMap: Map<string, Friend>;
  participantShares: Record<string, number>;
  equalIncludedIds: string[];
  onToggleEqualIncluded: (id: string) => void;
  percentageByParticipant: Record<string, string>;
  onPercentageChange: (id: string, val: string) => void;
  amountByParticipant: Record<string, string>;
  onAmountChange: (id: string, val: string) => void;
  distributedTotal: number;
  distributedPct: number;
  isStep3Valid: boolean;
  isSubmitting?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onSaveAndCreateNew?: () => void;
  onSwitchToTransaction?: () => void;
  onEqualizeSmallest?: () => void;
  onCreateFriendClick?: () => void;
  debtAlreadyPaid?: boolean;
  onAlreadyPaidChange?: (paid: boolean) => void;
}

export function computeEqualizedDistribution(
  participants: string[],
  currentValues: Record<string, number>,
  targetTotal: number
): Record<string, number> {
  const result: Record<string, number> = { ...currentValues };
  if (participants.length === 0) return result;

  const vals = participants.map((id) => currentValues[id] || 0);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);

  const distributeEqually = (ids: string[], totalToDistribute: number) => {
    if (ids.length === 0) return;
    const base = Math.floor((totalToDistribute / ids.length) * 100) / 100;
    const remainderTargetId = ids.includes('me') ? 'me' : ids[0];
    ids.forEach((id) => {
      result[id] =
        id === remainderTargetId
          ? Number((totalToDistribute - base * (ids.length - 1)).toFixed(2))
          : base;
    });
  };

  if (Math.abs(maxVal - minVal) < 0.005) {
    distributeEqually(participants, targetTotal);
    return result;
  }

  let targetIds = participants.filter((id) => Math.abs((currentValues[id] || 0) - minVal) < 0.005);
  const fixedSum = participants
    .filter((id) => !targetIds.includes(id))
    .reduce((acc, id) => acc + (currentValues[id] || 0), 0);
  let remaining = Number((targetTotal - fixedSum).toFixed(2));

  if (remaining < 0) {
    const nonMaxIds = participants.filter(
      (id) => Math.abs((currentValues[id] || 0) - maxVal) >= 0.005
    );
    const maxSum = participants
      .filter((id) => !nonMaxIds.includes(id))
      .reduce((acc, id) => acc + (currentValues[id] || 0), 0);
    const remAfterMax = Number((targetTotal - maxSum).toFixed(2));
    if (nonMaxIds.length > 0 && remAfterMax >= 0) {
      targetIds = nonMaxIds;
      remaining = remAfterMax;
    } else {
      distributeEqually(participants, targetTotal);
      return result;
    }
  }

  distributeEqually(targetIds, remaining);
  return result;
}

const SplitDebtModal: React.FC<SplitDebtModalProps> = ({
  isOpen,
  onClose,
  step,
  onStepChange,
  baseCurrency,
  householdId,
  groups,
  debtGroupId,
  onGroupChange,
  memberSearchTerm,
  onMemberSearchTermChange,
  availableMembersForSplit,
  selectedMemberIds,
  onToggleMemberSelection,
  onSelectAllAvailable,
  onDeselectAllAvailable,
  debtDirection,
  onDirectionChange,
  payerFriendId,
  onPayerFriendChange,
  debtCategory,
  onCategoryChange,
  userAccounts,
  debtAccountId,
  onAccountChange,
  debtDesc,
  onDescChange,
  totalAmountValue,
  totalAmountNumeric,
  onTotalAmountChange,
  debtInstallmentsCount,
  onInstallmentsCountChange,
  debtDate,
  onDateChange,
  onGoToStep3,
  debtSplitRule,
  onSplitRuleChange,
  splitParticipants,
  friendMap,
  participantShares,
  equalIncludedIds,
  onToggleEqualIncluded,
  percentageByParticipant,
  onPercentageChange,
  amountByParticipant,
  onAmountChange,
  distributedTotal,
  distributedPct,
  isStep3Valid,
  isSubmitting = false,
  onSubmit,
  onSaveAndCreateNew,
  onSwitchToTransaction,
  onEqualizeSmallest,
  onCreateFriendClick,
  debtAlreadyPaid = false,
  onAlreadyPaidChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[450px] max-w-lg p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
              {step === 1
                ? 'Com quem dividir?'
                : step === 2
                ? 'Nova despesa'
                : 'Divisão'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {onSwitchToTransaction && (
            <div className="grid grid-cols-2 gap-1.5 p-1 mb-4 rounded-lg bg-gray-100 dark:bg-gray-800/80">
              <button
                type="button"
                onClick={onSwitchToTransaction}
                className="py-1.5 px-3 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Transação
              </button>
              <button
                type="button"
                className="py-1.5 px-3 rounded-md text-xs font-medium bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm"
              >
                Divisão de Conta
              </button>
            </div>
          )}

          {/* PASSO 1: QUEM */}
          {step === 1 && (
            <div className="space-y-4">
              {groups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Grupo
                  </label>
                  <SelectCombobox
                    value={debtGroupId}
                    onValueChange={onGroupChange}
                    options={[
                      { value: '', label: 'Todos os amigos' },
                      ...groups.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                    placeholder="Todos os amigos"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Amigos
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {onCreateFriendClick && (
                      <>
                        <button
                          type="button"
                          onClick={onCreateFriendClick}
                          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:opacity-70 font-medium"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Novo amigo
                        </button>
                        <span className="text-gray-300 dark:text-gray-700">|</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={onSelectAllAvailable}
                      className="text-primary-600 dark:text-primary-400 hover:opacity-70"
                    >
                      Todos
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      type="button"
                      onClick={onDeselectAllAvailable}
                      className="text-gray-500 dark:text-gray-400 hover:opacity-70"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="relative mb-2">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearchTerm}
                    onChange={(e) => onMemberSearchTermChange(e.target.value)}
                    placeholder="Buscar..."
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                  />
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-md max-h-60 overflow-y-auto">
                  {availableMembersForSplit.length === 0 ? (
                    <div className="text-center py-4 space-y-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                        Nenhum resultado
                      </p>
                      {onCreateFriendClick && (
                        <button
                          type="button"
                          onClick={onCreateFriendClick}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:opacity-75"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Criar novo amigo
                        </button>
                      )}
                    </div>
                  ) : (
                    availableMembersForSplit.map((friend) => {
                      const isSelected = selectedMemberIds.includes(friend.id);
                      return (
                        <button
                          type="button"
                          key={friend.id}
                          onClick={() => onToggleMemberSelection(friend.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-primary-50/50 dark:bg-primary-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <span className="text-gray-900 dark:text-gray-100 font-light truncate">
                            {friend.name}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedMemberIds.length === 0}
                  onClick={() => onStepChange(2)}
                  className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* PASSO 2: O QUE */}
          {step === 2 && (
            <form
              onSubmit={(e) => {
                if (debtDirection === 'I_OWE_THEM') {
                  onSubmit(e);
                } else {
                  e.preventDefault();
                  if (
                    totalAmountNumeric > 0 &&
                    debtDesc.trim() &&
                    selectedMemberIds.length > 0
                  ) {
                    onGoToStep3();
                  }
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Quem pagou
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onDirectionChange('THEY_OWE_ME')}
                    className={`py-2.5 px-3 rounded-md border text-sm font-light tracking-tight transition-all ${
                      debtDirection === 'THEY_OWE_ME'
                        ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50/20 dark:bg-primary-950/20 font-medium'
                        : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    Eu paguei
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDirectionChange('I_OWE_THEM');
                      if (
                        selectedMemberIds.length > 0 &&
                        !selectedMemberIds.includes(payerFriendId)
                      ) {
                        onPayerFriendChange(selectedMemberIds[0]);
                      }
                    }}
                    className={`py-2.5 px-3 rounded-md border text-sm font-light tracking-tight transition-all ${
                      debtDirection === 'I_OWE_THEM'
                        ? 'border-primary-600 dark:border-primary-400 text-primary-600 dark:text-primary-400 bg-primary-50/20 dark:bg-primary-950/20 font-medium'
                        : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    Eu devo
                  </button>
                </div>

                {/* Se "Eu devo" e houver mais de 1 amigo selecionado, mostra as fotinhas para escolher quem pagou */}
                {debtDirection === 'I_OWE_THEM' && selectedMemberIds.length > 1 && (
                  <div className="mt-3">
                    <span className="block text-xs font-light text-gray-500 dark:text-gray-400 mb-2">
                      Escolha quem pagou:
                    </span>
                    <div className="flex items-center gap-3 flex-wrap">
                      {selectedMemberIds.map((fId) => {
                        const f = friendMap.get(fId);
                        if (!f) return null;
                        const activePayerId =
                          payerFriendId && selectedMemberIds.includes(payerFriendId)
                            ? payerFriendId
                            : selectedMemberIds[0];
                        const isPayer = activePayerId === f.id;
                        const initials = f.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => onPayerFriendChange(f.id)}
                            className="flex flex-col items-center gap-1 group focus:outline-none"
                            title={f.name}
                          >
                            <div
                              className={`relative rounded-full p-0.5 transition-all ${
                                isPayer
                                  ? 'ring-2 ring-primary-500'
                                  : 'opacity-60 hover:opacity-100'
                              }`}
                            >
                              {f.avatarUrl ? (
                                <img
                                  src={f.avatarUrl}
                                  alt={f.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`w-10 h-10 rounded-full ${f.avatarColor} text-white font-bold text-xs flex items-center justify-center`}
                                >
                                  {initials}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[11px] max-w-[68px] truncate ${
                                isPayer
                                  ? 'font-medium text-primary-600 dark:text-primary-400'
                                  : 'font-light text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {f.name.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div
                className={
                  debtDirection === 'THEY_OWE_ME' || debtAlreadyPaid
                    ? 'grid grid-cols-2 gap-3'
                    : ''
                }
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <CategoryCombobox
                    value={debtCategory}
                    onValueChange={onCategoryChange}
                    type={TransactionType.EXPENSE}
                    householdId={householdId ?? undefined}
                  />
                </div>

                {(debtDirection === 'THEY_OWE_ME' || debtAlreadyPaid) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Conta
                    </label>
                    <SelectCombobox
                      value={debtAccountId || userAccounts[0]?.id || ''}
                      onValueChange={onAccountChange}
                      options={[
                        ...userAccounts.map((acc) => ({
                          value: acc.id,
                          label: acc.name,
                        })),
                        { value: 'NONE', label: 'Nenhuma conta' },
                      ]}
                      placeholder="Selecione a conta"
                    />
                  </div>
                )}
              </div>

              {debtDirection === 'I_OWE_THEM' && onAlreadyPaidChange && (
                <label className="flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={debtAlreadyPaid}
                    onChange={(e) => onAlreadyPaidChange(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Pago
                  </span>
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    (Já paguei minha parte ao amigo)
                  </span>
                </label>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  required
                  value={debtDesc}
                  onChange={(e) => onDescChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={totalAmountValue}
                    onChange={onTotalAmountChange}
                    placeholder={formatCurrency(0, baseCurrency)}
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parcelas
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={debtInstallmentsCount}
                    onChange={(e) => {
                      onInstallmentsCountChange(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="1"
                    className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                  />
                </div>
              </div>

              {onDateChange && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data
                  </label>
                  <DatePicker
                    value={debtDate}
                    onChange={onDateChange}
                    placeholder="Selecione a data"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => onStepChange(1)}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                >
                  Voltar
                </button>
                {debtDirection === 'I_OWE_THEM' ? (
                  <>
                    {onSaveAndCreateNew && (
                      <button
                        type="button"
                        onClick={onSaveAndCreateNew}
                        disabled={
                          totalAmountNumeric <= 0 ||
                          !debtDesc.trim() ||
                          selectedMemberIds.length === 0 ||
                          isSubmitting
                        }
                        className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity disabled:opacity-50"
                      >
                        {isSubmitting ? 'Salvando...' : 'Salvar e criar outra'}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={
                        totalAmountNumeric <= 0 ||
                        !debtDesc.trim() ||
                        selectedMemberIds.length === 0 ||
                        isSubmitting
                      }
                      className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-50"
                    >
                      {isSubmitting ? 'Criando...' : 'Criar Dívida'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={
                      totalAmountNumeric <= 0 ||
                      !debtDesc.trim() ||
                      selectedMemberIds.length === 0
                    }
                    onClick={onGoToStep3}
                    className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    Continuar
                  </button>
                )}
              </div>
            </form>
          )}

          {/* PASSO 3: DIVISÃO */}
          {step === 3 && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'EQUAL', label: 'Igualmente' },
                    { value: 'PERCENTAGE', label: 'Porcentagem' },
                    { value: 'UNEQUAL', label: 'Desigualmente' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSplitRuleChange(opt.value)}
                    className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                      debtSplitRule === opt.value
                        ? 'border-primary-600 bg-primary-50/50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-md max-h-60 overflow-y-auto">
                {splitParticipants.map((id) => {
                  const label =
                    id === 'me' ? 'Você' : friendMap.get(id)?.name || 'Amigo';
                  const shareValue = participantShares[id] || 0;
                  const isIncluded = equalIncludedIds.includes(id);

                  if (debtSplitRule === 'EQUAL') {
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onToggleEqualIncluded(id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                          isIncluded
                            ? 'bg-primary-50/30 dark:bg-primary-900/10'
                            : 'opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <span className="text-gray-900 dark:text-gray-100 font-light truncate">
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(shareValue, baseCurrency)}
                          </span>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isIncluded
                                ? 'border-primary-600 bg-primary-600 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isIncluded && <Check className="h-3 w-3" />}
                          </div>
                        </div>
                      </button>
                    );
                  }

                  if (debtSplitRule === 'PERCENTAGE') {
                    const currentPct =
                      parseFloat((percentageByParticipant[id] || '0').replace(',', '.')) || 0;
                    const diffPct = Number((100 - distributedPct).toFixed(2));
                    const targetPct = Number((currentPct + diffPct).toFixed(2));
                    const showRestBtn =
                      splitParticipants.length > 2 &&
                      Math.abs(diffPct) > 0.01 &&
                      targetPct >= 0;

                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="text-gray-900 dark:text-gray-100 font-light truncate">
                          {label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatCurrency(shareValue, baseCurrency)}
                          </span>
                          {showRestBtn && (
                            <button
                              type="button"
                              onClick={() => onPercentageChange(id, String(targetPct))}
                              className="px-2 py-1 text-[11px] font-medium rounded border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-colors"
                              title="Completar com a porcentagem restante"
                            >
                              Resto
                            </button>
                          )}
                          <div className="relative w-24">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={percentageByParticipant[id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9.,]/g, '');
                                onPercentageChange(id, val);
                              }}
                              className="block w-full pr-6 pl-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 text-sm font-light"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const currentAmt =
                    parseFloat(
                      (amountByParticipant[id] || '0').replace(/\./g, '').replace(',', '.')
                    ) || 0;
                  const diffAmt = Number((totalAmountNumeric - distributedTotal).toFixed(2));
                  const targetAmt = Number((currentAmt + diffAmt).toFixed(2));
                  const showAmountRestBtn =
                    splitParticipants.length > 2 &&
                    Math.abs(diffAmt) > 0.01 &&
                    targetAmt >= 0;

                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <span className="text-gray-900 dark:text-gray-100 font-light truncate">
                        {label}
                      </span>
                      <div className="flex items-center gap-2">
                        {showAmountRestBtn && (
                          <button
                            type="button"
                            onClick={() =>
                              onAmountChange(id, targetAmt.toFixed(2).replace('.', ','))
                            }
                            className="px-2 py-1 text-[11px] font-medium rounded border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-colors"
                            title="Completar com o valor restante"
                          >
                            Resto
                          </button>
                        )}
                        <div className="w-32">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={amountByParticipant[id] ?? '0,00'}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '');
                              const formatted = (parseInt(digits || '0', 10) / 100)
                                .toFixed(2)
                                .replace('.', ',');
                              onAmountChange(id, formatted);
                            }}
                            className="block w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-right text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 text-sm font-light"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-2 text-xs px-1">
                <span className="text-gray-500 dark:text-gray-400">
                  Total: {formatCurrency(distributedTotal, baseCurrency)} de{' '}
                  {formatCurrency(totalAmountNumeric, baseCurrency)}
                </span>
                <div className="flex items-center gap-2">
                  {onEqualizeSmallest &&
                    splitParticipants.length > 2 &&
                    debtSplitRule !== 'EQUAL' && (
                      <button
                        type="button"
                        onClick={onEqualizeSmallest}
                        className="px-2 py-0.5 text-[11px] font-medium rounded border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-950/30 transition-colors"
                        title="Dividir o restante igualmente entre os menores valores"
                      >
                        Igualar
                      </button>
                    )}
                  {debtSplitRule === 'PERCENTAGE' && (
                    <span
                      className={
                        Math.abs(distributedPct - 100) <= 0.5
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-rose-500 font-medium'
                      }
                    >
                      {distributedPct}% / 100%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => onStepChange(2)}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-md text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity"
                >
                  Voltar
                </button>
                {onSaveAndCreateNew && (
                  <button
                    type="button"
                    onClick={onSaveAndCreateNew}
                    disabled={!isStep3Valid || isSubmitting}
                    className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-900 hover:opacity-70 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar e criar outra'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!isStep3Valid || isSubmitting}
                  className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitDebtModal;
