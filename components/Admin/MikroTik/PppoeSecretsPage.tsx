import React, { useMemo, useState } from 'react';
import { apiClient } from '../../../lib/api';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
  routerId: string;
  onRefresh: () => void;
};

const PppoeSecretsPage: React.FC<Props> = ({ billing, loading, routerId, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    profile: '',
    service: 'any',
    disabled: 'false',
    comment: ''
  });

  const filteredSecrets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = billing?.ppp_secrets || [];
    if (!q) return rows;
    return rows.filter((r: any) => String(r.name || '').toLowerCase().includes(q));
  }, [billing, search]);

  const resetForm = () => {
    setFormData({ name: '', password: '', profile: '', service: 'any', disabled: 'false', comment: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.password) {
      alert('Username and password are required');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.createMikrotikSecret(routerId, formData);
      resetForm();
      onRefresh();
      alert('Secret created successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to create secret');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (secret: any) => {
    setFormData({
      name: secret.name || '',
      password: '',
      profile: secret.profile || '',
      service: secret.service || 'any',
      disabled: String(secret.disabled || 'false'),
      comment: secret.comment || ''
    });
    setEditingId(secret['.id'] || secret.id);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setActionLoading(true);
    try {
      const updateData: any = {};
      if (formData.password) updateData.password = formData.password;
      if (formData.profile) updateData.profile = formData.profile;
      if (formData.service) updateData.service = formData.service;
      updateData.disabled = formData.disabled;
      updateData.comment = formData.comment;
      
      await apiClient.updateMikrotikSecret(routerId, editingId, updateData);
      resetForm();
      onRefresh();
      alert('Secret updated successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to update secret');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (secretId: string, username: string) => {
    if (!confirm(`Delete secret "${username}"?`)) return;
    setActionLoading(true);
    try {
      await apiClient.deleteMikrotikSecret(routerId, secretId);
      onRefresh();
      alert('Secret deleted successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete secret');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
          <div className="text-sm font-bold text-slate-900">Secrets / Users</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="admin-input text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username"
            disabled={!billing || loading}
          />
          <button
            onClick={() => setShowForm(true)}
            disabled={!routerId || actionLoading}
            className="admin-btn-primary px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
          >
            Add Secret
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="text-xs font-bold text-slate-900 mb-3">
            {editingId ? 'Edit Secret' : 'New Secret'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="admin-input text-xs"
              placeholder="Username *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!!editingId || actionLoading}
            />
            <input
              className="admin-input text-xs"
              type="password"
              placeholder={editingId ? 'Password (leave blank to keep current)' : 'Password *'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={actionLoading}
            />
            <input
              className="admin-input text-xs"
              placeholder="Profile"
              value={formData.profile}
              onChange={(e) => setFormData({ ...formData, profile: e.target.value })}
              disabled={actionLoading}
            />
            <select
              className="admin-input text-xs"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              disabled={actionLoading}
            >
              <option value="any">any</option>
              <option value="pppoe">pppoe</option>
            </select>
            <select
              className="admin-input text-xs"
              value={formData.disabled}
              onChange={(e) => setFormData({ ...formData, disabled: e.target.value })}
              disabled={actionLoading}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
            <input
              className="admin-input text-xs"
              placeholder="Comment"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              disabled={actionLoading}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={actionLoading || !formData.name}
              className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              disabled={actionLoading}
              className="admin-btn-secondary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!!(billing?.errors && billing.errors.length > 0) && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px]">
          {billing.errors[0]}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-2 text-left font-bold">Username</th>
              <th className="px-4 py-2 text-left font-bold">Profile</th>
              <th className="px-4 py-2 text-left font-bold">Service</th>
              <th className="px-4 py-2 text-left font-bold">Disabled</th>
              <th className="px-4 py-2 text-left font-bold">Comment</th>
              <th className="px-4 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!billing || filteredSecrets.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No secrets found.
                </td>
              </tr>
            )}
            {billing && filteredSecrets.map((r: any, idx: number) => (
              <tr key={(r['.id'] || r.id || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.profile || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.service || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{String(r.disabled || '')}</td>
                <td className="px-4 py-2 text-slate-600">{r.comment || ''}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(r)}
                      disabled={actionLoading}
                      className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r['.id'] || r.id, r.name)}
                      disabled={actionLoading}
                      className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PppoeSecretsPage;

