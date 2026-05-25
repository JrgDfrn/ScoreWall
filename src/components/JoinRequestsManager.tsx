import React, { useState, useEffect } from 'react';
import { JoinRequest, Player, Team } from '../types';
import { DB } from '../db';
import { UserCheck, UserX, Clock, UserPlus, AlertCircle, Info } from 'lucide-react';

interface JoinRequestsManagerProps {
  team: Team;
  players: Player[];
  onUpdated: () => void;
}

export default function JoinRequestsManager({ team, players, onUpdated }: JoinRequestsManagerProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingPlayerId, setLinkingPlayerId] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRequests();
  }, [team.id]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const list = await DB.requests.listByTeam(team.id);
      const pending = list.filter(r => r.status === 'pending');
      setRequests(pending);
      
      // Auto-assign default selection based on name match
      const initialLinks: Record<string, string> = {};
      pending.forEach(req => {
        const match = players.find(p => p.name.toLowerCase() === req.playerName.toLowerCase());
        if (match) {
          initialLinks[req.id] = match.id;
        }
      });
      setLinkingPlayerId(initialLinks);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (request: JoinRequest, status: 'accepted' | 'declined') => {
    try {
      if (status === 'accepted') {
        const selectedPlayerId = linkingPlayerId[request.id];
        if (!selectedPlayerId) {
          alert('Debes seleccionar un jugador de la plantilla para vincular esta solicitud.');
          return;
        }

        const playerToLink = players.find(p => p.id === selectedPlayerId);
        if (playerToLink) {
          const updatedPlayer: Player = { ...playerToLink, userId: request.userId };
          await DB.players.save(updatedPlayer);
        }
      }

      await DB.requests.respond(request.id, status);
      setRequests(prev => prev.filter(r => r.id !== request.id));
      onUpdated();
    } catch (err) {
      console.error('Error responding to request:', err);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-[2.5rem] p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
             <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tight text-white leading-none">Solicitudes de Unión</h3>
            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mt-1">Vincular cuentas de usuario a la plantilla</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full">{requests.length} Pendientes</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {requests.map(req => {
          const autoMatch = players.find(p => p.name.toLowerCase() === req.playerName.toLowerCase());
          
          return (
            <div key={req.id} className="bg-[#161b26] border border-slate-800 rounded-[2rem] p-6 space-y-5 hover:border-indigo-500/50 transition-all group shadow-xl">
               <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Solicitante</p>
                    <p className="text-xl font-black text-white italic uppercase leading-none">{req.playerName}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{req.userEmail}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-black text-slate-400 group-hover:text-indigo-400 transition-colors">
                    {req.playerName.charAt(0)}
                  </div>
               </div>

               <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    Vincular a Jugador en Plantilla
                    {!linkingPlayerId[req.id] && <AlertCircle className="w-3 h-3 text-rose-500 animate-pulse" />}
                  </p>
                  <select 
                    value={linkingPlayerId[req.id] || ''}
                    onChange={(e) => setLinkingPlayerId(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-slate-900">Seleccionar jugador del equipo...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id} className="bg-slate-900 border-b border-white/5 py-2">
                        #{p.number} - {p.name} {p.userId ? '(Vinculado ✓)' : ''}
                      </option>
                    ))}
                  </select>
                  {autoMatch && !linkingPlayerId[req.id] && (
                    <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider animate-pulse">
                      ¡Coincidencia encontrada!: {autoMatch.name}
                    </p>
                  )}
               </div>

               <div className="flex gap-3 pt-3">
                  <button 
                    onClick={() => handleRespond(req, 'accepted')}
                    disabled={!linkingPlayerId[req.id]}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg ${
                      linkingPlayerId[req.id] 
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" /> Aceptar Unión
                  </button>
                  <button 
                    onClick={() => handleRespond(req, 'declined')}
                    className="px-6 flex items-center justify-center gap-2 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-500 py-4 rounded-2xl text-[10px] font-black uppercase transition-all"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
               </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-4 p-5 bg-[#0b0e14] border border-white/5 rounded-3xl">
         <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-amber-500" />
         </div>
         <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
            <strong className="text-amber-500 font-black uppercase tracking-wider block mb-1">Información de Vinculación</strong>
            Al aceptar una solicitud, sincronizarás la cuenta de este usuario con un jugador específico de tu plantilla. El usuario podrá acceder a su panel personalizado, ver sus estadísticas individuales, notas del entrenador y votar en las sesiones de entrenamiento.
         </p>
      </div>
    </div>
  );
}
