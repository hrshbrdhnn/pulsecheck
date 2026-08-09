import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Monitor, MonitorType, MonitorStatus, ALL_MONITOR_TYPES } from '../types';
import { EmailTagsInput } from './EmailTagsInput';

interface UpdateMonitorPageProps {
  monitors: Monitor[];
  onSaveMonitor: (updated: Monitor) => void;
  onDeleteMonitor: (id: string) => void;
  config: { default_email_addresses: string };
}

export const UpdateMonitorPage: React.FC<UpdateMonitorPageProps> = ({
  monitors,
  onSaveMonitor,
  onDeleteMonitor,
  config,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  // Determine target monitor ID from URL params or query parameter
  const targetId = params.id || searchParams.get('id') || (monitors.length > 0 ? monitors[0].id : '');

  const currentMonitor = monitors.find((m) => m.id === targetId) || monitors[0] || null;

  const [selectedId, setSelectedId] = useState<string>(currentMonitor ? currentMonitor.id : '');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<MonitorType>('HTTP(s)');
  const [status, setStatus] = useState<MonitorStatus>('up');
  const [port, setPort] = useState<number>(8080);
  const [checkInterval, setCheckInterval] = useState<number>(60);
  const [keyword, setKeyword] = useState<string>('');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'HEAD'>('GET');
  const [expectedStatusCode, setExpectedStatusCode] = useState<number>(200);
  const [timeoutMs, setTimeoutMs] = useState<number>(5000);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailOnDown, setEmailOnDown] = useState<boolean>(true);
  const [downEmails, setDownEmails] = useState<string>(config?.default_email_addresses || '');
  const [sslExpiryAlertDays, setSslExpiryAlertDays] = useState<number>(14);
  const [sslExpiryAlertIntervalDays, setSslExpiryAlertIntervalDays] = useState<number>(7);
  const [sslExpiryEmails, setSslExpiryEmails] = useState<string>(config?.default_email_addresses || '');

  useEffect(() => {
    const mon = monitors.find((m) => m.id === selectedId) || currentMonitor;
    if (mon) {
      setSelectedId(mon.id);
      setName(mon.name);
      setUrl(mon.url);
      setType(mon.type);
      setStatus(mon.status);
      setPort(mon.port || 8080);
      const isSsl = mon.type === 'SSL';
      setCheckInterval(isSsl ? Math.round((mon.checkIntervalSeconds || 604800) / 86400) : (mon.checkIntervalSeconds || 60));
      setKeyword(mon.keyword || '');
      setEmailOnDown(mon.email_on_down !== undefined ? mon.email_on_down : true);
      setDownEmails(mon.down_emails || (config?.default_email_addresses || ''));
      setSslExpiryAlertDays(mon.ssl_expiry_alert_days || 14);
      setSslExpiryAlertIntervalDays(mon.ssl_expiry_alert_interval_days || 7);
      setSslExpiryEmails(mon.ssl_expiry_emails || (config?.default_email_addresses || ''));
    }
  }, [selectedId, monitors.length]);

  useEffect(() => {
    if (type === 'SSL') {
      if (checkInterval === 0 || checkInterval === 15 || checkInterval === 30 || checkInterval === 60 || checkInterval === 300) {
        setCheckInterval(7);
      }
    } else {
      if (checkInterval === 1 || checkInterval === 7 || checkInterval === 15 || checkInterval === 30) {
        setCheckInterval(60);
      }
    }
  }, [type]);

  const handleMonitorChange = (newId: string) => {
    setSelectedId(newId);
    navigate(`/update-monitor/${newId}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMonitor) {
      setError('No monitor selected to update.');
      return;
    }

    if (!name.trim()) {
      setError('Friendly name cannot be empty.');
      return;
    }

    if (!url.trim()) {
      setError('Target URL/host cannot be empty.');
      return;
    }

    const targetMon = monitors.find((m) => m.id === selectedId) || currentMonitor;

    const updated: Monitor = {
      ...targetMon,
      name: name.trim(),
      url: url.trim(),
      type,
      status,
      port: type === 'Port' ? port : undefined,
      keyword: (type === 'Keyword' || type === 'DNS') ? keyword : undefined,
      checkIntervalSeconds: type === 'SSL' ? checkInterval * 86400 : checkInterval,
      email_on_down: type !== 'SSL' ? emailOnDown : false,
      down_emails: type !== 'SSL' ? downEmails.trim() : '',
      ssl_expiry_alert_days: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryAlertDays : undefined,
      ssl_expiry_alert_interval_days: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryAlertIntervalDays : undefined,
      ssl_expiry_emails: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryEmails.trim() : '',
    };

    onSaveMonitor(updated);
    setSuccessMessage(`Updated configuration for "${updated.name}" successfully!`);
    setError(null);

    setTimeout(() => {
      navigate('/');
    }, 800);
  };

  const handleDelete = () => {
    if (!currentMonitor) return;
    if (window.confirm(`Are you sure you want to delete "${currentMonitor.name}"?`)) {
      onDeleteMonitor(currentMonitor.id);
      navigate('/');
    }
  };

  if (monitors.length === 0) {
    return (
      <main id="update-monitor-page" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
        <div className="max-w-3xl mx-auto text-center space-y-4 py-12">
          <span className="material-symbols-outlined text-5xl text-[#3b4b3a]">
            edit_off
          </span>
          <h2 className="text-xl font-bold text-[#e5e2e1]">No Monitors Available to Update</h2>
          <p className="text-xs text-[#b9ccb5] font-mono-code">
            Create a monitor first before editing its settings.
          </p>
          <button
            onClick={() => navigate('/add-monitor')}
            className="px-5 py-2.5 bg-[#00e55b] text-[#003911] font-bold rounded-lg hover:bg-[#6bff83] text-xs font-mono-code transition-colors"
          >
            + Create New Monitor
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="update-monitor-page" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between border-b border-[#3b4b3a] pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg bg-[#201f1f] hover:bg-[#2a2a2a] text-[#b9ccb5] hover:text-[#e5e2e1] border border-[#3b4b3a] transition-all flex items-center justify-center"
              title="Back to Dashboard"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div>
              <div className="text-xs font-mono-code text-[#9fcaff]">/update-monitor</div>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#e5e2e1]">Update Monitor Configuration</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9fcaff]">tune</span>
            <span className="text-xs font-mono-code text-[#b9ccb5] hidden sm:inline">
              Configuration Engine
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-[#ffb4ab]/10 border border-[#ffb4ab] text-[#ffb4ab] rounded-xl text-xs font-mono-code flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-[#00e55b]/10 border border-[#00e55b] text-[#00e55b] rounded-xl text-xs font-mono-code flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Target Monitor Selector */}
          <div className="glass-panel p-6 rounded-xl space-y-3">
            <label className="text-xs font-bold text-[#e5e2e1] uppercase font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#9fcaff] text-base">swap_horiz</span>
              Select Target Monitor to Edit
            </label>
            <select
              value={selectedId}
              onChange={(e) => handleMonitorChange(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-xs font-mono-code text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none cursor-pointer"
            >
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.type}) — {m.url} [{m.status.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          {/* Section 1: Protocol & Basic Settings */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#9fcaff] text-base">edit_note</span>
              1. General Properties
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-code">
              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Friendly Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Target URL / Host</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono-code pt-2">
              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Monitor Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MonitorType)}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none cursor-pointer"
                >
                  {ALL_MONITOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t === 'HTTP(s)' ? 'HTTP / HTTPS' : t === 'Ping' ? 'Ping (ICMP)' : t === 'Port' ? 'Port (TCP)' : t === 'Keyword' ? 'Keyword Search' : t === 'SSL' ? 'SSL Expiry' : 'DNS Query'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Status Override</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MonitorStatus)}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none cursor-pointer"
                >
                  <option value="up">Operational (Up)</option>
                  <option value="degraded">Degraded Performance</option>
                  <option value="down">Downtime (Down)</option>
                  <option value="paused">Paused Monitoring</option>
                </select>
              </div>

              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  {type === 'SSL' ? 'Check Interval (Days)' : 'Check Interval'}
                </label>
                {type === 'SSL' ? (
                  <select
                    value={checkInterval}
                    onChange={(e) => setCheckInterval(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none cursor-pointer"
                  >
                    <option value={1}>1 Day</option>
                    <option value={7}>7 Days (Recommended)</option>
                    <option value={15}>15 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                ) : (
                  <select
                    value={checkInterval}
                    onChange={(e) => setCheckInterval(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none cursor-pointer"
                  >
                    <option value={15}>15 Seconds</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds (1 min)</option>
                    <option value={300}>300 Seconds (5 min)</option>
                  </select>
                )}
              </div>
            </div>

            {type === 'Port' && (
              <div className="text-xs font-mono-code max-w-xs pt-2">
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Target TCP Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 80)}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                />
              </div>
            )}

            {(type === 'Keyword' || type === 'DNS') && (
              <div className="text-xs font-mono-code pt-2">
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  {type === 'DNS' ? 'Expected Resolved IP Address' : 'Expected Response Keyword'}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={type === 'DNS' ? 'e.g. 142.250.190.46' : 'e.g. "status": "operational"'}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Section 2: Advanced HTTP Settings */}
          {type === 'HTTP(s)' && (
            <div className="glass-panel p-6 rounded-xl space-y-4">
              <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
                <span className="material-symbols-outlined text-[#9fcaff] text-base">settings_ethernet</span>
                2. HTTP Execution Parameters
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono-code">
                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as any)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">Expected Code</label>
                  <input
                    type="number"
                    value={expectedStatusCode}
                    onChange={(e) => setExpectedStatusCode(parseInt(e.target.value) || 200)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">Timeout Threshold (ms)</label>
                  <input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 5000)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Configurable Email Alerts */}
          <div className="glass-panel p-6 rounded-xl space-y-6">
            <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00e55b] text-base">notifications</span>
              5. Configurable Email Alerts
            </h2>

            {/* Outage Alerts Configuration */}
            {type !== 'SSL' && (
              <div className="space-y-4 border-b border-[#3b4b3a]/30 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#e5e2e1] font-mono-code">Downtime Email Alerts</h3>
                    <p className="text-[11px] text-[#849581] font-mono-code">Send notification when monitor status goes DOWN or comes back UP</p>
                  </div>
                  <label className="relative inline-flex inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailOnDown}
                      onChange={(e) => setEmailOnDown(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#201f1f] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#b9ccb5] after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00e55b] peer-checked:after:bg-[#003911] peer-checked:after:border-[#00e55b]"></div>
                  </label>
                </div>

                {emailOnDown && (
                  <div className="text-xs font-mono-code">
                    <label className="text-[#b9ccb5] block mb-1.5 font-mono-code">Outage Notification Recipients</label>
                    <EmailTagsInput
                      value={downEmails}
                      onChange={setDownEmails}
                      placeholder="Add email address..."
                      focusColorClass="focus-within:border-[#9fcaff]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* SSL Expiry Alerts Configuration */}
            {(type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-[#e5e2e1] font-mono-code">SSL Expiration Alerts</h3>
                  <p className="text-[11px] text-[#849581] font-mono-code">Send alerts before certificate expiration</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono-code">
                  <div>
                    <label className="text-[#b9ccb5] block mb-1.5">Alert Days Before Expiration</label>
                    <input
                      type="number"
                      value={sslExpiryAlertDays}
                      onChange={(e) => setSslExpiryAlertDays(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#b9ccb5] block mb-1.5">Alert Repeat Interval (Days)</label>
                    <input
                      type="number"
                      value={sslExpiryAlertIntervalDays}
                      onChange={(e) => setSslExpiryAlertIntervalDays(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#9fcaff] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-mono-code">
                  <label className="text-[#b9ccb5] block mb-1.5 font-mono-code">SSL Expiration Alert Recipients</label>
                  <EmailTagsInput
                    value={sslExpiryEmails}
                    onChange={setSslExpiryEmails}
                    placeholder="Add email address..."
                    focusColorClass="focus-within:border-[#9fcaff]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone / Deletion */}
          <div className="glass-panel p-6 rounded-xl border-[#ffb4ab]/30 bg-[#ffb4ab]/5 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#ffb4ab] font-mono-code uppercase tracking-wider">
                Danger Zone
              </div>
              <div className="text-[11px] text-[#b9ccb5] font-mono-code mt-0.5">
                Permanently stop pinging and wipe response history for this monitor.
              </div>
            </div>

            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-[#2a0808] border border-[#ffb4ab] text-[#ffb4ab] hover:bg-[#ffb4ab] hover:text-[#690005] font-bold text-xs font-mono-code rounded-lg transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              Delete Monitor
            </button>
          </div>

          {/* Save Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#3b4b3a]">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-[#201f1f] hover:bg-[#2a2a2a] text-[#e5e2e1] rounded-xl text-xs font-mono-code font-medium border border-[#3b4b3a] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-[#9fcaff] text-[#001d36] hover:bg-[#d2e4ff] font-bold rounded-xl text-xs font-mono-code transition-all shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">save</span>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
