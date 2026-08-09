import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onOpenStatusPage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenAccount,
  onOpenStatusPage,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === '/';
  const isAddMonitor = location.pathname === '/add-monitor';
  const isStatusPage = location.pathname === '/status';

  return (
    <header id="app-header" className="bg-[#131313] border-b border-[#3b4b3a] sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-6 py-4 max-w-[1440px] mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-[#00e55b] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            monitor_heart
          </span>
          <span className="text-2xl font-bold text-[#00e55b] tracking-tight">PulseCheck</span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            id="nav-home-btn"
            onClick={() => navigate('/')}
            className={`font-label-md text-xs font-mono-code transition-colors pb-1 ${isHome
              ? 'text-[#00e55b] font-bold border-b-2 border-[#00e55b]'
              : 'text-[#b9ccb5] font-medium hover:text-[#edffe8]'
              }`}
          >
            Home
          </button>
          <button
            id="nav-add-monitor-btn"
            onClick={() => navigate('/add-monitor')}
            className={`font-label-md text-xs font-mono-code transition-colors pb-1 ${isAddMonitor
              ? 'text-[#00e55b] font-bold border-b-2 border-[#00e55b]'
              : 'text-[#b9ccb5] font-medium hover:text-[#edffe8]'
              }`}
          >
            Add Monitor
          </button>
          <button
            id="nav-status-page-btn"
            onClick={() => navigate('/status')}
            className={`font-label-md text-xs font-mono-code transition-colors pb-1 flex items-center gap-1 ${isStatusPage
              ? 'text-[#00e55b] font-bold border-b-2 border-[#00e55b]'
              : 'text-[#b9ccb5] font-medium hover:text-[#edffe8]'
              }`}
          >
            Public Status Page
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            id="header-settings-btn"
            aria-label="Settings"
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#b9ccb5] hover:text-[#edffe8] hover:bg-[#201f1f] transition-colors flex-shrink-0"
            title="Dashboard Settings"
          >
            <span className="material-symbols-outlined text-xl leading-none">settings</span>
          </button>
          <button
            id="header-account-btn"
            aria-label="Account"
            onClick={onOpenAccount}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#b9ccb5] hover:text-[#edffe8] hover:bg-[#201f1f] transition-colors flex-shrink-0"
            title="User Profile"
          >
            <span className="material-symbols-outlined text-xl leading-none">account_circle</span>
          </button>
        </div>
      </div>
    </header>
  );
};

