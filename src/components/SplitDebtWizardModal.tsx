import React, { useEffect, useMemo, useState } from 'react';
import SplitDebtModal, { computeEqualizedDistribution } from './SplitDebtModal';
import SplitContactModal from './SplitContactModal';
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
  useCreateSplitFriend,
} from '../hooks/api/useSplitwise';
import { CategoryName } from '../lib/enums';
import { formatDateForAPI } from '../utils/format';
import type { Friend, SplitGroup, SplitDirection, SplitRule } from '../pages/Loans';

const LAST_DEBT_ACCOUNT_KEY = 'recta_split_last_debt_account_v1';

interface SplitDebtWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAccountId?: string | null;
  initialDescription?: string;
  initialAmount?: number;
  initialCategory?: string;
  initialDirection?: SplitDirection;
  initialDate?: Date | null;
  onCreated?: (debtId?: string) => void;
  onSwitchToTransaction?: () => void;
}

const SplitDebtWizardModal: React.FC<SplitDebtWizardModalProps> = ({
  isOpen,
  onClose,
  defaultAccountId,
  initialDescription,
  initialAmount,
  initialCategory,
  initialDirection,
  initialDate,
  onCreated,
  onSwitchToTransaction,
}) => {
  const { baseCurrency } = useCurrency();
  const { error: showError, success: showSuccess } = useToastContext();
  const { householdId } = useDefaultHousehold();
  const { accounts: contextAccounts } = useTransactions();
  const { data: regularAccountsData } = useAccounts({ householdId: householdId || '' });
  const { data: backendFriends } = useSplitFriends(householdId || undefined);
  const { data: backendGroups } = useSplitGroups(householdId || undefined);
  const createDebtsMutation = useCreateSplitDebts();
  const createFriendMutation = useCreateSplitFriend();

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
  const [debtDate, setDebtDate] = useState<Date | null>(() => new Date());
  const [equalIncludedIds, setEqualIncludedIds] = useState<string[]>([]);
  const [percentageByParticipant, setPercentageByParticipant] = useState<Record<string, string>>({});
  const [amountByParticipant, setAmountByParticipant] = useState<Record<string, string>>({});
  const [debtAlreadyPaid, setDebtAlreadyPaid] = useState(false);
  const [isSubmittingDebt, setIsSubmittingDebt] = useState(false);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendContact, setNewFriendContact] = useState('');
  const [newFriendPhoto, setNewFriendPhoto] = useState('');

  const handleQuickAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim() || createFriendMutation.isPending) return;
    try {
      const created = await createFriendMutation.mutateAsync({
        householdId: householdId || undefined,
        name: newFriendName.trim(),
        emailOrPix: newFriendContact.trim() || undefined,
        photoUrl: newFriendPhoto || undefined,
      });
      if (created?.id) {
        setSelectedMemberIds((prev) =>
          prev.includes(created.id) ? prev : [...prev, created.id]
        );
      }
      setNewFriendName('');
      setNewFriendContact('');
      setNewFriendPhoto('');
      setIsAddFriendOpen(false);
      showSuccess('Amigo adicionado!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar amigo');
    }
  };

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
    totalAmountMask.setValue(
      typeof initialAmount === 'number' && initialAmount > 0 ? initialAmount : ''
    );
    setDebtDesc(initialDescription || '');
    setDebtCategory(initialCategory || CategoryName.FOOD);
    setDebtAccountId(resolveInitialAccountId());
    setStep(1);
    setDebtInstallmentsCount('1');
    setDebtDate(initialDate || new Date());
    setDebtDirection(initialDirection || 'THEY_OWE_ME');
    setDebtPayerFriendId('');
    setDebtSplitRule('EQUAL');
    setDebtGroupId('');
    setMemberSearchTerm('');
    setSelectedMemberIds([]);
    setEqualIncludedIds([]);
    setPercentageByParticipant({});
    setAmountByParticipant({});
    setDebtAlreadyPaid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAccountId, initialDescription, initialAmount, initialCategory, initialDirection, initialDate]);

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
      const isNoAccount = debtAccountId === 'NONE';
      const validAccountId =
        !isNoAccount && chosenAccountId && !chosenAccountId.startsWith('acc-')
          ? chosenAccountId
          : undefined;

      if (debtDirection === 'THEY_OWE_ME') {
        const shares = targetMemberIds
          .map((mId) => ({
            friendId: mId,
            debtTotalAmount: Number((participantShares[mId] || 0).toFixed(2)),
          }))
          .filter((s) => s.debtTotalAmount > 0);

        if (shares.length === 0) return;

        const myShareAmount = Number((participantShares['me'] || 0).toFixed(2));

        const created = await createDebtsMutation.mutateAsync({
          householdId: householdId || undefined,
          description: debtDesc.trim(),
          category: debtCategory,
          accountId: isNoAccount ? undefined : validAccountId,
          accountName: isNoAccount ? undefined : chosenAccountName,
          originalTotalAmount: numericTotal,
          myShareAmount,
          date: debtDate ? formatDateForAPI(debtDate) : undefined,
          createTransactions: !isNoAccount,
          direction: 'THEY_OWE_ME',
          splitRule: debtSplitRule,
          groupId: debtGroupId || undefined,
          totalInstallments: count,
          shares,
        });
        if (created?.[0]?.id) onCreated?.(created[0].id);
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
          ...(debtAlreadyPaid && validAccountId
            ? { accountId: validAccountId, accountName: chosenAccountName }
            : {}),
          originalTotalAmount: numericTotal,
          alreadyPaid: debtAlreadyPaid,
          date: debtDate ? formatDateForAPI(debtDate) : undefined,
          createTransactions: true,
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
        if (created?.[0]?.id) {
          onCreated?.(created[0].id);
        }
      }

      setDebtDesc('');
      totalAmountMask.setValue('');
      setDebtInstallmentsCount('1');
      setDebtDate(new Date());
      setPercentageByParticipant({});
      setAmountByParticipant({});
      setDebtAlreadyPaid(false);
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
    <>
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
        if (accountId && accountId !== 'NONE') {
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
      debtDate={debtDate}
      onDateChange={setDebtDate}
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
      onEqualizeSmallest={() => {
        if (debtSplitRule === 'PERCENTAGE') {
          const currentNums: Record<string, number> = {};
          splitParticipants.forEach((id) => {
            currentNums[id] =
              parseFloat((percentageByParticipant[id] || '0').replace(',', '.')) || 0;
          });
          const next = computeEqualizedDistribution(splitParticipants, currentNums, 100);
          const nextStr: Record<string, string> = {};
          splitParticipants.forEach((id) => {
            nextStr[id] = String(next[id] ?? 0);
          });
          setPercentageByParticipant(nextStr);
        } else if (debtSplitRule === 'UNEQUAL') {
          const currentNums: Record<string, number> = {};
          splitParticipants.forEach((id) => {
            currentNums[id] =
              parseFloat(
                (amountByParticipant[id] || '0').replace(/\./g, '').replace(',', '.')
              ) || 0;
          });
          const next = computeEqualizedDistribution(
            splitParticipants,
            currentNums,
            totalAmountMask.numericValue
          );
          const nextStr: Record<string, string> = {};
          splitParticipants.forEach((id) => {
            nextStr[id] = (next[id] ?? 0).toFixed(2).replace('.', ',');
          });
          setAmountByParticipant(nextStr);
        }
      }}
      onCreateFriendClick={() => setIsAddFriendOpen(true)}
      debtAlreadyPaid={debtAlreadyPaid}
      onAlreadyPaidChange={setDebtAlreadyPaid}
    />

      <SplitContactModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        activeTab="friend"
        onTabChange={() => {}}
        friends={activeFriends}
        newFriendName={newFriendName}
        onFriendNameChange={setNewFriendName}
        newFriendContact={newFriendContact}
        onFriendContactChange={setNewFriendContact}
        newFriendPhoto={newFriendPhoto}
        onFriendPhotoChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') setNewFriendPhoto(reader.result);
          };
          reader.readAsDataURL(file);
        }}
        onRemoveFriendPhoto={() => setNewFriendPhoto('')}
        onAddFriend={handleQuickAddFriend}
        newGroupName=""
        onGroupNameChange={() => {}}
        newGroupMembers={[]}
        onToggleGroupMember={() => {}}
        newGroupPhoto=""
        onGroupPhotoChange={() => {}}
        onRemoveGroupPhoto={() => {}}
        onAddGroup={(e) => e.preventDefault()}
        isSubmitting={createFriendMutation.isPending}
      />
    </>
  );
};

export default SplitDebtWizardModal;
