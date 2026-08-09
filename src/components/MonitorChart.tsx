import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ResponsePoint {
  time: string;
  ms: number;
  status: 'up' | 'down' | 'degraded';
}

interface MonitorChartProps {
  data: ResponsePoint[];
  avgResponseMs: number;
}

export const MonitorChart: React.FC<MonitorChartProps> = ({ data, avgResponseMs }) => {
  const [timeRange, setTimeRange] = useState<'3h' | '6h' | '12h' | '24h'>('3h');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Generate data based on selected time range if needed
  const displayData = React.useMemo(() => {
    let sliced = [...data];
    if (timeRange === '3h') {
      sliced = sliced.slice(-6);
    } else if (timeRange === '6h') {
      sliced = sliced.slice(-12);
    } else if (timeRange === '12h') {
      sliced = sliced.slice(-18);
    }
    // Apply zoom
    if (zoomLevel > 1) {
      const takeCount = Math.max(3, Math.floor(sliced.length / zoomLevel));
      sliced = sliced.slice(-takeCount);
    }
    return sliced;
  }, [data, timeRange, zoomLevel]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 1));

  return (
    <div className="glass-panel rounded-xl p-6 h-80 relative flex flex-col">
      {/* Controls Bar */}
      <div className="flex justify-between items-center mb-4">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['3h', '6h', '12h', '24h'] as const).map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                setZoomLevel(1);
              }}
              className={`px-3 py-1 rounded text-xs font-mono-code transition-colors ${
                timeRange === range
                  ? 'bg-[#2a2a2a] text-[#e5e2e1] font-semibold border border-[#849581]'
                  : 'bg-transparent text-[#b9ccb5] hover:bg-[#353534]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-3 text-[#b9ccb5]">
          <span className="text-xs font-mono-code hidden sm:inline text-[#849581]">
            Avg: {avgResponseMs} ms
          </span>
          <button
            onClick={handleZoomIn}
            className="hover:text-[#e5e2e1] p-1 rounded hover:bg-[#201f1f] transition-colors"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-sm">zoom_in</span>
          </button>
          <button
            onClick={handleZoomOut}
            className="hover:text-[#e5e2e1] p-1 rounded hover:bg-[#201f1f] transition-colors"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-sm">zoom_out</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e55b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00e55b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#849581"
              tick={{ fill: '#b9ccb5', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={{ stroke: '#3b4b3a' }}
              axisLine={{ stroke: '#3b4b3a' }}
            />
            <YAxis
              stroke="#849581"
              tick={{ fill: '#b9ccb5', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={{ stroke: '#3b4b3a' }}
              axisLine={{ stroke: '#3b4b3a' }}
              unit="ms"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload as ResponsePoint;
                  return (
                    <div className="bg-[#1c1b1b] border border-[#3b4b3a] p-2.5 rounded-lg shadow-xl text-xs font-mono-code">
                      <div className="text-[#b9ccb5] mb-1">{dataPoint.time}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#e5e2e1]">Latency:</span>
                        <span className="text-[#00e55b] font-bold">{dataPoint.ms} ms</span>
                      </div>
                      <div className="text-[10px] text-[#849581] mt-1 capitalize">
                        Status: {dataPoint.status}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={avgResponseMs}
              stroke="#9fcaff"
              strokeDasharray="3 3"
              label={{
                value: `Avg ${avgResponseMs}ms`,
                fill: '#9fcaff',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
            <Area
              type="monotone"
              dataKey="ms"
              stroke="#00e55b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMs)"
              dot={{ fill: '#00e55b', r: 3 }}
              activeDot={{ r: 6, fill: '#6bff83', stroke: '#003911', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
