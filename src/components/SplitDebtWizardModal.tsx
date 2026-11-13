import React, { useEffect, useMemo, useState } from 'react';
import SplitDebtModal from './SplitDebtModal';
import { useCurrency } from '../context/CurrencyContext';
import { useToastContext } from '../context/ToastContext';
import { useTransactions } from '../context/TransactionsContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useAccounts } from '../hooks/api/useAccounts';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import {
  useSplitFriends,
  useSplitGroups,
  useCreateSplitDebts,
} from '../hooks/api/useSplitwise';
import { CategoryName, TransactionType } from '../lib/enums';
import type { Friend, SplitGroup, SplitDirection, SplitRule } from '../pages/Loans';

const LAST_DEBT_ACCOUNT_KEY = 'recta_split_last_debt_account_v1';

interface SplitDebtWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string | null;
  onCreated?: (debtId?: string) => void;
  onSwitchToTransaction?: () => void;
}

const SplitDebtWizardModal: React.FC<SplitDebtWizardModalProps> = ({
  isOpen,
  onClose,
  defaultAccountId,
  onCreated,
  onSwitchToTransaction,
}) => {
  const { baseCurrency } = useCurrency();
  const { error: showError, success: showSuccess } = useToastContext();
  const { householdId } = useDefaultHousehold();
  const {
    accounts: contextAccounts,
    customCategories,
    addTransaction,
    createInstallments,
  } = useTransactions();
  const { data: regularAccountsData } = useAccounts({ householdId: householdId || '' });
  const { data: backendFriends } = useSplitFriends(householdId || undefined);
  const { data: backendGroups } = useSplitGroups(householdId || undefined);
  const createDebtsMutation = useCreateSplitDebts();

  const userAccounts = useMemo(() => {
    const raw = regularAccountsData?.accounts?.length
      ? regularAccountsData.accounts
      : contextAccounts || [];
    return raw.map((acc) => ({
      id: acc.id || acc.name,
      name: acc.name,
    }));
  }, [regularAccountsData, contextAccounts]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    userAccounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [userAccounts]);

  const friends = useMemo(() => backendFriends ?? [], [backendFriends]);
  const groups = useMemo(() => backendGroups ?? [], [backendGroups]);
  const activeFriends = useMemo(() => friends.filter((f) => !f.archived), [friends]);
  const activeGroups = useMemo(() => groups.filter((g) => !g.archived), [groups]);

  const friendMap = useMemo(() => {
    const map = new Map<string, Friend>();
    friends.forEach((f) => map.set(f.id, f));
    return map;
  }, [friends]);

  const groupMap = useMemo(() => {
    const map = new Map<string, SplitGroup>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [debtDesc, setDebtDesc] = useState('');
  const [debtCategory, setDebtCategory] = useState<string>(CategoryName.FOOD);
  const [debtAccountId, setDebtAccountId] = useState<string>('');
  const totalAmountMask = useCurrencyMask();
  const [debtDirection, setDebtDirection] = useState<SplitDirection>('THEY_OWE_ME');
  const [debtPayerFriendId, setDebtPayerFriendId] = useState<string>('');
  const [debtSplitRule, setDebtSplitRule] = useState<SplitRule>('EQUAL');
  const [debtGroupId, setDebtGroupId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [debtInstallmentsCount, setDebtInstallmentsCount] = useState<string>('1');
  const [equalIncludedIds, setEqualIncludedIds] = useState<string[]>([]);
  const [percentageByParticipant, setPercentageByParticipant] = useState<Record<string, string>>({});
  const [amountByParticipant, setAmountByParticipant] = useState<Record<string, string>>({});
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  const resolveInitialAccountId = () => {
    if (defaultAccountId && userAccounts.some((a) => a.id === defaultAccountId)) {
      return defaultAccountId;
    }
    const savedLastAccountId = localStorage.getItem(
      `${LAST_DEBT_ACCOUNT_KEY}_${householdId || 'default'}`
    );
    if (savedLastAccountId && userAccounts.some((a) => a.id === savedLastAccountId)) {
      return savedLastAccountId;
    }
    return userAccounts[0]?.id || '';
  };

  useEffect(() => {
    if (!isOpen) return;
    totalAmountMask.setValue('');
    setDebtDesc('');
    setDebtCategory(CategoryName.FOOD);
    setDebtAccountId(resolveInitialAccountId());
    setStep(1);
    setDebtInstallmentsCount('1');
    setDebtDirection('THEY_OWE_ME');
    setDebtPayerFriendId('');
    setDebtSplitRule('EQUAL');
    setDebtGroupId('');
    setMemberSearchTerm('');
    setSelectedMemberIds([]);
    setEqualIncludedIds([]);
    setPercentageByParticipant({});
    setAmountByParticipant({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAccountId]);

  const availableMembersForSplit = useMemo(() => {
    const pool = debtGroupId
      ? activeFriends.filter((f) => groupMap.get(debtGroupId)?.memberIds.includes(f.id))
      : activeFriends;

    if (!memberSearchTerm.trim()) return pool;
    const q = memberSearchTerm.toLowerCase();
    return pool.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.emailOrPix && f.emailOrPix.toLowerCase().includes(q))
    );
  }, [debtGroupId, activeFriends, groupMap, memberSearchTerm]);

  const splitParticipants = useMemo(() => ['me', ...selectedMemberIds], [selectedMemberIds]);

  const handleGoToStep3 = () => {
    const participants = ['me', ...selectedMemberIds];
    const total = totalAmountMask.numericValue;
    const n = participants.length;
    setEqualIncludedIds(participants);

    const pctMap: Record<string, string> = {};
    const amtMap: Record<string, string> = {};
    const basePct = Math.floor((100 / n) * 100) / 100;
    const baseAmt = Math.floor((total / n) * 100) / 100;

    participants.forEach((p, idx) => {
      if (idx === 0) {
        const remPct = Number((100 - basePct * (n - 1)).toFixed(2));
        const remAmt = Number((total - baseAmt * (n - 1)).toFixed(2));
        pctMap[p] = String(remPct);
        amtMap[p] = remAmt.toFixed(2).replace('.', ',');
      } else {
        pctMap[p] = String(basePct);
        amtMap[p] = baseAmt.toFixed(2).replace('.', ',');
      }
    });

    setPercentageByParticipant(pctMap);
    setAmountByParticipant(amtMap);
    setStep(3);
  };

  const participantShares = useMemo(() => {
    const total = totalAmountMask.numericValue;
    const shares: Record<string, number> = {};
    if (total <= 0 || splitParticipants.length === 0) return shares;

    if (debtSplitRule === 'EQUAL') {
      const active = equalIncludedIds.filter((id) => splitParticipants.includes(id));
      if (active.length === 0) return shares;
      const base = Math.floor((total / active.length) * 100) / 100;
      const remainderTargetId = active.includes('me') ? 'me' : active[0];
      active.forEach((id) => {
        if (id === remainderTargetId) {
          shares[id] = Number((total - base * (active.length - 1)).toFixed(2));
        } else {
          shares[id] = base;
        }
      });
    } else if (debtSplitRule === 'PERCENTAGE') {
      splitParticipants.forEach((id) => {
        const raw = (percentageByParticipant[id] || '0').replace(',', '.');
        const pct = parseFloat(raw) || 0;
        shares[id] = Number(((total * pct) / 100).toFixed(2));
      });
    } else {
      splitParticipants.forEach((id) => {
        const raw = (amountByParticipant[id] || '0').replace(/\./g, '').replace(',', '.');
        const val = parseFloat(raw) || 0;
        shares[id] = Number(val.toFixed(2));
      });
    }
    return shares;
  }, [
    totalAmountMask.numericValue,
    splitParticipants,
    debtSplitRule,
    equalIncludedIds,
    percentageByParticipant,
    amountByParticipant,
  ]);

  const distributedTotal = useMemo(() => {
    return Number(
      Object.values(participantShares)
        .reduce((acc, v) => acc + v, 0)
        .toFixed(2)
    );
  }, [participantShares]);

  const distributedPct = useMemo(() => {
    return Number(
      splitParticipants
        .reduce((acc, id) => {
          const raw = (percentageByParticipant[id] || '0').replace(',', '.');
          return acc + (parseFloat(raw) || 0);
        }, 0)
        .toFixed(2)
    );
  }, [splitParticipants, percentageByParticipant]);

  const isStep3Valid = useMemo(() => {
    const total = totalAmountMask.numericValue;
    if (total <= 0) return false;
    if (debtDirection === 'THEY_OWE_ME') {
      const anyFriendHasShare = selectedMemberIds.some((id) => (participantShares[id] || 0) > 0);
      if (!anyFriendHasShare) return false;
    } else {
      if ((participantShares['me'] || 0) <= 0) return false;
    }
    if (debtSplitRule === 'PERCENTAGE') {
      return Math.abs(distributedPct - 100) <= 0.5;
    }
    return Math.abs(distributedTotal - total) <= 0.05;
  }, [
    totalAmountMask.numericValue,
    debtDirection,
    selectedMemberIds,
    participantShares,
    debtSplitRule,
    distributedPct,
    distributedTotal,
  ]);

  const handleCreateDebt = async (e?: React.FormEvent, shouldCreateNew = false) => {
    e?.preventDefault();
    const numericTotal = totalAmountMask.numericValue;
    if (
      !debtDesc.trim() ||
      numericTotal <= 0 ||
      (debtDirection === 'THEY_OWE_ME' && !isStep3Valid) ||
      isSubmittingDebt ||
      createDebtsMutation.isPending
    ) {
      return;
    }

    const count = Math.max(1, parseInt(debtInstallmentsCount, 10) || 1);
    const chosenAccountId = debtAccountId || userAccounts[0]?.id || '';
    const chosenAccountName = accountMap.get(chosenAccountId) || userAccounts[0]?.name || '';
    if (chosenAccountId) {
      localStorage.setItem(
        `${LAST_DEBT_ACCOUNT_KEY}_${householdId || 'default'}`,
        chosenAccountId
      );
    }

    const targetMemberIds = selectedMemberIds;
    if (targetMemberIds.length === 0) return;

    setIsSubmittingDebt(true);
    try {
      const validAccountId =
        chosenAccountId && !chosenAccountId.startsWith('acc-') ? chosenAccountId : undefined;

      if (debtDirection === 'THEY_OWE_ME') {
        const shares = targetMemberIds
          .map((mId) => ({
            friendId: mId,
            debtTotalAmount: Number((participantShares[mId] || 0).toFixed(2)),
          }))
          .filter((s) => s.debtTotalAmount > 0);

        if (shares.length === 0) return;

        const created = await createDebtsMutation.mutateAsync({
          householdId: householdId || undefined,
          description: debtDesc.trim(),
          category: debtCategory,
          accountId: chosenAccountId,
          accountName: chosenAccountName,
          originalTotalAmount: numericTotal,
          direction: 'THEY_OWE_ME',
          splitRule: debtSplitRule,
          groupId: debtGroupId || undefined,
          totalInstallments: count,
          shares,
        });
        if (created?.[0]?.id) onCreated?.(created[0].id);

        const debtsCustomCat = customCategories?.find((c) => {
          const lower = c.name.toLowerCase();
          return lower.includes('dívida') || lower.includes('divida');
        });
        const debtsCategoryValue = debtsCustomCat
          ? `CUSTOM:${debtsCustomCat.id}`
          : CategoryName.DEBTS;
        const txNow = new Date();
        const txPayloads: Array<Parameters<typeof addTransaction>[0]> = [];

        const myShareAmount = Number((participantShares['me'] || 0).toFixed(2));
        if (myShareAmount > 0) {
          txPayloads.push({
            description: debtDesc.trim(),
            amount: myShareAmount,
            type: TransactionType.EXPENSE,
            category: debtCategory,
            date: txNow,
            accountId: validAccountId,
            paid: count === 1,
          });
        }

        shares.forEach((share) => {
          const friend = friendMap.get(share.friendId);
          txPayloads.push({
            description: `${debtDesc.trim()}${friend ? ` (${friend.name})` : ''}`,
            amount: share.debtTotalAmount,
            type: TransactionType.EXPENSE,
            category: debtsCategoryValue,
            date: txNow,
            accountId: validAccountId,
            paid: count === 1,
          });
        });

        if (count > 1) {
          for (const payload of txPayloads) {
            try {
              await createInstallments(payload, count);
            } catch {
              // Não interrompe a criação das demais séries se uma falhar
            }
          }
        } else {
          await Promise.allSettled(txPayloads.map((payload) => addTransaction(payload)));
        }
      } else {
        const payerFriendId =
          debtPayerFriendId && targetMemberIds.includes(debtPayerFriendId)
            ? debtPayerFriendId
            : targetMemberIds[0];
        const myDebtTotal = numericTotal;
        if (!payerFriendId || myDebtTotal <= 0) return;

        const created = await createDebtsMutation.mutateAsync({
          householdId: householdId || undefined,
          description: debtDesc.trim(),
          category: debtCategory,
          accountId: chosenAccountId,
          accountName: chosenAccountName,
          originalTotalAmount: numericTotal,
          direction: 'I_OWE_THEM',
          payerFriendId,
          splitRule: 'FULL_AMOUNT',
          groupId: debtGroupId || undefined,
          totalInstallments: count,
          shares: [
            {
              friendId: payerFriendId,
              debtTotalAmount: Number(myDebtTotal.toFixed(2)),
            },
          ],
        });
        if (created?.[0]?.id) onCreated?.(created[0].id);

        const myTxPayload: Parameters<typeof addTransaction>[0] = {
          description: debtDesc.trim(),
          amount: Number(myDebtTotal.toFixed(2)),
          type: TransactionType.EXPENSE,
          category: debtCategory,
          date: new Date(),
          accountId: validAccountId,
          paid: count === 1,
        };
        try {
          if (count > 1) {
            await createInstallments(myTxPayload, count);
          } else {
            await addTransaction(myTxPayload);
          }
        } catch {
          // Não interrompe o fluxo caso a criação da transação falhe
        }
      }

      setDebtDesc('');
      totalAmountMask.setValue('');
      setDebtInstallmentsCount('1');
      setPercentageByParticipant({});
      setAmountByParticipant({});
      setStep(1);
      if (shouldCreateNew) {
        showSuccess('Dívida criada com sucesso!');
      } else {
        showSuccess('Dívida criada com sucesso!');
        onClose();
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar despesa dividida');
    } finally {
      setIsSubmittingDebt(false);
    }
  };

  return (
    <SplitDebtModal
      isOpen={isOpen}
      onClose={onClose}
      step={step}
      onStepChange={setStep}
      baseCurrency={baseCurrency}
      householdId={householdId}
      groups={activeGroups}
      debtGroupId={debtGroupId}
      onGroupChange={(groupId) => {
        setDebtGroupId(groupId);
        if (groupId) {
          const grp = groupMap.get(groupId);
          setSelectedMemberIds(grp?.memberIds || []);
        } else {
          setSelectedMemberIds([]);
        }
      }}
      memberSearchTerm={memberSearchTerm}
      onMemberSearchTermChange={setMemberSearchTerm}
      availableMembersForSplit={availableMembersForSplit}
      selectedMemberIds={selectedMemberIds}
      onToggleMemberSelection={(friendId) =>
        setSelectedMemberIds((prev) =>
          prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
        )
      }
      onSelectAllAvailable={() => {
        const poolIds = debtGroupId
          ? groupMap.get(debtGroupId)?.memberIds || []
          : activeFriends.map((f) => f.id);
        setSelectedMemberIds(poolIds);
      }}
      onDeselectAllAvailable={() => setSelectedMemberIds([])}
      debtDirection={debtDirection}
      onDirectionChange={setDebtDirection}
      payerFriendId={debtPayerFriendId}
      onPayerFriendChange={setDebtPayerFriendId}
      debtCategory={debtCategory}
      onCategoryChange={setDebtCategory}
      userAccounts={userAccounts}
      debtAccountId={debtAccountId}
      onAccountChange={(accountId) => {
        setDebtAccountId(accountId);
        if (accountId) {
          localStorage.setItem(
            `${LAST_DEBT_ACCOUNT_KEY}_${householdId || 'default'}`,
            accountId
          );
        }
      }}
      debtDesc={debtDesc}
      onDescChange={setDebtDesc}
      totalAmountValue={totalAmountMask.value}
      totalAmountNumeric={totalAmountMask.numericValue}
      onTotalAmountChange={totalAmountMask.onChange}
      debtInstallmentsCount={debtInstallmentsCount}
      onInstallmentsCountChange={setDebtInstallmentsCount}
      onGoToStep3={handleGoToStep3}
      debtSplitRule={debtSplitRule}
      onSplitRuleChange={setDebtSplitRule}
      splitParticipants={splitParticipants}
      friendMap={friendMap}
      participantShares={participantShares}
      equalIncludedIds={equalIncludedIds}
      onToggleEqualIncluded={(id) =>
        setEqualIncludedIds((prev) =>
          prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
      }
      percentageByParticipant={percentageByParticipant}
      onPercentageChange={(id, val) => {
        if (splitParticipants.length === 2) {
          const otherId = splitParticipants.find((p) => p !== id);
          const rawNum = parseFloat(val.replace(',', '.'));
          const num = Number.isNaN(rawNum) ? 0 : Math.max(0, rawNum);
          if (num > 100) {
            setPercentageByParticipant((prev) => ({
              ...prev,
              [id]: '100',
              ...(otherId ? { [otherId]: '0' } : {}),
            }));
          } else {
            const rem = Number((100 - num).toFixed(2));
            setPercentageByParticipant((prev) => ({
              ...prev,
              [id]: val,
              ...(otherId ? { [otherId]: String(rem) } : {}),
            }));
          }
          return;
        }
        setPercentageByParticipant((prev) => ({
          ...prev,
          [id]: val,
        }));
      }}
      amountByParticipant={amountByParticipant}
      onAmountChange={(id, val) => {
        if (splitParticipants.length === 2) {
          const otherId = splitParticipants.find((p) => p !== id);
          const total = totalAmountMask.numericValue;
          const rawNum = parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
          const clamped = Math.min(total, Math.max(0, rawNum));
          const rem = Math.max(0, Number((total - clamped).toFixed(2)));
          setAmountByParticipant((prev) => ({
            ...prev,
            [id]: val,
            ...(otherId ? { [otherId]: rem.toFixed(2).replace('.', ',') } : {}),
          }));
          return;
        }
        setAmountByParticipant((prev) => ({
          ...prev,
          [id]: val,
        }));
      }}
      distributedTotal={distributedTotal}
      distributedPct={distributedPct}
      isStep3Valid={isStep3Valid}
      isSubmitting={isSubmittingDebt || createDebtsMutation.isPending}
      onSubmit={handleCreateDebt}
      onSaveAndCreateNew={() => {
        void handleCreateDebt(undefined, true);
      }}
      onSwitchToTransaction={onSwitchToTransaction}
    />
  );
};

export default SplitDebtWizardModal;
