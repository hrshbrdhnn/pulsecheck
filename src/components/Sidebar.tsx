import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, MonitorStatus, MonitorType, ALL_MONITOR_TYPES } from '../types';

interface SidebarProps {
  monitors: Monitor[];
  selectedMonitorId: string;
  onSelectMonitor: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (s: string) => void;
  typeFilter: string;
  onTypeFilterChange: (t: string) => void;
  onAddMonitorClick?: () => void;
  onCheckAll: () => void;
  isCheckingAll?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  monitors,
  selectedMonitorId,
  onSelectMonitor,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  onCheckAll,
  isCheckingAll = false,
}) => {
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    onSelectMonitor(id);
    navigate('/');
  };

  const handleAddClick = () => {
    navigate('/add-monitor');
  };
  // Filter logic
  const filteredMonitors = monitors.filter((m) => {
    // Search query
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.port && m.port.toString().includes(searchQuery));

    // Status filter
    const matchesStatus =
      statusFilter === 'All Statuses' ||
      m.status.toLowerCase() === statusFilter.toLowerCase();

    // Type filter
    const matchesType =
      typeFilter === 'All Types' ||
      m.type.toLowerCase() === typeFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusDotClass = (status: MonitorStatus) => {
    switch (status) {
      case 'up':
        return 'bg-[#00e55b] status-glow-up';
      case 'down':
        return 'bg-[#ffb4ab] status-glow-down';
      case 'degraded':
        return 'bg-[#ffcc00] status-glow-degraded';
      case 'paused':
        return 'bg-[#666666]';
      default:
        return 'bg-[#666666]';
    }
  };

  return (
    <aside
      id="sidebar-container"
      className="w-full lg:w-[320px] border-r border-[#3b4b3a] bg-[#0e0e0e] flex flex-col flex-shrink-0 h-full overflow-hidden"
    >
      {/* Filters & Search */}
      <div className="p-4 border-b border-[#3b4b3a] space-y-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#b9ccb5] text-sm">
            search
          </span>
          <input
            id="sidebar-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search monitors..."
            className="w-full bg-[#0A0A0A] border border-[#3b4b3a] rounded-md py-2 pl-9 pr-3 text-sm text-[#e5e2e1] focus:border-[#00e55b] focus:outline-none focus:ring-1 focus:ring-[#00e55b] transition-all font-body-md"
          />
        </div>

        <div className="flex gap-2">
          <select
            id="sidebar-status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="bg-[#0A0A0A] border border-[#3b4b3a] rounded-md py-1.5 px-3 text-xs font-mono-code text-[#b9ccb5] flex-1 appearance-none focus:border-[#9fcaff] focus:outline-none cursor-pointer"
          >
            <option>All Statuses</option>
            <option>Up</option>
            <option>Down</option>
            <option>Degraded</option>
            <option>Paused</option>
          </select>

          <select
            id="sidebar-type-filter"
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="bg-[#0A0A0A] border border-[#3b4b3a] rounded-md py-1.5 px-3 text-xs font-mono-code text-[#b9ccb5] flex-1 appearance-none focus:border-[#9fcaff] focus:outline-none cursor-pointer"
          >
            <option value="All Types">All Types</option>
            {ALL_MONITOR_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-mono-code text-[#b9ccb5]">
            {filteredMonitors.length} {filteredMonitors.length === 1 ? 'Monitor' : 'Monitors'}
          </span>
          <button
            id="sidebar-refresh-all-btn"
            onClick={onCheckAll}
            disabled={isCheckingAll}
            className="text-xs font-mono-code text-[#9fcaff] hover:text-[#edffe8] flex items-center gap-1 disabled:opacity-50"
            title="Ping all monitors now"
          >
            <span className={`material-symbols-outlined text-xs ${isCheckingAll ? 'animate-spin' : ''}`}>
              refresh
            </span>
            {isCheckingAll ? 'Checking...' : 'Check All'}
          </button>
        </div>
      </div>

      {/* Monitor List */}
      <div id="sidebar-monitor-list" className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredMonitors.length === 0 ? (
          <div className="text-center py-8 text-[#b9ccb5] text-xs font-mono-code">
            <p>No monitors found matching filters.</p>
            <button
              onClick={handleAddClick}
              className="mt-3 px-3 py-1.5 bg-[#201f1f] hover:bg-[#2a2a2a] text-[#00e55b] border border-[#00e55b]/30 rounded text-xs transition-colors"
            >
              + Add New Monitor
            </button>
          </div>
        ) : (
          filteredMonitors.map((m) => {
            const isSelected = selectedMonitorId === m.id;

            return (
              <button
                key={m.id}
                id={`monitor-item-${m.id}`}
                onClick={() => handleSelect(m.id)}
                className={`w-full text-left rounded-lg p-3 transition-colors group relative overflow-hidden border ${isSelected
                  ? 'bg-[#2a2a2a] border-[#849581]'
                  : 'bg-[#1c1b1b] border-transparent hover:bg-[#2a2a2a] hover:border-[#3b4b3a]'
                  }`}
              >
                {/* Active Indicator Bar on left edge */}
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00e55b]"></div>
                )}

                <div className="flex items-center gap-3">
                  {/* Status LED Dot */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusDotClass(m.status)}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#e5e2e1] flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{m.name}</span>
                      <span className="inline-flex items-center px-1 rounded text-[8px] font-bold bg-[#9fcaff]/10 border border-[#9fcaff]/20 text-[#9fcaff] uppercase tracking-wide scale-90 flex-shrink-0">
                        {m.type === 'HTTP(s)' ? 'HTTP' : m.type === 'Ping' ? 'ICMP' : m.type === 'Port' ? 'TCP' : m.type}
                      </span>
                    </div>
                    <div className="text-xs font-mono-code text-[#9fcaff] truncate">
                      {m.type === 'Port' && m.port ? (
                        <>
                          {m.url}<span className="font-bold">:{m.port}</span>
                        </>
                      ) : (
                        m.url
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="text-right flex-shrink-0">
                    {m.status === 'down' ? (
                      <div className="text-xs font-mono-code text-[#ffb4ab] font-semibold">DOWN</div>
                    ) : m.status === 'paused' ? (
                      <div className="text-xs font-mono-code text-[#666666]">PAUSED</div>
                    ) : (
                      <>
                        <div className="text-xs font-mono-code text-[#b9ccb5]">{m.uptime24h}%</div>
                        <div className="text-xs font-mono-code text-[#b9ccb5]">{m.currentResponseMs}ms</div>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add Monitor Quick Bar */}
      <div className="p-3 border-t border-[#3b4b3a] bg-[#131313]">
        <button
          id="sidebar-add-monitor-footer-btn"
          onClick={handleAddClick}
          className="w-full py-2 px-3 bg-[#201f1f] hover:bg-[#2a2a2a] border border-[#3b4b3a] rounded-md text-xs font-mono-code text-[#e5e2e1] flex items-center justify-center gap-2 transition-all hover:border-[#00e55b]"
        >
          <span className="material-symbols-outlined text-sm text-[#00e55b]">add_circle</span>
          Add New Monitor
        </button>
      </div>
    </aside>
  );
};
