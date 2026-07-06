import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { 
  Thermometer, 
  Layers, 
  AlertTriangle, 
  HardDrive, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { z } from 'zod';

const dashboardSearchSchema = z.object({
  sortBy: z.enum(['name', 'type', 'room', 'macAddress', 'status', 'lastReading', 'lastSeen']).optional().catch('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().catch('asc'),
});

export const Route = createFileRoute('/')({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  component: DashboardPage
});

function parseLastSeenToSeconds(lastSeen: string): number {
  if (lastSeen === 'Never') {
    return Infinity;
  }
  const match = lastSeen.match(/^(\d+)(s|m|h|d)\s+ago$/);
  if (!match) {
    return 0;
  }
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return value;
  }
}

function DashboardPage() {
  const rooms = useAppStore((state) => state.rooms);
  const devices = useAppStore((state) => state.devices);
  const navigate = useNavigate();

  const { sortBy, sortOrder } = Route.useSearch();

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Normal': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };



  const getRoomTemperature = (roomId: string): string => {
    const roomTemps = devices.filter((d) => d.roomId === roomId && d.type === 'Temperature' && d.status === 'Online');
    if (roomTemps.length === 0) return '--';
    return roomTemps[0].lastReading;
  };

  const renderHeader = (
    label: string, 
    key: 'name' | 'type' | 'room' | 'macAddress' | 'status' | 'lastReading' | 'lastSeen'
  ): React.ReactNode => {
    const isActive = sortBy === key;
    return (
      <th className="px-6 py-4">
        <Link
          to="."
          search={(prev) => ({
            ...prev,
            sortBy: key,
            sortOrder: isActive ? (prev.sortOrder === 'asc' ? 'desc' : 'asc') : 'asc',
          })}
          className="group inline-flex items-center gap-1.5 hover:text-indigo-400 transition-colors cursor-pointer select-none"
        >
          <span>{label}</span>
          {isActive ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5 text-indigo-400" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-indigo-400" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </Link>
      </th>
    );
  };

  const sortedDevices = [...devices].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        break;
      case 'type':
        comparison = a.type.toLowerCase().localeCompare(b.type.toLowerCase());
        break;
      case 'room': {
        const nameA = (rooms.find((r) => r.id === a.roomId)?.name || 'Unpaired').toLowerCase();
        const nameB = (rooms.find((r) => r.id === b.roomId)?.name || 'Unpaired').toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      }
      case 'macAddress':
        comparison = a.macAddress.toLowerCase().localeCompare(b.macAddress.toLowerCase());
        break;
      case 'status':
        comparison = a.status.toLowerCase().localeCompare(b.status.toLowerCase());
        break;
      case 'lastReading':
        comparison = a.lastReading.toLowerCase().localeCompare(b.lastReading.toLowerCase());
        break;
      case 'lastSeen': {
        const secA = parseLastSeenToSeconds(a.lastSeen);
        const secB = parseLastSeenToSeconds(b.lastSeen);
        comparison = secA - secB;
        break;
      }
      default:
        comparison = 0;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-8">
      {/* Overview stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Total Rooms</p>
            <h3 className="text-2xl font-bold text-zinc-100">{rooms.length}</h3>
          </div>
          <Layers className="h-8 w-8 text-indigo-500/40" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Active Devices</p>
            <h3 className="text-2xl font-bold text-zinc-100">
              {devices.filter((d) => d.status === 'Online').length}
            </h3>
          </div>
          <HardDrive className="h-8 w-8 text-indigo-500/40" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Warning Status</p>
            <h3 className="text-2xl font-bold text-amber-400">
              {rooms.filter((r) => r.status === 'Warning').length}
            </h3>
          </div>
          <AlertTriangle className="h-8 w-8 text-amber-500/40" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Critical Alerts</p>
            <h3 className="text-2xl font-bold text-red-500">
              {rooms.filter((r) => r.status === 'Critical').length}
            </h3>
          </div>
          <AlertTriangle className="h-8 w-8 text-red-500/40" />
        </div>
      </div>

      {/* Rooms Section */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">Rooms</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rooms.map((room) => {
            const currentTemp = getRoomTemperature(room.id);
            return (
              <Link
                key={room.id}
                to="/room/$roomId"
                params={{ roomId: room.id }}
                search={{}}
                className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 flex flex-col justify-between transition-all duration-300 group cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {room.name}
                    </h4>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <span className="text-xs text-zinc-500 font-medium">{room.deviceCount} paired devices</span>
                      <span className="text-[10px] text-zinc-550 font-medium">Updated {room.lastUpdate}</span>
                    </div>
                  </div>
                  <div className={cn("px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5", getStatusColor(room.status))}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      room.status === 'Normal' && 'bg-emerald-400',
                      room.status === 'Warning' && 'bg-amber-400',
                      room.status === 'Critical' && 'bg-red-400',
                      room.status === 'Offline' && 'bg-zinc-400'
                    )} />
                    <span>{room.status}</span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between mt-auto">
                  <span className="text-xs text-zinc-500 font-medium">Ambient Temperature</span>
                  <span className="text-3xl font-extrabold text-zinc-100 tracking-tight">{currentTemp}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Node Table (Devices) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">All Connected Nodes</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <tr>
                  {renderHeader('Device Name', 'name')}
                  {renderHeader('Type', 'type')}
                  {renderHeader('Room', 'room')}
                  {renderHeader('MAC Address', 'macAddress')}
                  {renderHeader('Status', 'status')}
                  {renderHeader('Last Reading', 'lastReading')}
                  {renderHeader('Last Seen', 'lastSeen')}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {sortedDevices.map((device) => {
                  const room = rooms.find((r) => r.id === device.roomId);
                  return (
                    <tr 
                      key={device.id} 
                      onClick={() => navigate({ to: '/device/$deviceId', params: { deviceId: device.id } })}
                      className={cn(
                        "hover:bg-zinc-850/50 transition-colors cursor-pointer",
                        device.status === 'Offline' && "opacity-50"
                      )}
                    >
                      <td className="px-6 py-4 font-medium text-zinc-100 group-hover:text-indigo-400 transition-colors">
                        {device.name}
                        {!device.roomId && (
                          <span className="text-zinc-500 font-normal italic text-xs ml-1.5">(Unpaired)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-md border border-zinc-700">
                          {device.type === 'Temperature' && <Thermometer className="h-3.5 w-3.5 text-indigo-400" />}
                          {device.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {device.roomId && room ? (
                          <Link
                            to="/room/$roomId"
                            params={{ roomId: device.roomId }}
                            search={{}}
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-400 hover:underline hover:text-indigo-300 transition-colors font-medium"
                          >
                            {room.name}
                          </Link>
                        ) : (
                          <span className="text-zinc-500 italic">Unpaired</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-zinc-400">{device.macAddress}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold",
                          device.status === 'Online' ? 'text-emerald-400' : 'text-zinc-500'
                        )}>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            device.status === 'Online' ? 'bg-emerald-500' : 'bg-zinc-500'
                          )} />
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-200">{device.lastReading}</td>
                      <td className="px-6 py-4 text-xs text-zinc-500">{device.lastSeen}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
