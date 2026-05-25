/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team, Player, CustomStatDefinition } from '../types';
import { DB } from '../db';
import { UserPlus, Star, BarChart3, Settings, Trash2, Edit2, Minus, Plus, Target, Trophy, Activity, UserCircle, Zap, ShieldAlert } from 'lucide-react';

interface PlayersManagerProps {
  team: Team;
  onTeamUpdated: (updatedTeam: Team) => void;
}

export default function PlayersManager({ team, onTeamUpdated }: PlayersManagerProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create / Edit player form states
  const [name, setName] = useState('');
  const [number, setNumber] = useState(5);
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  
  // Custom metrics configuration states
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricCat, setNewMetricCat] = useState<'performance' | 'discipline' | 'physical'>('performance');

  const suggestedPositions = team.sport === 'football' 
    ? ['Portero', 'Defensa Central', 'Lateral', 'Centrocampista', 'Extremo', 'Delantero']
    : ['Portero', 'Boya (Pívot)', 'Defensor Boya', 'Extremo Izquierdo', 'Extremo Derecho', 'Atacante 1-2 lineas'];

  const fetchRoster = async () => {
    try {
      setLoading(true);
      const list = await DB.players.list(team.id);
      setPlayers(list);
      
      // select default position if empty
      if (!position && suggestedPositions.length > 0) {
        setPosition(suggestedPositions[0]);
      }
    } catch (e) {
      console.error('Failed to get roster:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [team.id]);

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const activePlayer: Player = editingPlayerId 
        ? {
            ...players.find(p => p.id === editingPlayerId)!,
            name: name.trim(),
            number,
            position,
            notes: notes.trim()
          }
        : {
            id: 'plr-' + Date.now().toString(),
            teamId: team.id,
            name: name.trim(),
            number,
            position,
            active: true,
            notes: notes.trim(),
            stats: {
              goals: 0,
              assists: 0,
              yellowCards: 0,
              redCards: 0,
              custom: (team.customStatsConfig || []).reduce((acc, current) => {
                acc[current.id] = current.defaultValue;
                return acc;
              }, {} as Record<string, number>)
            }
          };

      await DB.players.save(activePlayer);
      setName('');
      setNotes('');
      setNumber(number + 1); // Auto increment number helper
      setEditingPlayerId(null);
      fetchRoster();
    } catch (e) {
      console.error('Error saving player:', e);
    }
  };

  const handleEditInit = (plr: Player) => {
    setEditingPlayerId(plr.id);
    setName(plr.name);
    setNumber(plr.number);
    setPosition(plr.position);
    setNotes(plr.notes || '');
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('¿Seguro que deseas dar de baja a este jugador de la plantilla?')) return;
    try {
      await DB.players.delete(playerId);
      fetchRoster();
    } catch (e) {
      console.error('Failed to remove player:', e);
    }
  };

  // Stat manipulators (Increments goals / custom stats)
  const modifyStat = async (player: Player, statField: 'goals' | 'assists' | 'yellowCards' | 'redCards', delta: number) => {
    try {
      const updatedStats = { ...player.stats };
      updatedStats[statField] = Math.max(0, updatedStats[statField] + delta);
      
      const updatedPlayer: Player = {
        ...player,
        stats: updatedStats
      };

      // Pessimistic render state update immediately for reactive clicks
      setPlayers(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      await DB.players.save(updatedPlayer);
    } catch (e) {
      console.error('Failed to save stat modification:', e);
    }
  };

  const modifyCustomStat = async (player: Player, metricId: string, delta: number) => {
    try {
      const updatedStats = { ...player.stats };
      const currentCustom = { ...updatedStats.custom };
      const val = currentCustom[metricId] !== undefined ? currentCustom[metricId] : 0;
      currentCustom[metricId] = Math.max(0, val + delta);
      updatedStats.custom = currentCustom;

      const updatedPlayer: Player = {
        ...player,
        stats: updatedStats
      };

      setPlayers(prev => prev.map(p => p.id === player.id ? updatedPlayer : p));
      await DB.players.save(updatedPlayer);
    } catch (e) {
      console.error('Failed modifying custom stat:', e);
    }
  };

  // SCALABILITY ENGINE: Dynamic Custom Metrics Config
  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMetricName.trim()) return;

    try {
      const metricId = 'm_' + Date.now().toString().substring(8);
      const newDef: CustomStatDefinition = {
        id: metricId,
        name: newMetricName.trim(),
        category: newMetricCat,
        defaultValue: 0
      };

      const updatedConfig = [...(team.customStatsConfig || []), newDef];
      const updatedTeam: Team = {
        ...team,
        customStatsConfig: updatedConfig
      };

      // 1. Save team update
      await DB.teams.save(updatedTeam);
      
      // 2. Map existing players to have default value index for the new metric to avoid runtime undefined
      const allPlayers = await DB.players.list(team.id);
      for (const p of allPlayers) {
        if (p.stats.custom[metricId] === undefined) {
          p.stats.custom[metricId] = 0;
          await DB.players.save(p);
        }
      }

      setNewMetricName('');
      onTeamUpdated(updatedTeam);
      fetchRoster();
    } catch (e) {
      console.error('Failed to configure dynamic metric:', e);
    }
  };

  const handleRemoveMetric = async (metricId: string) => {
    if (!confirm('Si eliminas esta métrica, se borrarán todos los valores anotados para ella de tus jugadores. ¿Proceder?')) return;

    try {
      const updatedConfig = (team.customStatsConfig || []).filter(c => c.id !== metricId);
      const updatedTeam: Team = {
        ...team,
        customStatsConfig: updatedConfig
      };

      await DB.teams.save(updatedTeam);
      onTeamUpdated(updatedTeam);
      fetchRoster();
    } catch (e) {
      console.error('Failed removing metric:', e);
    }
  };

  return (
    <div id="players-manager" className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4">
      
      {/* LEFT FORM: ADD PLAYER & CUSTOM METRICS WHITEBOARD CONFIG */}
      <div className="lg:col-span-1 space-y-4">
        
        {/* Form Player Creation */}
        <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl shadow-xl">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-4 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" /> 
            {editingPlayerId ? 'Editar Deportista' : 'Inscribir Jugador'}
          </h2>

          <form onSubmit={handleSavePlayer} className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Nombre Completo</label>
              <input
                type="text"
                required
                placeholder="Ej: Marc Estiarte"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-750 focus:border-indigo-500 transition outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Dorsal / Número</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={99}
                  value={number}
                  onChange={(e) => setNumber(Number(e.target.value))}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 transition outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Posición Común</label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:border-indigo-500 transition outline-none"
                >
                  {suggestedPositions.map((pos) => (
                    <option key={pos} value={pos} className="bg-[#0b0e14]">{pos}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1.5 uppercase font-bold">Anotaciones Médicas / Rendimiento (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Ej: Lateral explosivo. Viene de lesión leve."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder:text-slate-755 focus:border-indigo-500 transition resize-none outline-none leading-relaxed"
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingPlayerId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlayerId(null);
                    setName('');
                    setNotes('');
                  }}
                  className="w-1/3 bg-[#0b0e14] hover:bg-slate-900 border border-slate-800 text-slate-400 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Descartar
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition shadow shadow-indigo-500/10 cursor-pointer"
              >
                {editingPlayerId ? 'Aplicar Cambios' : 'Dar de Alta Ficha'}
              </button>
            </div>
          </form>
        </div>

        {/* METRICS CONFIGURATOR PANEL (SCALABILITY PROOF) */}
        <div className="bg-[#161b26] p-5 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-2xs font-extrabold uppercase tracking-widest text-[#06b6d4] flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-cyan-500" /> Métricas Personalizadas
            </h3>
            <button
              onClick={() => setEditingMetrics(!editingMetrics)}
              className="text-3xs font-black text-indigo-400 hover:text-indigo-300 uppercase transition cursor-pointer"
            >
              {editingMetrics ? 'Cerrar' : 'Ajustar'}
            </button>
          </div>
          
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Nuestra estructura de datos admite añadir cualquier parámetro que consideres oportuno de manera automática (Saves, Exclusiones de 20s, Bloqueos, Sprints).
          </p>

          {editingMetrics ? (
            <div className="space-y-4 pt-2.5 border-t border-slate-850">
              <form onSubmit={handleAddMetric} className="space-y-2.5">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-black mb-1">Nuevo Canal de Telemetría</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Exclusiones (20s)"
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-800 outline-none focus:border-indigo-500 transition"
                    value={newMetricName}
                    onChange={(e) => setNewMetricName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase font-black mb-1">Categoría</label>
                  <select
                    className="w-full bg-[#0b0e14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-[#FFF] outline-none focus:border-indigo-500 transition"
                    value={newMetricCat}
                    onChange={(e) => setNewMetricCat(e.target.value as any)}
                  >
                    <option value="performance" className="bg-[#0b0e14]">Rendimiento Técnico</option>
                    <option value="discipline" className="bg-[#0b0e14]">Disciplinario (Faltas/Tarjetas)</option>
                    <option value="physical" className="bg-[#0b0e14]">Estado Físico / Minutos</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-3xs py-2 rounded-lg transition cursor-pointer"
                >
                  Agregar Parámetro
                </button>
              </form>

              {/* List current configured custom metrics */}
              <div className="space-y-1 pt-2.5 border-t border-slate-850">
                <span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Métricas Activas:</span>
                {(team.customStatsConfig || []).length === 0 ? (
                  <span className="text-[10px] text-slate-650 block">Solo estadísticas estándar.</span>
                ) : (
                  (team.customStatsConfig || []).map((c) => (
                    <div key={c.id} className="flex justify-between items-center text-xs bg-[#0b0e14] px-3 py-2 rounded-xl border border-slate-850">
                      <div>
                        <span className="text-slate-300 font-medium block text-2xs">{c.name}</span>
                        <span className="text-[8px] text-indigo-400 uppercase tracking-widest font-bold">{c.category === 'performance' ? 'Rendimiento' : c.category === 'discipline' ? 'Disciplina' : 'Físico'}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMetric(c.id)}
                        className="text-red-450 hover:text-red-350 p-1 rounded-lg hover:bg-red-950/25 transition cursor-pointer"
                        title="Borrar Métrica"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-2.5 border-t border-slate-850 bg-[#0b0e14]/50 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 block mb-1">Métricas Activadas:</span>
              <div className="space-y-1.5 text-2xs text-slate-500 font-medium pl-1">
                <p className="flex items-center gap-1.5"><Target className="w-2.5 h-2.5 text-amber-500" /> Goles (Principal)</p>
                <p className="flex items-center gap-1.5"><Zap className="w-2.5 h-2.5 text-cyan-500" /> Asistencias</p>
                <p className="flex items-center gap-1.5"><ShieldAlert className="w-2.5 h-2.5 text-red-500" /> Tarjetas Disciplinarias</p>
                {(team.customStatsConfig || []).map(c => (
                  <p key={c.id} className="flex items-center gap-1.5 text-indigo-400/80"><Star className="w-2.5 h-2.5" /> {c.name}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PLANTILLA GRID VIEW: LIST CARDS WITH LIVE METRICS INCREMENT */}
      <div className="lg:col-span-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 h-64 border border-dashed border-slate-805 rounded-2xl bg-[#161b26]/30">
            <span className="w-8 h-8 rounded-full border-2 border-indigo-550 border-t-transparent animate-spin inline-block mb-3"></span>
            <span className="text-slate-400 text-xs text-center">Cargando futbolistas/waterpolistas...</span>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-slate-800 rounded-2.5xl bg-[#161b26]/20 text-center">
            <Star className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
            <h3 className="font-bold text-slate-300">Plantilla vacía</h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
              Aún no has registrado ningún jugador. Completa el casillero de inscripción lateral para asignarle número de dorsal, posición y notas individuales.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((plr) => (
              <div
                key={plr.id}
                className="bg-[#161b26] hover:bg-[#191f2c] border border-slate-800 hover:border-slate-700 p-5 rounded-2.5xl shadow-xl transition-all duration-200 relative group flex flex-col justify-between"
              >
                <div>
                  {/* Player Basic Heading */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#0b0e14] border border-slate-800 flex items-center justify-center select-none font-sans relative">
                        <span className="font-black text-lg text-indigo-400">
                          {plr.number}
                        </span>
                        {/* Little icon based on sport role position */}
                        <span className="absolute -bottom-1.5 -right-1.5 text-[8px] px-1 py-0.5 bg-[#161b26] border border-slate-800 rounded text-slate-400 uppercase font-black scale-90">
                          {plr.position.substring(0, 3)}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-white max-w-[160px] truncate leading-tight transition">
                          {plr.name}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block mt-0.5 flex items-center gap-1">
                          <UserCircle className="w-2.5 h-2.5" /> {plr.position}
                        </span>
                      </div>
                    </div>

                    {/* Operational Buttons */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEditInit(plr)}
                        className="p-1 h-7 w-7 text-slate-500 hover:text-white rounded bg-[#0b0e14]/50 hover:bg-[#0b0e14] border border-slate-800 hover:border-slate-700 flex items-center justify-center transition cursor-pointer"
                        title="Editar datos del jugador"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePlayer(plr.id)}
                        className="p-1 h-7 w-7 text-slate-500 hover:text-red-400 rounded bg-[#0b0e14]/50 hover:bg-[#0b0e14] border border-slate-800 hover:border-slate-700 flex items-center justify-center transition cursor-pointer"
                        title="Dar de baja jugador"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Operational Notes */}
                  {plr.notes && (
                    <p className="text-[10px] bg-[#0b0e14]/65 p-3 border border-slate-850 rounded-xl text-slate-400 leading-relaxed mb-4">
                      {plr.notes}
                    </p>
                  )}
                </div>

                {/* SCALABLE TELEMETRY SCOREBOARD */}
                <div className="space-y-3 pt-3.5 border-t border-[#0b0e14]/60">
                  <span className="text-[9px] font-black tracking-widest uppercase text-slate-500 block flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 text-emerald-500" /> Goles y Rendimiento
                  </span>

                  {/* Core Goal Trackers & Core stats */}
                  <div className="grid grid-cols-2 gap-2 text-2xs">
                    {/* Goles */}
                    <div className="bg-[#0b0e14]/70 rounded-xl p-2 flex items-center justify-between border border-slate-850 h-11 px-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Trophy className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="font-bold text-slate-300 truncate">Goles</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => modifyStat(plr, 'goals', -1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-extrabold text-[#f59e0b] min-w-4 text-center text-xs">{plr.stats.goals}</span>
                        <button
                          onClick={() => modifyStat(plr, 'goals', 1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Asistencias */}
                    <div className="bg-[#0b0e14]/70 rounded-xl p-2 flex items-center justify-between border border-slate-850 h-11 px-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Target className="w-3 h-3 text-cyan-500 shrink-0" />
                        <span className="font-bold text-slate-300 truncate">Asistencias</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => modifyStat(plr, 'assists', -1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-extrabold text-[#06b6d4] min-w-4 text-center text-xs">{plr.stats.assists}</span>
                        <button
                          onClick={() => modifyStat(plr, 'assists', 1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tarjeta Amarilla */}
                    <div className="bg-[#0b0e14]/70 rounded-xl p-2 flex items-center justify-between border border-slate-850 h-11 px-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-3 bg-amber-400 rounded-sm shadow-sm shrink-0" />
                        <span className="font-bold text-slate-300 truncate">Amarilla</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => modifyStat(plr, 'yellowCards', -1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-bold text-slate-200 min-w-4 text-center text-xs">{plr.stats.yellowCards}</span>
                        <button
                          onClick={() => modifyStat(plr, 'yellowCards', 1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tarjeta Roja */}
                    <div className="bg-[#0b0e14]/70 rounded-xl p-2 flex items-center justify-between border border-slate-850 h-11 px-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-3 bg-red-500 rounded-sm shadow-sm shrink-0" />
                        <span className="font-bold text-slate-300 truncate">Roja</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => modifyStat(plr, 'redCards', -1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-bold text-slate-200 min-w-4 text-center text-xs">{plr.stats.redCards}</span>
                        <button
                          onClick={() => modifyStat(plr, 'redCards', 1)}
                          className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamically Scaled Parameters Render */}
                  {(team.customStatsConfig || []).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-2xs pt-1">
                      {(team.customStatsConfig || []).map((c) => {
                        const score = plr.stats.custom[c.id] !== undefined ? plr.stats.custom[c.id] : c.defaultValue;
                        return (
                          <div key={c.id} className="bg-indigo-950/20 rounded-xl p-2 flex items-center justify-between border border-indigo-550/10 h-11 px-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Activity className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span className="font-bold text-indigo-300 truncate" title={c.name}>{c.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => modifyCustomStat(plr, c.id, -1)}
                                className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-450 hover:text-white transition cursor-pointer"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="font-extrabold text-xs text-[#818cf8] min-w-4 text-center">{score}</span>
                              <button
                                onClick={() => modifyCustomStat(plr, c.id, 1)}
                                className="w-4.5 h-4.5 bg-[#161b26] hover:bg-slate-850 border border-slate-800 rounded flex items-center justify-center text-slate-450 hover:text-white transition cursor-pointer"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
