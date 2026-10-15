import React, { useState, useEffect } from 'react';
import { User, AuditLog } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatDate } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Settings,
  Users,
  Shield,
  Key,
  Database,
  Download,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  History,
  Info
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user: currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'security' | 'audit' | 'backup'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Password change form
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    email: '',
    full_name: '',
    role: 'magasinier' as 'admin' | 'magasinier',
    phone: '',
    password: ''
  });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [submittingUser, setSubmittingUser] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadAuditLogs();
    }
  }, [isAdmin]);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getUsers();
      setUsers(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await api.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPass !== confirmPass) {
      setPassError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    if (newPass.length < 6) {
      setPassError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    try {
      await api.changePassword({ currentPassword: currPass, newPassword: newPass });
      setPassSuccess('Votre mot de passe a été modifié avec succès.');
      setCurrPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.message || 'Erreur lors du changement de mot de passe.');
    }
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      email: '',
      full_name: '',
      role: 'magasinier',
      phone: '',
      password: ''
    });
    setUserFormError(null);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserFormData({
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      phone: u.phone || '',
      password: ''
    });
    setUserFormError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    if (!userFormData.email || !userFormData.full_name) {
      setUserFormError('Email et nom complet requis.');
      return;
    }

    if (!editingUser && (!userFormData.password || userFormData.password.length < 6)) {
      setUserFormError('Un mot de passe d\'au moins 6 caractères est obligatoire à la création.');
      return;
    }

    try {
      setSubmittingUser(true);
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          email: userFormData.email,
          full_name: userFormData.full_name,
          role: userFormData.role,
          phone: userFormData.phone || undefined,
          password: userFormData.password ? userFormData.password : undefined
        });
        showNotification(`Utilisateur ${userFormData.full_name} mis à jour.`);
      } else {
        await api.createUser({
          email: userFormData.email,
          full_name: userFormData.full_name,
          role: userFormData.role,
          phone: userFormData.phone || undefined,
          password: userFormData.password
        });
        showNotification(`Utilisateur ${userFormData.full_name} créé avec succès.`);
      }

      setShowUserModal(false);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setUserFormError(err.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('Vous ne pouvez pas supprimer votre propre compte administrateur.');
      return;
    }

    if (!window.confirm(`Supprimer définitivement l'utilisateur "${u.full_name}" (${u.email}) ?`)) {
      return;
    }

    try {
      await api.deleteUser(u.id);
      showNotification('Compte utilisateur supprimé.');
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-amber-500/30 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Paramètres & Administration du Système
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comptes d'accès, permissions RBAC, sauvegardes et journaux d'audit
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'users' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Utilisateurs
            </button>
          )}

          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'security' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sécurité & Mot de Passe
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'audit' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Journaux d'Audit
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'backup' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sauvegarde
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Gestion des Comptes & Droits d'Accès
              </h2>
              <p className="text-xs text-slate-500">Rôles : Administrateur (contrôle total) et Magasinier (opérations courantes)</p>
            </div>

            <button
              onClick={handleOpenAddUser}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Créer un Utilisateur</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Nom Complet</th>
                  <th className="py-3 px-3">Adresse E-mail</th>
                  <th className="py-3 px-3">Rôle</th>
                  <th className="py-3 px-3">Téléphone</th>
                  <th className="py-3 px-4">Date de Création</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center font-bold text-xs">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.full_name}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{u.email}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {u.role === 'admin' ? 'Administrateur' : 'Magasinier'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">{u.phone || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === 'security' && (
        <div className="max-w-xl bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900 border-b border-slate-100 pb-3">
            <Key className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold">Modifier Mon Mot de Passe</h2>
              <p className="text-xs text-slate-500">Compte actif : {currentUser?.email}</p>
            </div>
          </div>

          {passError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Mot de passe actuel *</label>
              <input
                type="password"
                required
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nouveau mot de passe (min 6 caractères) *</label>
              <input
                type="password"
                required
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirmer le nouveau mot de passe *</label>
              <input
                type="password"
                required
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Enregistrer le nouveau mot de passe
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Journal des Actions Sensibles (Audit Trail)
              </h2>
              <p className="text-xs text-slate-500">Traçabilité légale des connexions, modifications de stock et créations</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-4">Date & Heure</th>
                  <th className="py-2.5 px-3">Utilisateur</th>
                  <th className="py-2.5 px-3">Action Réalisée</th>
                  <th className="py-2.5 px-4">Détails de l'Opération</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 font-sans">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{log.user_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BACKUP & DATABASE EXPORT */}
      {activeTab === 'backup' && isAdmin && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div className="flex items-center gap-3 text-slate-900 border-b border-slate-100 pb-4">
            <Database className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-base font-bold">Sauvegarde & Restauration de la Base de Données</h2>
              <p className="text-xs text-slate-500">Fichier de sauvegarde complet avec toutes les tables du magasin</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
            <div className="font-bold text-slate-900">Procédure de Sauvegarde :</div>
            <p>
              La base de données opérationnelle <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">securstock.sqlite</span> est conservée sur disque de manière atomique.
              Vous pouvez télécharger à tout moment un cliché complet au format JSON structuré incluant l'intégralité des catalogues, mouvements, historiques et tiers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={api.getBackupExportUrl()}
              download
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Télécharger la Sauvegarde Complète (JSON)</span>
            </a>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700">Instructions de Restauration :</div>
            <p>
              Pour restaurer la base en cas de sinistre serveur, placez le fichier SQLite dans le répertoire <span className="font-mono bg-slate-100 px-1 rounded">./data/securstock.sqlite</span> et relancez le serveur applicatif. L'intégrité référentielle et les index seront vérifiés automatiquement au démarrage.
            </p>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {editingUser ? 'Modifier Utilisateur' : 'Créer un Compte Utilisateur'}
              </h2>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 space-y-4 text-xs">
              {userFormError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{userFormError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  placeholder="Ex: Koffi KOUAME"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Adresse e-mail *</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="koffi@securstock.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rôle d'accès *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="magasinier">Magasinier</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="+225..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe initial *'}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-4 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs"
                >
                  {submittingUser ? 'Enregistrement...' : editingUser ? 'Sauvegarder' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
