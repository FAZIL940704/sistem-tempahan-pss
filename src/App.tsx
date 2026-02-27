import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  BarChart3, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  X, 
  LogIn, 
  LogOut,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { cn } from './lib/utils';
import { Booking, Block, Version, TimeSlot } from './types';
import { 
  INITIAL_GURU, 
  TIMES, 
  DATA_KEY, 
  BLOCK_KEY, 
  TEACH_KEY, 
  ROOMS 
} from './constants';

// --- Components ---

const Header = ({ isAdmin, onLogout, onLogin, isOnline }: { isAdmin: boolean, onLogout: () => void, onLogin: () => void, isOnline: boolean }) => (
  <header className="sticky top-0 z-50 flex flex-col md:flex-row items-center justify-between gap-4 p-4 md:p-6 bg-white/80 backdrop-blur-xl border-b border-green-200">
    <div className="flex flex-col md:flex-row items-center gap-4">
      <img 
        src="https://iili.io/qKhOKYX.md.jpg" 
        alt="Logo SEMESTI" 
        className="w-12 md:w-20 drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]"
      />
      <div className="text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <h1 className="font-display text-lg md:text-2xl text-green-700 font-bold uppercase tracking-wider">
            📚 SISTEM TEMPAHAN PSS
          </h1>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black tracking-tighter border self-center md:self-auto",
            isOnline 
              ? "bg-green-100 text-green-700 border-green-200" 
              : "bg-orange-100 text-orange-700 border-orange-200"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500 animate-pulse" : "bg-orange-500")} />
            {isOnline ? "SINKRONISASI AKTIF" : "MOD TEMPATAN"}
          </div>
        </div>
        <p className="font-display text-[8px] md:text-[10px] tracking-[0.3em] text-green-600 font-bold mt-1">
          SM SAINS TELUK INTAN (SEMESTI)
        </p>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <button 
        onClick={isAdmin ? onLogout : onLogin}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-display text-[10px] font-bold transition-all shrink-0",
          isAdmin 
            ? "bg-neon-gold text-black border-neon-gold shadow-[0_0_20px_rgba(255,204,0,0.4)]" 
            : "bg-neon-gold/10 text-neon-gold border-neon-gold hover:bg-neon-gold/20"
        )}
      >
        {isAdmin ? <LogOut size={14} /> : <LogIn size={14} />}
        {isAdmin ? "LOG KELUAR" : "ADMIN LOGIN"}
      </button>
    </div>
  </header>
);

const AnalyticsCard = ({ label, value, children }: { label: string, value?: string | number, children?: React.ReactNode }) => (
  <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
    <span className="text-sm uppercase tracking-widest text-green-700 font-black block mb-2">{label}</span>
    {value !== undefined && <span className="font-display text-3xl text-green-700 font-bold block">{value}</span>}
    {children}
  </div>
);

const Toast = ({ message, color, onClose }: { message: string, color: string, onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 50, x: '-50%' }}
      className="fixed bottom-8 left-1/2 z-[2000] px-8 py-3 rounded-full font-display text-xs font-bold shadow-lg"
      style={{ backgroundColor: color }}
    >
      {message}
    </motion.div>
  );
};

const parseTime = (t: string) => {
  const [start, end] = t.split(' - ').map(s => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  });
  return { start, end };
};

const isOverlapping = (t1: string, t2: string) => {
  const r1 = parseTime(t1);
  const r2 = parseTime(t2);
  return r1.start < r2.end && r2.start < r1.end;
};

const checkConflict = (room: string, b: Booking, currentSlot: string, currentVersion: Version) => {
  // 1. Same version and same slot is always a conflict
  if (b.version === currentVersion && b.slot === currentSlot) return true;
  
  // 2. If different versions, check for overlaps
  if (!isOverlapping(b.slot, currentSlot)) return false;

  // 3. Bilik Bacaan: Any overlap is a conflict
  if (room === "Bilik Bacaan") return true;

  // 4. Pusat Sumber: Conflict only if overlap is within 09:30 - 11:00
  const r1 = parseTime(b.slot);
  const r2 = parseTime(currentSlot);
  const overlapStart = Math.max(r1.start, r2.start);
  const overlapEnd = Math.min(r1.end, r2.end);

  const windowStart = 9 * 60 + 30; // 09:30
  const windowEnd = 11 * 60; // 11:00

  return overlapStart < windowEnd && windowStart < overlapEnd;
};

// --- Main App ---

export default function App() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [teachers, setTeachers] = useState<string[]>(INITIAL_GURU);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGcixfrxcuFR0Dhcd8zo0avDo8rpjfzjC9WjzKyY4_tYb0SarSa03kSHsjdCBgAvEn/exec";

  // Fetch Data from Google Sheets
  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL);
      const json = await response.json();
      if (json && json.teachers) {
        setBookings(json.bookings || []);
        setBlocks(json.blocks || []);
        setTeachers(json.teachers || INITIAL_GURU);
      }
      setIsLoaded(true);
      setIsOnline(true);
    } catch (e) {
      console.error("Ralat Cloud:", e);
      setIsOnline(false);
      loadFromLocalStorage();
      setIsLoaded(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Push Data to Google Sheets
  const pushData = async (newData: any) => {
    setIsOnline(true);
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(newData)
      });
      showToast("Data Diselaraskan", "#22c55e");
    } catch (e) {
      console.error("Gagal simpan:", e);
      setIsOnline(false);
      showToast("Gagal Simpan ke Cloud", "#ef4444");
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadFromLocalStorage = () => {
    const b = localStorage.getItem(DATA_KEY);
    const bl = localStorage.getItem(BLOCK_KEY);
    const t = localStorage.getItem(TEACH_KEY);
    if (b) setBookings(JSON.parse(b));
    if (bl) setBlocks(JSON.parse(bl));
    if (t) setTeachers(JSON.parse(t));
  };

  const saveToLocalStorage = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const sendUpdate = (type: string, payload: any) => {
    let newData = { bookings, blocks, teachers };
    
    if (type === 'UPDATE_BOOKINGS') {
      newData.bookings = payload;
      saveToLocalStorage(DATA_KEY, payload);
    }
    if (type === 'UPDATE_BLOCKS') {
      newData.blocks = payload;
      saveToLocalStorage(BLOCK_KEY, payload);
    }
    if (type === 'UPDATE_TEACHERS') {
      newData.teachers = payload;
      saveToLocalStorage(TEACH_KEY, payload);
    }

    pushData(newData);
  };

  const [version, setVersion] = useState<Version>('T12');
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomDates, setRoomDates] = useState<Record<string, string>>(() => {
    const today = new Date().toISOString().split('T')[0];
    return ROOMS.reduce((acc, room) => ({ ...acc, [room]: today }), {});
  });

  const [toast, setToast] = useState<{ message: string, color: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showLogin, setShowLogin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [showTeacherManager, setShowTeacherManager] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [showBookingModal, setShowBookingModal] = useState<{ room: string, date: string, slot: string } | null>(null);
  const [bookingForm, setBookingForm] = useState({ name: '', aim: '' });
  const [showAdminChoice, setShowAdminChoice] = useState<{ room: string, date: string, slot: string } | null>(null);

  // Persistence removed for WebSocket

  const showToast = (message: string, color: string) => {
    setToast({ message, color });
  };

  const handleLogin = () => {
    if (adminPass === 'PSS123') {
      setIsAdmin(true);
      setShowLogin(false);
      setAdminPass('');
      showToast("Mod Admin Aktif", "#ffcc00");
    } else {
      alert("Kata laluan salah!");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    showToast("Log Keluar Berjaya", "#94a3b8");
  };

  const addTeacher = () => {
    const name = newTeacherName.trim().toUpperCase();
    if (!name) return;
    if (teachers.includes(name)) {
      alert("Nama guru sudah ada!");
      return;
    }
    const newTeachers = [...teachers, name].sort();
    setTeachers(newTeachers);
    sendUpdate('UPDATE_TEACHERS', newTeachers);
    setNewTeacherName('');
    showToast("✅ Guru Ditambah", "#00ff88");
  };

  const deleteTeacher = (name: string) => {
    const newTeachers = teachers.filter(t => t !== name);
    setTeachers(newTeachers);
    sendUpdate('UPDATE_TEACHERS', newTeachers);
    showToast("🗑️ Guru Dipadam", "#ff0055");
  };

  const deleteBooking = (booking: Booking) => {
    const newBookings = bookings.filter(b => 
      !(b.room === booking.room && b.date === booking.date && b.slot === booking.slot)
    );
    setBookings(newBookings);
    sendUpdate('UPDATE_BOOKINGS', newBookings);
    showToast("🗑️ Tempahan Dipadam", "#ff0055");
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBookingModal) return;

    // Double check for overlaps or blocks
    const hasOverlap = bookings.some(b => 
      b.room === showBookingModal.room && 
      b.date === showBookingModal.date && 
      checkConflict(showBookingModal.room, b, showBookingModal.slot, version)
    );

    const isBlocked = blocks.some(b => 
      b.room === showBookingModal.room && 
      b.date === showBookingModal.date && 
      (b.type === 'day' || (b.type === 'slot' && b.slot && isOverlapping(b.slot, showBookingModal.slot)))
    );

    if (hasOverlap || isBlocked) {
      showToast("❌ Ralat: Slot ini telah ditempah atau ditutup!", "#ff0055");
      setShowBookingModal(null);
      return;
    }
    
    const newBooking: Booking = {
      ...showBookingModal,
      ...bookingForm,
      version
    };
    
    const newBookings = [...bookings, newBooking];
    setBookings(newBookings);
    sendUpdate('UPDATE_BOOKINGS', newBookings);
    setShowBookingModal(null);
    setBookingForm({ name: '', aim: '' });
    showToast("✅ Tempahan Berjaya!", "#00ff88");
  };

  const execBlock = (type: 'slot' | 'day') => {
    if (!showAdminChoice) return;
    const { room, date, slot } = showAdminChoice;

    const exists = blocks.some(b => 
      b.room === room && 
      b.date === date && 
      (type === 'day' ? b.type === 'day' : (b.slot === slot && b.type === 'slot'))
    );

    if (!exists) {
      const newBlocks = [...blocks, { room, date, slot: type === 'day' ? null : slot, type }];
      setBlocks(newBlocks);
      sendUpdate('UPDATE_BLOCKS', newBlocks);
    }

    setShowAdminChoice(null);
    showToast("🔒 Slot Berjaya Ditutup", "#ff0055");
  };

  const execFullUnlock = () => {
    if (!showAdminChoice) return;
    const { room, date, slot } = showAdminChoice;

    // Remove conflicting bookings
    const newBookings = bookings.filter(b => !(b.room === room && b.date === date && checkConflict(room, b, slot, version)));
    setBookings(newBookings);
    sendUpdate('UPDATE_BOOKINGS', newBookings);
    
    // Remove blocks (both specific slot blocks and any day blocks for this room/date)
    const newBlocks = blocks.filter(b => {
      const isSameRoomDate = (b.room === room && b.date === date);
      if (isSameRoomDate) {
        if (b.type === 'day') return false; 
        if (b.type === 'slot' && b.slot && isOverlapping(b.slot, slot)) return false;
      }
      return true;
    });
    setBlocks(newBlocks);
    sendUpdate('UPDATE_BLOCKS', newBlocks);

    setShowAdminChoice(null);
    showToast("🔓 Slot Berjaya Dibuka Semula", "#00ff88");
  };

  // Analytics data
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      counts[b.name] = (counts[b.name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name: name.split(' ')[0], fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [bookings]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mb-4"
        />
        <p className="font-display text-green-700 font-bold animate-pulse">MENYELARASKAN DATA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans">
      <Header 
        isAdmin={isAdmin} 
        onLogout={handleLogout} 
        onLogin={() => setShowLogin(true)} 
        isOnline={isOnline}
      />

      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <AnalyticsCard label="📊 Jumlah Tempahan" value={bookings.length} />
          <AnalyticsCard label="👨‍🏫 Jumlah Guru" value={teachers.length} />
          <AnalyticsCard label="📈 Guru Teraktif">
            <div className="h-48 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#166534" 
                    fontSize={10} 
                    width={80}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #bbf7d0', borderRadius: '8px' }}
                    itemStyle={{ color: '#166534' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#22c55e" fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AnalyticsCard>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8">
          <div className="grid grid-cols-2 glass-panel p-1 rounded-xl border-glass-border w-full lg:w-auto">
            <button 
              onClick={() => setVersion('T12')}
              className={cn(
                "px-4 md:px-6 py-3 rounded-lg font-display text-[10px] md:text-xs transition-all font-black tracking-wider",
                version === 'T12' ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]" : "text-green-800/60 bg-green-50/50"
              )}
            >
              TINGKATAN 1 DAN 2
            </button>
            <button 
              onClick={() => setVersion('T35')}
              className={cn(
                "px-4 md:px-6 py-3 rounded-lg font-display text-[10px] md:text-xs transition-all font-black tracking-wider",
                version === 'T35' ? "bg-neon-blue text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]" : "text-green-800/60 bg-green-50/50"
              )}
            >
              TINGKATAN 3, 4, 5
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-3 w-full lg:w-auto">
            {isAdmin && (
              <button 
                onClick={() => setShowTeacherManager(true)}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-neon-gold text-neon-gold font-display text-[10px] font-bold bg-neon-gold/10 hover:bg-neon-gold/20 transition-all"
              >
                <Users size={14} />
                URUS SENARAI GURU
              </button>
            )}
          </div>
        </div>

        {/* Rooms Grid */}
        <div className="space-y-8">
          {ROOMS.map((room) => {
            const date = roomDates[room];
            const dayBlocked = blocks.find(b => b.room === room && b.date === date && b.type === 'day');

            return (
              <div key={room} className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <h2 className="font-display text-xl md:text-2xl text-green-700 font-bold flex items-center gap-3">
                    <ChevronRight className="text-green-600 shrink-0" />
                    📖 {room}
                  </h2>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setRoomDates(prev => ({ ...prev, [room]: e.target.value }))}
                    className="w-full sm:w-auto bg-white text-black px-4 py-2 rounded-lg font-bold border-2 border-neon-blue focus:outline-none focus:ring-2 ring-neon-blue/50 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
                  {TIMES[version].map((slot) => {
                    const isBooked = bookings.find(b => 
                      b.room === room && 
                      b.date === date && 
                      checkConflict(room, b, slot.t, version)
                    );
                    const isSlotBlocked = blocks.find(b => 
                      b.room === room && 
                      b.date === date && 
                      b.type === 'slot' && 
                      b.slot && isOverlapping(b.slot, slot.t)
                    );
                    
                    const status = slot.r ? 'rehat' : (dayBlocked || isSlotBlocked ? 'blocked' : (isBooked ? 'booked' : 'available'));

                    return (
                      <button
                        key={slot.t}
                        disabled={slot.r === 1}
                        onClick={() => {
                          if (isAdmin) {
                            setShowAdminChoice({ room, date, slot: slot.t });
                          } else if (status === 'available') {
                            setShowBookingModal({ room, date, slot: slot.t });
                          } else if (status === 'booked' && isBooked) {
                            showToast(`Ditempah oleh ${isBooked.name}`, "#ff0055");
                          }
                        }}
                        className={cn(
                          "relative flex flex-col items-center justify-center p-4 rounded-2xl border border-glass-border transition-all group",
                          isAdmin && !slot.r && "border-2 border-dashed border-neon-gold/50 hover:border-neon-gold",
                          status === 'rehat' && "opacity-40 cursor-not-allowed border-t-4 border-t-slate-400",
                          status === 'blocked' && "bg-red-50 border-t-4 border-t-red-500",
                          status === 'booked' && "bg-green-50 border-t-4 border-t-red-500",
                          status === 'available' && "hover:bg-green-100/50 border-t-4 border-t-green-500"
                        )}
                      >
                        <span className="font-inter text-[14px] font-black text-green-900 mb-1">{slot.t}</span>
                        <span className={cn(
                          "text-[11px] font-black uppercase tracking-widest",
                          status === 'rehat' && "text-[#94a3b8]",
                          status === 'blocked' && "text-neon-red",
                          status === 'booked' && "text-neon-red",
                          status === 'available' && "text-neon-green"
                        )}>
                          {status === 'rehat' ? 'REHAT' : 
                           status === 'blocked' ? 'DITUTUP' : 
                           status === 'booked' ? (isBooked?.name || (isBooked as any)?.teacher || '').split(' ')[0] : 'KOSONG'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking List Table */}
        <div className="mt-12 glass-panel rounded-3xl p-6 md:p-8 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="font-display text-lg text-green-700 font-bold flex items-center gap-3">
              <BarChart3 className="text-green-600 shrink-0" />
              📜 SENARAI TEMPAHAN TERKINI
            </h2>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Cari nama guru..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/90 border border-green-200 rounded-xl py-2 pl-10 pr-4 text-xs text-green-900 font-bold focus:outline-none focus:ring-1 ring-green-500"
              />
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600" size={14} />
            </div>
          </div>

          <div className="relative">
            <div className="overflow-x-auto custom-scrollbar pb-4">
              <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-green-200">
                  <th className="py-4 px-4 font-display text-xs text-green-700 font-bold uppercase tracking-widest">🏢 Bilik</th>
                  <th className="py-4 px-4 font-display text-xs text-green-700 font-bold uppercase tracking-widest">📅 Tarikh</th>
                  <th className="py-4 px-4 font-display text-xs text-green-700 font-bold uppercase tracking-widest">⏰ Masa</th>
                  <th className="py-4 px-4 font-display text-xs text-green-700 font-bold uppercase tracking-widest">👨‍🏫 Guru</th>
                  <th className="py-4 px-4 font-display text-xs text-green-700 font-bold uppercase tracking-widest">🎯 Tujuan</th>
                  {isAdmin && <th className="py-4 px-4 font-display text-xs text-red-600 font-bold uppercase tracking-widest text-right">🛠️ Tindakan</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bookings
                  .filter(b => (b.name || (b as any).teacher || '').toLowerCase().includes((searchTerm || '').toLowerCase()))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 20)
                  .map((b, i) => (
                    <tr key={i} className="hover:bg-green-50 transition-colors group">
                      <td className="py-4 px-4 text-sm text-green-800 font-bold group-hover:text-green-950">{b.room}</td>
                      <td className="py-4 px-4 text-sm text-green-800 font-bold group-hover:text-green-950">{b.date}</td>
                      <td className="py-4 px-4 text-sm font-inter font-black text-green-900">{b.slot}</td>
                      <td className="py-4 px-4 text-sm font-black text-green-950">{b.name || (b as any).teacher}</td>
                      <td className="py-4 px-4 text-sm text-green-700 font-bold italic group-hover:text-green-900">{b.aim}</td>
                      {isAdmin && (
                        <td className="py-4 px-4 text-right">
                          <button 
                            onClick={() => deleteBooking(b)}
                            className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Padam Tempahan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-[#94a3b8] text-xs uppercase tracking-widest">Tiada tempahan ditemui</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-center lg:hidden">
            <p className="text-[10px] text-green-600/60 font-bold animate-pulse">
              ⬅️ Sila skrol ke kanan untuk maklumat lanjut ➡️
            </p>
          </div>
        </div>
      </div>
    </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Admin Login Modal */}
        {showLogin && (
          <Modal onClose={() => setShowLogin(false)}>
            <h3 className="font-display text-neon-gold text-center text-lg mb-6">🔐 LOG MASUK ADMIN</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Kata Laluan</label>
                <input 
                  type="password" 
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Masukkan Kata Laluan"
                  className="w-full bg-white border border-green-200 rounded-xl p-3 text-green-900 font-bold focus:outline-none focus:ring-1 ring-green-500"
                />
              </div>
              <button 
                onClick={handleLogin}
                className="w-full bg-neon-gold text-black font-display font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(255,204,0,0.4)] transition-all"
              >
                MASUK
              </button>
            </div>
          </Modal>
        )}

        {/* Teacher Manager Modal */}
        {showTeacherManager && (
          <Modal onClose={() => setShowTeacherManager(false)} className="max-w-xl">
            <h3 className="font-display text-neon-gold text-center text-lg mb-6">👨‍🏫 URUS SENARAI GURU</h3>
            <div className="flex gap-2 mb-6">
              <input 
                type="text" 
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="Nama Guru Baru"
                className="flex-1 bg-white border border-green-200 rounded-xl p-3 text-green-900 font-bold focus:outline-none focus:ring-1 ring-green-500"
              />
              <button 
                onClick={addTeacher}
                className="bg-neon-blue text-black font-display text-[10px] font-bold px-6 rounded-xl"
              >
                TAMBAH
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto border border-green-200 rounded-xl p-2 space-y-1 custom-scrollbar">
              {teachers.map(name => (
                <div key={name} className="flex justify-between items-center bg-white/90 p-3 rounded-lg group">
                  <span className="text-xs text-green-900 font-bold">{name}</span>
                  <button 
                    onClick={() => deleteTeacher(name)}
                    className="text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Modal>
        )}

        {/* Booking Modal */}
        {showBookingModal && (
          <Modal onClose={() => setShowBookingModal(null)}>
            <div className="text-center mb-6">
              <h3 className="font-display text-neon-blue text-lg mb-1">📝 TEMPAHAN</h3>
              <p className="text-[10px] text-[#94a3b8] uppercase tracking-widest">
                {showBookingModal.room} • {showBookingModal.slot}
              </p>
            </div>
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Nama Guru</label>
                <select 
                  required
                  value={bookingForm.name}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white text-black font-bold rounded-xl p-3 border-2 border-green-500 focus:outline-none"
                >
                  <option value="">-- PILIH NAMA GURU --</option>
                  {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Tujuan / Kelas</label>
                <input 
                  required
                  type="text" 
                  value={bookingForm.aim}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, aim: e.target.value }))}
                  placeholder="PdPc 4 Al-Farabi"
                  className="w-full bg-white border border-green-200 rounded-xl p-3 text-green-900 font-bold focus:outline-none focus:ring-1 ring-green-500"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-neon-blue text-black font-display font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all"
              >
                SAHKAN TEMPAHAN
              </button>
            </form>
          </Modal>
        )}

        {/* Admin Choice Modal */}
        {showAdminChoice && (
          <Modal onClose={() => setShowAdminChoice(null)} className="border-neon-gold">
            <h3 className="font-display text-neon-gold text-center text-lg mb-2">⚙️ URUS SLOT / TEMPAHAN</h3>
            <p className="text-[10px] text-center text-[#94a3b8] mb-6 whitespace-pre-line">
              {showAdminChoice.room}{'\n'}
              Tarikh: {showAdminChoice.date}{'\n'}
              Jam: {showAdminChoice.slot}
            </p>

            {(() => {
              const booking = bookings.find(b => b.room === showAdminChoice.room && b.date === showAdminChoice.date && checkConflict(showAdminChoice.room, b, showAdminChoice.slot, version));
              const hasSlotBlock = blocks.some(b => b.room === showAdminChoice.room && b.date === showAdminChoice.date && b.type === 'slot' && b.slot && isOverlapping(b.slot, showAdminChoice.slot));
              const hasDayBlock = blocks.some(b => b.room === showAdminChoice.room && b.date === showAdminChoice.date && b.type === 'day');
              const canUnlock = !!booking || hasSlotBlock || hasDayBlock;

              return (
                <>
                  {booking && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
                      <div className="flex items-center gap-2 text-red-600 text-[10px] font-bold mb-2">
                        <Info size={14} />
                        MAKLUMAT TEMPAHAN:
                      </div>
                      <p className="text-green-900 font-black text-sm">{booking.name || (booking as any).teacher}</p>
                      <p className="text-green-700 font-bold text-xs mt-1">Tujuan: {booking.aim}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button 
                      onClick={() => execBlock('slot')}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-green-100 hover:bg-green-50 transition-all group"
                    >
                      <span className="font-display text-xs text-green-800 font-bold">TUTUP SLOT INI SAHAJA</span>
                      <Lock size={16} className="text-green-600" />
                    </button>
                    <button 
                      onClick={() => execBlock('day')}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white border border-green-100 hover:bg-green-50 transition-all group"
                    >
                      <span className="font-display text-xs text-green-800 font-bold">TUTUP KESELURUHAN HARI INI</span>
                      <Calendar size={16} className="text-green-600" />
                    </button>
                    
                    {canUnlock && (
                      <button 
                        onClick={execFullUnlock}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-neon-green/10 border border-neon-green text-neon-green font-bold hover:bg-neon-green hover:text-black transition-all group mt-4"
                      >
                        <span className="font-display text-xs">BUKA SEMULA SLOT / PADAM TEMPAHAN</span>
                        <Unlock size={16} />
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </Modal>
        )}
      </AnimatePresence>

      {toast && (
        <Toast 
          message={toast.message} 
          color={toast.color} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-green-200 text-center">
        <p className="text-[10px] text-green-600 font-bold tracking-widest uppercase">
          🏫 &copy; 2024 PSS SEMESTI • Crafted with Precision ✨
        </p>
      </footer>
    </div>
  );
}

// --- Helper Components ---

const Modal = ({ children, onClose, className }: { children: React.ReactNode, onClose: () => void, className?: string }) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-green-900/20 backdrop-blur-sm"
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className={cn(
        "relative w-full max-w-md bg-white border border-green-300 rounded-3xl p-8 shadow-2xl overflow-hidden",
        className
      )}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-green-400 hover:text-green-900 transition-colors"
      >
        <X size={20} />
      </button>
      {children}
    </motion.div>
  </div>
);
