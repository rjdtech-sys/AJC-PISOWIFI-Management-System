import React from 'react';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
};

const PppoeActivePage: React.FC<Props> = ({ billing }) => {
  const rows = billing?.ppp_actives || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
        <div className="text-sm font-bold text-slate-900">Active Sessions</div>
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
              <th className="px-4 py-2 text-left font-bold">Address</th>
              <th className="px-4 py-2 text-left font-bold">Uptime</th>
              <th className="px-4 py-2 text-left font-bold">Caller ID</th>
            </tr>
          </thead>
          <tbody>
            {(!billing || rows.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No active sessions.
                </td>
              </tr>
            )}
            {billing && rows.map((r: any, idx: number) => (
              <tr key={(r.id || r['.id'] || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.address || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r.uptime || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-600">{r['caller-id'] || r.caller_id || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PppoeActivePage;

