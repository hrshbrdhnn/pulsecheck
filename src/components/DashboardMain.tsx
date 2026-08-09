import React, { useState } from 'react';
import { Monitor, formatUtcToLocal, filterLastGoodAndBad } from '../types';
import { MonitorChart } from './MonitorChart';

interface DashboardMainProps {
  monitor: Monitor;
  onEditClick: () => void;
  onDeleteClick: (id: string) => void;
  onTogglePause: (id: string) => void;
  onRunCheck: (id: string) => void;
  onOpenCertModal: () => void;
}

export const DashboardMain: React.FC<DashboardMainProps> = ({
  monitor,
  onEditClick,
  onDeleteClick,
  onTogglePause,
  onRunCheck,
  onOpenCertModal,
}) => {
  const [isTesting, setIsTesting] = useState(false);

  const handleTestNow = () => {
    setIsTesting(true);
    onRunCheck(monitor.id);
    setTimeout(() => {
      setIsTesting(false);
    }, 600);
  };

  return (
    <main id="dashboard-main-content" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-2xl text-[#9fcaff] flex-shrink-0">
                {monitor.type === 'HTTP(s)' ? 'public' : monitor.type === 'Ping' ? 'radar' : monitor.type === 'Port' ? 'lan' : monitor.type === 'Keyword' ? 'manage_search' : monitor.type === 'SSL' ? 'lock' : 'dns'}
              </span>
              <h1 className="text-3xl font-bold text-[#e5e2e1] font-headline-lg">{monitor.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-mono-code border font-medium ${monitor.status === 'up'
                  ? 'bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30'
                  : monitor.status === 'down'
                    ? 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30'
                    : monitor.status === 'degraded'
                      ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-[#ffcc00]/30'
                      : 'bg-[#666666]/10 text-[#666666] border-[#666666]/30'
                  }`}
              >
                {monitor.status.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-mono-code font-bold bg-[#9fcaff]/10 border border-[#9fcaff]/30 text-[#9fcaff] uppercase tracking-wider">
                {monitor.type === 'HTTP(s)' ? 'HTTP' : monitor.type === 'Ping' ? 'ICMP' : monitor.type === 'Port' ? 'TCP' : monitor.type}
              </span>
            </div>

            <a
              href={monitor.url.startsWith('http') ? monitor.url : `http://${monitor.url}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#9fcaff] hover:text-[#0e9aff] transition-colors text-xs font-body-md flex items-center gap-1 mt-1 font-mono-code"
            >
              {monitor.type === 'Port' && monitor.port ? (
                <>
                  {monitor.url}<span className="font-bold">:{monitor.port}</span>
                </>
              ) : (
                monitor.url
              )}
              <span className="material-symbols-outlined text-sm">open_in_new</span>
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="monitor-run-test-btn"
              onClick={handleTestNow}
              disabled={isTesting}
              className="h-9 px-3 rounded-md border border-[#3b4b3a] bg-[#201f1f] hover:border-[#00e55b] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0"
              title="Ping monitor now"
            >
              <span className={`material-symbols-outlined text-base leading-none ${isTesting ? 'animate-spin text-[#00e55b]' : ''}`}>
                refresh
              </span>
              <span className="hidden sm:inline">Ping Now</span>
            </button>

            <button
              id="monitor-pause-btn"
              onClick={() => onTogglePause(monitor.id)}
              className="h-9 px-3 rounded-md border border-[#3b4b3a] bg-[#201f1f] hover:border-[#9fcaff] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0"
              title={monitor.status === 'paused' ? 'Resume Monitor' : 'Pause Monitor'}
            >
              <span className="material-symbols-outlined text-base leading-none">
                {monitor.status === 'paused' ? 'play_arrow' : 'pause'}
              </span>
              <span className="hidden sm:inline">
                {monitor.status === 'paused' ? 'Resume' : 'Pause'}
              </span>
            </button>

            <button
              id="monitor-edit-btn"
              onClick={onEditClick}
              className="w-9 h-9 rounded-md border border-[#3b4b3a] hover:border-[#e5e2e1] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center flex-shrink-0"
              title="Edit Configuration"
            >
              <span className="material-symbols-outlined text-base leading-none">edit</span>
            </button>

            <button
              id="monitor-delete-btn"
              onClick={() => onDeleteClick(monitor.id)}
              className="w-9 h-9 rounded-md bg-[#2a0808] border border-[#ffb4ab] hover:bg-[#ffb4ab] hover:text-[#690005] text-[#ffb4ab] transition-all flex items-center justify-center flex-shrink-0"
              title="Delete Monitor"
            >
              <span className="material-symbols-outlined text-base leading-none">delete</span>
            </button>
          </div>
        </div>

        {/* Stats Bento Grid */}
        <div id="stats-bento-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Response */}
          <div className="glass-panel p-6 rounded-xl text-center flex flex-col justify-center">
            <div className="text-xs font-mono-code text-[#b9ccb5] mb-2">Response</div>
            <div className="text-2xl lg:text-3xl font-semibold text-[#e5e2e1]">
              {monitor.status === 'down' ? '--' : `${monitor.currentResponseMs} ms`}
            </div>
            <div className="text-xs font-mono-code text-[#00e55b] mt-1">Current</div>
          </div>

          {/* Card 2: Avg Response */}
          <div className="glass-panel p-6 rounded-xl text-center flex flex-col justify-center">
            <div className="text-xs font-mono-code text-[#b9ccb5] mb-2">Avg. Response</div>
            <div className="text-2xl lg:text-3xl font-semibold text-[#e5e2e1]">
              {monitor.avgResponseMs} ms
            </div>
            <div className="text-xs font-mono-code text-[#b9ccb5] mt-1">24 hour</div>
          </div>

          {/* Card 3: Uptime */}
          <div className="glass-panel p-6 rounded-xl text-center flex flex-col justify-center">
            <div className="text-xs font-mono-code text-[#b9ccb5] mb-2">Uptime</div>
            <div className="text-2xl lg:text-3xl font-semibold text-[#00e55b]">
              {monitor.uptime24h}%
            </div>
            <div className="text-xs font-mono-code text-[#b9ccb5] mt-1">24 hour</div>
          </div>

          {/* Card 4: Certificate Expiry */}
          {(() => {
            const hasCert = monitor.certInfo && (monitor.type === 'HTTP(s)' || monitor.type === 'Keyword');
            return (
              <div
                onClick={hasCert ? onOpenCertModal : undefined}
                className={`glass-panel p-6 rounded-xl text-center flex flex-col justify-center border-t-2 border-t-[#9fcaff] transition-colors ${hasCert
                  ? 'cursor-pointer hover:border-t-[#0e9aff]'
                  : 'cursor-not-allowed opacity-60'
                  }`}
              >
                <div className="text-xs font-mono-code text-[#b9ccb5] mb-2">Certificate Expiry</div>
                <div className="text-base lg:text-lg font-semibold text-[#e5e2e1]">
                  {hasCert ? monitor.certInfo.validTo : 'N/A'}
                </div>
                {hasCert ? (
                  <div className="text-xs font-mono-code text-[#9fcaff] underline mt-1">
                    {monitor.certInfo.daysRemaining} days
                  </div>
                ) : (
                  <div className="text-xs font-mono-code text-[#849581] mt-1">
                    {monitor.type === 'Ping' ? 'ICMP Target Only' : monitor.type === 'Port' ? 'TCP Target Only' : 'N/A'}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Chart Area */}
        <MonitorChart data={monitor.responseHistory} avgResponseMs={monitor.avgResponseMs} />

        {/* Log Table */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#3b4b3a] flex justify-between items-center bg-[#1a1a1a]">
            <div>
              <h2 className="text-lg font-semibold text-[#e5e2e1] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00e55b] text-base">monitor_heart</span>
                Heartbeat Summary
                {/* <span className="material-symbols-outlined text-sm text-[#b9ccb5]">rocket_launch</span> */}
              </h2>
              <p className="text-xs text-[#b9ccb5] font-mono-code mt-0.5">Latest successful &amp; latest failed status checkpoints</p>
            </div>
            <button
              onClick={handleTestNow}
              className="text-xs font-mono-code text-[#00e55b] hover:underline flex items-center gap-1"
            >
              + Trigger Pulse
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0e0e0e] border-b border-[#3b4b3a]">
                  <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Status</th>
                  <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">DateTime</th>
                  <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Response Time</th>
                  <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3b4b3a]/50 text-xs font-mono-code">
                {filterLastGoodAndBad<any>(monitor.heartbeats).map((hb) => (
                  <tr key={hb.id} className="hover:bg-[#1c1b1b] transition-colors">
                    <td className="p-4">
                      <div
                        className={`w-3 h-3 rounded-full ${hb.status === 'up'
                          ? 'bg-[#00e55b]'
                          : hb.status === 'degraded'
                            ? 'bg-[#ffcc00]'
                            : 'bg-[#ffb4ab]'
                          }`}
                      />
                    </td>
                    <td className="p-4 text-[#e5e2e1]">{formatUtcToLocal(hb.timestamp)}</td>
                    <td className="p-4 text-[#b9ccb5]">
                      {hb.responseTimeMs !== null ? `${hb.responseTimeMs} ms` : '--'}
                    </td>
                    <td className="p-4">
                      <div
                        className={`flex items-center gap-2 ${hb.status === 'up'
                          ? 'text-[#9fcaff]'
                          : hb.status === 'degraded'
                            ? 'text-[#ffcc00]'
                            : 'text-[#ffb4ab]'
                          }`}
                      >
                        <span>{hb.statusText}</span>
                        {hb.isOndemand && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#9fcaff]/10 border border-[#9fcaff]/30 text-[#9fcaff] uppercase tracking-wider font-mono-code scale-90">
                            On-Demand
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
};
