import React, { useState } from 'react';
import { Monitor, DnsChainNode, DnsRecordItem, DnsTraceInfo, AIDiagnosis } from '../types';
import { AIDiagnosisModal } from './AIDiagnosisModal';
import { Sparkles } from 'lucide-react';

interface DnsMonitorDashboardProps {
    monitor: Monitor;
    onEditClick: () => void;
    onDeleteClick: (id: string) => void;
    onTogglePause: (id: string) => void;
    onRunCheck: (id: string) => void;
}

export const DnsMonitorDashboard: React.FC<DnsMonitorDashboardProps> = ({
    monitor,
    onEditClick,
    onDeleteClick,
    onTogglePause,
    onRunCheck,
}) => {
    const [isTracing, setIsTracing] = useState(false);
    const [activeHoverNode, setActiveHoverNode] = useState<DnsChainNode | null>(null);
    const [selectedNodeModal, setSelectedNodeModal] = useState<DnsChainNode | null>(null);
    const [activeRecordFilter, setActiveRecordFilter] = useState<string>('ALL');
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

    const domainName = monitor.url.replace(/^https?:\/\//, '').split('/')[0];

    const traceData = monitor.dnsTraceInfo;

    const handleTraceNow = () => {
        setIsTracing(true);
        onRunCheck(monitor.id);
        setTimeout(() => {
            setIsTracing(false);
        }, 900);
    };

    if (!traceData) {
        return (
            <main id="dns-dashboard-main" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
                <div className="max-w-[1440px] mx-auto space-y-6 text-center py-20">
                    <span className="material-symbols-outlined text-5xl text-[#9fcaff] animate-pulse">
                        account_tree
                    </span>
                    <h2 className="text-xl font-bold text-[#e5e2e1] mt-4">DNS Resolution Path Loading</h2>
                    <p className="text-xs text-[#b9ccb5] font-mono-code max-w-sm mx-auto mt-2">
                        Querying DNS root servers, resolving TLD registry nameservers, and building the lookup hierarchy. Please wait...
                    </p>
                    <button
                        onClick={handleTraceNow}
                        disabled={isTracing}
                        className="mt-6 px-5 py-2.5 bg-[#201f1f] hover:bg-[#2a2a2a] text-[#b9ccb5] border border-[#3b4b3a] rounded-lg text-xs font-mono-code transition-colors cursor-pointer"
                    >
                        {isTracing ? 'Tracing...' : 'Trace Resolution Path Now'}
                    </button>
                </div>
            </main>
        );
    }

    const totalLatency = traceData.nodes.reduce((acc, node) => acc + node.latencyMs, 0);

    const filteredRecords = activeRecordFilter === 'ALL'
        ? traceData.records
        : traceData.records.filter((r) => r.type === activeRecordFilter);

    return (
        <main id="dns-dashboard-main" className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#131313] min-w-0">
            <div className="max-w-[1440px] mx-auto space-y-6">
                {/* DNS Monitor Top Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3b4b3a] pb-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-2xl text-[#9fcaff]">
                                account_tree
                            </span>
                            <h1 className="text-3xl font-bold text-[#e5e2e1] font-headline-lg">{monitor.name}</h1>
                            <span className="px-2.5 py-0.5 rounded text-xs font-mono-code border font-medium bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30">
                                NOERROR (AUTHORITATIVE)
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono-code bg-[#201f1f] text-[#b9ccb5] border border-[#3b4b3a]">
                                Interval: {monitor.checkIntervalSeconds || 60}s
                            </span>
                        </div>

                        <div className="text-xs font-mono-code text-[#9fcaff] flex items-center gap-2 mt-1">
                            <span>Domain: <strong className="text-[#e5e2e1]">{domainName}</strong></span>
                            <span className="text-[#3b4b3a]">|</span>
                            <span>Authoritative NS: <strong className="text-[#00e55b]">{traceData.authoritativeNs}</strong> ({traceData.authoritativeIp})</span>
                        </div>
                    </div>

                    {/* Action Header Buttons */}
                    <div className="flex items-center gap-2">
                        {(monitor.status === 'down' || monitor.status === 'degraded') && (
                            <button
                                id="dns-ai-diagnosis-btn"
                                onClick={handleFetchDiagnosis}
                                className="h-9 px-3 rounded-md border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 text-amber-300 hover:text-white transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0 font-medium shadow-lg shadow-amber-500/10"
                                title="Generate AI Outage Diagnosis"
                            >
                                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span>AI Diagnosis</span>
                            </button>
                        )}

                        <button
                            id="dns-trace-btn"
                            onClick={handleTraceNow}
                            disabled={isTracing}
                            className="h-9 px-3 rounded-md border border-[#3b4b3a] bg-[#201f1f] hover:border-[#9fcaff] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center gap-1.5 text-xs font-mono-code flex-shrink-0"
                            title="Trace full DNS resolution hierarchy"
                        >
                            <span className={`material-symbols-outlined text-base leading-none ${isTracing ? 'animate-spin text-[#9fcaff]' : ''}`}>
                                route
                            </span>
                            <span className="hidden sm:inline">Trace Resolution Path</span>
                        </button>

                        <button
                            id="dns-pause-btn"
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
                            id="dns-edit-btn"
                            onClick={onEditClick}
                            className="w-9 h-9 rounded-md border border-[#3b4b3a] hover:border-[#e5e2e1] text-[#b9ccb5] hover:text-[#e5e2e1] transition-all flex items-center justify-center flex-shrink-0"
                            title="Edit Configuration"
                        >
                            <span className="material-symbols-outlined text-base leading-none">edit</span>
                        </button>

                        <button
                            id="dns-delete-btn"
                            onClick={() => onDeleteClick(monitor.id)}
                            className="w-9 h-9 rounded-md bg-[#2a0808] border border-[#ffb4ab] hover:bg-[#ffb4ab] hover:text-[#690005] text-[#ffb4ab] transition-all flex items-center justify-center flex-shrink-0"
                            title="Delete Monitor"
                        >
                            <span className="material-symbols-outlined text-base leading-none">delete</span>
                        </button>
                    </div>
                </div>

                {/* DNS Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-panel p-5 rounded-xl border-t-2 border-t-[#9fcaff]">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase">Total Resolution Hops</div>
                        <div className="text-2xl font-bold font-mono-code text-[#e5e2e1] mt-2 flex items-baseline gap-1">
                            {traceData.nodes.length} <span className="text-xs font-normal text-[#849581]">Server Nodes</span>
                        </div>
                        <div className="text-[11px] font-mono-code text-[#00e55b] mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Root &rarr; TLD &rarr; Auth NS
                        </div>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border-t-2 border-t-[#00e55b]">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase">Total Trace Latency</div>
                        <div className="text-2xl font-bold font-mono-code text-[#00e55b] mt-2 flex items-baseline gap-1">
                            {totalLatency} <span className="text-xs font-normal text-[#849581]">ms</span>
                        </div>
                        <div className="text-[11px] font-mono-code text-[#b9ccb5] mt-1">
                            Sum of recursive lookup steps
                        </div>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border-t-2 border-t-[#9fcaff]">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase">DNSSEC Validation</div>
                        <div className="text-2xl font-bold font-mono-code text-[#9fcaff] mt-2 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xl text-[#00e55b]">verified</span>
                            VALIDATED
                        </div>
                        <div className="text-[11px] font-mono-code text-[#b9ccb5] mt-1">
                            RRSIG &amp; DNSKEY chain signed
                        </div>
                    </div>

                    <div className="glass-panel p-5 rounded-xl border-t-2 border-t-[#ffcc00]">
                        <div className="text-xs font-mono-code text-[#b9ccb5] uppercase">Active Records Discovered</div>
                        <div className="text-2xl font-bold font-mono-code text-[#e5e2e1] mt-2 flex items-baseline gap-1">
                            {traceData.records.length} <span className="text-xs font-normal text-[#849581]">Records</span>
                        </div>
                        <div className="text-[11px] font-mono-code text-[#b9ccb5] mt-1">
                            A, AAAA, MX, NS, TXT, SOA
                        </div>
                    </div>
                </div>

                {/* DNS RESOLUTION PATH VISUALIZER */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#3b4b3a] pb-4">
                        <div>
                            <div className="text-xs font-mono-code text-[#9fcaff] uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">hub</span>
                                Hierarchical Domain NameServer Lookup Path
                            </div>
                            <h2 className="text-xl font-bold text-[#e5e2e1] font-headline-sm mt-0.5">
                                Iterative Resolution Flow: Root &rarr; TLD &rarr; Authoritative
                            </h2>
                        </div>
                        <div className="text-[11px] font-mono-code text-[#849581] flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs text-[#9fcaff]">info</span>
                            Hover server boxes for instant metadata, or click for full payload details.
                        </div>
                    </div>

                    {/* Interactive Server Chain Nodes Flow */}
                    <div className="relative py-4">
                        {/* Horizontal flow line for wide screens */}
                        <div className="hidden lg:block absolute top-[50%] left-8 right-8 h-1 bg-[#3b4b3a]/60 -translate-y-1/2 z-0" />

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                            {traceData.nodes.map((node, idx) => {
                                const levelColor =
                                    node.level === 'Root Server'
                                        ? 'border-[#9fcaff] bg-[#001d36]/80 text-[#9fcaff]'
                                        : node.level === 'TLD Server'
                                            ? 'border-[#ffcc00] bg-[#332a00]/80 text-[#ffcc00]'
                                            : node.level === 'Authoritative NS'
                                                ? 'border-[#00e55b] bg-[#00280b]/80 text-[#00e55b]'
                                                : 'border-[#d2e4ff] bg-[#1a2333]/80 text-[#e5e2e1]';

                                const levelBadge =
                                    node.level === 'Root Server'
                                        ? 'ROOT ZONE (.)'
                                        : node.level === 'TLD Server'
                                            ? 'TLD (.COM)'
                                            : node.level === 'Authoritative NS'
                                                ? 'AUTHORITATIVE (AA)'
                                                : 'TARGET RECORD';

                                return (
                                    <div key={node.id} className="relative flex flex-col items-center group">
                                        {/* Main Server Box */}
                                        <div
                                            onClick={() => setSelectedNodeModal(node)}
                                            onMouseEnter={() => setActiveHoverNode(node)}
                                            onMouseLeave={() => setActiveHoverNode(null)}
                                            className={`w-full p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer shadow-lg hover:scale-[1.02] ${levelColor} relative`}
                                        >
                                            {/* Step Indicator Pill */}
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-mono-code font-bold uppercase tracking-wider bg-black/40 border border-white/10">
                                                    Step {idx + 1}: {levelBadge}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-[#00e55b]/20 text-[#00e55b] border border-[#00e55b]/30">
                                                    {node.latencyMs} ms
                                                </span>
                                            </div>

                                            {/* Server Name & IP */}
                                            <div className="space-y-1">
                                                <div className="text-sm font-bold font-mono-code truncate text-[#e5e2e1]" title={node.serverName}>
                                                    {node.serverName}
                                                </div>
                                                <div className="text-xs font-mono-code text-[#b9ccb5] flex items-center justify-between">
                                                    <span>IP: {node.serverIp}</span>
                                                    <span className="text-[10px] text-[#00e55b] font-bold">{node.status}</span>
                                                </div>
                                            </div>

                                            {/* Operator & Location */}
                                            <div className="mt-3 pt-3 border-t border-white/10 text-[11px] font-mono-code text-[#b9ccb5] space-y-1">
                                                <div className="truncate text-white/90">
                                                    <strong className="text-white/60">Operator:</strong> {node.operator}
                                                </div>
                                                <div className="truncate text-white/80">
                                                    <strong className="text-white/60">Location:</strong> {node.location}
                                                </div>
                                            </div>

                                            {/* Hover Tooltip Overlay card preview */}
                                            {activeHoverNode?.id === node.id && (
                                                <div className="absolute -bottom-2 translate-y-full left-0 right-0 z-30 p-3 rounded-lg bg-[#0A0A0A] border border-[#9fcaff] shadow-2xl text-xs font-mono-code text-[#e5e2e1] space-y-1.5 pointer-events-none">
                                                    <div className="text-[#9fcaff] font-bold flex items-center justify-between">
                                                        <span>{node.serverName}</span>
                                                        <span className="text-[10px] text-[#00e55b]">Click for Details</span>
                                                    </div>
                                                    <div className="text-[11px] text-[#b9ccb5]">{node.queryDetails}</div>
                                                    <div className="flex items-center gap-1 text-[10px] text-[#849581]">
                                                        <span>Flags:</span>
                                                        {node.responseFlags.map((f, i) => (
                                                            <span key={i} className="px-1 bg-[#201f1f] text-[#9fcaff] rounded border border-[#3b4b3a]">
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Down/Right Arrow Connectors */}
                                        {idx < traceData.nodes.length - 1 && (
                                            <div className="my-3 lg:my-0 lg:absolute lg:-right-5 lg:top-1/2 lg:-translate-y-1/2 z-20 flex flex-col lg:flex-row items-center justify-center text-[#9fcaff]">
                                                <span className="material-symbols-outlined text-2xl lg:text-3xl rotate-90 lg:rotate-0 animate-pulse">
                                                    arrow_forward
                                                </span>
                                            </div>
                                        )}

                                        {/* Step Referral Descriptor under box */}
                                        <div className="mt-3 text-center text-[11px] font-mono-code text-[#b9ccb5] px-2 max-w-xs">
                                            <span className="text-[#849581]">Referral:</span> {node.referralTo}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* DNS Record Lookup Section & Filters */}
                <div className="glass-panel rounded-xl overflow-hidden space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3b4b3a] pb-4">
                        <div>
                            <h2 className="text-sm font-bold text-[#e5e2e1] font-mono-code uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#00e55b] text-base">dns</span>
                                Authoritative Record Set Discovered ({traceData.records.length} Records)
                            </h2>
                            <p className="text-xs text-[#b9ccb5] font-mono-code mt-0.5">
                                Query answers directly served by <strong className="text-[#9fcaff]">{traceData.authoritativeNs}</strong>
                            </p>
                        </div>

                        {/* Record Filter Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            {['ALL', 'A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveRecordFilter(filter)}
                                    className={`px-3 py-1 rounded-md text-xs font-mono-code transition-all ${activeRecordFilter === filter
                                        ? 'bg-[#00e55b] text-[#003911] font-bold'
                                        : 'bg-[#201f1f] text-[#b9ccb5] hover:text-[#e5e2e1] border border-[#3b4b3a]'
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Records Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0e0e0e] border-b border-[#3b4b3a]">
                                    <th className="p-3 text-xs font-mono-code text-[#b9ccb5] font-medium">Type</th>
                                    <th className="p-3 text-xs font-mono-code text-[#b9ccb5] font-medium">Domain Name</th>
                                    <th className="p-3 text-xs font-mono-code text-[#b9ccb5] font-medium">Value / Target</th>
                                    <th className="p-3 text-xs font-mono-code text-[#b9ccb5] font-medium">TTL (sec)</th>
                                    <th className="p-3 text-xs font-mono-code text-[#b9ccb5] font-medium text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#3b4b3a]/50 text-xs font-mono-code">
                                {filteredRecords.map((rec, i) => (
                                    <tr key={i} className="hover:bg-[#1c1b1b] transition-colors">
                                        <td className="p-3">
                                            <span
                                                className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${rec.type === 'A' || rec.type === 'AAAA'
                                                    ? 'bg-[#00e55b]/10 text-[#00e55b] border-[#00e55b]/30'
                                                    : rec.type === 'MX'
                                                        ? 'bg-[#ffcc00]/10 text-[#ffcc00] border-[#ffcc00]/30'
                                                        : rec.type === 'NS'
                                                            ? 'bg-[#9fcaff]/10 text-[#9fcaff] border-[#9fcaff]/30'
                                                            : 'bg-[#201f1f] text-[#e5e2e1] border-[#3b4b3a]'
                                                    }`}
                                            >
                                                {rec.type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-[#e5e2e1] font-semibold">{rec.name}</td>
                                        <td className="p-3 text-[#9fcaff] font-mono-code select-all break-all">{rec.value}</td>
                                        <td className="p-3 text-[#b9ccb5]">{rec.ttl}s</td>
                                        <td className="p-3 text-right">
                                            <span className="text-[#00e55b] text-[11px] font-bold">ACTIVE</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DETAILED SERVER NODE INSPECTOR MODAL */}
            {selectedNodeModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#181818] border border-[#3b4b3a] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-[#3b4b3a] pb-4">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-2xl text-[#9fcaff]">dns</span>
                                <div>
                                    <div className="text-xs font-mono-code text-[#9fcaff] font-bold uppercase">
                                        {selectedNodeModal.level} Detailed Inspection
                                    </div>
                                    <h3 className="text-lg font-bold text-[#e5e2e1] font-headline-sm">
                                        {selectedNodeModal.serverName}
                                    </h3>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedNodeModal(null)}
                                className="w-8 h-8 rounded-lg bg-[#201f1f] hover:bg-[#2a2a2a] text-[#b9ccb5] hover:text-[#e5e2e1] flex items-center justify-center border border-[#3b4b3a] transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg leading-none">close</span>
                            </button>
                        </div>

                        <div className="space-y-4 text-xs font-mono-code">
                            <div className="grid grid-cols-2 gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-[#3b4b3a]">
                                <div>
                                    <span className="text-[#849581] block text-[11px]">Server IP Address</span>
                                    <span className="text-[#e5e2e1] font-bold text-sm">{selectedNodeModal.serverIp}</span>
                                </div>

                                <div>
                                    <span className="text-[#849581] block text-[11px]">Response Latency</span>
                                    <span className="text-[#00e55b] font-bold text-sm">{selectedNodeModal.latencyMs} ms</span>
                                </div>

                                <div>
                                    <span className="text-[#849581] block text-[11px]">Operator Organization</span>
                                    <span className="text-[#e5e2e1]">{selectedNodeModal.operator}</span>
                                </div>

                                <div>
                                    <span className="text-[#849581] block text-[11px]">Server Location</span>
                                    <span className="text-[#e5e2e1]">{selectedNodeModal.location}</span>
                                </div>
                            </div>

                            <div className="space-y-2 bg-[#0A0A0A] p-4 rounded-xl border border-[#3b4b3a]">
                                <div className="text-[#9fcaff] font-bold">Query Execution Payload</div>
                                <div className="p-3 bg-[#131313] rounded border border-[#3b4b3a] text-[#b9ccb5] font-mono-code break-all">
                                    {selectedNodeModal.queryDetails}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-[#0A0A0A] p-4 rounded-xl border border-[#3b4b3a]">
                                <div>
                                    <span className="text-[#849581] block text-[11px]">Response Header Flags</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {selectedNodeModal.responseFlags.map((flag, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-[#201f1f] text-[#9fcaff] rounded border border-[#3b4b3a] font-bold">
                                                {flag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-[#849581] block text-[11px]">DNS Protocol</span>
                                    <span className="text-[#e5e2e1] font-bold">{selectedNodeModal.protocol || 'UDP 53'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-[#3b4b3a]">
                            <button
                                onClick={() => setSelectedNodeModal(null)}
                                className="px-5 py-2.5 bg-[#9fcaff] text-[#001d36] hover:bg-[#d2e4ff] font-bold text-xs font-mono-code rounded-lg transition-all"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
