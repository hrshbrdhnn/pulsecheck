import React from 'react';
import { CertInfo } from '../types';

interface SSLCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certInfo?: CertInfo;
  monitorName: string;
  monitorUrl: string;
}

export const SSLCertificateModal: React.FC<SSLCertificateModalProps> = ({
  isOpen,
  onClose,
  certInfo,
  monitorName,
  monitorUrl,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1c1b1b] border border-[#3b4b3a] rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-[#3b4b3a] flex items-center justify-between bg-[#131313]">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#9fcaff]">verified_user</span>
            <div>
              <h3 className="text-lg font-semibold text-[#e5e2e1]">SSL Certificate Details</h3>
              <p className="text-xs text-[#b9ccb5] font-mono-code">{monitorName} ({monitorUrl})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-[#b9ccb5] hover:text-[#e5e2e1] rounded-lg hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
            title="Close modal"
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!certInfo ? (
            <div className="text-center py-6 text-[#b9ccb5] text-sm">
              No SSL certificate info found for this monitor target.
            </div>
          ) : (
            <>
              {/* Expiry Badge */}
              <div className="bg-[#201f1f] border border-[#3b4b3a] rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono-code text-[#b9ccb5]">Days Until Expiration</div>
                  <div className="text-2xl font-bold font-mono-code text-[#9fcaff] mt-0.5">
                    {certInfo.daysRemaining} Days
                  </div>
                  <div className="text-xs text-[#849581] mt-1">Valid until {certInfo.validTo}</div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-[#00e55b]/10 border border-[#00e55b] text-[#00e55b] text-xs font-mono-code rounded-full font-medium">
                    Grade A+ (Valid)
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono-code text-[#b9ccb5]">
                  <span>Issued: {certInfo.validFrom}</span>
                  <span>Expires: {certInfo.validTo}</span>
                </div>
                <div className="w-full h-2 bg-[#0e0e0e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00e55b] to-[#9fcaff]"
                    style={{ width: `${Math.min(100, Math.max(10, (certInfo.daysRemaining / 365) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-3 pt-2 text-xs font-mono-code">
                <div className="flex justify-between py-1.5 border-b border-[#3b4b3a]/50">
                  <span className="text-[#b9ccb5]">Issuer:</span>
                  <span className="text-[#e5e2e1] font-medium text-right max-w-[240px] truncate">
                    {certInfo.issuer}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#3b4b3a]/50">
                  <span className="text-[#b9ccb5]">Subject CN:</span>
                  <span className="text-[#e5e2e1] font-medium">{certInfo.subject}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#3b4b3a]/50">
                  <span className="text-[#b9ccb5]">TLS Version:</span>
                  <span className="text-[#9fcaff]">{certInfo.tlsVersion}</span>
                </div>

                <div className="flex justify-between py-1.5 border-b border-[#3b4b3a]/50">
                  <span className="text-[#b9ccb5]">Signature Algorithm:</span>
                  <span className="text-[#e5e2e1]">{certInfo.signatureAlgorithm}</span>
                </div>

                <div className="py-1.5">
                  <span className="text-[#b9ccb5] block mb-1">SANs (Alternative Names):</span>
                  <div className="flex flex-wrap gap-1">
                    {certInfo.san.map((domain, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-[#2a2a2a] text-[#b9ccb5] rounded text-[11px] border border-[#3b4b3a]"
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3b4b3a] bg-[#131313] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#353534] text-[#e5e2e1] rounded-lg text-xs font-mono-code transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
