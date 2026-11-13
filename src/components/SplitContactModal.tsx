import React from 'react';
import { X, Camera, Check } from 'lucide-react';
import type { Friend } from '../pages/Loans';

interface SplitContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'friend' | 'group';
  onTabChange: (tab: 'friend' | 'group') => void;
  friends: Friend[];
  // Friend form
  newFriendName: string;
  onFriendNameChange: (val: string) => void;
  newFriendContact: string;
  onFriendContactChange: (val: string) => void;
  newFriendPhoto: string;
  onFriendPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFriendPhoto: () => void;
  onAddFriend: (e: React.FormEvent) => void;
  // Group form
  newGroupName: string;
  onGroupNameChange: (val: string) => void;
  newGroupMembers: string[];
  onToggleGroupMember: (friendId: string) => void;
  newGroupPhoto: string;
  onGroupPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveGroupPhoto: () => void;
  onAddGroup: (e: React.FormEvent) => void;
}

const SplitContactModal: React.FC<SplitContactModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  friends,
  newFriendName,
  onFriendNameChange,
  newFriendContact,
  onFriendContactChange,
  newFriendPhoto,
  onFriendPhotoChange,
  onRemoveFriendPhoto,
  onAddFriend,
  newGroupName,
  onGroupNameChange,
  newGroupMembers,
  onToggleGroupMember,
  newGroupPhoto,
  onGroupPhotoChange,
  onRemoveGroupPhoto,
  onAddGroup,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[420px] max-w-md p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 animate-slide-in-bottom">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-xl font-light tracking-tight text-gray-900 dark:text-white">
              {activeTab === 'friend' ? 'Novo amigo' : 'Novo grupo'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => onTabChange('friend')}
              className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                activeTab === 'friend'
                  ? 'border-primary-600 bg-primary-50/50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              Amigo
            </button>
            <button
              type="button"
              onClick={() => onTabChange('group')}
              className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                activeTab === 'group'
                  ? 'border-primary-600 bg-primary-50/50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              Grupo
            </button>
          </div>

          {activeTab === 'friend' ? (
            <form onSubmit={onAddFriend} className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer group flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFriendPhotoChange}
                    className="hidden"
                  />
                  {newFriendPhoto ? (
                    <img
                      src={newFriendPhoto}
                      alt="Preview"
                      className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 group-hover:border-primary-500 transition-colors">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                </label>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-light text-primary-600 dark:text-primary-400 cursor-pointer hover:opacity-70">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onFriendPhotoChange}
                      className="hidden"
                    />
                    Escolher foto
                  </label>
                  {newFriendPhoto && (
                    <button
                      type="button"
                      onClick={onRemoveFriendPhoto}
                      className="text-xs font-light text-gray-500 hover:text-rose-500 text-left"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={newFriendName}
                  onChange={(e) => onFriendNameChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contato ou Pix
                </label>
                <input
                  type="text"
                  value={newFriendContact}
                  onChange={(e) => onFriendContactChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                />
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
                  type="submit"
                  className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onAddGroup} className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer group flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onGroupPhotoChange}
                    className="hidden"
                  />
                  {newGroupPhoto ? (
                    <img
                      src={newGroupPhoto}
                      alt="Preview"
                      className="w-14 h-14 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 group-hover:border-primary-500 transition-colors">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                </label>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-light text-primary-600 dark:text-primary-400 cursor-pointer hover:opacity-70">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onGroupPhotoChange}
                      className="hidden"
                    />
                    Escolher foto
                  </label>
                  {newGroupPhoto && (
                    <button
                      type="button"
                      onClick={onRemoveGroupPhoto}
                      className="text-xs font-light text-gray-500 hover:text-rose-500 text-left"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => onGroupNameChange(e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 sm:text-sm font-light tracking-tight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Membros
                </label>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-md max-h-48 overflow-y-auto">
                  {friends.map((f) => {
                    const checked = newGroupMembers.includes(f.id);
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => onToggleGroupMember(f.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <span className="text-gray-900 dark:text-gray-100 font-light">
                          {f.name}
                        </span>
                        {checked && (
                          <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        )}
                      </button>
                    );
                  })}
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
                  type="submit"
                  className="px-4 py-2.5 border border-primary-600 dark:border-primary-500 rounded-md text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 hover:opacity-80 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitContactModal;
