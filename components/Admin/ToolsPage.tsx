import React, { useState, useEffect, useCallback } from 'react';

interface SpeedTestResult {
  success: boolean;
  ping: number | null;
  jitter: number | null;
  download: number | null;   // bytes/sec
  upload: number | null;      // bytes/sec
  server: string | null;
  serverId: string | null;
  serverLocation: string | null;
  ip: string | null;
  timestamp: string | null;
  resultUrl: string | null;
  raw?: string;
}

interface SpeedTestStatus {
  installed: boolean;
  cliPath: string;
  termsAccepted: boolean;
}

type TestPhase = 'idle' | 'testing' | 'done' | 'error';

const ToolsPage: React.FC = () => {
  const [status, setStatus] = useState<SpeedTestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [animPhase, setAnimPhase] = useState<'idle' | 'download' | 'upload' | 'ping'>('idle');

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('ajc_admin_token');
      const res = await fetch('/api/speedtest/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch speedtest status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      const token = localStorage.getItem('ajc_admin_token');
      const res = await fetch('/api/speedtest/install', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Installation failed');
      }
    } catch (e: any) {
      setError(e.message || 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  const handleAcceptTerms = async () => {
    setAcceptingTerms(true);
    setError(null);
    try {
      const token = localStorage.getItem('ajc_admin_token');
      const res = await fetch('/api/speedtest/accept-terms', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to accept terms');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to accept terms');
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleRunTest = async () => {
    setPhase('testing');
    setError(null);
    setResult(null);
    setAnimPhase('ping');

    try {
      const token = localStorage.getItem('ajc_admin_token');
      const res = await fetch('/api/speedtest/run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        setPhase('done');
        setAnimPhase('idle');
      } else {
        setError(data.error || 'Speedtest failed');
        setPhase('error');
        setAnimPhase('idle');
      }
    } catch (e: any) {
      setError(e.message || 'Speedtest failed');
      setPhase('error');
      setAnimPhase('idle');
    }
  };

  // Simulate animation phases during test
  useEffect(() => {
    if (phase !== 'testing') return;
    const t1 = setTimeout(() => setAnimPhase('download'), 2000);
    const t2 = setTimeout(() => setAnimPhase('upload'), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  const bytesToMbps = (bytes: number | null): string => {
    if (bytes === null || bytes === undefined) return '--';
    return (bytes * 8 / 1000000).toFixed(2);
  };

  const formatPing = (ms: number | null): string => {
    if (ms === null || ms === undefined) return '--';
    return ms.toFixed(2);
  };

  // Gauge component
  const Gauge: React.FC<{ value: number; max: number; label: string; unit: string; color: string; active: boolean }> = ({ value, max, label, unit, color, active }) => {
    const pct = Math.min((value / max) * 100, 100);
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference - (pct / 100) * circumference * 0.75;

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-[135deg]" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} strokeLinecap="round" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-black ${active ? 'text-slate-900' : 'text-slate-300'}`}>
              {value > 0 ? value.toFixed(1) : '--'}
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? 'text-slate-500' : 'text-slate-300'}`}>{unit}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tools</h1>
          <p className="text-xs text-slate-500">Speedtest - Test your machine's WAN internet speed using Ookla.</p>
        </div>
      </div>

      {/* Speedtest Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Speedtest by Ookla</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Machine WAN Speed Test</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-xs text-slate-500 font-bold uppercase tracking-wider">Checking Speedtest CLI...</span>
            </div>
          )}

          {/* Not Installed */}
          {!loading && status && !status.installed && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Speedtest CLI Not Installed</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The Ookla Speedtest CLI needs to be installed on this machine to test the WAN internet speed. This runs the test from your machine directly, not from the browser.
              </p>
              <button
                onClick={handleInstall}
                disabled={installing}
                className="admin-btn-primary px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                {installing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Installing...
                  </span>
                ) : (
                  'Install Speedtest CLI'
                )}
              </button>
              {error && (
                <p className="text-xs text-red-500 font-semibold mt-2">{error}</p>
              )}
            </div>
          )}

          {/* Installed but Terms Not Accepted */}
          {!loading && status && status.installed && !status.termsAccepted && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Accept Ookla Terms of Use</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Before using the Speedtest CLI, you must accept Ookla's License Agreement and GDPR Terms.
                By clicking "Accept Terms", you agree to the Ookla End User License Agreement, Privacy Policy, and Terms of Use.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-md mx-auto">
                <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                  By using Speedtest, you agree to Ookla's Terms of Use and Privacy Policy available at:
                  <a href="https://www.speedtest.net/about/terms" target="_blank" rel="noopener noreferrer" className="underline ml-1">speedtest.net/about/terms</a> and
                  <a href="https://www.speedtest.net/about/privacy" target="_blank" rel="noopener noreferrer" className="underline ml-1">speedtest.net/about/privacy</a>
                </p>
              </div>
              <button
                onClick={handleAcceptTerms}
                disabled={acceptingTerms}
                className="admin-btn-primary px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg disabled:opacity-50"
              >
                {acceptingTerms ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Accepting...
                  </span>
                ) : (
                  'Accept Terms & License'
                )}
              </button>
              {error && (
                <p className="text-xs text-red-500 font-semibold mt-2">{error}</p>
              )}
            </div>
          )}

          {/* Ready / Test Results */}
          {!loading && status && status.installed && status.termsAccepted && (
            <div className="space-y-6">
              {/* Gauge Display */}
              <div className="flex flex-col items-center py-4">
                <div className="flex items-center gap-8 md:gap-12 flex-wrap justify-center">
                  <Gauge
                    value={result?.ping ? parseFloat(formatPing(result.ping)) : 0}
                    max={200}
                    label="Ping"
                    unit="ms"
                    color={phase === 'testing' && animPhase === 'ping' ? '#3b82f6' : (result?.ping ? '#3b82f6' : '#cbd5e1')}
                    active={phase === 'testing' ? animPhase === 'ping' : !!result?.ping}
                  />
                  <Gauge
                    value={result?.download ? parseFloat(bytesToMbps(result.download)) : 0}
                    max={1000}
                    label="Download"
                    unit="Mbps"
                    color={phase === 'testing' && animPhase === 'download' ? '#10b981' : (result?.download ? '#10b981' : '#cbd5e1')}
                    active={phase === 'testing' ? animPhase === 'download' : !!result?.download}
                  />
                  <Gauge
                    value={result?.upload ? parseFloat(bytesToMbps(result.upload)) : 0}
                    max={1000}
                    label="Upload"
                    unit="Mbps"
                    color={phase === 'testing' && animPhase === 'upload' ? '#8b5cf6' : (result?.upload ? '#8b5cf6' : '#cbd5e1')}
                    active={phase === 'testing' ? animPhase === 'upload' : !!result?.upload}
                  />
                </div>

                {/* Testing animation indicator */}
                {phase === 'testing' && (
                  <div className="mt-6 flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                      Testing {animPhase === 'ping' ? 'Ping' : animPhase === 'download' ? 'Download Speed' : 'Upload Speed'}...
                    </span>
                  </div>
                )}
              </div>

              {/* Run Test Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleRunTest}
                  disabled={phase === 'testing'}
                  className={`
                    px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-300 shadow-xl
                    ${phase === 'testing'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-green-500/30 active:scale-95'
                    }
                  `}
                >
                  {phase === 'testing' ? 'Testing...' : 'Start Speedtest'}
                </button>
              </div>

              {/* Results Details */}
              {result && phase === 'done' && (
                <div className="mt-4 bg-slate-50 rounded-xl border border-slate-100 p-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Test Results</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ping</span>
                      <p className="text-lg font-black text-blue-600">{formatPing(result.ping)} <span className="text-[10px] font-bold text-slate-400">ms</span></p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Jitter</span>
                      <p className="text-lg font-black text-blue-500">{formatPing(result.jitter)} <span className="text-[10px] font-bold text-slate-400">ms</span></p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Download</span>
                      <p className="text-lg font-black text-emerald-600">{bytesToMbps(result.download)} <span className="text-[10px] font-bold text-slate-400">Mbps</span></p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Upload</span>
                      <p className="text-lg font-black text-violet-600">{bytesToMbps(result.upload)} <span className="text-[10px] font-bold text-slate-400">Mbps</span></p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {result.server && (
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Server</span>
                        <p className="text-xs font-semibold text-slate-700">{result.server}</p>
                      </div>
                    )}
                    {result.serverLocation && (
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Location</span>
                        <p className="text-xs font-semibold text-slate-700">{result.serverLocation}</p>
                      </div>
                    )}
                    {result.ip && (
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">External IP</span>
                        <p className="text-xs font-semibold text-slate-700">{result.ip}</p>
                      </div>
                    )}
                  </div>

                  {result.resultUrl && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <a
                        href={result.resultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-widest"
                      >
                        View Full Results on Speedtest.net →
                      </a>
                    </div>
                  )}

                  {result.timestamp && (
                    <div className="mt-2">
                      <span className="text-[9px] text-slate-400">Tested at: {new Date(result.timestamp).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && phase === 'error' && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              Powered by Ookla® Speedtest CLI
            </span>
            {status?.cliPath && (
              <span className="text-[9px] text-slate-400 font-mono">
                {status.cliPath}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolsPage;
