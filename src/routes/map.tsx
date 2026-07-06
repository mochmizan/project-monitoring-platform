import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { Thermometer, Zap, Wind, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { type Device } from '../lib/mockData';

export const Route = createFileRoute('/map')({
  component: MapPage
});

function MapPage() {
  const router = useRouter();
  const devices = useAppStore((state) => state.devices);
  const floorPlanUrl = useAppStore((state) => state.floorPlanUrl);
  const [hoveredDevice, setHoveredDevice] = useState<Device | null>(null);

  const getMarkerColor = (device: Device): string => {
    if (device.status === 'Offline') return 'bg-zinc-500 border-zinc-450';
    if (device.type === 'Temperature') {
      const match = device.lastReading.match(/([\d.]+)/);
      if (match) {
        const tempVal = parseFloat(match[1]);
        if (device.criticalThreshold !== null && tempVal >= device.criticalThreshold) {
          return 'bg-red-500 border-red-300 shadow-red-500/50 animate-pulse';
        }
        if (device.warningThreshold !== null && tempVal >= device.warningThreshold) {
          return 'bg-amber-500 border-amber-300 shadow-amber-500/50 animate-pulse';
        }
      }
      return 'bg-emerald-500 border-emerald-350 shadow-emerald-500/30';
    } else if (device.type === 'ATS') {
      if (device.lastReading.includes('Genset')) return 'bg-amber-500 border-amber-300';
      return 'bg-emerald-500 border-emerald-350 shadow-emerald-500/30';
    }
    return 'bg-emerald-500 border-emerald-350 shadow-emerald-500/30';
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'Temperature': return <Thermometer className="h-3.5 w-3.5 text-white" />;
      case 'ATS': return <Zap className="h-3.5 w-3.5 text-white" />;
      case 'AC': return <Wind className="h-3.5 w-3.5 text-white" />;
      default: return <HelpCircle className="h-3.5 w-3.5 text-white" />;
    }
  };

  const pairedDevices = devices.filter((d) => d.roomId !== null && d.mapX !== null && d.mapY !== null);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Facility Floor Map</h1>
        <p className="text-zinc-500 text-sm mt-1">Live status of paired nodes overlaid on facility layout</p>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col items-center justify-center min-h-[500px] relative">
        {floorPlanUrl === null ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2 min-h-[400px]">
            <HelpCircle className="h-8 w-8 text-zinc-650" />
            <p className="text-sm">No floor plan uploaded. An admin can upload one in Settings.</p>
          </div>
        ) : (
          /* custom uploaded floorplan image */
          <div className="relative w-full max-w-4xl aspect-[16/10] bg-zinc-950 border border-zinc-850 rounded-lg overflow-hidden select-none">
            <img src={floorPlanUrl} alt="Facility Floor Plan" className="w-full h-full object-cover opacity-50" />
            
            {/* Render Node Markers */}
            {pairedDevices.map((device) => {
              const x = device.mapX !== null ? device.mapX : 0;
              const y = device.mapY !== null ? device.mapY : 0;

              return (
                <div
                  key={device.id}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                >
                  <button
                    onClick={() => router.navigate({ to: '/device/$deviceId', params: { deviceId: device.id } })}
                    onMouseEnter={() => setHoveredDevice(device)}
                    onMouseLeave={() => setHoveredDevice(null)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 active:scale-95 transition-all duration-150",
                      getMarkerColor(device)
                    )}
                  >
                    {getDeviceIcon(device.type)}
                  </button>

                  {/* Tooltip on hover */}
                  {hoveredDevice?.id === device.id && (
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 rounded-lg p-3.5 shadow-2xl z-30 w-56 pointer-events-none space-y-1">
                      <h5 className="font-bold text-zinc-100 text-xs">{device.name}</h5>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{device.type}</div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800">
                        <span className="text-[10px] text-zinc-400">Telemetry:</span>
                        <span className="text-xs font-bold text-indigo-400">{device.lastReading}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">Last Seen:</span>
                        <span className="text-[10px] text-zinc-500">{device.lastSeen}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
