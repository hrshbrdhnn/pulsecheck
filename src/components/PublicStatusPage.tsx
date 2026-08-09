import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from '../types';

interface PublicStatusPageProps {
  monitors?: Monitor[];
}

export const PublicStatusPage: React.FC<PublicStatusPageProps> = ({ monitors: propMonitors }) => {
  const navigate = useNavigate();

  const [monitors, setMonitors] = useState<any[]>(propMonitors || []);
  const [overallUptime, setOverallUptime] = useState<string>('100.00');
  const [avgLatency, setAvgLatency] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/public-status');
      const data = await res.json();
      setMonitors(data.monitors || []);
      setOverallUptime(String(data.overallUptime || '100.00'));
      setAvgLatency(data.avgLatency || 0);
    } catch (err) {
      console.error("Failed to fetch public status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh public status stream every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute status aggregates
  const downMonitors = monitors.filter((m) => m.status === 'down');
  const degradedMonitors = monitors.filter((m) => m.status === 'degraded');
  const totalMonitors = monitors.length;
  const isAllHealthy = downMonitors.length === 0 && degradedMonitors.length === 0;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscribeEmail.trim()) {
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: subscribeEmail }),
        });
        if (res.ok) {
          setSubscribed(true);
          setTimeout(() => setSubscribed(false), 4000);
          setSubscribeEmail('');
        }
      } catch (err) {
        console.error("Failed to subscribe email:", err);
      }
    }
  };

  return (
    <main id="public-status-page" className="flex-1 overflow-y-auto bg-[#131313] min-w-0 p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Header & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3b4b3a] pb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-[#201f1f] hover:bg-[#2a2a2a] text-[#b9ccb5] hover:text-[#e5e2e1] border border-[#3b4b3a] transition-all flex items-center justify-center"
              title="Back to Console Dashboard"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div>
              <div className="text-xs font-mono-code text-[#00e55b]">/status</div>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#e5e2e1]">Infrastructure Status Page</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00e55b]/10 border border-[#00e55b]/30 rounded-full text-xs font-mono-code text-[#00e55b]">
              <span className="w-2 h-2 rounded-full bg-[#00e55b] animate-ping" />
              Live Health Stream
            </span>
          </div>
        </div>

        {loading && monitors.length === 0 ? (
          <div className="text-center py-20 text-xs font-mono-code text-[#b9ccb5] animate-pulse">
            Fetching system status stream...
          </div>
        ) : (
          <>
            {/* Global Status Banner */}
            <div
              className={`p-6 sm:p-8 rounded-2xl border backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
                isAllHealthy
                  ? 'bg-[#00e55b]/10 border-[#00e55b] text-[#edffe8]'
                  : downMonitors.length > 0
                  ? 'bg-[#ffb4ab]/10 border-[#ffb4ab] text-[#ffdad6]'
                  : 'bg-[#ffcc00]/10 border-[#ffcc00] text-[#fff8f7]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isAllHealthy
                      ? 'bg-[#00e55b]/20 text-[#00e55b]'
                      : downMonitors.length > 0
                      ? 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
                      : 'bg-[#ffcc00]/20 text-[#ffcc00]'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    {isAllHealthy ? 'check_circle' : downMonitors.length > 0 ? 'error' : 'warning'}
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">
                    {isAllHealthy
                      ? 'All Systems Operational'
                      : downMonitors.length > 0
                      ? 'Partial Infrastructure Outage'
                      : 'Degraded Service Performance'}
                  </h2>
                  <p className="text-xs sm:text-sm font-mono-code opacity-85 mt-1">
                    {isAllHealthy
                      ? `All ${totalMonitors} services are responding normally across global nodes.`
                      : `${downMonitors.length} service(s) experiencing downtime; engineers investigating.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono-code border-t md:border-t-0 md:border-l border-current/20 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                <div>
                  <div className="opacity-75">Global Uptime</div>
                  <div className="text-lg font-bold font-mono-code">{overallUptime}%</div>
                </div>
                <div>
                  <div className="opacity-75">Avg Latency</div>
                  <div className="text-lg font-bold font-mono-code">{avgLatency} ms</div>
                </div>
              </div>
            </div>

            {/* Subscribe / Notification Bar */}
            <div className="glass-panel p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#9fcaff]">mail</span>
                <div>
                  <div className="text-xs font-bold text-[#e5e2e1] font-mono-code">Subscribe to Incident Alerts</div>
                  <div className="text-[11px] text-[#b9ccb5]">Get email notifications whenever PulseCheck detects downtime.</div>
                </div>
              </div>

              <form onSubmit={handleSubscribe} className="flex gap-2 w-full sm:w-auto">
                <input
                  type="email"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  placeholder="sre-team@example.com"
                  required
                  className="bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg px-3 py-2 text-xs font-mono-code text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none w-full sm:w-64"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#9fcaff] hover:bg-[#d2e4ff] text-[#001d36] font-bold text-xs font-mono-code rounded-lg transition-colors flex-shrink-0"
                >
                  {subscribed ? 'Subscribed!' : 'Subscribe'}
                </button>
              </form>
            </div>

            {/* System Health Breakdown Cards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono-code text-[#b9ccb5] uppercase tracking-wider font-semibold">
                  Monitored Systems &amp; Services ({monitors.length})
                </h3>
                <span className="text-xs font-mono-code text-[#849581]">
                  Refreshed live every 10s
                </span>
              </div>

              <div className="space-y-3">
                {monitors.map((m) => (
                  <div
                    key={m.id}
                    className="glass-panel p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#849581] transition-all"
                  >
                    {/* Left: Status Dot & Service Name */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                          m.status === 'up'
                            ? 'bg-[#00e55b] status-glow-up'
                            : m.status === 'down'
                            ? 'bg-[#ffb4ab] status-glow-down'
                            : m.status === 'degraded'
                            ? 'bg-[#ffcc00] status-glow-degraded'
                            : 'bg-[#666666]'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-bold text-[#e5e2e1] font-mono-code">{m.name}</div>
                        <div className="text-xs text-[#9fcaff] font-mono-code truncate">
                          {m.type === 'port' && m.port ? `${m.url}:${m.port}` : m.url}
                        </div>
                      </div>
                    </div>

                    {/* Center: 24-Hour Visual Strip */}
                    <div className="hidden lg:flex flex-col items-center gap-1">
                      <div className="flex gap-1">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const isFaulty = m.status === 'down' && i === 23;
                          const isDegraded = m.status === 'degraded' && i === 23;
                          return (
                            <div
                              key={i}
                              className={`w-2 h-6 rounded-sm ${
                                isFaulty
                                  ? 'bg-[#ffb4ab]'
                                  : isDegraded
                                  ? 'bg-[#ffcc00]'
                                  : 'bg-[#00e55b]'
                              }`}
                              title={`Hour -${24 - i}: ${isFaulty ? 'Down' : 'Operational'}`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-mono-code text-[#849581]">
                        Last 24 Hours Performance
                      </span>
                    </div>

                    {/* Right: Metrics & Badge */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto text-xs font-mono-code pt-2 sm:pt-0 border-t sm:border-t-0 border-[#3b4b3a]/50">
                      <div className="text-right">
                        <div className="text-[#b9ccb5]">Response Time</div>
                        <div className="text-[#e5e2e1] font-bold">
                          {m.status === 'down' ? '--' : `${m.currentResponseMs} ms`}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[#b9ccb5]">24h Uptime</div>
                        <div className="text-[#00e55b] font-bold">{m.uptime24h}%</div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full border font-bold capitalize ${
                          m.status === 'up'
                            ? 'bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30'
                            : m.status === 'down'
                            ? 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30'
                            : m.status === 'degraded'
                            ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-[#ffcc00]/30'
                            : 'bg-[#666666]/10 text-[#666666] border-[#666666]/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 90-Day Historical Availability Section */}
        <div className="glass-panel p-6 rounded-xl space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#e5e2e1] font-mono-code uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00e55b] text-base">calendar_month</span>
              90-Day Operational History
            </h3>
            <span className="px-2.5 py-0.5 bg-[#3b4b3a]/30 text-[#b9ccb5] text-[10px] font-mono-code rounded-full border border-[#3b4b3a] font-bold">
              Coming Soon
            </span>
          </div>

          <div className="opacity-30 pointer-events-none">
            <div className="grid grid-cols-30 gap-1 h-8 bg-[#0A0A0A] p-2 rounded-lg border border-[#3b4b3a]">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="h-full rounded-xs bg-[#3b4b3a]" />
              ))}
            </div>
            <div className="flex justify-between text-[11px] font-mono-code text-[#849581] mt-2">
              <span>90 Days Ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Past Incident Logs Feed */}
        <div className="glass-panel rounded-xl overflow-hidden relative">
          <div className="p-5 border-b border-[#3b4b3a] bg-[#1a1a1a] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#e5e2e1] font-mono-code uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[#9fcaff] text-base">history</span>
              Past Incident &amp; Maintenance Logs
            </h3>
            <span className="px-2.5 py-0.5 bg-[#3b4b3a]/30 text-[#b9ccb5] text-[10px] font-mono-code rounded-full border border-[#3b4b3a] font-bold">
              Coming Soon
            </span>
          </div>

          <div className="p-8 text-center text-xs font-mono-code text-[#849581] space-y-2 flex flex-col items-center">
            <span className="material-symbols-outlined text-3xl text-[#3d4d3c]">history_toggle_off</span>
            <p>Past incident records and scheduled maintenance logs will be displayed here.</p>
          </div>
        </div>

        {/* Public Footer */}
        <div className="text-center py-6 border-t border-[#3b4b3a] text-xs font-mono-code text-[#849581] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PulseCheck Status Dashboard &copy; 2026</span>
          <button
            onClick={() => navigate('/')}
            className="text-[#00e55b] hover:underline flex items-center gap-1 cursor-pointer"
          >
            Switch to Admin Monitoring Console &rarr;
          </button>
        </div>
      </div>
    </main>
  );
};
