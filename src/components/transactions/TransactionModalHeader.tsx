import { X, FileSpreadsheet } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface TransactionModalHeaderProps {
  title: string;
  onClose: () => void;
  readOnly?: boolean;
  onImportCsv?: () => void;
}

export const TransactionModalHeader = ({ title, onClose, readOnly: _readOnly, onImportCsv }: TransactionModalHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-2 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
      <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
        {title}
      </h3>
      <div className="flex items-center gap-2">
        {onImportCsv && (
          <button
            type="button"
            onClick={onImportCsv}
            title="Importar extrato CSV"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Importar CSV
          </button>
        )}
        <button
          onClick={onClose}
          aria-label={t.close}
          className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
