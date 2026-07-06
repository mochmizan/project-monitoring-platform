import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  CheckCircle, 
  Bell, 
  Wind
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';

export const Route = createFileRoute('/device/$deviceId')({
  component: DeviceDetailPage
});

interface HistoryPoint {
  label: string;
  value: number;
}

function generateMockHistory(deviceType: string, lastReading: string, range: '6h' | '24h' | '7d' | '30d'): HistoryPoint[] {
  let baseVal = 22.0;
  if (deviceType === 'Temperature') {
    const match = lastReading.match(/([\d.]+)/);
    baseVal = match ? parseFloat(match[1]) : 22.0;
  } else if (deviceType === 'AC') {
    const match = lastReading.match(/(\d+)°C/);
    baseVal = match ? parseFloat(match[1]) : 22.0;
  } else {
    baseVal = lastReading.includes('PLN') ? 220.0 : 0.0;
  }

  let count = 24;
  let labelFormatter = (idx: number): string => `-${count - idx}h`;

  if (range === '6h') {
    count = 12;
    labelFormatter = (idx: number): string => `-${(count - idx) * 30}m`;
  } else if (range === '24h') {
    count = 24;
    labelFormatter = (idx: number): string => `-${count - idx}h`;
  } else if (range === '7d') {
    count = 7;
    labelFormatter = (idx: number): string => `-${count - idx}d`;
  } else if (range === '30d') {
    count = 30;
    labelFormatter = (idx: number): string => `-${count - idx}d`;
  }

  const points: HistoryPoint[] = [];
  let currentVal = baseVal;
  for (let i = 0; i < count; i = i + 1) {
    let change = 0.0;
    if (deviceType === 'Temperature') {
      change = (Math.sin(i / 2.0) * 0.8) + (Math.random() * 0.4 - 0.2);
      currentVal = Math.round((baseVal + change) * 10.0) / 10.0;
    } else if (deviceType === 'AC') {
      if (i > 0 && Math.random() < 0.15) {
        currentVal = Math.random() < 0.5 ? baseVal - 1.0 : baseVal + 1.0;
      } else {
        currentVal = baseVal;
      }
    } else {
      if (baseVal === 0.0) {
        currentVal = Math.round(212.0 + Math.random() * 6.0);
      } else {
        currentVal = Math.round(218.0 + Math.random() * 5.0);
      }
    }
    points.push({
      label: labelFormatter(i),
      value: currentVal
    });
  }

  if (points.length > 0) {
    points[points.length - 1].value = baseVal;
  }

  return points;
}

function DeviceDetailPage() {
  const { deviceId } = Route.useParams();
  const router = useRouter();

  // Zustand 5 optimized selectors
  const devices = useAppStore((state) => state.devices);
  const rooms = useAppStore((state) => state.rooms);
  const alerts = useAppStore((state) => state.alerts);
  const role = useAppStore((state) => state.role);
  const updateDeviceConfig = useAppStore((state) => state.updateDeviceConfig);
  const confirmPendingChanges = useAppStore((state) => state.confirmPendingChanges);
  const controlAC = useAppStore((state) => state.controlAC);

  const device = devices.find((d) => d.id === deviceId);
  const room = device ? rooms.find((r) => r.id === device.roomId) : null;

  // Config Form States
  const currentPending = device?.pendingChanges;
  const [samplingInterval, setSamplingInterval] = useState<number>(
    currentPending?.samplingInterval !== null && currentPending?.samplingInterval !== undefined
      ? currentPending.samplingInterval
      : device?.samplingInterval || 30
  );
  const [warningThreshold, setWarningThreshold] = useState<string>(
    currentPending?.warningThreshold !== null && currentPending?.warningThreshold !== undefined
      ? currentPending.warningThreshold.toString()
      : device?.warningThreshold?.toString() || ''
  );
  const [criticalThreshold, setCriticalThreshold] = useState<string>(
    currentPending?.criticalThreshold !== null && currentPending?.criticalThreshold !== undefined
      ? currentPending.criticalThreshold.toString()
      : device?.criticalThreshold?.toString() || ''
  );
  const [hysteresis, setHysteresis] = useState<string>(
    currentPending?.hysteresis !== null && currentPending?.hysteresis !== undefined
      ? currentPending.hysteresis.toString()
      : device?.hysteresis?.toString() || ''
  );
  const [debounce, setDebounce] = useState<string>(
    currentPending?.debounce !== null && currentPending?.debounce !== undefined
      ? currentPending.debounce.toString()
      : device?.debounce?.toString() || ''
  );
  const [telegramAlerts, setTelegramAlerts] = useState<boolean>(
    currentPending?.telegramAlerts !== null && currentPending?.telegramAlerts !== undefined
      ? currentPending.telegramAlerts
      : device?.telegramAlerts || false
  );

  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Chart States
  const [timeRange, setTimeRange] = useState<'6h' | '24h' | '7d' | '30d'>('24h');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // AC Control Mock States
  const [acAction, setAcAction] = useState<{ deviceId: string; power: boolean; setpoint: number } | null>(null);
  const [acConfirmOpen, setAcConfirmOpen] = useState<boolean>(false);
  const [acStatus, setAcStatus] = useState<'idle' | 'sending' | 'confirmed'>('idle');

  if (!device) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => router.navigate({ to: '/' })}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">Device not found.</p>
        </div>
      </div>
    );
  }

  const handleSaveInit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSave = () => {
    setShowConfirm(false);
    setSaveStatus('saving');
    
    const warn = warningThreshold === '' ? null : parseFloat(warningThreshold);
    const crit = criticalThreshold === '' ? null : parseFloat(criticalThreshold);
    const hyst = hysteresis === '' ? null : parseFloat(hysteresis);
    const deb = debounce === '' ? null : parseInt(debounce);

    updateDeviceConfig(device.id, samplingInterval, warn, crit, telegramAlerts, hyst, deb);

    // Simulate Device confirmation ack
    setTimeout(() => {
      confirmPendingChanges(device.id);
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, 2000);
  };

  const handleACActionInit = (deviceId: string, currentPower: boolean, currentSetpoint: number, actionType: 'toggle' | 'temp-up' | 'temp-down') => {
    let nextPower = currentPower;
    let nextSetpoint = currentSetpoint;

    if (actionType === 'toggle') {
      nextPower = !currentPower;
    } else if (actionType === 'temp-up') {
      nextSetpoint = currentSetpoint + 1;
    } else if (actionType === 'temp-down') {
      nextSetpoint = currentSetpoint - 1;
    }

    setAcAction({ deviceId: deviceId, power: nextPower, setpoint: nextSetpoint });
    setAcConfirmOpen(true);
    setAcStatus('idle');
  };

  const executeACAction = () => {
    if (!acAction) return;
    setAcStatus('sending');
    
    // Simulate MQTT ack delay of 1.5s
    setTimeout(() => {
      controlAC(acAction.deviceId, acAction.power, acAction.setpoint);
      setAcStatus('confirmed');
      setTimeout(() => {
        setAcConfirmOpen(false);
        setAcAction(null);
        setAcStatus('idle');
      }, 1000);
    }, 1500);
  };

  const deviceAlerts = alerts.filter((a) => a.deviceId === device.id);

  // SVG Chart Setup
  const historyPoints = generateMockHistory(device.type, device.lastReading, timeRange);
  const values = historyPoints.map((p) => p.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (device.type === 'Temperature') {
    if (device.warningThreshold !== null) {
      minVal = Math.min(minVal, device.warningThreshold);
      maxVal = Math.max(maxVal, device.warningThreshold);
    }
    if (device.criticalThreshold !== null) {
      minVal = Math.min(minVal, device.criticalThreshold);
      maxVal = Math.max(maxVal, device.criticalThreshold);
    }
  }

  const valRange = maxVal - minVal;
  const paddedMin = minVal - (valRange * 0.1 || 2.0);
  const paddedMax = maxVal + (valRange * 0.1 || 2.0);

  const svgWidth = 600;
  const svgHeight = 220;
  const paddingTop = 20;
  const paddingBottom = 30;
  const paddingLeft = 45;
  const paddingRight = 15;

  const chartPoints = historyPoints.map((p, idx) => {
    const x = paddingLeft + (idx / (historyPoints.length - 1)) * (svgWidth - paddingLeft - paddingRight);
    const y = svgHeight - paddingBottom - ((p.value - paddedMin) / (paddedMax - paddedMin || 1.0)) * (svgHeight - paddingTop - paddingBottom);
    return { x, y, label: p.label, value: p.value };
  });

  let pathD = '';
  if (chartPoints.length > 0) {
    pathD = `M ${chartPoints[0].x} ${chartPoints[0].y} ` + chartPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
  }

  const areaD = chartPoints.length > 0
    ? `${pathD} L ${chartPoints[chartPoints.length - 1].x} ${svgHeight - paddingBottom} L ${chartPoints[0].x} ${svgHeight - paddingBottom} Z`
    : '';

  const warningThresholdLineY = device.type === 'Temperature' && device.warningThreshold !== null
    ? svgHeight - paddingBottom - ((device.warningThreshold - paddedMin) / (paddedMax - paddedMin || 1.0)) * (svgHeight - paddingTop - paddingBottom)
    : null;

  const criticalThresholdLineY = device.type === 'Temperature' && device.criticalThreshold !== null
    ? svgHeight - paddingBottom - ((device.criticalThreshold - paddedMin) / (paddedMax - paddedMin || 1.0)) * (svgHeight - paddingTop - paddingBottom)
    : null;

  // AC specific states parsing
  const isAcPowerOn = device.lastReading.includes('On');
  const acSetpointMatch = device.lastReading.match(/(\d+)°C/);
  const acSetpoint = acSetpointMatch ? parseInt(acSetpointMatch[1]) : 22;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => {
            if (device.roomId) {
              router.navigate({ to: '/room/$roomId', params: { roomId: device.roomId }, search: {} });
            } else {
              router.navigate({ to: '/' });
            }
          }}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {room ? room.name : 'Dashboard'}</span>
        </button>
      </div>

      {/* Header Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">{device.name}</h1>
            <span className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded font-medium border border-zinc-700">
              {device.type}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-2 text-sm text-zinc-500 font-medium">
            <span>MAC: <span className="font-mono">{device.macAddress}</span></span>
            <span>Firmware: {device.firmwareVersion}</span>
            {room !== null && room !== undefined && (
              <span>Room: <Link to="/room/$roomId" params={{ roomId: room.id }} search={{}} className="text-indigo-400 hover:underline">{room.name}</Link></span>
            )}
            <span>Last seen: {device.lastSeen}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-zinc-500 font-semibold uppercase">Device Link Status:</span>
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
            device.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              device.status === 'Online' ? 'bg-emerald-500' : 'bg-zinc-500'
            )} />
            {device.status}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Reading Box */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Latest Transmitted Reading</p>
              <h3 className="text-4xl font-black text-indigo-400 tracking-tight">{device.lastReading}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-500 block">Sampling Frequency</span>
              <span className="text-sm font-semibold text-zinc-300">Every {device.samplingInterval}s</span>
            </div>
          </div>

          {/* Historical Graph */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-zinc-200">Historical Log Values</h3>
              <div className="flex gap-2">
                {(['6h', '24h', '7d', '30d'] as const).map((range) => (
                  <button 
                    key={range} 
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded transition-colors font-medium border cursor-pointer",
                      range === timeRange ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-zinc-950 border border-zinc-850 rounded p-4 relative overflow-hidden">
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                className="w-full h-auto overflow-visible"
              >
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = paddingTop + ratio * (svgHeight - paddingTop - paddingBottom);
                  const val = paddedMax - ratio * (paddedMax - paddedMin);
                  return (
                    <g key={ratio}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={svgWidth - paddingRight}
                        y2={y}
                        stroke="#27272a"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3}
                        fill="#71717a"
                        fontSize="9"
                        textAnchor="end"
                      >
                        {device.type === 'Temperature' || device.type === 'AC' ? `${val.toFixed(1)}°C` : `${Math.round(val)}V`}
                      </text>
                    </g>
                  );
                })}

                {/* Warning & Critical Threshold lines */}
                {warningThresholdLineY !== null && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={warningThresholdLineY}
                      x2={svgWidth - paddingRight}
                      y2={warningThresholdLineY}
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="4"
                    />
                    <text
                      x={paddingLeft + 10}
                      y={warningThresholdLineY - 4}
                      fill="#f59e0b"
                      fontSize="9"
                      fontWeight="semibold"
                    >
                      Warning ({device.warningThreshold}°C)
                    </text>
                  </g>
                )}
                {criticalThresholdLineY !== null && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={criticalThresholdLineY}
                      x2={svgWidth - paddingRight}
                      y2={criticalThresholdLineY}
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="4"
                    />
                    <text
                      x={paddingLeft + 10}
                      y={criticalThresholdLineY - 4}
                      fill="#ef4444"
                      fontSize="9"
                      fontWeight="semibold"
                    >
                      Critical ({device.criticalThreshold}°C)
                    </text>
                  </g>
                )}

                {/* Filled Area */}
                {areaD !== '' && (
                  <path d={areaD} fill="url(#chartGradient)" />
                )}

                {/* Line Path */}
                {pathD !== '' && (
                  <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                )}

                {/* Dots */}
                {chartPoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIndex === idx ? '5' : '3'}
                    fill={hoveredIndex === idx ? '#818cf8' : '#6366f1'}
                    className="transition-all duration-150"
                  />
                ))}

                {/* Time labels on the X axis */}
                {chartPoints.filter((_, idx) => idx % Math.max(1, Math.floor(chartPoints.length / 6)) === 0).map((pt, idx) => (
                  <text
                    key={idx}
                    x={pt.x}
                    y={svgHeight - paddingBottom + 16}
                    fill="#71717a"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {pt.label}
                  </text>
                ))}

                {/* Interactive Tooltip Overlay */}
                {hoveredIndex !== null && chartPoints[hoveredIndex] && (
                  <g>
                    <line
                      x1={chartPoints[hoveredIndex].x}
                      y1={paddingTop}
                      x2={chartPoints[hoveredIndex].x}
                      y2={svgHeight - paddingBottom}
                      stroke="#6366f1"
                      strokeWidth="1"
                      strokeDasharray="2"
                    />
                    <rect
                      x={Math.max(paddingLeft, Math.min(chartPoints[hoveredIndex].x - 45, svgWidth - paddingRight - 90))}
                      y={Math.max(paddingTop, chartPoints[hoveredIndex].y - 35)}
                      width="90"
                      height="28"
                      rx="4"
                      fill="#18181b"
                      stroke="#3f3f46"
                      strokeWidth="1"
                    />
                    <text
                      x={Math.max(paddingLeft + 45, Math.min(chartPoints[hoveredIndex].x, svgWidth - paddingRight - 45))}
                      y={Math.max(paddingTop + 11, chartPoints[hoveredIndex].y - 24)}
                      fill="#e4e4e7"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {chartPoints[hoveredIndex].value} {device.type === 'Temperature' || device.type === 'AC' ? '°C' : 'V'}
                    </text>
                    <text
                      x={Math.max(paddingLeft + 45, Math.min(chartPoints[hoveredIndex].x, svgWidth - paddingRight - 45))}
                      y={Math.max(paddingTop + 21, chartPoints[hoveredIndex].y - 14)}
                      fill="#71717a"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      Time: {chartPoints[hoveredIndex].label}
                    </text>
                  </g>
                )}

                {/* Transparent Interactive Rects */}
                {chartPoints.map((pt, idx) => {
                  const x = pt.x - (svgWidth - paddingLeft - paddingRight) / (chartPoints.length - 1) / 2;
                  const width = (svgWidth - paddingLeft - paddingRight) / (chartPoints.length - 1);
                  return (
                    <rect
                      key={idx}
                      x={x}
                      y={paddingTop}
                      width={width}
                      height={svgHeight - paddingTop - paddingBottom}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Device Alert History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="font-bold text-zinc-200 mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-400" />
              <span>Recent Alerts Log</span>
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-400">
                <thead className="bg-zinc-950 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Parameter</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Threshold Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {deviceAlerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-zinc-850/30">
                      <td className="px-4 py-3 font-mono text-zinc-500">{new Date(alert.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          alert.severity === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        )}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{alert.parameter}</td>
                      <td className="px-4 py-3 font-bold text-zinc-200">{alert.value}</td>
                      <td className="px-4 py-3 text-zinc-500">{alert.threshold}</td>
                    </tr>
                  ))}

                  {deviceAlerts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-650 italic">
                        No telemetry alerts recorded for this device.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Config Panel & Environmental Controls */}
        <div className="space-y-6">
          {/* AC Module Panel (if device is AC) */}
          {device.type === 'AC' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Wind className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-200">AC Control Module</h4>
                  <span className="text-xs text-zinc-500 font-medium">Connected to: {device.name}</span>
                </div>
              </div>

              <div className="bg-zinc-950 rounded-lg p-4 flex items-center justify-between border border-zinc-850">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Status</div>
                  <div className={cn("text-sm font-bold", isAcPowerOn ? 'text-emerald-400' : 'text-zinc-400')}>
                    {isAcPowerOn ? 'Powered ON' : 'Powered OFF'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Setpoint</div>
                  <div className="text-2xl font-black text-zinc-100">{acSetpoint}°C</div>
                </div>
              </div>

              {role === 'Viewer' ? (
                <div className="bg-zinc-950 border border-zinc-850 p-4 rounded text-xs text-zinc-500 italic">
                  Read-only access. Viewer accounts cannot send AC commands.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Setpoint Buttons */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-400 font-medium">Adjust Temperature</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleACActionInit(device.id, isAcPowerOn, acSetpoint, 'temp-down')}
                        className="h-10 w-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-zinc-200 rounded font-bold transition-colors flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-lg font-bold w-12 text-center text-zinc-200">{acSetpoint}°C</span>
                      <button
                        onClick={() => handleACActionInit(device.id, isAcPowerOn, acSetpoint, 'temp-up')}
                        className="h-10 w-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-750 text-zinc-200 rounded font-bold transition-colors flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Power Button */}
                  <button
                    onClick={() => handleACActionInit(device.id, isAcPowerOn, acSetpoint, 'toggle')}
                    className={cn(
                      "w-full py-2.5 rounded font-bold text-sm transition-all duration-200 cursor-pointer",
                      isAcPowerOn 
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    )}
                  >
                    {isAcPowerOn ? 'Turn AC Off' : 'Turn AC On'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Config Panel (Admin & Operator only) */}
          {role !== 'Viewer' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <SettingsIcon className="h-5 w-5 text-indigo-400" />
                </div>
                <h4 className="font-bold text-zinc-200">Device Node Settings</h4>
              </div>

              {device.pendingChanges !== null && (
                <div className="bg-amber-500/15 border border-amber-500/25 p-3.5 rounded-lg mb-6 text-xs text-amber-400 flex items-start gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse mt-1.5 flex-shrink-0"></span>
                  <div>
                    <div className="font-bold">Pending broker confirmation...</div>
                    <p className="text-amber-500/80 mt-0.5">Settings uploaded to broker. Waiting for device acknowledgement.</p>
                  </div>
                </div>
              )}

              {saveStatus === 'saved' && (
                <div className="bg-emerald-500/15 border border-emerald-500/25 p-3.5 rounded-lg mb-6 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-bold">Settings Synced Successfully!</span>
                </div>
              )}

              <form onSubmit={handleSaveInit} className="space-y-4">
                {/* Sampling Interval */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Sampling Interval
                    </label>
                    <div className="text-[10px] text-zinc-500">
                      <span>Active: <strong>{device.samplingInterval}s</strong></span>
                      {device.pendingChanges && device.pendingChanges.samplingInterval !== null && device.pendingChanges.samplingInterval !== device.samplingInterval && (
                        <span className="text-amber-400 ml-2 font-medium">
                          (Pending: {device.pendingChanges.samplingInterval}s)
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={samplingInterval}
                    onChange={(e) => setSamplingInterval(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value={5}>5s</option>
                    <option value={10}>10s</option>
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>

                {device.type === 'Temperature' && (
                  <>
                    {/* Warning Threshold */}
                    <div>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Warning Threshold (°C)
                        </label>
                        <div className="text-[10px] text-zinc-500">
                          <span>Active: <strong>{device.warningThreshold !== null ? `${device.warningThreshold}°C` : 'Disabled'}</strong></span>
                          {device.pendingChanges && device.pendingChanges.warningThreshold !== undefined && device.pendingChanges.warningThreshold !== device.warningThreshold && (
                            <span className="text-amber-400 ml-2 font-medium">
                              (Pending: {device.pendingChanges.warningThreshold !== null ? `${device.pendingChanges.warningThreshold}°C` : 'Disabled'})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={warningThreshold}
                        onChange={(e) => setWarningThreshold(e.target.value)}
                        placeholder="Disabled"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Critical Threshold */}
                    <div>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Critical Threshold (°C)
                        </label>
                        <div className="text-[10px] text-zinc-500">
                          <span>Active: <strong>{device.criticalThreshold !== null ? `${device.criticalThreshold}°C` : 'Disabled'}</strong></span>
                          {device.pendingChanges && device.pendingChanges.criticalThreshold !== undefined && device.pendingChanges.criticalThreshold !== device.criticalThreshold && (
                            <span className="text-amber-400 ml-2 font-medium">
                              (Pending: {device.pendingChanges.criticalThreshold !== null ? `${device.pendingChanges.criticalThreshold}°C` : 'Disabled'})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={criticalThreshold}
                        onChange={(e) => setCriticalThreshold(e.target.value)}
                        placeholder="Disabled"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Hysteresis */}
                    <div>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Hysteresis Gap (°C)
                        </label>
                        <div className="text-[10px] text-zinc-500">
                          <span>Active: <strong>{device.hysteresis !== null && device.hysteresis !== undefined ? `${device.hysteresis}°C` : 'Disabled'}</strong></span>
                          {device.pendingChanges && device.pendingChanges.hysteresis !== undefined && device.pendingChanges.hysteresis !== (device.hysteresis || null) && (
                            <span className="text-amber-400 ml-2 font-medium">
                              (Pending: {device.pendingChanges.hysteresis !== null ? `${device.pendingChanges.hysteresis}°C` : 'Disabled'})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={hysteresis}
                        onChange={(e) => setHysteresis(e.target.value)}
                        placeholder="Disabled"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Debounce */}
                    <div>
                      <div className="flex justify-between items-baseline mb-1">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Debounce Count
                        </label>
                        <div className="text-[10px] text-zinc-500">
                          <span>Active: <strong>{device.debounce !== null && device.debounce !== undefined ? `${device.debounce} samples` : 'Disabled'}</strong></span>
                          {device.pendingChanges && device.pendingChanges.debounce !== undefined && device.pendingChanges.debounce !== (device.debounce || null) && (
                            <span className="text-amber-400 ml-2 font-medium">
                              (Pending: {device.pendingChanges.debounce !== null ? `${device.pendingChanges.debounce} samples` : 'Disabled'})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        step="1"
                        value={debounce}
                        onChange={(e) => setDebounce(e.target.value)}
                        placeholder="Disabled"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {/* Alert Routing */}
                <div className="flex items-center justify-between py-2 border-t border-zinc-800/60 mt-4">
                  <div>
                    <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Route to Telegram</span>
                    <span className="text-[10px] text-zinc-500">
                      Active: {device.telegramAlerts ? 'On' : 'Off'}
                      {device.pendingChanges && device.pendingChanges.telegramAlerts !== null && device.pendingChanges.telegramAlerts !== device.telegramAlerts && (
                        <span className="text-amber-400 ml-2 font-medium">
                          (Pending: {device.pendingChanges.telegramAlerts ? 'On' : 'Off'})
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTelegramAlerts(!telegramAlerts)}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      telegramAlerts ? "bg-indigo-600" : "bg-zinc-800"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        telegramAlerts ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded transition-all text-sm mt-4 cursor-pointer"
                >
                  {saveStatus === 'saving' ? 'Syncing...' : 'Apply Configuration'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Config Apply Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Confirm Changes</h3>
              <p className="text-zinc-400 text-sm mt-2">
                Are you sure you want to upload new configurations to <strong className="text-indigo-400">{device.name}</strong>? This will reconfigure its sampling and alert mechanisms.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 border border-zinc-800 rounded text-sm text-zinc-400 hover:bg-zinc-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-semibold cursor-pointer"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AC Confirmation Modal */}
      {acConfirmOpen && acAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Confirm AC Command</h3>
              <p className="text-zinc-400 text-sm mt-2">
                Are you sure you want to {acAction.power ? 'turn ON the AC and set temperature to' : 'turn OFF the AC (target setpoint'} <strong className="text-indigo-400">{acAction.setpoint}°C</strong>?
              </p>
            </div>

            {acStatus === 'idle' && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setAcConfirmOpen(false); setAcAction(null); }}
                  className="px-4 py-2 border border-zinc-800 rounded text-sm text-zinc-400 hover:bg-zinc-800 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={executeACAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-semibold cursor-pointer"
                >
                  Confirm Command
                </button>
              </div>
            )}

            {acStatus === 'sending' && (
              <div className="flex items-center justify-center gap-3 py-2 text-zinc-300 font-medium text-sm">
                <span className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
                <span>Transmitting MQTT Command...</span>
              </div>
            )}

            {acStatus === 'confirmed' && (
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-400 font-bold text-sm">
                <CheckCircle className="h-5 w-5" />
                <span>Command Acknowledged</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
