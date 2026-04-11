import React from 'react';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
};

const PppoeProfilesPage: React.FC<Props> = ({ billing }) => {
  const rows = billing?.ppp_profiles || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
        <div className="text-sm font-bold text-slate-900">Profiles</div>
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
              <th className="px-4 py-2 text-left font-bold">Name</th>
              <th className="px-4 py-2 text-left font-bold">Rate Limit</th>
              <th className="px-4 py-2 text-left font-bold">Local Address</th>
              <th className="px-4 py-2 text-left font-bold">Remote Address</th>
            </tr>
          </thead>
          <tbody>
            {(!billing || rows.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No profiles found.
                </td>
              </tr>
            )}
            {billing && rows.map((r: any, idx: number) => (
              <tr key={(r.id || r['.id'] || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['rate-limit'] || r.rate_limit || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['local-address'] || r.local_address || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['remote-address'] || r.remote_address || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PppoeProfilesPage;

