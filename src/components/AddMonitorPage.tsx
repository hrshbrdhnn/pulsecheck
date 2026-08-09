import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, MonitorType } from '../types';
import { EmailTagsInput } from './EmailTagsInput';

interface AddMonitorPageProps {
  onAddMonitor: (monitor: Omit<Monitor, 'id' | 'heartbeats' | 'responseHistory' | 'createdAt'>) => void;
  config: { default_email_addresses: string };
}

export const AddMonitorPage: React.FC<AddMonitorPageProps> = ({ onAddMonitor, config }) => {
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<MonitorType>('HTTP(s)');
  const [port, setPort] = useState<number>(8080);
  const [keyword, setKeyword] = useState('');
  const [checkInterval, setCheckInterval] = useState<number>(60);
  const [enableSsl, setEnableSsl] = useState<boolean>(true);
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'HEAD'>('GET');
  const [expectedStatusCode, setExpectedStatusCode] = useState<number>(200);
  const [timeoutMs, setTimeoutMs] = useState<number>(5000);
  const [customHeaders, setCustomHeaders] = useState<string>('');
  const [webhookAlerts, setWebhookAlerts] = useState<boolean>(true);
  const [emailOnDown, setEmailOnDown] = useState<boolean>(true);
  const [downEmails, setDownEmails] = useState<string>(config?.default_email_addresses || '');
  const [sslExpiryAlertDays, setSslExpiryAlertDays] = useState<number>(14);
  const [sslExpiryAlertIntervalDays, setSslExpiryAlertIntervalDays] = useState<number>(7);
  const [sslExpiryEmails, setSslExpiryEmails] = useState<string>(config?.default_email_addresses || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (type === 'SSL') {
      setCheckInterval(7);
    } else {
      setCheckInterval(60);
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter a descriptive friendly name for the monitor.');
      return;
    }
    if (!url.trim()) {
      setError('Please provide a target URL, domain, or IP address.');
      return;
    }

    // Clean URL formatting
    let formattedUrl = url.trim();
    if (type === 'HTTP(s)' && !formattedUrl.match(/^https?:\/\//i)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const newMonitorData: Omit<Monitor, 'id' | 'heartbeats' | 'responseHistory' | 'createdAt'> = {
      name: name.trim(),
      url: formattedUrl,
      type,
      status: 'up',
      currentResponseMs: Math.floor(Math.random() * 25) + 12,
      avgResponseMs: Math.floor(Math.random() * 30) + 18,
      uptime24h: 100.0,
      checkIntervalSeconds: type === 'SSL' ? checkInterval * 86400 : checkInterval,
      ...(type === 'Port' ? { port } : {}),
      ...((type === 'Keyword' || type === 'DNS') ? { keyword } : {}),
      email_on_down: type !== 'SSL' ? emailOnDown : false,
      down_emails: type !== 'SSL' ? downEmails.trim() : '',
      ssl_expiry_alert_days: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryAlertDays : undefined,
      ssl_expiry_alert_interval_days: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryAlertIntervalDays : undefined,
      ssl_expiry_emails: (type === 'HTTP(s)' || type === 'Keyword' || type === 'SSL') ? sslExpiryEmails.trim() : '',
      ...(enableSsl && type === 'HTTP(s)'
        ? {
          certInfo: {
            validTo: '2026-12-31',
            daysRemaining: 147,
            issuer: "Let's Encrypt Authority X3",
            subject: `CN=${formattedUrl.replace(/^https?:\/\//, '').split('/')[0]}`,
            validFrom: '2026-06-01',
            tlsVersion: 'TLS 1.3',
            signatureAlgorithm: 'SHA256-RSA',
            san: [formattedUrl.replace(/^https?:\/\//, '').split('/')[0]],
          },
        }
        : {}),
    };

    onAddMonitor(newMonitorData);
    navigate('/');
  };

  return (
    <main id="add-monitor-page" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Breadcrumb & Title */}
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
              <div className="text-xs font-mono-code text-[#00e55b]">/add-monitor</div>
              <h1 className="text-2xl lg:text-3xl font-bold text-[#e5e2e1]">Create New Monitor</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00e55b]">add_task</span>
            <span className="text-xs font-mono-code text-[#b9ccb5] hidden sm:inline">
              Real-time Uptime Engine
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-[#ffb4ab]/10 border border-[#ffb4ab] text-[#ffb4ab] rounded-xl text-xs font-mono-code flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Monitor Protocol & Type Selection */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00e55b] text-base">alt_route</span>
              1. Select Monitor Type
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(
                [
                  { id: 'HTTP(s)', label: 'HTTP / HTTPS', desc: 'Websites, APIs & webhooks' },
                  { id: 'Ping', label: 'ICMP Ping', desc: 'Servers & IP addresses' },
                  { id: 'Port', label: 'TCP Port', desc: 'Custom network services' },
                  { id: 'Keyword', label: 'Keyword Search', desc: 'Body string matching' },
                  { id: 'SSL', label: 'SSL Expiry', desc: 'Certificate validity tracking' },
                  { id: 'DNS', label: 'DNS Query', desc: 'Domain nameserver lookups' },
                ] as const
              ).map((t) => {
                const iconName = t.id === 'HTTP(s)' ? 'public' : t.id === 'Ping' ? 'radar' : t.id === 'Port' ? 'lan' : t.id === 'Keyword' ? 'manage_search' : t.id === 'SSL' ? 'lock' : 'dns';
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setType(t.id as MonitorType)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${type === t.id
                      ? 'bg-[#2a2a2a] border-[#00e55b] text-[#00e55b] shadow-lg'
                      : 'bg-[#101010] border-[#3b4b3a] text-[#b9ccb5] hover:border-[#849581]'
                      }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`material-symbols-outlined text-xl ${type === t.id ? 'text-[#00e55b]' : 'text-[#849581]'}`}>
                        {iconName}
                      </span>
                      {type === t.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00e55b]" />
                      )}
                    </div>
                    <div>
                      <div className="font-mono-code font-bold text-xs mb-0.5">{t.label}</div>
                      <div className="text-[10px] text-[#849581] font-sans leading-tight">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: General Settings */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00e55b] text-base">dns</span>
              2. Target Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-code">
              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  Friendly Name <span className="text-[#00e55b]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary Payment Gateway"
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  {type === 'Ping' ? 'IP Address / Hostname' : 'Target URL / Hostname'} <span className="text-[#00e55b]">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={
                    type === 'Ping'
                      ? '192.168.1.1 or db.internal.net'
                      : type === 'SSL'
                        ? 'google.com'
                        : type === 'DNS'
                          ? 'api.mycompany.com'
                          : 'https://api.myapp.com/v1/health'
                  }
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Conditional Port */}
            {type === 'Port' && (
              <div className="text-xs font-mono-code max-w-md">
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">Port Number</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 1)}
                  placeholder="8080"
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                />
              </div>
            )}

            {/* Conditional Keyword / Expected DNS Value */}
            {(type === 'Keyword' || type === 'DNS') && (
              <div className="text-xs font-mono-code max-w-md">
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  {type === 'DNS' ? 'Expected Resolved IP Address (Optional)' : 'Required Response String / Phrase'}
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={type === 'DNS' ? 'e.g. 142.250.190.46' : 'e.g. "status": "operational"'}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Section 3: Monitoring Frequency & SSL Settings */}
          <div className="glass-panel p-6 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00e55b] text-base">timer</span>
              3. Check Interval &amp; SSL Validation
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-code">
              <div>
                <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                  {type === 'SSL' ? 'Check Interval (Days)' : 'Pulse Check Interval'}
                </label>
                {type === 'SSL' ? (
                  <select
                    value={checkInterval}
                    onChange={(e) => setCheckInterval(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none cursor-pointer"
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
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none cursor-pointer"
                  >
                    <option value={15}>15 Seconds (High Priority)</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds (1 Minute - Recommended)</option>
                    <option value={300}>300 Seconds (5 Minutes)</option>
                  </select>
                )}
              </div>

              {type === 'HTTP(s)' && (
                <div>
                  <label className="text-[#b9ccb5] block mb-1.5 font-medium">
                    SSL Certificate Tracking
                  </label>
                  <div className="p-3 bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg flex items-center justify-between">
                    <span className="text-[#e5e2e1]">Track Expiry &amp; Issuer Chain</span>
                    <input
                      type="checkbox"
                      checked={enableSsl}
                      onChange={(e) => setEnableSsl(e.target.checked)}
                      className="accent-[#00e55b] w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Advanced HTTP Request Configuration */}
          {type === 'HTTP(s)' && (
            <div className="glass-panel p-6 rounded-xl space-y-4">
              <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00e55b] text-base">settings_ethernet</span>
                4. Advanced Request Parameters
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono-code">
                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as any)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">Expected Status Code</label>
                  <input
                    type="number"
                    value={expectedStatusCode}
                    onChange={(e) => setExpectedStatusCode(parseInt(e.target.value) || 200)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[#b9ccb5] block mb-1.5">Request Timeout (ms)</label>
                  <input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 5000)}
                    className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                  />
                </div>
              </div>

              <div className="text-xs font-mono-code">
                <label className="text-[#b9ccb5] block mb-1.5">Custom HTTP Headers (JSON or Key: Value)</label>
                <textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer token123", "User-Agent": "PulseCheck-Bot/2.0"}'
                  rows={2}
                  className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                />
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
                  <label className="relative inline-flex items-center cursor-pointer">
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
                      focusColorClass="focus-within:border-[#00e55b]"
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
                      className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#b9ccb5] block mb-1.5">Alert Repeat Interval (Days)</label>
                    <input
                      type="number"
                      value={sslExpiryAlertIntervalDays}
                      onChange={(e) => setSslExpiryAlertIntervalDays(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-lg p-3 text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs font-mono-code">
                  <label className="text-[#b9ccb5] block mb-1.5 font-mono-code">SSL Expiration Alert Recipients</label>
                  <EmailTagsInput
                    value={sslExpiryEmails}
                    onChange={setSslExpiryEmails}
                    placeholder="Add email address..."
                    focusColorClass="focus-within:border-[#00e55b]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
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
              className="px-8 py-3 bg-[#00e55b] text-[#003911] hover:bg-[#6bff83] font-bold rounded-xl text-xs font-mono-code transition-all shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Save &amp; Start Monitoring
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
