import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { 
  ArrowLeft, 
  Wind, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowRight, 
  AlertTriangle, 
  Thermometer, 
  Zap, 
  Info 
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { z } from 'zod';
import type { Device, Room } from '../lib/mockData';

const roomSearchSchema = z.object({
  range: z.enum(['6h', '24h', '7d', '30d']).optional(),
});

export const Route = createFileRoute('/room/$roomId')({
  validateSearch: (search) => roomSearchSchema.parse(search),
  component: RoomDetailPage
});

interface DataPoint {
  timestamp: string;
  value: number;
}

function generateHistory(device: Device, range: '6h' | '24h' | '7d' | '30d', deviceIndex: number): DataPoint[] {
  const currentValMatch = device.lastReading.match(/([\d.]+)/);
  const currentVal = currentValMatch && currentValMatch[1] ? parseFloat(currentValMatch[1]) : 22.0;
  const points: DataPoint[] = [];
  const now = new Date();
  
  let numPoints = 24;
  let intervalMs = 60 * 60 * 1000;
  
  if (range === '6h') {
    numPoints = 12;
    intervalMs = 30 * 60 * 1000;
  } else if (range === '24h') {
    numPoints = 24;
    intervalMs = 60 * 60 * 1000;
  } else if (range === '7d') {
    numPoints = 14;
    intervalMs = 12 * 60 * 60 * 1000;
  } else if (range === '30d') {
    numPoints = 30;
    intervalMs = 24 * 60 * 60 * 1000;
  }

  for (let i = 0; i < numPoints; i++) {
    const time = new Date(now.getTime() - (numPoints - 1 - i) * intervalMs);
    if (i === numPoints - 1) {
      points.push({
        timestamp: time.toISOString(),
        value: currentVal
      });
    } else {
      const progress = i / (numPoints - 1);
      const wave = Math.sin(progress * Math.PI * 2) * 2.5 + Math.cos(progress * Math.PI * 4) * 1.0;
      const offset = (deviceIndex - 0.5) * 1.5;
      const noise = Math.sin(i * 12.34 + deviceIndex * 5.67) * 0.4;
      const baseVal = currentVal - (1.0 - progress) * (offset + wave + noise);
      let roundedVal = Math.round(baseVal * 10) / 10;
      if (roundedVal < 15.0) roundedVal = 15.0;
      if (roundedVal > 42.0) roundedVal = 42.0;
      
      points.push({
        timestamp: time.toISOString(),
        value: roundedVal
      });
    }
  }
  
  return points;
}

function RoomDetailPage() {
  const { roomId } = Route.useParams();
  const { range = '24h' } = Route.useSearch();
  const router = useRouter();

  // Zustand 5 selective selectors to prevent re-renders
  const rooms = useAppStore((state) => state.rooms);
  const devices = useAppStore((state) => state.devices);
  const role = useAppStore((state) => state.role);
  const controlAC = useAppStore((state) => state.controlAC);

  const room = rooms.find((r) => r.id === roomId);
  const roomDevices = devices.filter((d) => d.roomId === roomId);

  // AC Control Mock States
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [acAction, setAcAction] = useState<{ deviceId: string; power: boolean; setpoint: number } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'idle' | 'sending' | 'confirmed' | 'failed'>('idle');

  // Tooltip Hover States
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    svgX: number;
    svgY: number;
    deviceName: string;
    value: number;
    timestamp: string;
  } | null>(null);

  const tempDevices = useMemo(() => {
    return roomDevices.filter((d) => d.type === 'Temperature');
  }, [roomDevices]);

  // Generate deterministic memoized histories
  const tempDeviceIdsAndReadings = tempDevices.map((d) => `${d.id}:${d.lastReading}:${d.status}`).join(',');
  const histories = useMemo(() => {
    const result: Record<string, DataPoint[]> = {};
    tempDevices.forEach((device, idx) => {
      result[device.id] = generateHistory(device, range, idx);
    });
    return result;
  }, [tempDeviceIdsAndReadings, range, tempDevices]);

  if (!room) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => router.navigate({ to: '/' })}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400">Room not found.</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: Room['status']): string => {
    switch (status) {
      case 'Normal': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-450 border-zinc-500/20';
    }
  };

  const getTrend = (deviceId: string): 'rising' | 'falling' | 'stable' => {
    if (deviceId.endsWith('-1')) return 'rising';
    if (deviceId.endsWith('-2')) return 'falling';
    if (deviceId.endsWith('-3')) return 'rising';
    return 'stable';
  };

  const renderTrend = (deviceId: string) => {
    const trend = getTrend(deviceId);
    if (trend === 'rising') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/10">
          <TrendingUp className="h-3 w-3" />
          <span>Rising</span>
        </span>
      );
    }
    if (trend === 'falling') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
          <TrendingDown className="h-3 w-3" />
          <span>Falling</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-455 font-semibold bg-zinc-500/10 px-1.5 py-0.5 rounded border border-zinc-500/10">
        <Minus className="h-3 w-3" />
        <span>Stable</span>
      </span>
    );
  };

  const renderTypeIcon = (type: Device['type']) => {
    switch (type) {
      case 'Temperature':
        return <Thermometer className="h-4 w-4 text-indigo-400" />;
      case 'ATS':
        return <Zap className="h-4 w-4 text-amber-400" />;
      case 'AC':
        return <Wind className="h-4 w-4 text-emerald-400" />;
    }
  };

  const handleACActionInit = (
    deviceId: string, 
    currentPower: boolean, 
    currentSetpoint: number, 
    actionType: 'toggle' | 'temp-up' | 'temp-down'
  ) => {
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
    setShowConfirm(true);
    setPendingStatus('idle');
  };

  const executeACAction = () => {
    if (!acAction) return;
    setPendingStatus('sending');
    
    // Simulate MQTT ack delay of 2.0s
    setTimeout(() => {
      controlAC(acAction.deviceId, acAction.power, acAction.setpoint);
      setPendingStatus('confirmed');
      setTimeout(() => {
        setShowConfirm(false);
        setAcAction(null);
        setPendingStatus('idle');
      }, 1000);
    }, 2000);
  };

  // Find AC device in this room
  const acDevice = roomDevices.find((d) => d.type === 'AC');
  const isAcPowerOn = acDevice ? acDevice.lastReading.includes('On') : false;
  const acSetpointMatch = acDevice ? acDevice.lastReading.match(/(\d+)°C/) : null;
  const acSetpoint = acSetpointMatch && acSetpointMatch[1] ? parseInt(acSetpointMatch[1], 10) : 22;

  // Chart coordinate mapping
  const width = 600;
  const height = 300;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const allValues = tempDevices.flatMap((d) => histories[d.id] || []).map((p) => p.value);
  const warningThreshold = tempDevices[0]?.warningThreshold ?? null;
  const criticalThreshold = tempDevices[0]?.criticalThreshold ?? null;

  const rawMinVal = allValues.length > 0 ? Math.min(...allValues) : 15.0;
  const rawMaxVal = allValues.length > 0 ? Math.max(...allValues) : 40.0;

  const thresholdVals = [
    warningThreshold !== null ? warningThreshold : 28.0,
    criticalThreshold !== null ? criticalThreshold : 35.0
  ];

  const minY = Math.max(0, Math.floor(Math.min(rawMinVal, ...thresholdVals) - 2));
  const maxY = Math.ceil(Math.max(rawMaxVal, ...thresholdVals) + 2);

  const getX = (index: number, total: number): number => {
    if (total <= 1) return paddingLeft;
    return paddingLeft + (index / (total - 1)) * chartWidth;
  };

  const getY = (value: number): number => {
    const ratio = (value - minY) / (maxY - minY);
    return height - paddingBottom - ratio * chartHeight;
  };

  const getPathD = (points: DataPoint[]): string => {
    return points.map((p, idx) => {
      const x = getX(idx, points.length);
      const y = getY(p.value);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const getAreaD = (points: DataPoint[]): string => {
    if (points.length === 0) return '';
    const pathD = getPathD(points);
    const startX = getX(0, points.length);
    const endX = getX(points.length - 1, points.length);
    const bottomY = getY(minY);
    return `${pathD} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  };

  // Generate ticks for Y axis
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = (maxY - minY) / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round((minY + i * step) * 10) / 10);
    }
    return ticks;
  }, [minY, maxY]);

  const handlePointHover = (
    e: React.MouseEvent<SVGCircleElement>,
    deviceName: string,
    value: number,
    timestamp: string,
    pointIndex: number,
    totalPoints: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (parentRect) {
      const pixelX = rect.left - parentRect.left + rect.width / 2;
      const pixelY = rect.top - parentRect.top;
      const svgX = getX(pointIndex, totalPoints);
      const svgY = getY(value);
      setHoveredPoint({
        x: pixelX,
        y: pixelY,
        svgX: svgX,
        svgY: svgY,
        deviceName: deviceName,
        value: value,
        timestamp: timestamp
      });
    }
  };

  const handlePointLeave = () => {
    setHoveredPoint(null);
  };

  const formatXLabel = (timestamp: string, currentRange: '6h' | '24h' | '7d' | '30d'): string => {
    const date = new Date(timestamp);
    if (currentRange === '6h' || currentRange === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    if (currentRange === '7d') {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getConfirmMessage = (): string => {
    if (!acAction) return '';
    return acAction.power
      ? `Turn AC on and set to ${acAction.setpoint}°C?`
      : `Turn AC off (with setpoint ${acAction.setpoint}°C)?`;
  };

  // Show AC panel if it exists and user is Admin or Operator
  const canControlAC = role === 'Admin' || role === 'Operator';

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <button 
        onClick={() => router.navigate({ to: '/' })}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </button>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{room.name}</h1>
          <p className="text-zinc-505 text-sm mt-1">{roomDevices.length} monitored devices in this space</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Overall Room Status:</span>
          <span className={cn("px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider", getStatusColor(room.status))}>
            {room.status}
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Readings panel */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Live Readings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomDevices.map((device) => (
                <div 
                  key={device.id}
                  className={cn(
                    "bg-zinc-900 border rounded-lg p-5 flex flex-col justify-between transition-all",
                    device.status === 'Offline' ? "border-zinc-850 opacity-60" : "border-zinc-855 hover:border-zinc-800"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-zinc-950 rounded-md border border-zinc-850">
                        {renderTypeIcon(device.type)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-150 text-sm leading-snug">{device.name}</h4>
                        <span className="text-[10px] text-zinc-500 font-mono">{device.macAddress}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {device.type === 'Temperature' && device.status === 'Online' && renderTrend(device.id)}
                      
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        device.status === 'Online' ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
                      )} />
                      <span className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        device.status === 'Online' ? "text-emerald-400" : "text-zinc-500"
                      )}>
                        {device.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-800/40">
                    <span className="text-xs text-zinc-400">Current Reading</span>
                    <span className={cn(
                      "text-xl font-extrabold tracking-tight",
                      device.status === 'Offline' 
                        ? "text-zinc-500" 
                        : device.type === 'Temperature'
                          ? "text-indigo-400"
                          : device.type === 'ATS'
                            ? "text-amber-400"
                            : "text-emerald-400"
                    )}>
                      {device.status === 'Offline' ? '—' : device.lastReading}
                    </span>
                  </div>
                </div>
              ))}
              
              {roomDevices.length === 0 && (
                <div className="col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center text-zinc-500">
                  No active devices are paired to this room.
                </div>
              )}
            </div>
          </div>

          {/* Historical Graph Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="font-bold text-zinc-200">Temperature History</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Real-time plotted charts relative to thresholds</p>
              </div>
              <div className="flex gap-1.5 bg-zinc-950 p-1 border border-zinc-850 rounded-lg">
                {(['6h', '24h', '7d', '30d'] as const).map((r) => (
                  <Link 
                    key={r}
                    to="/room/$roomId"
                    params={{ roomId: room.id }}
                    search={{ range: r }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-md transition-colors font-semibold cursor-pointer",
                      r === range 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                    )}
                  >
                    {r}
                  </Link>
                ))}
              </div>
            </div>
            
            {tempDevices.length === 0 ? (
              <div className="h-64 bg-zinc-950 border border-zinc-850 rounded-lg flex flex-col items-center justify-center p-6 text-zinc-500 text-sm">
                <Info className="h-6 w-6 text-zinc-650 mb-2" />
                <span>No temperature sensors in this room to plot history.</span>
              </div>
            ) : (
              <div className="relative w-full h-72 bg-zinc-950 border border-zinc-850 rounded-lg p-4">
                {/* Tooltip HTML overlay */}
                {hoveredPoint && (
                  <div 
                    className="absolute bg-zinc-905 border border-zinc-750 rounded shadow-xl p-2.5 text-[11px] pointer-events-none z-20 flex flex-col gap-1 text-zinc-150 max-w-xs"
                    style={{ 
                      left: hoveredPoint.x, 
                      top: hoveredPoint.y - 12,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="font-bold border-b border-zinc-800 pb-1 mb-1 text-zinc-200">{hoveredPoint.deviceName}</div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-550">Value:</span>
                      <span className="font-extrabold text-indigo-400">{hoveredPoint.value}°C</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-zinc-550">Time:</span>
                      <span className="font-mono text-zinc-400">
                        {new Date(hoveredPoint.timestamp).toLocaleString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </span>
                    </div>
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  width="100%"
                  height="100%"
                  className="overflow-visible"
                  onMouseLeave={handlePointLeave}
                >
                  <defs>
                    {tempDevices.map((device, idx) => {
                      const colors = ['#6366f1', '#10b981', '#06b6d4', '#a855f7'];
                      const color = colors[idx % colors.length];
                      return (
                        <linearGradient key={device.id} id={`grad-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                        </linearGradient>
                      );
                    })}
                  </defs>

                  {/* Vertical line at hovered X */}
                  {hoveredPoint && (
                    <line
                      x1={hoveredPoint.svgX}
                      y1={paddingTop}
                      x2={hoveredPoint.svgX}
                      y2={height - paddingBottom}
                      className="stroke-zinc-700/50 stroke-1 stroke-dasharray-[3,3]"
                      strokeDasharray="3,3"
                    />
                  )}

                  {/* Y Axis Grid Lines & Labels */}
                  {yTicks.map((tick, idx) => {
                    const y = getY(tick);
                    return (
                      <g key={idx}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={width - paddingRight}
                          y2={y}
                          className="stroke-zinc-800/40 stroke-1"
                        />
                        <text
                          x={paddingLeft - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] fill-zinc-500 font-mono font-semibold"
                        >
                          {tick}°C
                        </text>
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {tempDevices[0] && histories[tempDevices[0].id] && (() => {
                    const points = histories[tempDevices[0].id];
                    const labelIndices: number[] = [];
                    const step = Math.max(1, Math.floor(points.length / 5));
                    for (let i = 0; i < points.length; i += step) {
                      labelIndices.push(i);
                    }
                    if (points.length > 0 && !labelIndices.includes(points.length - 1)) {
                      labelIndices.push(points.length - 1);
                    }

                    return labelIndices.map((idx) => {
                      const p = points[idx];
                      const x = getX(idx, points.length);
                      return (
                        <g key={idx}>
                          <line
                            x1={x}
                            y1={height - paddingBottom}
                            x2={x}
                            y2={height - paddingBottom + 4}
                            className="stroke-zinc-800 stroke-1"
                          />
                          <text
                            x={x}
                            y={height - paddingBottom + 16}
                            textAnchor="middle"
                            className="text-[9px] fill-zinc-500 font-mono font-semibold"
                          >
                            {formatXLabel(p.timestamp, range)}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Warning & Critical Threshold lines */}
                  {warningThreshold !== null && (
                    <g>
                      <line
                        x1={paddingLeft}
                        y1={getY(warningThreshold)}
                        x2={width - paddingRight}
                        y2={getY(warningThreshold)}
                        className="stroke-amber-500/40 stroke-1 stroke-dasharray-[4,4]"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={width - paddingRight - 4}
                        y={getY(warningThreshold) - 4}
                        textAnchor="end"
                        className="text-[9px] font-semibold fill-amber-400/80"
                      >
                        Warning ({warningThreshold}°C)
                      </text>
                    </g>
                  )}
                  {criticalThreshold !== null && (
                    <g>
                      <line
                        x1={paddingLeft}
                        y1={getY(criticalThreshold)}
                        x2={width - paddingRight}
                        y2={getY(criticalThreshold)}
                        className="stroke-red-500/40 stroke-1 stroke-dasharray-[4,4]"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={width - paddingRight - 4}
                        y={getY(criticalThreshold) - 4}
                        textAnchor="end"
                        className="text-[9px] font-semibold fill-red-400/80"
                      >
                        Critical ({criticalThreshold}°C)
                      </text>
                    </g>
                  )}

                  {/* Paths for each device */}
                  {tempDevices.map((device, devIdx) => {
                    const points = histories[device.id] || [];
                    if (points.length === 0) return null;
                    const colors = ['#6366f1', '#10b981', '#06b6d4', '#a855f7'];
                    const color = colors[devIdx % colors.length];
                    
                    const pathD = getPathD(points);
                    const areaD = getAreaD(points);

                    return (
                      <g key={device.id}>
                        <path
                          d={areaD}
                          fill={`url(#grad-${device.id})`}
                          className="pointer-events-none"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="pointer-events-none"
                        />
                        {points.map((p, idx) => {
                          const x = getX(idx, points.length);
                          const y = getY(p.value);
                          const isHovered = hoveredPoint && 
                                            hoveredPoint.deviceName === device.name && 
                                            hoveredPoint.value === p.value && 
                                            hoveredPoint.timestamp === p.timestamp;
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r={isHovered ? 6 : 3.5}
                              fill="#09090b"
                              stroke={color}
                              strokeWidth={isHovered ? 3 : 1.5}
                              className="cursor-pointer transition-all duration-100"
                              onMouseEnter={(e) => handlePointHover(e, device.name, p.value, p.timestamp, idx, points.length)}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Axes lines */}
                  <line
                    x1={paddingLeft}
                    y1={height - paddingBottom}
                    x2={width - paddingRight}
                    y2={height - paddingBottom}
                    className="stroke-zinc-800 stroke-1"
                  />
                  <line
                    x1={paddingLeft}
                    y1={paddingTop}
                    x2={paddingLeft}
                    y2={height - paddingBottom}
                    className="stroke-zinc-800 stroke-1"
                  />
                </svg>
              </div>
            )}

            {tempDevices.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-2">
                {tempDevices.map((device, idx) => {
                  const colors = ['#6366f1', '#10b981', '#06b6d4', '#a855f7'];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={device.id} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-zinc-350 font-semibold">{device.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Device Inventory list */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-zinc-200">Device Inventory</h4>
              <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full font-semibold">
                {roomDevices.length} Total
              </span>
            </div>
            {roomDevices.length === 0 ? (
              <p className="text-zinc-550 text-sm text-center py-4">No devices assigned to this room.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5">MAC Address</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {roomDevices.map((d) => (
                      <tr key={d.id} className="group hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 pr-2">
                          <Link 
                            to="/device/$deviceId" 
                            params={{ deviceId: d.id }}
                            className="font-medium text-zinc-300 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>{d.name}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                          </Link>
                        </td>
                        <td className="py-3 pr-2 font-semibold text-zinc-400 text-xs">
                          {d.type}
                        </td>
                        <td className="py-3 pr-2 font-mono text-xs text-zinc-500">
                          {d.macAddress}
                        </td>
                        <td className="py-3 text-right">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                            d.status === 'Online' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-zinc-500/10 text-zinc-450 border-zinc-500/20"
                          )}>
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              d.status === 'Online' ? "bg-emerald-500" : "bg-zinc-500"
                            )} />
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Environmental Controls</h3>

          {/* AC Module Controls Panel */}
          {acDevice ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Wind className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-200">AC Control Module</h4>
                  <span className="text-xs text-zinc-550 font-medium">Device: {acDevice.name}</span>
                </div>
              </div>

              <div className="bg-zinc-950 rounded-lg p-4 flex items-center justify-between border border-zinc-850">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Status</div>
                  <div className={cn("text-sm font-bold", isAcPowerOn ? "text-emerald-400" : "text-zinc-500")}>
                    {isAcPowerOn ? "Powered ON" : "Powered OFF"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Setpoint</div>
                  <div className="text-2xl font-black text-zinc-200">{acSetpoint}°C</div>
                </div>
              </div>

              {canControlAC ? (
                <div className="space-y-4">
                  {/* Setpoint Buttons */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-400 font-semibold">Adjust Setpoint</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleACActionInit(acDevice.id, isAcPowerOn, acSetpoint, 'temp-down')}
                        className="h-10 w-10 bg-zinc-855 hover:bg-zinc-800 active:bg-zinc-750 text-zinc-200 rounded font-bold transition-colors flex items-center justify-center cursor-pointer border border-zinc-800"
                      >
                        -
                      </button>
                      <span className="text-lg font-bold w-12 text-center text-zinc-200">{acSetpoint}°C</span>
                      <button
                        onClick={() => handleACActionInit(acDevice.id, isAcPowerOn, acSetpoint, 'temp-up')}
                        className="h-10 w-10 bg-zinc-855 hover:bg-zinc-800 active:bg-zinc-750 text-zinc-200 rounded font-bold transition-colors flex items-center justify-center cursor-pointer border border-zinc-800"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Power Button */}
                  <button
                    onClick={() => handleACActionInit(acDevice.id, isAcPowerOn, acSetpoint, 'toggle')}
                    className={cn(
                      "w-full py-2.5 rounded font-bold text-sm transition-all duration-200 cursor-pointer",
                      isAcPowerOn 
                        ? "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/25" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    )}
                  >
                    {isAcPowerOn ? "Turn AC Off" : "Turn AC On"}
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-855 p-4 rounded-lg text-xs text-zinc-500 leading-relaxed">
                  You are logged in as <span className="font-semibold text-zinc-400">{role}</span>. Admin or Operator access is required to control the AC unit.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-6 text-center text-zinc-500 text-sm">
              No Air Conditioning module detected in this room.
            </div>
          )}

          {/* Quick list of devices for switching */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h4 className="font-bold text-zinc-200 mb-4 text-sm uppercase tracking-wider text-zinc-400">Room Devices</h4>
            {roomDevices.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No devices paired.</p>
            ) : (
              <ul className="space-y-3">
                {roomDevices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between border-b border-zinc-800/40 pb-2">
                    <Link 
                      to="/device/$deviceId" 
                      params={{ deviceId: d.id }}
                      className="text-sm font-semibold text-zinc-300 hover:text-indigo-400 transition-colors"
                    >
                      {d.name}
                    </Link>
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">{d.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && acAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span>Confirm Command</span>
              </h3>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
                {getConfirmMessage()}
              </p>
            </div>

            {pendingStatus === 'idle' && (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowConfirm(false); setAcAction(null); }}
                  className="px-4 py-2 border border-zinc-800 rounded text-sm text-zinc-450 hover:bg-zinc-800 hover:text-zinc-200 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeACAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white font-semibold cursor-pointer transition-colors"
                >
                  Confirm Command
                </button>
              </div>
            )}

            {pendingStatus === 'sending' && (
              <div className="flex items-center justify-center gap-3 py-2 text-zinc-300 font-semibold text-sm">
                <span className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
                <span>Sending...</span>
              </div>
            )}

            {pendingStatus === 'confirmed' && (
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-400 font-bold text-sm">
                <CheckCircle className="h-5 w-5 animate-bounce" />
                <span>Confirmed</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
