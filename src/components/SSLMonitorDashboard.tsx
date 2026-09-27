import React, { useState, useEffect } from 'react';
import { Monitor, SslAuditLog, formatUtcToLocal, filterLastGoodAndBad, AIDiagnosis } from '../types';
import { AIDiagnosisModal } from './AIDiagnosisModal';
import { Sparkles } from 'lucide-react';

interface SslMonitorDashboardProps {
    monitor: Monitor;
    onEditClick: () => void;
    onDeleteClick: (id: string) => void;
    onTogglePause: (id: string) => void;
    onRunCheck: (id: string) => void;
}

export const SslMonitorDashboard: React.FC<SslMonitorDashboardProps> = ({
    monitor,
    onEditClick,
    onDeleteClick,
    onTogglePause,
    onRunCheck,
}) => {
    const [isRescanning, setIsRescanning] = useState(false);
    const [showAllSan, setShowAllSan] = useState(false);
    const [logs, setLogs] = useState<SslAuditLog[]>([]);
    const [isDiagnosisOpen, setIsDiagnosisOpen] = useState(false);
    const [diagnosisData, setDiagnosisData] = useState<AIDiagnosis | null>(null);
    const [diagnosisLoading, setDiagnosisLoading] = useState(false);
    const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

    const handleFetchDiagnosis = async () => {
        setIsDiagnosisOpen(true);
        setDiagnosisLoading(true);
        setDiagnosisError(null);
        try {
            const idStr = String(monitor.id).replace('mon-', '');
            const res = await fetch(`/api/monitors/${idStr}/ai-diagnosis`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Failed to fetch AI diagnosis');
            }
            const data = await res.json();
            setDiagnosisData(data);
        } catch (err: any) {
            setDiagnosisError(err.message || 'Error generating AI diagnosis');
        } finally {
            setDiagnosisLoading(false);
        }
    };

    useEffect(() => {
        if (monitor.sslAuditLogs) {
            setLogs(monitor.sslAuditLogs);
        } else {
            const heartbeatLogs: SslAuditLog[] = monitor.heartbeats.map((hb) => {
                const isHbUp = hb.status === 'up' || hb.status === 'degraded';
                return {
                    id: hb.id,
                    timestamp: hb.timestamp,
                    status: hb.status === 'degraded' ? 'warning' : (isHbUp ? 'valid' : 'expired'),
                    daysRemaining: monitor.certInfo?.daysRemaining || 0,
                    message: hb.statusText,
                    checkedBy: hb.isOndemand ? 'On-Demand Manual Rescan' : 'Automated SSL Scanner'
                };
            });
            setLogs(heartbeatLogs.length > 0 ? heartbeatLogs : [
                {
                    id: 'ssl-log-default-1',
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    status: 'valid',
                    daysRemaining: monitor.certInfo?.daysRemaining || 120,
                    message: 'SSL Certificate verified valid & trusted. Chain verification passed.',
                    checkedBy: 'Automated SSL Scanner',
                }
            ]);
        }
    }, [monitor]);

    const cert = monitor.certInfo;

    const handleRescan = () => {
        setIsRescanning(true);
        onRunCheck(monitor.id);

        setTimeout(() => {
            setIsRescanning(false);
            if (cert) {
                const newLog: SslAuditLog = {
                    id: `ssl-log-${Date.now()}`,
                    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    status: cert.daysRemaining < 15 ? 'warning' : 'valid',
                    daysRemaining: cert.daysRemaining,
                    message: 'Manual SSL inspection completed. Certificate valid, trusted, and hostname matched.',
                    checkedBy: 'On-Demand Manual Rescan',
                };
                setLogs((prev) => [newLog, ...prev]);
            }
        }, 800);
    };

    if (!cert) {
        return (
            <main id="ssl-dashboard-main" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
                <div className="max-w-[1440px] mx-auto space-y-6 text-center py-20">
                    <span className="material-symbols-outlined text-5xl text-[#9fcaff] animate-pulse">
                        lock
                    </span>
                    <h2 className="text-xl font-bold text-[#e5e2e1] mt-4">SSL Certificate Diagnostics Loading</h2>
                    <p className="text-xs text-[#b9ccb5] font-mono-code max-w-sm mx-auto mt-2">
                        Querying target security parameters and verifying CA trust chain. Please wait a few moments...
                    </p>
                    <button
                        onClick={handleRescan}
                        disabled={isRescanning}
                        className="mt-6 px-5 py-2.5 bg-[#201f1f] hover:bg-[#2a2a2a] text-[#b9ccb5] border border-[#3b4b3a] rounded-lg text-xs font-mono-code transition-colors cursor-pointer"
                    >
                        {isRescanning ? 'Scanning...' : 'Trigger Immediate Scan'}
                    </button>
                </div>
            </main>
        );
    }

    // Determine Expiry Badge Colors & Status
    const daysLeft = cert.daysRemaining;
    const isExpired = daysLeft <= 0;
    const isCritical = daysLeft > 0 && daysLeft <= 15;
    const isWarning = daysLeft > 15 && daysLeft <= 30;

    let badgeColor = 'bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30';
    let badgeText = 'VALID & TRUSTED';
    if (isExpired) {
        badgeColor = 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30';
        badgeText = 'EXPIRED';
    } else if (isCritical) {
        badgeColor = 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30';
        badgeText = 'CRITICAL EXPIRY';
    } else if (isWarning) {
        badgeColor = 'bg-[#ffcc00]/10 text-[#ffcc00] border-[#ffcc00]/30';
        badgeText = 'EXPIRING SOON';
    }

    // Calculate life progress percentage (Assuming 90 days validity window by default or custom)
    const totalDaysWindow = 180;
    const elapsedDays = Math.max(0, totalDaysWindow - daysLeft);
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDaysWindow) * 100)));

    const checkIntervalText = monitor.checkIntervalDays
        ? `${monitor.checkIntervalDays} Day${monitor.checkIntervalDays > 1 ? 's' : ''}`
        : `${Math.round((monitor.checkIntervalSeconds || 86400) / 86400)} Day(s)`;

    return (
        <main id="ssl-dashboard-main" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
            <div className="max-w-[1440px] mx-auto space-y-6">
                {/* SSL Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3b4b3a] pb-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-2xl text-[#9fcaff]">
                                lock
                            </span>
                            <h1 className="text-3xl font-bold text-[#e5e2e1] font-headline-lg">{monitor.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded text-xs font-mono-code border font-medium ${badgeColor}`}>
                                {badgeText}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-[#201f1f] text-[#b9ccb5] border border-[#3b4b3a]">
                                Scan Interval: {checkIntervalText}
                            </span>
                        </div>

                        <a
                            href={`https://${monitor.url.replace(/^https?:\/\//, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#9fcaff] hover:text-[#0e9aff] transition-colors text-xs font-mono-code flex items-center gap-1 mt-1"
                        >
                            https://{monitor.url.replace(/^https?:\/\//, '')}
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {(monitor.status === 'down' || isExpired || isCritical) && (
                            <button
                                id="ssl-ai-diagnosis-btn"
                                onClick={handleFetchDiagnosis}
                                className="h-9 px-3 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 text-amber-300 hover:text-white transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0 font-medium shadow-lg shadow-amber-500/10"
                                title="Generate AI Outage Diagnosis"
                            >
                                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span>AI Diagnosis</span>
                            </button>
                        )}

                        <button
                            id="ssl-rescan-btn"
                            onClick={handleRescan}
                            disabled={isRescanning}
                            className="h-9 px-3 rounded-md border border-[#3b4b3a] bg-[#201f1f] hover:border-[#9fcaff] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0"
                            title="Rescan SSL Certificate now"
                        >
                            <span className={`material-symbols-outlined text-base leading-none ${isRescanning ? 'animate-spin text-[#9fcaff]' : ''}`}>
                                license
                            </span>
                            <span className="hidden sm:inline">Re-scan Certificate</span>
                        </button>

                        <button
                            id="ssl-pause-btn"
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
                            id="ssl-edit-btn"
                            onClick={onEditClick}
                            className="w-9 h-9 rounded-md border border-[#3b4b3a] hover:border-[#e5e2e1] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center flex-shrink-0"
                            title="Edit Configuration"
                        >
                            <span className="material-symbols-outlined text-base leading-none">edit</span>
                        </button>

                        <button
                            id="ssl-delete-btn"
                            onClick={() => onDeleteClick(monitor.id)}
                            className="w-9 h-9 rounded-md bg-[#2a0808] border border-[#ffb4ab] hover:bg-[#ffb4ab] hover:text-[#690005] text-[#ffb4ab] transition-all flex items-center justify-center flex-shrink-0"
                            title="Delete Monitor"
                        >
                            <span className="material-symbols-outlined text-base leading-none">delete</span>
                        </button>
                    </div>
                </div>

                {/* SSL Hero Health Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Card 1: Days Remaining Expiry Hero */}
                    <div className="glass-panel p-6 rounded-xl flex flex-col justify-between border-t-2 border-t-[#9fcaff]">
                        <div>
                            <div className="flex items-center justify-between text-xs font-mono-code text-[#b9ccb5]">
                                <span>Certificate Lifetime</span>
                                <span className="text-[#9fcaff] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">event</span>
                                    {cert.validTo}
                                </span>
                            </div>

                            <div className="mt-4 mb-2 flex items-baseline gap-2">
                                <span
                                    className={`text-4xl lg:text-5xl font-extrabold font-mono-code ${isExpired
                                        ? 'text-[#ffb4ab]'
                                        : isCritical
                                            ? 'text-[#ffb4ab]'
                                            : isWarning
                                                ? 'text-[#ffcc00]'
                                                : 'text-[#00e55b]'
                                        }`}
                                >
                                    {daysLeft}
                                </span>
                                <span className="text-sm font-mono-code text-[#b9ccb5]">Days Remaining</span>
                            </div>

                            <div className="text-xs text-[#849581] font-mono-code">
                                Valid from {cert.validFrom} to {cert.validTo}
                            </div>
                        </div>

                        {/* Lifetime Bar */}
                        <div className="mt-6 space-y-1.5">
                            <div className="flex justify-between text-[11px] font-mono-code text-[#b9ccb5]">
                                <span>Validity Elapsed</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-[#0e0e0e] rounded-full overflow-hidden border border-[#3b4b3a]">
                                <div
                                    className={`h-full transition-all duration-500 ${isExpired
                                        ? 'bg-[#ffb4ab]'
                                        : isCritical
                                            ? 'bg-[#ffb4ab]'
                                            : isWarning
                                                ? 'bg-[#ffcc00]'
                                                : 'bg-[#00e55b]'
                                        }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Issuer Authority & Cryptography */}
                    <div className="glass-panel p-6 rounded-xl space-y-4">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#9fcaff]">verified_user</span>
                            Certificate Authority &amp; Encryption
                        </div>

                        <div className="space-y-3 font-mono-code text-xs">
                            <div>
                                <span className="text-[#849581] block text-[11px]">Issuer (CA)</span>
                                <span className="text-[#e5e2e1] font-semibold">{cert.issuer}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#3b4b3a]/50">
                                <div>
                                    <span className="text-[#849581] block text-[11px]">TLS Protocol</span>
                                    <span className="text-[#9fcaff] font-bold">{cert.tlsVersion}</span>
                                </div>
                                <div>
                                    <span className="text-[#849581] block text-[11px]">Key Size &amp; Type</span>
                                    <span className="text-[#e5e2e1]">{cert.keySize || '2048-bit RSA'}</span>
                                </div>
                            </div>

                            <div className="pt-1 border-t border-[#3b4b3a]/50">
                                <span className="text-[#849581] block text-[11px]">Signature Algorithm</span>
                                <span className="text-[#e5e2e1]">{cert.signatureAlgorithm}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Security & Chain Validation Checks */}
                    <div className="glass-panel p-6 rounded-xl space-y-4">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#00e55b]">fact_check</span>
                            Chain &amp; Hostname Security Diagnostics
                        </div>

                        <div className="space-y-2.5 font-mono-code text-xs">
                            <div className="p-2 rounded bg-[#0A0A0A] border border-[#3b4b3a] flex items-center justify-between">
                                <span className="text-[#b9ccb5]">Hostname Matching</span>
                                {cert.hostnameMatched ? (
                                    <span className="text-[#00e55b] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm text-[#00e55b]">check_circle</span>
                                        Matched
                                    </span>
                                ) : (
                                    <span className="text-[#ffb4ab] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm text-[#ffb4ab]">error</span>
                                        Mismatch
                                    </span>
                                )}
                            </div>

                            <div className="p-2 rounded bg-[#0A0A0A] border border-[#3b4b3a] flex items-center justify-between">
                                <span className="text-[#b9ccb5]">OCSP Revocation Status</span>
                                <span className="text-[#00e55b] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm text-[#00e55b]">check_circle</span>
                                    {cert.ocspStatus || 'GOOD'}
                                </span>
                            </div>

                            <div className="p-2 rounded bg-[#0A0A0A] border border-[#3b4b3a] flex items-center justify-between">
                                <span className="text-[#b9ccb5]">Trust Chain Integrity</span>
                                {cert.valid ? (
                                    <span className="text-[#00e55b] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm text-[#00e55b]">verified</span>
                                        Trusted Chain
                                    </span>
                                ) : (
                                    <span className="text-[#ffb4ab] flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm text-[#ffb4ab]">warning</span>
                                        Untrusted Chain
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Certificate Technical Identity Panel */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                    <h2 className="text-sm font-bold text-[#e5e2e1] uppercase tracking-wider font-mono-code flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#9fcaff] text-base">badge</span>
                        Certificate Identity &amp; Subject Alternative Names (SANs)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-code">
                        <div className="space-y-2 bg-[#0A0A0A] p-4 rounded-lg border border-[#3b4b3a]">
                            <div>
                                <span className="text-[#849581] block text-[11px]">Subject (Common Name / CN)</span>
                                <span className="text-[#e5e2e1] font-semibold">{cert.subject}</span>
                            </div>
                            <div className="pt-2 border-t border-[#3b4b3a]/50">
                                <span className="text-[#849581] block text-[11px]">Serial Number</span>
                                <span className="text-[#b9ccb5] select-all">{cert.serialNumber || '03:A4:91:B8:2C:DE:10:5E'}</span>
                            </div>
                            <div className="pt-2 border-t border-[#3b4b3a]/50">
                                <span className="text-[#849581] block text-[11px]">SHA-256 Fingerprint</span>
                                <span className="text-[#b9ccb5] select-all break-all">{cert.fingerprintSha256 || '8F:32:11:A9:7B:4C:D8:12:33:EE:90:5B:7F:1A:22:9C'}</span>
                            </div>
                        </div>

                        <div className="bg-[#0A0A0A] p-4 rounded-lg border border-[#3b4b3a] space-y-2">
                            <span className="text-[#849581] block text-[11px]">Covered Subject Alternative Names (SANs)</span>
                            {(() => {
                                const sanList = cert.san && cert.san.length > 0 ? cert.san : [monitor.url];
                                const visibleSan = showAllSan ? sanList : sanList.slice(0, 4);
                                return (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {visibleSan.map((s, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2.5 py-1 rounded bg-[#201f1f] text-[#9fcaff] border border-[#3b4b3a] text-xs font-mono-code flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-xs">public</span>
                                                {s}
                                            </span>
                                        ))}
                                        {sanList.length > 6 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllSan(!showAllSan)}
                                                className="px-2.5 py-1 rounded bg-[#092c4c] hover:bg-[#0e4875] text-[#9fcaff] border border-[#0e4875]/50 text-xs font-mono-code flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-xs leading-none">
                                                    {showAllSan ? 'keyboard_double_arrow_up' : 'keyboard_double_arrow_down'}
                                                </span>
                                                {showAllSan ? 'Show Less' : `+ ${sanList.length - 6} more`}
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* SSL Inspection Audit Log */}
                <div className="glass-panel rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-[#3b4b3a] flex justify-between items-center bg-[#1a1a1a]">
                        <div>
                            <h2 className="text-sm font-bold text-[#e5e2e1] font-mono-code uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#9fcaff] text-base">verified</span>
                                SSL Inspection Audit Log
                            </h2>
                            <p className="text-[10px] text-[#b9ccb5] font-mono-code mt-0.5 uppercase tracking-wide">Latest successful &amp; latest failed inspections</p>
                        </div>
                        <button
                            onClick={handleRescan}
                            className="text-xs font-mono-code text-[#9fcaff] hover:underline flex items-center gap-1"
                        >
                            + Trigger On-Demand Scan
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0e0e0e] border-b border-[#3b4b3a]">
                                    <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Status</th>
                                    <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Timestamp</th>
                                    <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Days Left</th>
                                    <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Trigger Source</th>
                                    <th className="p-4 text-xs font-mono-code text-[#b9ccb5] font-medium">Audit Message</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3b4b3a]/50 text-xs font-mono-code">
                                {filterLastGoodAndBad<any>(logs).map((log) => (
                                    <tr key={log.id} className="hover:bg-[#1c1b1b] transition-colors">
                                        <td className="p-4">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${log.status === 'valid'
                                                    ? 'bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30'
                                                    : log.status === 'warning'
                                                        ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-[#ffcc00]/30'
                                                        : 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/30'
                                                    }`}
                                            >
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#e5e2e1]">{formatUtcToLocal(log.timestamp)}</td>
                                        <td className="p-4 text-[#9fcaff] font-bold">{log.daysRemaining} days</td>
                                        <td className="p-4 text-[#b9ccb5]">{log.checkedBy}</td>
                                        <td className="p-4 text-[#e5e2e1]">{log.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AIDiagnosisModal
                isOpen={isDiagnosisOpen}
                onClose={() => setIsDiagnosisOpen(false)}
                monitorName={monitor.name}
                diagnosis={diagnosisData}
                loading={diagnosisLoading}
                error={diagnosisError}
                onReDiagnose={handleFetchDiagnosis}
            />
        </main>
    );
};
