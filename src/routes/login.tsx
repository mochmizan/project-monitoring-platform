import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Thermometer, ShieldAlert } from 'lucide-react';
import { type Role } from '../lib/mockData';
import { z } from 'zod';

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage
});

function LoginPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const login = useAppStore((state) => state.login);
  
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (attempts >= 5) {
      setError('Too many attempts. Try again in 1 minute.');
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Invalid username or password');
      setAttempts(attempts + 1);
      setPassword('');
      return;
    }

    // Standard logins:
    // admin -> admin
    // operator -> operator
    // viewer -> viewer
    const expectedPwd = username.trim().toLowerCase();
    if (password === expectedPwd) {
      let inferredRole: Role = 'Viewer';
      if (expectedPwd === 'admin') inferredRole = 'Admin';
      else if (expectedPwd === 'operator') inferredRole = 'Operator';
      
      login(username, inferredRole);
      router.navigate({ to: search.redirect || '/' });
    } else {
      setError('Invalid username or password');
      setAttempts(attempts + 1);
      setPassword('');
    }
  };

  const handleQuickLogin = (user: string, role: Role) => {
    login(user, role);
    router.navigate({ to: search.redirect || '/' });
  };

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-8">
      {/* Title */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
          <Thermometer className="h-7 w-7 text-indigo-500" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-wider">TracerTemp IoT</h1>
        <p className="text-zinc-500 text-sm">Temperature & Environment Monitor</p>
      </div>

      {error !== null && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-md flex items-center gap-2 mb-6">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter admin, operator, or viewer"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Same as username (e.g. admin)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3.5 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={attempts >= 5}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded transition-colors text-sm cursor-pointer"
        >
          Sign In
        </button>
      </form>

      {/* Quick Login Section */}
      <div className="mt-8 pt-6 border-t border-zinc-800/80">
        <p className="text-xs text-zinc-500 font-semibold text-center mb-4 uppercase tracking-wider">Quick Sign-In (Assessor Shortcuts)</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleQuickLogin('admin', 'Admin')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-2 px-1.5 rounded text-center transition-colors cursor-pointer"
          >
            <div className="font-semibold">Admin</div>
            <div className="text-[10px] text-zinc-500">Full Access</div>
          </button>
          <button
            onClick={() => handleQuickLogin('operator', 'Operator')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-2 px-1.5 rounded text-center transition-colors cursor-pointer"
          >
            <div className="font-semibold">Operator</div>
            <div className="text-[10px] text-zinc-500">AC + Limits</div>
          </button>
          <button
            onClick={() => handleQuickLogin('viewer', 'Viewer')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-2 px-1.5 rounded text-center transition-colors cursor-pointer"
          >
            <div className="font-semibold">Viewer</div>
            <div className="text-[10px] text-zinc-500">Read-Only</div>
          </button>
        </div>
      </div>
    </div>
  );
}
