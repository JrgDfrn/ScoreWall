/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team, Player, Match } from '../types';
import { DB, generateUUID } from '../db';
import { Calendar, MapPin, Trophy, ShieldAlert, Plus, CheckCircle, Clock, Trash2, Users, UserPlus, Check } from 'lucide-react';

interface MatchesManagerProps {
  team: Team;
}

export default function MatchesManager({ team }: MatchesManagerProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);

  // Schedule Match Form States
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSquad, setSelectedSquad] = useState<string[]>([]); // New match squad

  // UI States
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [scoreFor, setScoreFor] = useState(0);
  const [scoreAgainst, setScoreAgainst] = useState(0);
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]); // player IDs

  const fetchMatchesAndRoster = async () => {
    try {
      setLoading(true);
      const list = await DB.matches.list(team.id);
      
      // Sort: Future matches first, then completed by date
      const sorted = list.sort((a, b) => {
        if (a.status === 'future' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status === 'future') return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setMatches(sorted);

      const roster = await DB.players.list(team.id);
      setPlayers(roster);
    } catch (e) {
      console.error('Failed to get match details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndRoster();
  }, [team.id]);

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim() || !date || !time) return;

    try {
      const newMatch: Match = {
        id: generateUUID(),
        teamId: team.id,
        opponent: opponent.trim(),
        date,
        time,
        location: location.trim() || 'Campo Principal',
        status: 'future',
        notes: notes.trim(),
        callupIds: selectedSquad,
      };

      await DB.matches.save(newMatch);
      
      // Reset form
      setOpponent('');
      setDate('');
      setTime('');
      setLocation('');
      setNotes('');
      setSelectedSquad([]);

      fetchMatchesAndRoster();
    } catch (e) {
      console.error('Error scheduling match:', e);
    }
  };

  const handleUpdateSquad = async (match: Match, newSquad: string[]) => {
    try {
      const updatedMatch: Match = {
        ...match,
        callupIds: newSquad
      };
      await DB.matches.save(updatedMatch);
      setEditingSquadId(null);
      fetchMatchesAndRoster();
    } catch (e) {
      console.error('Failed to update squad:', e);
    }
  };

  const handleSaveResult = async (match: Match) => {
    try {
      // 1. Mark match completed with scores
      const updatedMatch: Match = {
        ...match,
        status: 'completed',
        goalsFor: scoreFor,
        goalsAgainst: scoreAgainst,
        scorers: selectedScorers.map(id => players.find(p => p.id === id)?.name || 'Desconocido'),
      };

      await DB.matches.save(updatedMatch);

      // 2. IMPORTANT ACCELERATOR: Increment goals dynamically of selected scorers in database!
      for (const playerId of selectedScorers) {
        const p = players.find(p => p.id === playerId);
        if (p) {
          const updatedPlayer: Player = {
            ...p,
            stats: {
              ...p.stats,
              goals: p.stats.goals + 1
            }
          };
          await DB.players.save(updatedPlayer);
        }
      }

      setCompletingId(null);
      setSelectedScorers([]);
      setScoreFor(0);
      setScoreAgainst(0);

      fetchMatchesAndRoster();
    } catch (e) {
      console.error('Failed saving match results:', e);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (!confirm('¿Seguro de que quieres eliminar la fecha de este partido?')) return;
    try {
      await DB.matches.delete(id);
      fetchMatchesAndRoster();
    } catch (e) {
      console.error('Failed to remove match sched:', e);
    }
  };

  const toggleScorerSelection = (playerId: string) => {
    setSelectedScorers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const toggleSquadSelection = (playerId: string) => {
    setSelectedSquad(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  return (
    <div id="matches-manager" className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 text-slate-100 font-sans">
      
      {/* LEFT COMPONENT: SCHEDULE INPUT PLANNERS */}
      <div className="lg:col-span-1">
        <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl sticky top-6 shadow-xl">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-500" /> Convocar Partido
          </h2>

          <form onSubmit={handleScheduleMatch} className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Rival / Oponente</label>
              <input
                type="text"
                required
                placeholder="Ej: Club Deportivo Centella"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-755 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Fecha</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Hora inicio</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* CONVOCATORIA (SQUAD SELECTION) FOR NEW MATCH */}
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold flex items-center justify-between">
                <span>Convocatoria</span>
                {selectedSquad.length > 0 && (
                  <span className="text-indigo-400 font-black">{selectedSquad.length} Jugadores</span>
                )}
              </label>
              <div className="max-h-24 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                {players.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic px-1">Registra jugadores para convocarlos.</p>
                ) : (
                  players.map(p => {
                    const isSelected = selectedSquad.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSquadSelection(p.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                          isSelected 
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400' 
                            : 'bg-[#0b0e14] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="truncate pr-2">#{p.number} {p.name}</span>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Cancha / Ubicación</label>
              <input
                type="text"
                placeholder={team.sport === 'football' ? 'Ej: Campo Municipal F11' : 'Ej: Piscina Olímpica Climatizada'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-755 focus:border-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Apuntes Estratégicos</label>
              <textarea
                rows={3}
                placeholder="Ej: Jugar con equipación de repuesto. Llegar 45 min antes para calentamiento técnico."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-indigo-500 resize-none outline-none leading-relaxed transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition shadow shadow-indigo-500/10 cursor-pointer"
            >
              Fijar Fecha Oficial
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT CONTAINER: DYNAMIC MATCH list CARDS AND RESULTS MODAL ENGINE */}
      <div className="lg:col-span-3 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 h-64 border border-dashed border-slate-800 rounded-2xl bg-[#161b26]/30">
            <span className="w-8 h-8 rounded-full border-2 border-indigo-550 border-t-transparent animate-spin inline-block mb-3"></span>
            <span className="text-slate-400 text-xs text-center">Analizando calendario deportivo...</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-800 rounded-2.5xl bg-[#161b26]/20 text-center">
            <Calendar className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
            <h3 className="font-bold text-slate-350">Ningún partido convocado</h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
              No hay partidos próximos ni resultados cargados. Utiliza el panel lateral para acordar una próxima fecha competitiva o de práctica.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const isCompeted = match.status === 'completed';
              const isEditingSquad = editingSquadId === match.id;
              
              return (
                <div
                  key={match.id}
                  className={`border rounded-2.5xl p-5 shadow-lg relative transition duration-150 flex flex-col justify-between ${
                    isCompeted
                      ? 'bg-[#161b26]/40 border-slate-800/60'
                      : 'bg-[#161b26] border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    {/* Event Team vs Rival */}
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isCompeted ? 'bg-[#0b0e14] text-slate-500 border border-slate-850' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black px-1.5 py-0.5 rounded bg-[#0b0e14] border border-slate-800 text-indigo-400 uppercase tracking-wider">
                            {team.name}
                          </span>
                          <span className="text-2xs text-slate-500 font-bold font-mono">VS</span>
                          <span className="text-xs font-bold text-white uppercase tracking-wide">
                            {match.opponent}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" /> 
                            {new Date(match.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })} a las {match.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" /> {match.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {/* Squad management button */}
                      {!isCompeted && !isEditingSquad && (
                        <button
                          onClick={() => {
                            setSelectedSquad(match.callupIds || []);
                            setEditingSquadId(match.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b0e14] border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 transition text-[10px] font-bold uppercase tracking-tight"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Convocatoria ({match.callupIds?.length || 0})</span>
                        </button>
                      )}

                      {/* Delete Action */}
                      <button
                        onClick={() => handleDeleteMatch(match.id)}
                        className="p-1 h-7.5 w-7.5 bg-[#0b0e14] hover:bg-red-950/20 text-slate-500 hover:text-red-450 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-center transition cursor-pointer"
                        title="Borrar partido del calendario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* SQUAD EDITING DRAWER */}
                  {isEditingSquad && (
                    <div className="bg-[#0b0e14]/90 border border-indigo-500/20 rounded-xl p-4 mb-4 animate-fade-in space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-400" />
                          <span className="text-[11px] font-black uppercase text-slate-200">Gestionar Convocatoria</span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{selectedSquad.length} / {players.length}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar scroll-p-2">
                        {players.map(p => {
                          const isSelected = selectedSquad.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => toggleSquadSelection(p.id)}
                              className={`flex items-center gap-2 p-2 rounded-xl border text-[10px] transition-all ${
                                isSelected 
                                  ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-300' 
                                  : 'bg-[#161b26] border-slate-800 text-slate-500 hover:border-slate-700'
                              }`}
                            >
                               <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`} />
                               <span className="truncate">#{p.number} {p.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 justify-end pt-3 border-t border-white/5">
                        <button
                          onClick={() => setEditingSquadId(null)}
                          className="px-4 py-1.5 rounded-lg bg-[#161b26] text-slate-400 hover:text-white text-[10px] font-bold uppercase transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleUpdateSquad(match, selectedSquad)}
                          className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase shadow-lg shadow-indigo-900/40 transition"
                        >
                          Confirmar Lista
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Operational result details or scoring dialog */}
                  {isCompeted ? (
                    // Display final static scoreline!
                    <div className="bg-[#0b0e14]/60 p-4 border border-slate-850 rounded-xl flex items-center justify-between gap-4">
                      <div className="text-center font-mono py-1.5 px-4 bg-[#0b0e14] border border-slate-800 rounded-xl shrink-0 shadow-inner">
                        <span className="block text-[8px] uppercase tracking-widest text-[#10b981] font-extrabold mb-1">SCORE FINAL</span>
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-xl font-black text-indigo-400">{match.goalsFor}</span>
                          <span className="text-slate-600 font-bold">:</span>
                          <span className="text-xl font-black text-rose-400">{match.goalsAgainst}</span>
                        </div>
                      </div>

                      <div className="text-left w-full space-y-3">
                         {/* Show squad if registered */}
                        {match.callupIds && match.callupIds.length > 0 && (
                          <div className="border-b border-slate-800/50 pb-2">
                             <span className="text-[9px] font-black tracking-widest text-slate-500 uppercase block flex items-center gap-1.5 mb-1.5">
                               <Users className="w-3 h-3" /> Convocados:
                             </span>
                             <div className="flex flex-wrap gap-1">
                               {match.callupIds.map(id => {
                                 const p = players.find(p => p.id === id);
                                 if (!p) return null;
                                 return (
                                   <span key={id} className="text-[10px] text-slate-400 bg-slate-800/30 px-1.5 py-0.5 rounded">
                                     {p.name}
                                   </span>
                                 );
                               })}
                             </div>
                          </div>
                        )}

                        {match.scorers && match.scorers.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase block flex items-center gap-1.5">
                              <Trophy className="w-3 h-3" /> Goleadores del equipo:
                            </span>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">
                              {match.scorers.join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-2xs text-slate-550 italic">No se indicaron goleadores específicos.</span>
                        )}
                        {match.notes && (
                          <p className="text-2xs italic text-slate-400 border-t border-slate-850 pt-2 mt-2 leading-relaxed">
                            "{match.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ) : completingId === match.id ? (
                    // In-card collapsible result logger drawer
                    <div className="bg-[#0b0e14]/90 border border-slate-800 rounded-xl p-4 mt-2 space-y-4 shadow-xl">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-850">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black uppercase text-slate-300 tracking-wider">Registrar Resultados</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-indigo-400 uppercase font-extrabold mb-1.5">Goles de {team.name}</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-[#161b26] border border-slate-850 rounded-lg px-2.5 py-1.5 text-sm text-center font-bold text-indigo-400 outline-none focus:border-indigo-500"
                            value={scoreFor}
                            onChange={(e) => setScoreFor(Math.max(0, Number(e.target.value)))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-indigo-400 uppercase font-extrabold mb-1.5">Goles de {match.opponent}</label>
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-[#161b26] border border-slate-850 rounded-lg px-2.5 py-1.5 text-sm text-center font-bold text-rose-400 outline-none focus:border-rose-550"
                            value={scoreAgainst}
                            onChange={(e) => setScoreAgainst(Math.max(0, Number(e.target.value)))}
                          />
                        </div>
                      </div>

                      {/* Scorer assigner: Click player from CONVOCATORIA (SQUAD) to allocate goal points */}
                      <div className="space-y-2">
                        <span className="block text-[10px] text-slate-500 uppercase font-extrabold">¿Quién ha anotado los goles?</span>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {(match.callupIds && match.callupIds.length > 0 ? match.callupIds : players.map(p => p.id)).map(id => {
                            const p = players.find(p => p.id === id);
                            if (!p) return null;
                            const isSelected = selectedScorers.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleScorerSelection(p.id)}
                                className={`text-2xs px-2.5 py-1.5 rounded-lg border font-semibold tracking-tight transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-500/10 border-indigo-500/45 text-indigo-400'
                                    : 'bg-[#161b26] border-slate-850 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {p.name} (#{p.number})
                              </button>
                            );
                          })}
                        </div>
                        {(!match.callupIds || match.callupIds.length === 0) && (
                          <p className="text-[9px] text-slate-600 italic">* Mostrando todos los jugadores ya que no hay convocatoria fijada.</p>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                        <button
                          type="button"
                          onClick={() => setCompletingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-[#161b26] text-slate-400 hover:text-white text-2xs font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveResult(match)}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-2xs font-semibold shadow shadow-indigo-900/40 cursor-pointer"
                        >
                          Guardar Marcador
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Default scheduling placeholder
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 bg-[#0b0e14]/40 p-3 rounded-xl border border-slate-850">
                       <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center text-xs">
                          <Clock className="w-4 h-4 text-[#06b6d4]" />
                          <span className="text-slate-400 font-medium">Partido programado.</span>
                        </div>
                        {match.callupIds && match.callupIds.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 ml-6">
                            <Users className="w-3 h-3" />
                            <span>{match.callupIds.length} jugadores en convocatoria</span>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={() => {
                          setCompletingId(match.id);
                          setScoreFor(0);
                          setScoreAgainst(0);
                          setSelectedScorers([]);
                        }}
                        className="bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-transparent text-indigo-400 hover:text-[#FFF] font-bold text-3xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        Registrar Marcador Final
                      </button>
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
