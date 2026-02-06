
import React from 'react';
import { Notification } from '../types';

interface NotificationCenterProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ notifications, onClose, onMarkRead }) => {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-[#111] border-l border-[#222] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#151515]">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
          <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
          Studio Alerts
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-4">
            <span className="text-4xl mb-4">📭</span>
            <p className="text-xs font-bold uppercase tracking-widest">No New Signals</p>
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              onMouseEnter={() => !n.read && onMarkRead(n.id)}
              className={`p-4 rounded-xl border transition cursor-default ${
                n.read ? 'bg-[#151515] border-[#222]' : 'bg-[#1a1a1a] border-red-600/30'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-white">{n.title}</p>
                <span className="text-[8px] font-mono text-gray-600">{n.timestamp}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{n.message}</p>
              {!n.read && <div className="mt-2 w-1.5 h-1.5 bg-red-600 rounded-full"></div>}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-[#222] text-center">
        <button className="text-[10px] font-bold text-gray-600 hover:text-white transition uppercase tracking-widest">Clear Log</button>
      </div>
    </div>
  );
};

export default NotificationCenter;
