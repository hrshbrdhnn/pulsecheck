import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Monitor, Settings, Heartbeat } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardMain } from './components/DashboardMain';
import { SslMonitorDashboard } from './components/SSLMonitorDashboard';
import { DnsMonitorDashboard } from './components/DNSMonitorDashboard';
import { AddMonitorPage } from './components/AddMonitorPage';
import { UpdateMonitorPage } from './components/UpdateMonitorPage';
import { PublicStatusPage } from './components/PublicStatusPage';
import { SSLCertificateModal } from './components/SSLCertificateModal';
import socket from './socket';

export default function App() {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>(() => {
    return localStorage.getItem('selectedMonitorId') || '';
  });
  const [config, setConfig] = useState({
    app_name: '',
    support_email: '',
    default_email_addresses: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [activeTab, setActiveTab] = useState<'home' | 'status-page'>('home');

  // Modals state
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper type mapper (Database -> Frontend Types)
  const mapTypeToFrontend = (dbType: string | null | undefined): Monitor['type'] => {
    if (!dbType) return 'HTTP(s)';
    const t = dbType.toLowerCase().trim();
    if (t === 'ping') return 'Ping';
    if (t === 'port') return 'Port';
    if (t === 'keyword') return 'Keyword';
    if (t === 'ssl') return 'SSL';
    if (t === 'dns') return 'DNS';
    return 'HTTP(s)';
  };

  const mapTypeToBackend = (feType: Monitor['type']): string => {
    if (feType === 'Ping') return 'ping';
    if (feType === 'Port') return 'port';
    if (feType === 'Keyword') return 'keyword';
    if (feType === 'SSL') return 'ssl';
    if (feType === 'DNS') return 'dns';
    return 'http';
  };

  // Initial Fetch: List all monitors
  const fetchMonitors = async () => {
    try {
      const res = await fetch('/api/monitors');
      const data = await res.json();
      const mapped = data.monitors.map((m: any) => ({
        id: `mon-${m.id}`,
        name: m.name || '',
        url: m.url || '',
        type: mapTypeToFrontend(m.type),
        status: m.active ? 'up' : 'paused',
        currentResponseMs: 0,
        avgResponseMs: 0,
        uptime24h: 100.0,
        checkIntervalSeconds: m.interval,
        port: m.port || undefined,
        keyword: m.keyword || undefined,
        email_on_down: m.email_on_down || false,
        down_emails: m.down_emails || '',
        ssl_expiry_alert_days: m.ssl_expiry_alert_days || undefined,
        ssl_expiry_alert_interval_days: m.ssl_expiry_alert_interval_days || undefined,
        ssl_expiry_emails: m.ssl_expiry_emails || '',
        heartbeats: [],
        responseHistory: [],
        createdAt: m.created_date || '',
      }));
      setMonitors(mapped);
      if (mapped.length > 0) {
        const storedId = localStorage.getItem('selectedMonitorId');
        const exists = storedId ? mapped.some((m) => m.id === storedId) : false;
        if (exists) {
          setSelectedMonitorId(storedId!);
        } else {
          setSelectedMonitorId(mapped[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching monitors:', err);
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching branding config:', err);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchMonitors();
  }, [fetchConfig]);

  // Fetch details (certificate and heartbeat logs) when selection changes
  useEffect(() => {
    if (!selectedMonitorId) return;
    localStorage.setItem('selectedMonitorId', selectedMonitorId);

    const fetchDetails = async () => {
      try {
        const idStr = selectedMonitorId.replace('mon-', '');

        // Fetch monitor info & SSL details
        const detRes = await fetch(`/api/monitors/${idStr}`);
        const detData = await detRes.json();
        const certData = detData.monitorCertificate;
        let parsedCert = undefined;
        if (certData && certData.info_json) {
          try {
            const parsedObj = JSON.parse(certData.info_json);
            parsedCert = parsedObj.certInfo;
            if (parsedCert) {
              parsedCert.fingerprintSha256 = parsedCert.fingerprint;
              parsedCert.valid = parsedObj.valid;
            }
          } catch (e) {
            console.error("Failed to parse cert info_json:", e);
          }
        }

        // Fetch heartbeat summary and history graph
        const hbRes = await fetch(`/api/heartbeat/${idStr}`);
        const hbData = await hbRes.json();

        const hbSummary = hbData.heartbeatSummary.map((h: any) => ({
          id: `hb-${h.startTime}`,
          status: h.status === 1 ? 'up' : (h.status === 2 ? 'degraded' : 'down'),
          timestamp: h.startTime,
          responseTimeMs: 0,
          statusCode: h.status === 1 ? 200 : (h.status === 2 ? 299 : 503),
          statusText: h.msg,
          isOndemand: h.isOndemand
        }));

        const hbGraph = hbData.heartbeatGraph.map((g: any) => {
          let timeLabel = '';
          try {
            const cleanT = g.time.endsWith('Z') || g.time.includes('+') ? g.time : g.time.replace(' ', 'T') + 'Z';
            const dateObj = new Date(cleanT);
            if (!isNaN(dateObj.getTime())) {
              const hr = dateObj.getHours().toString().padStart(2, '0');
              const min = dateObj.getMinutes().toString().padStart(2, '0');
              timeLabel = `${hr}:${min}`;
            } else {
              timeLabel = g.time.substring(11, 16);
            }
          } catch (e) {
            timeLabel = g.time.substring(11, 16);
          }
          return {
            time: timeLabel,
            ms: g.ping,
            status: g.status === 1 ? 'up' : 'down' as const
          };
        }).reverse();

        setMonitors((prev) =>
          prev.map((m) => {
            if (m.id === selectedMonitorId) {
              return {
                ...m,
                certInfo: parsedCert,
                uptime24h: hbData.uptime24h,
                avgResponseMs: Math.round(hbData.avgResponse24h),
                currentResponseMs: hbData.heartbeatGraph[0]?.ping || 0,
                heartbeats: hbSummary,
                responseHistory: hbGraph.slice(-20),
                dnsTraceInfo: detData.monitor.dnsTraceInfo,
              };
            }
            return m;
          })
        );
      } catch (err) {
        console.error('Error fetching monitor details:', err);
      }
    };

    fetchDetails();
  }, [selectedMonitorId]);

  // Real-time socket updates
  useEffect(() => {
    const handleHeartbeat = (data: any) => {
      const monIdStr = `mon-${data.monitorId}`;
      const statusValue: 'up' | 'down' | 'degraded' =
        data.status === 'degraded'
          ? 'degraded'
          : (data.status === 'up' ? 'up' : 'down');
      const latency = data.ping;
      let timeShort = '';
      try {
        const cleanT = data.timestamp.endsWith('Z') || data.timestamp.includes('+') ? data.timestamp : data.timestamp.replace(' ', 'T') + 'Z';
        const dateObj = new Date(cleanT);
        if (!isNaN(dateObj.getTime())) {
          const hr = dateObj.getHours().toString().padStart(2, '0');
          const min = dateObj.getMinutes().toString().padStart(2, '0');
          timeShort = `${hr}:${min}`;
        } else {
          timeShort = data.timestamp.includes(' ') ? data.timestamp.split(' ')[1].substring(0, 5) : data.timestamp.substring(11, 16);
        }
      } catch (e) {
        timeShort = data.timestamp.includes(' ') ? data.timestamp.split(' ')[1].substring(0, 5) : data.timestamp.substring(11, 16);
      }

      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === monIdStr) {
            const newHeartbeat: Heartbeat = {
              id: `hb-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              status: statusValue,
              timestamp: data.timestamp,
              responseTimeMs: latency || null,
              statusCode: statusValue === 'up' ? 200 : (statusValue === 'degraded' ? 299 : 503),
              statusText: data.msg,
              isOndemand: data.is_ondemand
            };
            const updatedHeartbeats = [newHeartbeat, ...m.heartbeats.slice(0, 19)];
            const updatedHistory = [
              ...m.responseHistory.slice(1),
              { time: timeShort, ms: latency || 0, status: statusValue },
            ];
            return {
              ...m,
              status: m.status === 'paused' ? 'paused' : statusValue,
              currentResponseMs: latency || 0,
              heartbeats: updatedHeartbeats,
              responseHistory: updatedHistory,
            };
          }
          return m;
        })
      );
    };

    socket.on('heartbeat', handleHeartbeat);
    return () => {
      socket.off('heartbeat', handleHeartbeat);
    };
  }, []);

  // Run heartbeat ping check dynamically on-demand
  const performMonitorCheck = useCallback(async (monId: string) => {
    try {
      const idStr = monId.replace('mon-', '');
      await fetch(`/api/monitors/${idStr}/check`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to trigger check:', err);
      showToast('Failed to trigger check.');
    }
  }, []);

  // Add Monitor
const constructBackendPayload = (monitorData: any, isActive: boolean) => {
  const mType = mapTypeToBackend(monitorData.type);
  const payload: any = {
    name: monitorData.name,
    url: monitorData.url,
    type: mType,
    interval: monitorData.checkIntervalSeconds,
    active: isActive,
  };

  const typeLower = mType.toLowerCase();
  if (typeLower === 'http') {
    payload.email_on_down = monitorData.email_on_down;
    payload.down_emails = monitorData.down_emails;
  } else if (typeLower === 'ssl') {
    payload.ssl_expiry_alert_days = monitorData.ssl_expiry_alert_days;
    payload.ssl_expiry_alert_interval_days = monitorData.ssl_expiry_alert_interval_days;
    payload.ssl_expiry_emails = monitorData.ssl_expiry_emails;
  } else if (typeLower === 'keyword') {
    payload.keyword = monitorData.keyword;
    payload.email_on_down = monitorData.email_on_down;
    payload.down_emails = monitorData.down_emails;
  } else if (typeLower === 'port') {
    payload.port = monitorData.port;
    payload.email_on_down = monitorData.email_on_down;
    payload.down_emails = monitorData.down_emails;
  } else if (typeLower === 'ping') {
    payload.email_on_down = monitorData.email_on_down;
    payload.down_emails = monitorData.down_emails;
  } else if (typeLower === 'dns') {
    payload.port = monitorData.port;
    payload.keyword = monitorData.keyword;
    payload.email_on_down = monitorData.email_on_down;
    payload.down_emails = monitorData.down_emails;
  }
  return payload;
};

  const handleAddMonitor = async (
    newMonData: Omit<Monitor, 'id' | 'heartbeats' | 'responseHistory' | 'createdAt'>
  ) => {
    try {
      const backendPayload = constructBackendPayload(newMonData, true);

      const res = await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
      });
      const data = await res.json();
      const created = data.monitor;

      const newMon: Monitor = {
        id: `mon-${created.id}`,
        name: created.name,
        url: created.url,
        type: mapTypeToFrontend(created.type),
        status: 'up',
        currentResponseMs: 0,
        avgResponseMs: 0,
        uptime24h: 100.0,
        checkIntervalSeconds: created.interval,
        port: created.port || undefined,
        keyword: created.keyword || undefined,
        email_on_down: created.email_on_down || false,
        down_emails: created.down_emails || '',
        ssl_expiry_alert_days: created.ssl_expiry_alert_days || undefined,
        ssl_expiry_alert_interval_days: created.ssl_expiry_alert_interval_days || undefined,
        ssl_expiry_emails: created.ssl_expiry_emails || '',
        heartbeats: [],
        responseHistory: [],
        createdAt: created.created_date || '',
      };

      setMonitors((prev) => [newMon, ...prev]);
      setSelectedMonitorId(newMon.id);
      navigate('/');
      showToast(`Monitor "${newMon.name}" successfully created!`);
    } catch (err) {
      console.error('Failed to create monitor:', err);
      showToast('Failed to create monitor.');
    }
  };

  const handleEditSave = async (updated: Monitor) => {
    try {
      const idStr = updated.id.replace('mon-', '');
      const backendPayload = constructBackendPayload(updated, updated.status !== 'paused');

      const res = await fetch(`/api/monitors/${idStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload),
      });

      if (!res.ok) {
        throw new Error('Failed to save configuration update');
      }

      setMonitors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      showToast(`Updated "${updated.name}" configuration.`);
    } catch (err) {
      console.error('Failed to update monitor:', err);
      showToast('Failed to update monitor.');
    }
  };

  // Delete Monitor
  const handleDeleteMonitor = async (id: string) => {
    const target = monitors.find((m) => m.id === id);
    if (confirm(`Are you sure you want to delete "${target?.name || 'this monitor'}"?`)) {
      try {
        const idStr = id.replace('mon-', '');
        await fetch(`/api/monitors/${idStr}`, { method: 'DELETE' });

        setMonitors((prev) => prev.filter((m) => m.id !== id));
        if (selectedMonitorId === id) {
          const remaining = monitors.filter((m) => m.id !== id);
          if (remaining.length > 0) {
            setSelectedMonitorId(remaining[0].id);
          }
        }
        showToast('Monitor removed.');
      } catch (err) {
        console.error('Failed to delete monitor:', err);
        showToast('Failed to delete monitor.');
      }
    }
  };

  // Toggle Pause/Resume
  const handleTogglePause = async (id: string) => {
    try {
      const idStr = id.replace('mon-', '');
      const res = await fetch(`/api/monitors/${idStr}/toggle`, { method: 'POST' });
      const data = await res.json();
      const nextStatus = data.active ? 'up' : 'paused';

      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            return { ...m, status: nextStatus };
          }
          return m;
        })
      );
      showToast(`Monitor is now ${nextStatus}.`);
    } catch (err) {
      console.error('Failed to toggle monitor state:', err);
      showToast('Failed to toggle monitor state.');
    }
  };

  const handleCheckAll = () => {
    setIsCheckingAll(true);
    monitors.forEach((m) => performMonitorCheck(m.id));
    setTimeout(() => {
      setIsCheckingAll(false);
      showToast('All active monitors check requests sent!');
    }, 800);
  };

  const selectedMonitor =
    monitors.find((m) => m.id === selectedMonitorId) || monitors[0];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#131313] text-[#e5e2e1]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#00e55b] text-[#003911] font-bold px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2 border border-[#6bff83] text-xs font-mono-code animate-bounce">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <Header
        onOpenSettings={() => showToast('Dashboard Settings coming soon!')}
        onOpenAccount={() => showToast('User Profiles coming soon!')}
        onOpenStatusPage={() => navigate('/status')}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-65px)]">
        {/* Sidebar - Always visible */}
        <Sidebar
          monitors={monitors}
          selectedMonitorId={selectedMonitorId}
          onSelectMonitor={setSelectedMonitorId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onCheckAll={handleCheckAll}
          isCheckingAll={isCheckingAll}
        />

        {/* Dynamic Route View */}
        <Routes>
          <Route
            path="/"
            element={
              selectedMonitor ? (
                selectedMonitor.type === 'SSL' ? (
                  <SslMonitorDashboard
                    monitor={selectedMonitor}
                    onEditClick={() => navigate(`/update-monitor/${selectedMonitor.id}`)}
                    onDeleteClick={handleDeleteMonitor}
                    onTogglePause={handleTogglePause}
                    onRunCheck={performMonitorCheck}
                  />
                ) : selectedMonitor.type === 'DNS' ? (
                  <DnsMonitorDashboard
                    monitor={selectedMonitor}
                    onEditClick={() => navigate(`/update-monitor/${selectedMonitor.id}`)}
                    onDeleteClick={handleDeleteMonitor}
                    onTogglePause={handleTogglePause}
                    onRunCheck={performMonitorCheck}
                  />
                ) : (
                  <DashboardMain
                    monitor={selectedMonitor}
                    onEditClick={() => navigate(`/update-monitor/${selectedMonitor.id}`)}
                    onDeleteClick={handleDeleteMonitor}
                    onTogglePause={handleTogglePause}
                    onRunCheck={performMonitorCheck}
                    onOpenCertModal={() => setIsCertModalOpen(true)}
                  />
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#131313]">
                  <span className="material-symbols-outlined text-5xl text-[#3b4b3a] mb-3">
                    monitor_heart
                  </span>
                  <h2 className="text-xl font-bold text-[#e5e2e1]">No Monitors Configured</h2>
                  <p className="text-xs text-[#b9ccb5] font-mono-code mt-1 max-w-sm">
                    Add your first service target or API endpoint to begin real-time performance tracking.
                  </p>
                  <button
                    onClick={() => navigate('/add-monitor')}
                    className="mt-4 px-5 py-2 bg-[#00e55b] text-[#003911] font-bold rounded-lg hover:bg-[#6bff83] text-xs font-mono-code transition-colors"
                  >
                    + Create Monitor
                  </button>
                </div>
              )
            }
          />
          <Route
            path="/add-monitor"
            element={<AddMonitorPage onAddMonitor={handleAddMonitor} config={config} />}
          />
          <Route
            path="/update-monitor"
            element={
              <UpdateMonitorPage
                monitors={monitors}
                onSaveMonitor={handleEditSave}
                onDeleteMonitor={handleDeleteMonitor}
                config={config}
              />
            }
          />
          <Route
            path="/update-monitor/:id"
            element={
              <UpdateMonitorPage
                monitors={monitors}
                onSaveMonitor={handleEditSave}
                onDeleteMonitor={handleDeleteMonitor}
                config={config}
              />
            }
          />
          <Route
            path="/status"
            element={<PublicStatusPage monitors={monitors} />}
          />
          <Route
            path="/status-page"
            element={<PublicStatusPage monitors={monitors} />}
          />
        </Routes>
      </div>

      {/* Modals */}
      <SSLCertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certInfo={selectedMonitor?.certInfo}
        monitorName={selectedMonitor?.name || ''}
        monitorUrl={selectedMonitor?.url || ''}
      />

    </div>
  );
}
