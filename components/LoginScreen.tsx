
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { apiService } from '../services/apiService';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoading(true);
        setError(null);
        let fetched = await apiService.getUsers();

        // Auto-seed on first use if collection is empty
        if (fetched.length === 0) {
          await apiService.seedUsers();
          fetched = await apiService.getUsers();
        }

        if (!cancelled) setUsers(fetched);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load users');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUsers();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-sans animate-in fade-in duration-700">
      <div className="text-center mb-16">
        <h1 className="text-6xl font-black tracking-tighter text-white mb-4">
          <span className="text-red-600">AiM</span> STUDIO
        </h1>
        <p className="text-gray-500 uppercase tracking-widest text-sm">Intelligent Media Production Environment v2.0</p>
      </div>

      <div className="w-full max-w-4xl">
        <h2 className="text-center text-xl text-gray-300 font-medium mb-10">Who is working today?</h2>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-white transition"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-8">
            {users.map(user => (
              <div key={user.id} className="group flex flex-col items-center gap-4 cursor-pointer" onClick={() => onLogin(user)}>
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-transparent group-hover:border-red-600 transition-all duration-300 relative shadow-2xl">
                   <img src={user.avatar} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={user.username} />
                   <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-300 group-hover:text-white transition">{user.username}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-[#111] px-2 py-1 rounded border border-[#222] group-hover:border-red-600/50 group-hover:text-red-500 transition">
                      {user.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-20">
         <button className="text-xs font-bold text-gray-600 uppercase tracking-widest hover:text-white transition">
            Manage Profiles
         </button>
      </div>
    </div>
  );
};

export default LoginScreen;
