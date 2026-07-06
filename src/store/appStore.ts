import { create } from 'zustand';
import { 
  type Role, 
  type User, 
  type Device, 
  type Room, 
  type Alert, 
  INITIAL_USERS, 
  INITIAL_ROOMS, 
  INITIAL_DEVICES, 
  INITIAL_ALERTS 
} from '../lib/mockData';

interface AppState {
  isLoggedIn: boolean;
  currentUser: User | null;
  role: Role;
  rooms: Room[];
  devices: Device[];
  alerts: Alert[];
  users: User[];
  floorPlanUrl: string | null;
  
  // Auth Actions
  login: (username: string, role: Role) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  
  // Device Management Actions
  pairDevice: (
    deviceId: string, 
    name: string, 
    roomId: string, 
    mapX: number | null, 
    mapY: number | null, 
    warningThreshold: number | null, 
    criticalThreshold: number | null, 
    telegramAlerts: boolean
  ) => void;
  unpairDevice: (deviceId: string) => void;
  updateDeviceConfig: (
    deviceId: string, 
    samplingInterval: number, 
    warningThreshold: number | null, 
    criticalThreshold: number | null, 
    telegramAlerts: boolean,
    hysteresis: number | null,
    debounce: number | null
  ) => void;
  confirmPendingChanges: (deviceId: string) => void;
  controlAC: (deviceId: string, power: boolean, setpoint: number) => void;
  
  // Room Management Actions
  addRoom: (name: string) => void;
  renameRoom: (roomId: string, name: string) => void;
  deleteRoom: (roomId: string) => void;
  
  // User Management Actions
  addUser: (username: string, displayName: string, role: Role) => void;
  editUser: (username: string, displayName: string, role: Role) => void;
  deleteUser: (username: string) => void;
  
  // System Actions
  uploadFloorPlan: (url: string | null) => void;
  tickSimulation: (timestamp: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoggedIn: true, // Default to logged in for ease of assessment, but can be toggled
  currentUser: INITIAL_USERS[0], // Jane Doe (Admin)
  role: 'Admin',
  rooms: INITIAL_ROOMS,
  devices: INITIAL_DEVICES,
  alerts: INITIAL_ALERTS,
  users: INITIAL_USERS,
  floorPlanUrl: null, // Starts null, so the map shows the placeholder

  login: (username: string, role: Role) => set((state) => {
    const foundUser = state.users.find((u) => u.username === username);
    const user: User = foundUser ? { ...foundUser, role: role } : {
      username: username,
      displayName: username.charAt(0).toUpperCase() + username.slice(1),
      role: role,
      createdAt: new Date().toISOString()
    };
    
    // Add user if they don't exist
    const updatedUsers = foundUser ? state.users : [...state.users, user];
    
    return {
      isLoggedIn: true,
      currentUser: user,
      role: role,
      users: updatedUsers
    };
  }),

  logout: () => set({
    isLoggedIn: false,
    currentUser: null
  }),

  setRole: (role: Role) => set((state) => {
    if (state.currentUser) {
      return {
        role: role,
        currentUser: { ...state.currentUser, role: role }
      };
    }
    return { role: role };
  }),

  pairDevice: (
    deviceId: string, 
    name: string, 
    roomId: string, 
    mapX: number | null, 
    mapY: number | null, 
    warningThreshold: number | null, 
    criticalThreshold: number | null, 
    telegramAlerts: boolean
  ) => set((state) => {
    const updatedDevices = state.devices.map((d) => {
      if (d.id === deviceId) {
        return {
          ...d,
          name: name,
          roomId: roomId,
          mapX: mapX,
          mapY: mapY,
          warningThreshold: warningThreshold,
          criticalThreshold: criticalThreshold,
          telegramAlerts: telegramAlerts,
          lastSeen: 'Just now'
        };
      }
      return d;
    });

    return {
      devices: updatedDevices,
      rooms: recalculateRoomMetrics(state.rooms, updatedDevices)
    };
  }),

  unpairDevice: (deviceId: string) => set((state) => {
    const updatedDevices = state.devices.map((d) => {
      if (d.id === deviceId) {
        return {
          ...d,
          roomId: null,
          mapX: null,
          mapY: null,
          lastSeen: 'Just now'
        };
      }
      return d;
    });

    return {
      devices: updatedDevices,
      rooms: recalculateRoomMetrics(state.rooms, updatedDevices)
    };
  }),

  updateDeviceConfig: (
    deviceId: string, 
    samplingInterval: number, 
    warningThreshold: number | null, 
    criticalThreshold: number | null, 
    telegramAlerts: boolean,
    hysteresis: number | null,
    debounce: number | null
  ) => set((state) => {
    const updatedDevices = state.devices.map((d) => {
      if (d.id === deviceId) {
        return {
          ...d,
          pendingChanges: {
            samplingInterval: samplingInterval,
            warningThreshold: warningThreshold,
            criticalThreshold: criticalThreshold,
            telegramAlerts: telegramAlerts,
            hysteresis: hysteresis,
            debounce: debounce
          }
        };
      }
      return d;
    });
    return { devices: updatedDevices };
  }),

  confirmPendingChanges: (deviceId: string) => set((state) => {
    const updatedDevices = state.devices.map((d) => {
      if (d.id === deviceId && d.pendingChanges) {
        return {
          ...d,
          samplingInterval: d.pendingChanges.samplingInterval !== null ? d.pendingChanges.samplingInterval : d.samplingInterval,
          warningThreshold: d.pendingChanges.warningThreshold,
          criticalThreshold: d.pendingChanges.criticalThreshold,
          telegramAlerts: d.pendingChanges.telegramAlerts !== null ? d.pendingChanges.telegramAlerts : d.telegramAlerts,
          hysteresis: d.pendingChanges.hysteresis !== null ? d.pendingChanges.hysteresis : d.hysteresis,
          debounce: d.pendingChanges.debounce !== null ? d.pendingChanges.debounce : d.debounce,
          pendingChanges: null,
          lastSeen: 'Just now'
        };
      }
      return d;
    });

    return {
      devices: updatedDevices,
      rooms: recalculateRoomMetrics(state.rooms, updatedDevices)
    };
  }),

  controlAC: (deviceId: string, power: boolean, setpoint: number) => set((state) => {
    const updatedDevices = state.devices.map((d) => {
      if (d.id === deviceId) {
        return {
          ...d,
          lastReading: power ? `AC On ${setpoint}°C` : 'AC Off',
          lastSeen: 'Just now'
        };
      }
      return d;
    });
    return { devices: updatedDevices };
  }),

  addRoom: (name: string) => set((state) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    const newRoom: Room = {
      id: id,
      name: name,
      status: 'Offline',
      deviceCount: 0,
      lastUpdate: 'Never'
    };
    return { rooms: [...state.rooms, newRoom] };
  }),

  renameRoom: (roomId: string, name: string) => set((state) => {
    const updatedRooms = state.rooms.map((r) => {
      if (r.id === roomId) {
        return { ...r, name: name };
      }
      return r;
    });
    return { rooms: updatedRooms };
  }),

  deleteRoom: (roomId: string) => set((state) => {
    return {
      rooms: state.rooms.filter((r) => r.id !== roomId)
    };
  }),

  addUser: (username: string, displayName: string, role: Role) => set((state) => {
    const newUser: User = {
      username: username,
      displayName: displayName,
      role: role,
      createdAt: new Date().toISOString()
    };
    return { users: [...state.users, newUser] };
  }),

  editUser: (username: string, displayName: string, role: Role) => set((state) => {
    const updatedUsers = state.users.map((u) => {
      if (u.username === username) {
        return { ...u, displayName: displayName, role: role };
      }
      return u;
    });
    return { users: updatedUsers };
  }),

  deleteUser: (username: string) => set((state) => {
    return {
      users: state.users.filter((u) => u.username !== username)
    };
  }),

  uploadFloorPlan: (url: string | null) => set({
    floorPlanUrl: url
  }),

  tickSimulation: (timestamp: string) => set((state) => {
    let alertsUpdated = false;
    const newAlerts = [...state.alerts];

    const updatedDevices = state.devices.map((d) => {
      if (d.roomId === null || d.status === 'Offline') {
        return d;
      }

      if (d.type === 'Temperature') {
        // Parse current temp
        const match = d.lastReading.match(/([\d.]+)/);
        if (!match) return d;
        const currentTemp = parseFloat(match[1]);
        
        // Random drift -0.3 to +0.3
        const drift = (Math.random() * 0.6) - 0.3;
        const newTemp = Math.round((currentTemp + drift) * 10) / 10;
        
        // Check thresholds
        let newSeverity: 'Warning' | 'Critical' | null = null;
        let threshVal = '';

        if (d.criticalThreshold !== null && newTemp >= d.criticalThreshold) {
          newSeverity = 'Critical';
          threshVal = `> ${d.criticalThreshold}°C (critical)`;
        } else if (d.warningThreshold !== null && newTemp >= d.warningThreshold) {
          newSeverity = 'Warning';
          threshVal = `> ${d.warningThreshold}°C (warning)`;
        }

        // Trigger new alert if threshold crossed and no active alert for this device in last 10s
        if (newSeverity !== null) {
          const hasRecentAlert = state.alerts.some(
            (a) => a.deviceId === d.id && 
            (new Date(timestamp).getTime() - new Date(a.timestamp).getTime() < 30000)
          );

          if (!hasRecentAlert) {
            const roomObj = state.rooms.find((r) => r.id === d.roomId);
            const newAlertItem: Alert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              timestamp: timestamp,
              severity: newSeverity,
              deviceId: d.id,
              deviceName: d.name,
              roomId: d.roomId,
              roomName: roomObj ? roomObj.name : 'Unknown Room',
              parameter: 'Temperature',
              value: `${newTemp}°C`,
              threshold: threshVal
            };
            newAlerts.unshift(newAlertItem);
            alertsUpdated = true;
          }
        }

        return {
          ...d,
          lastReading: `${newTemp}°C`,
          lastSeen: '1s ago'
        };
      } else if (d.type === 'ATS') {
        // 5% chance to toggle ATS source
        if (Math.random() < 0.02) {
          const currentSource = d.lastReading;
          const nextSource = currentSource.includes('PLN') ? 'Genset (Backup)' : 'PLN (Grid)';
          
          const roomObj = state.rooms.find((r) => r.id === d.roomId);
          
          if (nextSource.includes('Genset')) {
            // Trigger Critical/Warning alert for grid loss
            const newAlertItem: Alert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              timestamp: timestamp,
              severity: 'Critical',
              deviceId: d.id,
              deviceName: d.name,
              roomId: d.roomId || '',
              roomName: roomObj ? roomObj.name : 'Unknown Room',
              parameter: 'Power Source',
              value: 'PLN Lost',
              threshold: 'Grid Fail'
            };
            newAlerts.unshift(newAlertItem);
            alertsUpdated = true;
          }

          return {
            ...d,
            lastReading: nextSource,
            lastSeen: '1s ago'
          };
        }
      }

      return {
        ...d,
        lastSeen: '1s ago'
      };
    });

    return {
      devices: updatedDevices,
      alerts: alertsUpdated ? newAlerts : state.alerts,
      rooms: recalculateRoomMetrics(state.rooms, updatedDevices)
    };
  })
}));

// Helper function to recalculate Room statuses and device counts based on devices list
function recalculateRoomMetrics(rooms: Room[], devices: Device[]): Room[] {
  return rooms.map((room) => {
    const roomDevices = devices.filter((d) => d.roomId === room.id);
    const deviceCount = roomDevices.length;
    
    if (deviceCount === 0) {
      return {
        ...room,
        status: 'Offline',
        deviceCount: 0,
        lastUpdate: 'Never'
      };
    }

    // Determine room status based on individual device thresholds
    let finalStatus: Room['status'] = 'Normal';
    let hasOnline = false;

    for (const d of roomDevices) {
      if (d.status === 'Online') {
        hasOnline = true;
        if (d.type === 'Temperature') {
          const match = d.lastReading.match(/([\d.]+)/);
          if (match) {
            const tempVal = parseFloat(match[1]);
            if (d.criticalThreshold !== null && tempVal >= d.criticalThreshold) {
              finalStatus = 'Critical';
            } else if (d.warningThreshold !== null && tempVal >= d.warningThreshold) {
              if (finalStatus !== 'Critical') {
                finalStatus = 'Warning';
              }
            }
          }
        } else if (d.type === 'ATS' && d.lastReading.includes('Genset')) {
          // If ATS is on Genset backup, room is in warning state
          if (finalStatus !== 'Critical') {
            finalStatus = 'Warning';
          }
        }
      }
    }

    if (!hasOnline) {
      finalStatus = 'Offline';
    }

    return {
      ...room,
      status: finalStatus,
      deviceCount: deviceCount,
      lastUpdate: '1s ago'
    };
  });
}
