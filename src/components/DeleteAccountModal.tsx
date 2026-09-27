import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../context/I18nContext';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteTransactions: boolean) => void;
  accountName: string;
}

const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirm,
  accountName,
}: DeleteAccountModalProps) => {
  const { t } = useI18n();
  const [typedName, setTypedName] = useState('');
  const [deleteTransactions, setDeleteTransactions] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTypedName('');
      setDeleteTransactions(false);
    }
  }, [isOpen]);

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isOpen) return;
    
    // Prevenir scroll do body quando modal estiver aberto
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isNameValid = typedName.trim() === accountName.trim();
  const canConfirm = isNameValid;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(deleteTransactions);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal Card */}
        <div className="relative w-full sm:w-[500px] max-w-md p-6 border shadow-2xl rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 rounded-full p-2 mr-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t.deleteBankAccount || 'Deletar Conta Bancária'}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-6 space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                {t.destructiveAction || 'Ação Destrutiva'}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                {t.deleteAccountWarning || 'Esta ação é permanente e não pode ser desfeita.'}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                {deleteTransactions
                  ? (t.deleteAccountAndTransactionsWarning || 'Todas as transações vinculadas a esta conta bancária também serão apagadas permanentemente. Esta ação não pode ser desfeita.')
                  : (t.deleteAccountTransactionsWarning || 'As transações associadas a esta conta bancária serão mantidas na sua conta do Recta e serão debitadas no cálculo de saldo da próxima conta bancária que você cadastrar. Você precisará remover esses registros manualmente caso não queira que isso afete o saldo bancário.')}
              </p>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
              <input
                type="checkbox"
                checked={deleteTransactions}
                onChange={(e) => setDeleteTransactions(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t.deleteLinkedTransactions || 'Também apagar todas as transações vinculadas a esta conta'}
              </span>
            </label>

            <div>
              <label htmlFor="account-name-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.typeBankAccountNameToConfirm || 'Digite o nome da conta bancária para confirmar:'}
              </label>
              <input
                id="account-name-input"
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={accountName}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              {typedName && !isNameValid && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t.nameDoesNotMatch || 'O nome digitado não corresponde ao nome da conta bancária.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                canConfirm
                  ? 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {t.delete}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteAccountModal;

