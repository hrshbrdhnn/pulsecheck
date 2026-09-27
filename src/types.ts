export type MonitorType = 'HTTP(s)' | 'Ping' | 'Port' | 'Keyword' | 'SSL' | 'DNS';
export const ALL_MONITOR_TYPES: MonitorType[] = ['HTTP(s)', 'Ping', 'Port', 'Keyword', 'SSL', 'DNS'];
export type MonitorStatus = 'up' | 'down' | 'degraded' | 'paused';

export interface AIDiagnosis {
  summary: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  likely_causes: string[];
  recommended_actions: string[];
}

export interface DnsChainNode {
  id: string;
  level: 'Root Server' | 'TLD Server' | 'Authoritative NS' | 'Resolved Answer';
  serverName: string;
  serverIp: string;
  operator: string;
  location: string;
  latencyMs: number;
  status: 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'REFUSED';
  responseFlags: string[];
  referralTo: string;
  queryDetails: string;
  protocol?: string;
  dnssecValidated?: boolean;
}

export interface DnsRecordItem {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA';
  name: string;
  value: string;
  ttl: number;
  priority?: number;
}

export interface DnsTraceInfo {
  targetDomain: string;
  recordType: 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME';
  authoritativeNs: string;
  authoritativeIp: string;
  lastTraceTimestamp: string;
  nodes: DnsChainNode[];
  records: DnsRecordItem[];
}

export interface Heartbeat {
  id: string;
  status: 'up' | 'down' | 'degraded';
  timestamp: string; // ISO or formatted date "2026-08-06 10:35:46"
  responseTimeMs: number | null; // null if down
  statusCode: number;
  statusText: string;
  isOndemand?: boolean;
}

export interface CertInfo {
  validTo: string; // "2026-10-12"
  daysRemaining: number;
  issuer: string;
  subject: string;
  validFrom: string;
  tlsVersion: string;
  signatureAlgorithm: string;
  san: string[];
  keySize?: string;
  serialNumber?: string;
  ocspStatus?: string;
  hostnameMatched?: boolean;
  fingerprintSha256?: string;
  valid?: boolean;
}

export interface SslAuditLog {
  id: string;
  timestamp: string;
  status: 'valid' | 'warning' | 'expired';
  daysRemaining: number;
  message: string;
  checkedBy: string;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  type: MonitorType;
  status: MonitorStatus;
  currentResponseMs: number;
  avgResponseMs: number;
  uptime24h: number; // percentage e.g. 99.99
  certInfo?: CertInfo;
  checkIntervalSeconds: number; // e.g. 60
  checkIntervalDays?: number;
  port?: number;
  keyword?: string;
  dnsTraceInfo?: DnsTraceInfo;
  heartbeats: Heartbeat[];
  responseHistory: {
    time: string;
    ms: number;
    status: 'up' | 'down' | 'degraded';
  }[];
  createdAt: string;
  sslAuditLogs?: SslAuditLog[];
  email_on_down?: boolean;
  down_emails?: string;
  ssl_expiry_alert_days?: number;
  ssl_expiry_alert_interval_days?: number;
  ssl_expiry_emails?: string;
}

export interface Settings {
  autoRefreshSeconds: number;
  emailAlerts: boolean;
  webhookUrl: string;
  soundNotifications: boolean;
  themeMode: 'dark';
}

export const formatUtcToLocal = (utcStr: string): string => {
  if (!utcStr) return '';
  let cleanStr = utcStr;
  if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
    cleanStr = cleanStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(cleanStr);
  if (isNaN(date.getTime())) return utcStr; // Fallback if invalid
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hr = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hr}:${min}:${sec}`;
};

export const filterLastGoodAndBad = <T extends { status: string; timestamp: string }>(items: T[]): T[] => {
  if (!items || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const tA = new Date(a.timestamp.endsWith('Z') || a.timestamp.includes('+') ? a.timestamp : a.timestamp.replace(' ', 'T') + 'Z').getTime();
    const tB = new Date(b.timestamp.endsWith('Z') || b.timestamp.includes('+') ? b.timestamp : b.timestamp.replace(' ', 'T') + 'Z').getTime();
    return tB - tA;
  });

  const latestGood = sorted.find(
    (item) => item.status === 'up' || item.status === 'degraded' || item.status === 'valid' || item.status === 'warning'
  );
  const latestBad = sorted.find(
    (item) => item.status === 'down' || item.status === 'expired'
  );

  const res: T[] = [];
  if (latestGood) res.push(latestGood);
  if (latestBad) res.push(latestBad);

  return res.sort((a, b) => {
    const tA = new Date(a.timestamp.endsWith('Z') || a.timestamp.includes('+') ? a.timestamp : a.timestamp.replace(' ', 'T') + 'Z').getTime();
    const tB = new Date(b.timestamp.endsWith('Z') || b.timestamp.includes('+') ? b.timestamp : b.timestamp.replace(' ', 'T') + 'Z').getTime();
    return tB - tA;
  });
};
