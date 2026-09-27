import React from 'react';
import { Sparkles, X, AlertTriangle, CheckCircle2, HelpCircle, Loader2, ArrowRight } from 'lucide-react';
import { AIDiagnosis } from '../types';

interface AIDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  monitorName: string;
  diagnosis: AIDiagnosis | null;
  loading: boolean;
  error: string | null;
  onReDiagnose?: () => void;
}

export const AIDiagnosisModal: React.FC<AIDiagnosisModalProps> = ({
  isOpen,
  onClose,
  monitorName,
  diagnosis,
  loading,
  error,
  onReDiagnose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#141210]/95 border border-[#3b342e] shadow-2xl text-[#e5e2e1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-500" />
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2420]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                AI Outage Diagnosis
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Beta
                </span>
              </h3>
              <p className="text-xs text-[#b0a8a0]">
                Root cause analysis for <span className="text-white font-medium">{monitorName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#b0a8a0] hover:text-white hover:bg-[#2a2420] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-400 absolute animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Analyzing Outage Context...</p>
                <p className="text-xs text-[#b0a8a0] mt-1">Inspecting error message, status codes, and server reachability</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm">Diagnosis Failed</h4>
                <p className="text-xs text-rose-300/80 mt-1">{error}</p>
                {onReDiagnose && (
                  <button
                    onClick={onReDiagnose}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900 text-white font-medium transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          ) : diagnosis ? (
            <>
              {/* Summary Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1c1815] to-[#25201b] border border-[#3b342e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#b0a8a0] flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-400" /> Issue Summary
                  </span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase font-mono ${
                    diagnosis.severity === 'CRITICAL' 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : diagnosis.severity === 'WARNING'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {diagnosis.severity}
                  </span>
                </div>
                <p className="text-sm text-white font-medium leading-relaxed">
                  {diagnosis.summary}
                </p>
              </div>

              {/* Likely Root Causes */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-bold text-[#b0a8a0] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Likely Root Causes
                </h4>
                <div className="space-y-2">
                  {diagnosis.likely_causes.map((cause, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-3 rounded-xl bg-[#1a1714] border border-[#2e2823] text-sm text-[#e5e2e1]"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 font-mono text-xs shrink-0 mt-0.5 font-bold">
                        {idx + 1}
                      </span>
                      <span>{cause}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Action Plan */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-bold text-[#b0a8a0] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Recommended Action Plan
                </h4>
                <div className="space-y-2">
                  {diagnosis.recommended_actions.map((action, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-start gap-3 p-3 rounded-xl bg-[#1a1714] border border-[#2e2823] text-sm text-[#e5e2e1]"
                    >
                      <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-xs md:text-sm text-[#d4cfca]">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[#2a2420] bg-[#100e0c]">
          <span className="text-xs text-[#8c827a]">Powered by Gemini SRE Diagnoser</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2a2420] hover:bg-[#38302b] text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
