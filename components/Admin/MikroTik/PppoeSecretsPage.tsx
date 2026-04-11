import React, { useMemo, useState } from 'react';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
};

const PppoeSecretsPage: React.FC<Props> = ({ billing, loading }) => {
  const [search, setSearch] = useState('');

  const filteredSecrets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = billing?.ppp_secrets || [];
    if (!q) return rows;
    return rows.filter((r: any) => String(r.name || '').toLowerCase().includes(q));
  }, [billing, search]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
          <div className="text-sm font-bold text-slate-900">Secrets / Users</div>
        </div>
        <input
          className="admin-input text-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username"
          disabled={!billing || loading}
        />
      </div>

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
            </tr>
          </thead>
          <tbody>
            {(!billing || filteredSecrets.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No secrets found.
                </td>
              </tr>
            )}
            {billing && filteredSecrets.map((r: any, idx: number) => (
              <tr key={(r.id || r['.id'] || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.profile || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.service || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{String(r.disabled || '')}</td>
                <td className="px-4 py-2 text-slate-600">{r.comment || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PppoeSecretsPage;

