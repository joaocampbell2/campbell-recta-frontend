import { Account } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getAccountBalance } from '../../utils/accountBalance';
import { CreditCard, Wallet, PiggyBank, Banknote, Plus, Share2, TrendingUp } from 'lucide-react';
import { getAccountTypeLabel } from '../../constants/accountTypes';

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onAddAccount: () => void;
  baseCurrency: string;
  selectedMonth: Date;
  householdMembers?: Array<{ userId: string; user?: { displayName?: string; email?: string } }>;
  currentUserId?: string;
  t: Record<string, string>;
}

const getAccountIcon = (type: string) => {
  switch (type) {
    case "CHECKING":
      return CreditCard;
    case "SAVINGS":
      return PiggyBank;
    case "CASH":
      return Banknote;
    case "INVESTMENT":
      return TrendingUp;
    default:
      return Wallet;
  }
};

export const AccountSelector = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
  baseCurrency,
  selectedMonth: _selectedMonth,
  householdMembers,
  currentUserId: _currentUserId,
  t,
}: AccountSelectorProps) => {
  return (
    <div className="flex overflow-x-auto pb-2 gap-4 scrollbar-hide">
      {accounts.map((account) => {
        const balances = getAccountBalance(account);
        const isSharedAccount = (account as any).isPersonal && (account as any).accountOwnerId;
        const accountOwnerMember = isSharedAccount && householdMembers
          ? householdMembers.find(m => m.userId === (account as any).accountOwnerId)
          : null;
        
        const IconComponent = getAccountIcon(account.type);
        
        return (
          <button
            key={account.id}
            onClick={() => onSelectAccount(account.id || null)}
            className={`flex-shrink-0 w-[200px] flex items-center p-4 rounded-lg border transition-all relative ${
              selectedAccountId === account.id
                ? "border-primary-500 dark:border-primary-500 bg-white dark:bg-gray-900"
                : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:opacity-80"
            }`}
          >
            {isSharedAccount && (
              <div className="absolute top-2 right-2 flex items-center">
                <Share2 className="h-3 w-3 text-blue-500 dark:text-blue-400" title="Conta compartilhada" />
              </div>
            )}
            <div
              className="p-2 rounded-lg mr-3"
              style={{
                backgroundColor: `${account.color || "#3b82f6"}20`,
                color: account.color || "#3b82f6",
              }}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-sm font-light text-gray-900 dark:text-white truncate">
                {account.name}
              </div>
              <div className="text-xs font-light text-gray-500 dark:text-gray-400">
                {formatCurrency(balances.totalBalance, baseCurrency)}
              </div>
              <div className="text-[10px] font-light text-gray-400 dark:text-gray-500 mt-0.5">
                {getAccountTypeLabel(account.type as any, t)}
                {isSharedAccount && accountOwnerMember && (
                  <span className="ml-1 text-blue-500">
                    • {accountOwnerMember.user?.displayName || accountOwnerMember.user?.email?.split('@')[0] || 'Compartilhada'}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Botão para Adicionar Nova Conta */}
      <button
        onClick={onAddAccount}
        className="flex-shrink-0 w-[200px] flex items-center p-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:opacity-80 transition-opacity group"
      >
        <div className="p-2 rounded-lg mr-3 bg-gray-50 dark:bg-gray-900 text-gray-400 group-hover:text-primary-500 transition-colors">
          <Plus className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="text-sm font-light text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">
            {t.account}
          </div>
          <div className="text-xs font-light text-gray-400 dark:text-gray-500">{t.newAccount}</div>
        </div>
      </button>
    </div>
  );
};
