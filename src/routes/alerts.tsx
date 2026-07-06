import { createFileRoute, Link } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { z } from 'zod';

const alertsSearchSchema = z.object({
  rooms: z.preprocess(
    (val) => (Array.isArray(val) ? val : typeof val === 'string' ? [val] : []),
    z.array(z.string())
  ).catch([]).optional(),
  devices: z.preprocess(
    (val) => (Array.isArray(val) ? val : typeof val === 'string' ? [val] : []),
    z.array(z.string())
  ).catch([]).optional(),
  severity: z.enum(['All', 'Warning', 'Critical']).catch('All').optional(),
  timeRange: z.enum(['6h', '24h', '7d', '30d']).catch('24h').optional(),
});

export const Route = createFileRoute('/alerts')({
  validateSearch: (search) => alertsSearchSchema.parse(search),
  component: AlertsPage
});

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelect({ label, placeholder, options, selected, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded px-3 py-2 text-zinc-300 text-sm focus:outline-none focus:border-indigo-500 text-left transition-colors cursor-pointer"
      >
        <span className="truncate">
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-full bg-zinc-950 border border-zinc-800 rounded shadow-xl max-h-60 overflow-y-auto p-1 divide-y divide-zinc-900">
          <div className="py-1">
            <button
              type="button"
              onClick={selectAll}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-400 hover:bg-zinc-900 rounded text-left font-semibold cursor-pointer"
            >
              <div className={cn(
                "w-3.5 h-3.5 rounded border border-zinc-700 flex items-center justify-center bg-zinc-950",
                selected.length === 0 && "bg-indigo-650 border-indigo-650"
              )}>
                {selected.length === 0 && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              All (Clear Filters)
            </button>
          </div>
          <div className="py-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleOption(opt.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 rounded text-left cursor-pointer"
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded border border-zinc-750 flex items-center justify-center bg-zinc-950",
                    isChecked && "bg-indigo-650 border-indigo-650"
                  )}>
                    {isChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="truncate">{opt.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertsPage() {
  const { alerts, rooms, devices } = useAppStore();
  const { rooms: selectedRooms = [], devices: selectedDevices = [], severity: selectedSeverity = 'All', timeRange: selectedTimeRange = '24h' } = Route.useSearch();
  const navigate = Route.useNavigate();

  const updateSearch = (newParams: Partial<z.infer<typeof alertsSearchSchema>>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...newParams,
      }),
    });
  };

  // Filter logic
  const filteredAlerts = alerts.filter((alert) => {
    // Room Filter (multi-select)
    if (selectedRooms.length > 0 && !selectedRooms.includes(alert.roomId)) return false;

    // Device Filter (multi-select)
    if (selectedDevices.length > 0 && !selectedDevices.includes(alert.deviceId)) return false;

    // Severity Filter
    if (selectedSeverity !== 'All' && alert.severity !== selectedSeverity) return false;
    
    // Time Filter (relative duration calculation)
    const alertTime = new Date(alert.timestamp).getTime();
    const now = Date.now();
    let durationMs = 24 * 60 * 60 * 1000; // default 24h
    if (selectedTimeRange === '6h') {
      durationMs = 6 * 60 * 60 * 1000;
    } else if (selectedTimeRange === '7d') {
      durationMs = 7 * 24 * 60 * 60 * 1000;
    } else if (selectedTimeRange === '30d') {
      durationMs = 30 * 24 * 60 * 60 * 1000;
    }
    
    if (now - alertTime > durationMs) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Alerts History</h1>
        <p className="text-zinc-500 text-sm mt-1">Real-time log of threshold violations and hardware events</p>
      </div>

      {/* Filter Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Filter className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Search Filters</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Room filter */}
          <MultiSelect
            label="Filter by Room"
            placeholder="All Rooms"
            options={rooms}
            selected={selectedRooms}
            onChange={(val) => updateSearch({ rooms: val })}
          />

          {/* Device filter */}
          <MultiSelect
            label="Filter by Device"
            placeholder="All Devices"
            options={devices}
            selected={selectedDevices}
            onChange={(val) => updateSearch({ devices: val })}
          />

          {/* Severity toggle */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Severity Level</label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-950 p-1 rounded border border-zinc-850">
              {(['All', 'Warning', 'Critical'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => updateSearch({ severity: sev })}
                  className={cn(
                    "text-[10px] font-bold py-1.5 rounded transition-all cursor-pointer",
                    selectedSeverity === sev 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Time range picker */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Time Range</label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded border border-zinc-850">
              {(['6h', '24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => updateSearch({ timeRange: range })}
                  className={cn(
                    "text-[10px] font-bold py-1.5 rounded transition-all cursor-pointer",
                    selectedTimeRange === range 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950 text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Device</th>
                <th className="px-6 py-4">Room</th>
                <th className="px-6 py-4">Parameter</th>
                <th className="px-6 py-4">Trigger Value</th>
                <th className="px-6 py-4">Threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-zinc-850/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border",
                      alert.severity === 'Critical' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    )}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-zinc-200">
                    <Link
                      to="/device/$deviceId"
                      params={{ deviceId: alert.deviceId }}
                      className="hover:text-indigo-400 hover:underline transition-colors"
                    >
                      {alert.deviceName}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to="/room/$roomId"
                      params={{ roomId: alert.roomId }}
                      search={{}}
                      className="hover:text-indigo-400 hover:underline transition-colors text-zinc-400 font-medium"
                    >
                      {alert.roomName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{alert.parameter}</td>
                  <td className="px-6 py-4 font-bold text-zinc-150">{alert.value}</td>
                  <td className="px-6 py-4 text-zinc-500">{alert.threshold}</td>
                </tr>
              ))}

              {filteredAlerts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 italic">
                    No alerts matching filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
