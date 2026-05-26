import React, { useState, useEffect } from 'react';
import { Team, JoinRequest } from '../types';
import { DB, getDeterministicCode } from '../db';
import { Search, MapPin, Users, Send, Clock, CheckCircle, XCircle } from 'lucide-react';

interface TeamSearchProps {
  userId: string;
  userEmail: string;
  onJoinRequested: () => void;
  onSelectTeam: (team: Team) => void;
}

export default function TeamSearch({ userId, userEmail, onJoinRequested, onSelectTeam }: TeamSearchProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [enteredCode, setEnteredCode] = useState('');

  useEffect(() => {
    if (!userId) {
      setDismissedIds([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`dismissed_requests_${userId}`);
      setDismissedIds(saved ? JSON.parse(saved) : []);
    } catch {
      setDismissedIds([]);
    }
  }, [userId]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const allTeams = await DB.global.listAllTeams();
        setTeams(allTeams);
        const requests = await DB.requests.listByUser(userId);
        setMyRequests(requests);
      } catch (err) {
        console.error('Error fetching teams:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.sport.toLowerCase().includes(search.toLowerCase())
  );

  const handleRequest = async (teamId: string) => {
    if (!playerName.trim()) return;

    const targetTeam = teams.find(t => t.id === teamId);
    const expectedCode = targetTeam?.accessCode || getDeterministicCode(teamId);
    if (enteredCode.trim() !== expectedCode) {
      alert('¡Código de acceso incorrecto! Introduce el código de 6 dígitos correcto proporcionado por tu entrenador.');
      return;
    }

    const teamRequests = myRequests.filter(r => r.teamId === teamId);
    if (teamRequests.length >= 5) {
      alert('Has alcanzado el límite de 5 solicitudes para este mismo equipo.');
      return;
    }

    const request: JoinRequest = {
      id: crypto.randomUUID(),
      userId,
      userEmail,
      teamId,
      playerName: playerName.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      await DB.requests.create(request);
      setMyRequests(prev => [...prev, request]);
      setRequestingTeamId(null);
      setPlayerName('');
      setEnteredCode('');
      onJoinRequested();
    } catch (err) {
      console.error('Error creating request:', err);
    }
  };

  const handleDismissRequest = async (requestId: string) => {
    try {
      const updated = [...dismissedIds, requestId];
      setDismissedIds(updated);
      try {
        localStorage.setItem(`dismissed_requests_${userId}`, JSON.stringify(updated));
      } catch (locErr) {
        console.warn('LocalStorage error:', locErr);
      }
      await DB.requests.delete(requestId);
      setMyRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Error dismissing request:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in text-slate-100">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black tracking-tight text-white uppercase italic">
          Busca tu <span className="text-indigo-500">Equipo</span>
        </h2>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
          Encuentra tu equipo en la plataforma y solicita unirte como jugador. Tu entrenador revisará la solicitud y te dará acceso a las tácticas y estadísticas.
        </p>
      </div>

      {/* SEARCH BAR */}
      <div className="relative group max-w-lg mx-auto">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
          <Search className="w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre de equipo o deporte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#161b26] border border-slate-800 focus:border-indigo-500/50 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium transition-all shadow-xl outline-none"
        />
      </div>

      {/* MY REQUESTS SECTION */}
      {(() => {
        const visibleRequests = myRequests.filter(r => !dismissedIds.includes(r.id));
        if (visibleRequests.length === 0) return null;
        return (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-l-2 border-indigo-500 pl-3">Tus Solicitudes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleRequests.map(req => {
                const team = teams.find(t => t.id === req.teamId);
                return (
                  <div key={req.id} className="bg-[#161b26]/50 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">{team?.name || 'Equipo Desconocido'}</p>
                      <p className="text-[10px] text-slate-500">Como: <span className="text-slate-300">{req.playerName}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'pending' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {req.status === 'accepted' && (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase">
                            <CheckCircle className="w-3 h-3" /> Aceptado
                          </span>
                          {team && (
                            <button
                              onClick={() => onSelectTeam(team)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
                            >
                              Entrar
                            </button>
                          )}
                          <button
                            onClick={() => handleDismissRequest(req.id)}
                            className="bg-slate-850 hover:bg-slate-800 text-slate-500 hover:text-white border border-slate-800 w-6 h-6 rounded flex items-center justify-center text-xs transition duration-200"
                            title="Quitar de mi lista"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      {req.status === 'declined' && (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase">
                            <XCircle className="w-3 h-3" /> Rechazado
                          </span>
                          <button
                            onClick={() => handleDismissRequest(req.id)}
                            className="bg-slate-850 hover:bg-slate-800 text-slate-500 hover:text-white border border-slate-800 w-6 h-6 rounded flex items-center justify-center text-xs transition duration-200"
                            title="Quitar de mi lista"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* TEAMS LIST */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-l-2 border-slate-800 pl-3">Equipos Disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.length === 0 ? (
            <div className="col-span-full py-12 bg-[#0b0e14] border border-dashed border-slate-800 rounded-3xl text-center">
              <p className="text-slate-500 italic text-sm">No se encontraron equipos con ese nombre.</p>
            </div>
          ) : (
            filteredTeams.map(team => {
              const teamReqs = myRequests.filter(r => r.teamId === team.id);
              const requestCount = teamReqs.length;
              const hasReachedLimit = requestCount >= 5;
              const isRequesting = requestingTeamId === team.id;

              return (
                <div 
                  key={team.id} 
                  className="group relative bg-[#161b26] border border-slate-800 hover:border-indigo-500/30 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5 flex flex-col"
                >
                  <div className="p-6 space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg"
                        style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                      >
                        {team.name.charAt(0)}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[#0b0e14] text-slate-400 border border-slate-800">
                        {team.sport === 'football' ? 'Fútbol' : 'Waterpolo'}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors truncate">{team.name}</h4>
                    </div>

                    {isRequesting ? (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] ml-1">Tu Nombre en la Ficha</label>
                          <input 
                            autoFocus
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Ej: Juan García"
                            className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] ml-1">Código de Acceso del Equipo (6 dígitos)</label>
                          <input 
                            value={enteredCode}
                            onChange={(e) => setEnteredCode(e.target.value.substring(0, 6))}
                            placeholder="Introduce el código de 6 dígitos"
                            className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-700 font-mono tracking-wider"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setRequestingTeamId(null);
                              setEnteredCode('');
                            }}
                            className="flex-1 py-2 text-[10px] font-black uppercase text-slate-500 hover:text-white transition"
                          >
                            Cancelar
                          </button>
                          <button 
                            type="button"
                            disabled={!playerName.trim() || enteredCode.trim().length !== 6}
                            onClick={() => handleRequest(team.id)}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Send className="w-3 h-3" /> Enviar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        disabled={hasReachedLimit}
                        onClick={() => setRequestingTeamId(team.id)}
                        className={`w-full py-3.5 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                          hasReachedLimit
                            ? 'bg-[#0b0e14] text-slate-600 cursor-not-allowed border border-slate-800'
                            : 'bg-white text-black hover:bg-slate-200 shadow-xl'
                        }`}
                      >
                        {hasReachedLimit ? (
                          <>LÍMITE ALCANZADO (5/5)</>
                        ) : requestCount > 0 ? (
                          <>Volver a Solicitar ({requestCount}/5)</>
                        ) : (
                          <>Solicitar Unión</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
