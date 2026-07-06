import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useAppStore } from '../store/appStore';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { 
  Users as UsersIcon, 
  Cpu, 
  Sliders, 
  Plus, 
  Trash2, 
  Radio, 
  MapPin, 
  ShieldAlert
} from 'lucide-react';
import { type Role, type User } from '../lib/mockData';
import { z } from 'zod';

const settingsSearchSchema = z.object({
  tab: z.enum(['users', 'devices', 'system']).catch('users').optional(),
});

export const Route = createFileRoute('/settings')({
  beforeLoad: () => {
    const { role } = useAppStore.getState();
    if (role !== 'Admin') {
      throw redirect({ to: '/' });
    }
  },
  validateSearch: (search) => settingsSearchSchema.parse(search),
  component: SettingsPage
});

function SettingsPage() {
  const router = useRouter();
  const { tab } = Route.useSearch();
  const activeTab = tab || 'users';

  const role = useAppStore((state) => state.role);
  const users = useAppStore((state) => state.users);
  const rooms = useAppStore((state) => state.rooms);
  const devices = useAppStore((state) => state.devices);
  const addUser = useAppStore((state) => state.addUser);
  const editUser = useAppStore((state) => state.editUser);
  const deleteUser = useAppStore((state) => state.deleteUser);
  const pairDevice = useAppStore((state) => state.pairDevice);
  const unpairDevice = useAppStore((state) => state.unpairDevice);
  const addRoom = useAppStore((state) => state.addRoom);
  const renameRoom = useAppStore((state) => state.renameRoom);
  const deleteRoom = useAppStore((state) => state.deleteRoom);
  const uploadFloorPlan = useAppStore((state) => state.uploadFloorPlan);
  const floorPlanUrl = useAppStore((state) => state.floorPlanUrl);
  const currentUser = useAppStore((state) => state.currentUser);

  // Tab 1: Users States
  const [newUsername, setNewUsername] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<Role>('Viewer');
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Tab 2: Devices pairing/editing States
  const [selectedUnpairedId, setSelectedUnpairedId] = useState<string | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [pairName, setPairName] = useState<string>('');
  const [pairRoomId, setPairRoomId] = useState<string>('');
  const [pairWarn, setPairWarn] = useState<string>('30');
  const [pairCrit, setPairCrit] = useState<string>('35');
  const [pairTelegram, setPairTelegram] = useState<boolean>(false);
  const [showNewRoomInput, setShowNewRoomInput] = useState<boolean>(false);
  const [inlineNewRoomName, setInlineNewRoomName] = useState<string>('');
  const [deviceToUnpair, setDeviceToUnpair] = useState<string | null>(null);

  // Tab 3: System States
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [renamingRoomId, setRenamingRoomId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  if (role !== 'Admin') {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-lg text-center space-y-2">
        <ShieldAlert className="h-8 w-8 mx-auto" />
        <h4 className="font-bold">Access Denied</h4>
        <p className="text-sm">You must be logged in as an Administrator to view Settings.</p>
      </div>
    );
  }

  // Handlers
  const handleUserSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUsername.trim() || !newDisplayName.trim()) return;

    if (editingUsername !== null) {
      editUser(editingUsername, newDisplayName.trim(), newUserRole);
      setEditingUsername(null);
    } else {
      addUser(newUsername.trim().toLowerCase(), newDisplayName.trim(), newUserRole);
    }
    setNewUsername('');
    setNewDisplayName('');
    setNewUserRole('Viewer');
  };

  const startEditUser = (u: User) => {
    setEditingUsername(u.username);
    setNewUsername(u.username);
    setNewDisplayName(u.displayName);
    setNewUserRole(u.role);
  };

  const handlePairSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const activeId = selectedUnpairedId !== null ? selectedUnpairedId : editingDeviceId;
    if (!activeId || !pairName.trim()) return;

    const deviceObj = devices.find((d) => d.id === activeId);
    if (!deviceObj) return;

    let targetRoomId = pairRoomId;
    if (showNewRoomInput && inlineNewRoomName.trim() !== '') {
      const generatedId = inlineNewRoomName.trim().toLowerCase().replace(/\s+/g, '-');
      addRoom(inlineNewRoomName.trim());
      targetRoomId = generatedId;
    }

    if (!targetRoomId) return;

    const warn = pairWarn === '' ? null : parseFloat(pairWarn);
    const crit = pairCrit === '' ? null : parseFloat(pairCrit);

    // Keep existing map position if editing, or choose random one if pairing for first time
    const mapX = deviceObj.mapX !== null ? deviceObj.mapX : Math.round(20 + Math.random() * 60);
    const mapY = deviceObj.mapY !== null ? deviceObj.mapY : Math.round(20 + Math.random() * 60);

    pairDevice(
      activeId,
      pairName.trim(),
      targetRoomId,
      mapX,
      mapY,
      warn,
      crit,
      pairTelegram
    );

    setSelectedUnpairedId(null);
    setEditingDeviceId(null);
    setPairName('');
    setPairRoomId('');
    setPairWarn('');
    setPairCrit('');
    setPairTelegram(false);
    setShowNewRoomInput(false);
    setInlineNewRoomName('');
  };

  const handleAddRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    addRoom(newRoomName.trim());
    setNewRoomName('');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          uploadFloorPlan(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const unpaired = devices.filter((d) => d.roomId === null);
  const paired = devices.filter((d) => d.roomId !== null);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings Panel</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage users, pair MQTT hardware nodes, and configure rooms</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-zinc-800 gap-2">
        <button
          onClick={() => router.navigate({ to: '/settings', search: { tab: 'users' } })}
          className={cn(
            "px-5 py-3 border-b-2 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'users' 
              ? "border-indigo-500 text-indigo-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <UsersIcon className="h-4 w-4" />
          <span>User Accounts</span>
        </button>
        
        <button
          onClick={() => router.navigate({ to: '/settings', search: { tab: 'devices' } })}
          className={cn(
            "px-5 py-3 border-b-2 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'devices' 
              ? "border-indigo-500 text-indigo-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Cpu className="h-4 w-4" />
          <span>Hardware & Pairing</span>
        </button>

        <button
          onClick={() => router.navigate({ to: '/settings', search: { tab: 'system' } })}
          className={cn(
            "px-5 py-3 border-b-2 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer",
            activeTab === 'system' 
              ? "border-indigo-500 text-indigo-400" 
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Sliders className="h-4 w-4" />
          <span>System Config</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        
        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Add/Edit User Form */}
              <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-lg space-y-4 h-fit">
                <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-1.5">
                  {editingUsername !== null ? (
                    <Sliders className="h-4 w-4 text-indigo-500" />
                  ) : (
                    <Plus className="h-4 w-4 text-indigo-500" />
                  )}
                  <span>{editingUsername !== null ? 'Edit User Account' : 'Create User Account'}</span>
                </h4>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-500 font-semibold mb-2">Username</label>
                    <input
                      type="text"
                      required
                      disabled={editingUsername !== null}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. operations-east"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 font-semibold mb-2">Display Name</label>
                    <input
                      type="text"
                      required
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="e.g. East Office Admin"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 font-semibold mb-2">System Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Admin' || val === 'Operator' || val === 'Viewer') {
                          setNewUserRole(val);
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Operator">Operator</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {editingUsername !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUsername(null);
                          setNewUsername('');
                          setNewDisplayName('');
                          setNewUserRole('Viewer');
                        }}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-350 font-bold py-2 rounded text-sm transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm transition-colors cursor-pointer"
                    >
                      {editingUsername !== null ? 'Save Changes' : 'Register User'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Users List */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="font-bold text-zinc-200 text-sm">Active Credentials</h4>
                <div className="border border-zinc-800/80 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-zinc-950 text-xs text-zinc-500 border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-3">Display Name</th>
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Created Date</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                      {users.map((u) => (
                        <tr key={u.username}>
                          <td className="px-4 py-3 font-semibold text-zinc-200">{u.displayName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.username}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              u.role === 'Admin' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                              u.role === 'Operator' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            )}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {userToDelete === u.username ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-red-400 font-semibold">Delete?</span>
                                <button
                                  onClick={() => {
                                    deleteUser(u.username);
                                    setUserToDelete(null);
                                  }}
                                  className="text-xs bg-red-650 hover:bg-red-500 text-white py-1 px-2.5 rounded font-bold transition-all cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setUserToDelete(null)}
                                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-355 py-1 px-2.5 rounded transition-all cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  onClick={() => startEditUser(u)}
                                  className="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
                                  title="Edit User"
                                >
                                  <Sliders className="h-4 w-4 inline" />
                                </button>
                                <button
                                  onClick={() => setUserToDelete(u.username)}
                                  disabled={u.username === currentUser?.username}
                                  className="text-zinc-550 hover:text-red-400 disabled:opacity-30 transition-colors cursor-pointer"
                                  title={u.username === currentUser?.username ? "Cannot delete your own account" : "Delete User"}
                                >
                                  <Trash2 className="h-4 w-4 inline" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEVICES TAB */}
        {activeTab === 'devices' && (
          <div className="space-y-8">
            {/* Unpaired Hardware Feed */}
            <div className="space-y-4">
              <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                <Radio className="h-4 w-4 text-amber-500 animate-pulse" />
                <span>MQTT Auto-Discovery Feed (Unpaired Nodes)</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpaired.map((d) => (
                  <div key={d.id} className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-zinc-355">{d.macAddress}</span>
                        <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-semibold uppercase">{d.type}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500">Firmware: {d.firmwareVersion} • Signal: -48dBm</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedUnpairedId(d.id);
                        setEditingDeviceId(null);
                        setPairName(d.name);
                        setPairRoomId(rooms[0]?.id || '');
                        setPairWarn(d.warningThreshold !== null ? String(d.warningThreshold) : '');
                        setPairCrit(d.criticalThreshold !== null ? String(d.criticalThreshold) : '');
                        setPairTelegram(d.telegramAlerts);
                        setShowNewRoomInput(false);
                      }}
                      className="mt-4 w-full bg-indigo-600/10 border border-indigo-500/25 hover:bg-indigo-600/25 text-indigo-400 text-xs py-2 rounded font-bold transition-all cursor-pointer"
                    >
                      Pair Module to Room
                    </button>
                  </div>
                ))}

                {unpaired.length === 0 && (
                  <div className="col-span-3 border border-dashed border-zinc-800 p-8 rounded-lg text-center text-zinc-500 text-xs">
                    No new auto-discovered hardware nodes detected on broker.
                  </div>
                )}
              </div>
            </div>

            {/* Pairing/Editing Wizard Form Overlay */}
            {(selectedUnpairedId !== null || editingDeviceId !== null) && (() => {
              const activeId = selectedUnpairedId !== null ? selectedUnpairedId : editingDeviceId;
              const deviceObj = devices.find((d) => d.id === activeId);
              if (!deviceObj) return null;
              
              const isEditMode = editingDeviceId !== null;
              
              return (
                <div className="bg-zinc-950 border border-indigo-500/30 p-5 rounded-lg space-y-4 w-full max-w-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  <h4 className="font-bold text-indigo-400 text-sm">
                    {isEditMode ? `Edit Device Config (${deviceObj.macAddress})` : `Pairing Wizard (${deviceObj.macAddress})`}
                  </h4>
                  <form onSubmit={handlePairSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-500 font-semibold mb-2">Node Display Name</label>
                      <input
                        type="text"
                        required
                        value={pairName}
                        onChange={(e) => setPairName(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 font-semibold mb-2">Assign to Room Space</label>
                      <select
                        value={pairRoomId}
                        required={!showNewRoomInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__create_new__') {
                            setShowNewRoomInput(true);
                            setPairRoomId('');
                          } else {
                            setShowNewRoomInput(false);
                            setPairRoomId(val);
                          }
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none"
                      >
                        <option value="" disabled>Select Space...</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                        <option value="__create_new__">+ Create new room...</option>
                      </select>
                      
                      {showNewRoomInput && (
                        <div className="mt-2 animate-in fade-in duration-200">
                          <label className="block text-[10px] text-zinc-500 font-semibold mb-1">New Room Name</label>
                          <input
                            type="text"
                            required={showNewRoomInput}
                            value={inlineNewRoomName}
                            onChange={(e) => setInlineNewRoomName(e.target.value)}
                            placeholder="e.g. Lab Room 4"
                            className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-1.5 text-zinc-250 text-sm focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {deviceObj.type === 'Temperature' && (
                      <>
                        <div>
                          <label className="block text-xs text-zinc-500 font-semibold mb-2">Warning Temp Threshold (°C)</label>
                          <input
                            type="number"
                            value={pairWarn}
                            onChange={(e) => setPairWarn(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-500 font-semibold mb-2">Critical Temp Threshold (°C)</label>
                          <input
                            type="number"
                            value={pairCrit}
                            onChange={(e) => setPairCrit(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between py-2 md:col-span-2">
                      <span className="text-xs text-zinc-500 font-semibold uppercase">Send Critical Telemetry to Telegram</span>
                      <button
                        type="button"
                        onClick={() => setPairTelegram(!pairTelegram)}
                        className={cn(
                          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                          pairTelegram ? "bg-indigo-600" : "bg-zinc-800"
                        )}
                      >
                        <span className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition duration-200",
                          pairTelegram ? "translate-x-5" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="md:col-span-2 text-xs text-zinc-550 bg-zinc-950 p-3 border border-zinc-850 rounded">
                      {isEditMode ? `Map position: currently at (${deviceObj.mapX}%, ${deviceObj.mapY}%)` : 'Map position can be set after pairing'}
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUnpairedId(null);
                          setEditingDeviceId(null);
                          setShowNewRoomInput(false);
                          setInlineNewRoomName('');
                        }}
                        className="px-4 py-2 border border-zinc-850 hover:bg-zinc-800 rounded text-xs text-zinc-400 cursor-pointer"
                      >
                        Abort
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold cursor-pointer"
                      >
                        {isEditMode ? 'Save Configuration' : 'Complete Pairing'}
                      </button>
                    </div>
                  </form>
                </div>
              );
            })()}

            {/* Paired Devices List */}
            <div className="space-y-4 pt-4 border-t border-zinc-800/80">
              <h4 className="font-bold text-zinc-200 text-sm">Active Paired Hardware</h4>
              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-zinc-950 text-xs text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Device Name</th>
                      <th className="px-4 py-3">MAC / Firmware</th>
                      <th className="px-4 py-3">Assigned Room</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                    {paired.map((d) => {
                      const deviceRoom = rooms.find((r) => r.id === d.roomId);
                      return (
                        <tr key={d.id}>
                          <td className="px-4 py-3 font-semibold text-zinc-200">{d.name}</td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-zinc-400">{d.macAddress}</div>
                            <span className="text-[10px] text-zinc-550">{d.firmwareVersion} • {d.type}</span>
                          </td>
                          <td className="px-4 py-3 text-indigo-400 font-medium">{deviceRoom ? deviceRoom.name : 'Unknown'}</td>
                          <td className="px-4 py-3 text-right">
                            {deviceToUnpair === d.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-xs text-red-400 font-semibold">Unpair?</span>
                                <button
                                  onClick={() => {
                                    unpairDevice(d.id);
                                    setDeviceToUnpair(null);
                                  }}
                                  className="text-xs bg-red-650 hover:bg-red-500 text-white py-1 px-2.5 rounded font-bold transition-all cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeviceToUnpair(null)}
                                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-355 py-1 px-2.5 rounded transition-all cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setEditingDeviceId(d.id);
                                    setSelectedUnpairedId(null);
                                    setPairName(d.name);
                                    setPairRoomId(d.roomId || '');
                                    setPairWarn(d.warningThreshold !== null ? String(d.warningThreshold) : '');
                                    setPairCrit(d.criticalThreshold !== null ? String(d.criticalThreshold) : '');
                                    setPairTelegram(d.telegramAlerts);
                                    setShowNewRoomInput(false);
                                  }}
                                  className="text-xs font-bold border border-zinc-750 text-zinc-300 bg-zinc-950 hover:bg-zinc-900 py-1 px-2.5 rounded transition-all cursor-pointer"
                                >
                                  Edit Config
                                </button>
                                <button
                                  onClick={() => setDeviceToUnpair(d.id)}
                                  className="text-xs font-bold border border-red-500/25 text-red-400 bg-red-500/5 hover:bg-red-500/15 py-1 px-2.5 rounded transition-all cursor-pointer"
                                >
                                  Unpair Device
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SYSTEM CONFIG TAB */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Map Upload Configuration */}
            <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-lg space-y-4">
              <h4 className="font-bold text-zinc-200 text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-500" />
                <span>Floor Plan Layout Settings</span>
              </h4>
              <p className="text-zinc-555 text-xs leading-relaxed">
                Upload a floor plan image file to display on the map overlays. Dropping a file will instantly replace the active layout.
              </p>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center",
                  isDragging 
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" 
                    : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/30"
                )}
                onClick={() => document.getElementById('floorplan-file')?.click()}
              >
                <input
                  type="file"
                  id="floorplan-file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                
                {floorPlanUrl ? (
                  <div className="space-y-4 w-full">
                    <div className="relative aspect-[16/10] w-full max-w-xs mx-auto border border-zinc-800 rounded overflow-hidden">
                      <img src={floorPlanUrl} alt="Uploaded Floor Plan" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-xs text-zinc-300">Custom floor plan image active.</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById('floorplan-file')?.click();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-3 rounded text-xs transition-colors cursor-pointer"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          uploadFloorPlan(null);
                        }}
                        className="bg-red-650 hover:bg-red-500 text-white font-bold py-1 px-3 rounded text-xs transition-colors cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-zinc-900 rounded-full w-fit mx-auto">
                      <MapPin className="h-6 w-6 text-zinc-500" />
                    </div>
                    <div className="text-sm font-semibold text-zinc-200">Drag & Drop Floor Plan Image</div>
                    <p className="text-xs text-zinc-500">Supports PNG, JPG, or SVG. Or click to browse files.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Room management */}
            <div className="bg-zinc-950 border border-zinc-850 p-5 rounded-lg space-y-6">
              <h4 className="font-bold text-zinc-200 text-sm">Room & Space Management</h4>
              
              <form onSubmit={handleAddRoom} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Lab Room 4"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-250 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Space</span>
                </button>
              </form>

              <div className="space-y-2">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider block">Defined Spaces</span>
                <ul className="divide-y divide-zinc-800/80 border border-zinc-850 rounded overflow-hidden">
                  {rooms.map((r) => (
                    <li key={r.id} className="flex items-center justify-between p-3 bg-zinc-900/30">
                      {renamingRoomId === r.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-4">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="bg-zinc-955 border border-zinc-800 rounded px-2 py-1 text-zinc-250 text-sm focus:outline-none flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              if (renameValue.trim()) {
                                renameRoom(r.id, renameValue.trim());
                                setRenamingRoomId(null);
                              }
                            }}
                            className="bg-emerald-650 hover:bg-emerald-500 text-white font-bold py-1 px-2.5 rounded text-xs transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setRenamingRoomId(null)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 py-1 px-2.5 rounded text-xs transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-sm text-zinc-200">{r.name}</span>
                          <span className="text-[10px] text-zinc-500 ml-3">{r.deviceCount} paired nodes</span>
                        </div>
                      )}
                      
                      {roomToDelete === r.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400 font-semibold">Delete Room?</span>
                          <button
                            onClick={() => {
                              deleteRoom(r.id);
                              setRoomToDelete(null);
                            }}
                            className="bg-red-650 hover:bg-red-500 text-white font-bold py-1 px-2.5 rounded text-xs transition-colors cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setRoomToDelete(null)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 py-1 px-2.5 rounded text-xs transition-colors cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : renamingRoomId !== r.id ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setRenamingRoomId(r.id);
                              setRenameValue(r.name);
                            }}
                            className="text-zinc-400 hover:text-indigo-400 transition-colors cursor-pointer"
                            title="Rename Space"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setRoomToDelete(r.id)}
                            disabled={r.deviceCount > 0}
                            className="text-zinc-550 hover:text-red-400 disabled:opacity-20 transition-colors cursor-pointer"
                            title={r.deviceCount > 0 ? "Remove all devices first" : "Delete Space"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
