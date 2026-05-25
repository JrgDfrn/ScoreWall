/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team, SportType } from '../types';
import { DB } from '../db';
import { Shield, Waves, PlusCircle, Trash2, Calendar, Users, LogOut, Settings2, Info } from 'lucide-react';

interface TeamSelectorProps {
  userId: string;
  onTeamSelected: (team: Team) => void;
  onLogOut: () => void;
}

export default function TeamSelector({
  userId,
  onTeamSelected,
  onLogOut
}: TeamSelectorProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [sport, setSport] = useState<SportType>('football');
  const [pColor, setPColor] = useState('#2563eb'); // default blue
  const [sColor, setSColor] = useState('#fbbf24'); // default amber
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      const list = await DB.teams.list(userId);
      setTeams(list);
    } catch (e) {
      console.error('Failed to get teams:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [userId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const newTeam: Team = {
        id: 'team-' + Date.now().toString(),
        userId,
        name: name.trim(),
        sport,
        primaryColor: pColor,
        secondaryColor: sColor,
        createdAt: new Date().toISOString(),
        customStatsConfig: sport === 'football' ? [
          { id: 'saves', name: 'Paradas del Portero', category: 'performance', defaultValue: 0 },
          { id: 'fouls', name: 'Faltas Cometidas', category: 'discipline', defaultValue: 0 },
          { id: 'mvps', name: 'Premios MVP', category: 'performance', defaultValue: 0 }
        ] : [
          { id: 'exclusions', name: 'Exclusiones (20s)', category: 'discipline', defaultValue: 0 },
          { id: 'saves_wp', name: 'Paradas de Portería', category: 'performance', defaultValue: 0 }
        ]
      };

      await DB.teams.save(newTeam);
      setName('');
      setCreating(false);
      fetchTeams();
    } catch (e) {
      console.error('Error creating team:', e);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await DB.teams.delete(teamId);
      setDeletingId(null);
      fetchTeams();
    } catch (e) {
      console.error('Error deleting team:', e);
    }
  };

  const predefinedColors = [
    { primary: '#ef4444', secondary: '#ffffff', label: 'Rojo / Blanco' },
    { primary: '#2563eb', secondary: '#f59e0b', label: 'Azul / Amarillo' },
    { primary: '#059669', secondary: '#ffffff', label: 'Verde / Blanco' },
    { primary: '#ffffff', secondary: '#1e293b', label: 'Blanco / Slate' },
    { primary: '#7c3aed', secondary: '#f43f5e', label: 'Morado / Fucsia' },
    { primary: '#0891b2', secondary: '#e0f2fe', label: 'Cyan / Agua' },
    { primary: '#d97706', secondary: '#111827', label: 'Naranja / Negro' },
    { primary: '#111827', secondary: 'gold', label: 'Negro / Dorado' },
  ];

  return (
    <div id="team-selector" className="max-w-6xl mx-auto px-4 py-8 text-slate-200 font-sans">
      
      {/* Top Banner Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">
            Panel de control <span className="text-indigo-500">Equipos</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Selecciona un equipo existente o funda una nueva escuadra deportiva.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onLogOut}
            className="flex items-center gap-1.5 text-xs font-semibold bg-red-950/20 hover:bg-red-900/30 border border-red-900/35 text-red-400 px-4 py-2.5 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Form: Create a new Team */}
        <div className="lg:col-span-1">
          <div className="bg-[#161b26] border border-slate-800 rounded-2xl p-6 sticky top-6 shadow-xl">
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-indigo-400 uppercase tracking-wider">
              <PlusCircle className="w-4 h-4" /> Fundar Nuevo Equipo
            </h2>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nombre del Equipo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Barcelona Dolphins WP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-700 transition outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Deporte / Disciplina
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSport('football')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                      sport === 'football'
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
                        : 'bg-[#0b0e14]/50 border-slate-800 text-slate-400 hover:text-slate-350'
                    }`}
                  >
                    <Shield className="w-6 h-6" />
                    <span className="text-xs font-semibold">Fútbol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSport('waterpolo')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition ${
                      sport === 'waterpolo'
                        ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
                        : 'bg-[#0b0e14]/50 border-slate-800 text-slate-400 hover:text-slate-350'
                    }`}
                  >
                    <Waves className="w-6 h-6" />
                    <span className="text-xs font-semibold">Waterpolo</span>
                  </button>
                </div>
              </div>

              {/* Jersey Designer (Colors) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Diseño de Equipación
                </label>
                
                {/* Live Badge Preview */}
                <div className="mb-3 p-3 rounded-xl bg-[#0b0e14]/85 border border-slate-800 flex items-center justify-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative shadow-inner overflow-hidden border border-slate-850"
                    style={{ backgroundColor: pColor }}
                  >
                    {/* Secondary stripe */}
                    <div 
                      className="absolute inset-y-0 left-1/3 right-1/3 transform rotate-12"
                      style={{ backgroundColor: sColor }}
                    />
                    
                    {sport === 'football' ? (
                      <Shield className="w-6 h-6 text-slate-950 drop-shadow-md relative z-10" />
                    ) : (
                      <Waves className="w-6 h-6 text-slate-950 drop-shadow-md relative z-10" />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold block text-slate-300">Escudo del Club</span>
                    <span className="text-[10px] text-slate-500">Diseño bicolor interactivo</span>
                  </div>
                </div>

                {/* Color Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {predefinedColors.map((col, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPColor(col.primary);
                        setSColor(col.secondary);
                      }}
                      className="h-8 rounded-lg flex border border-slate-850 overflow-hidden hover:scale-105 transition"
                      title={col.label}
                    >
                      <div className="w-1/2" style={{ backgroundColor: col.primary }}></div>
                      <div className="w-1/2" style={{ backgroundColor: col.secondary }}></div>
                    </button>
                  ))}
                </div>

                {/* Custom Pickers */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Color Principal</span>
                    <div className="flex items-center gap-1.5 bg-[#0b0e14]/60 p-1.5 border border-slate-800 rounded-lg">
                      <input
                        type="color"
                        value={pColor}
                        onChange={(e) => setPColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="font-mono text-[10px] text-slate-400">{pColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Color Secundario</span>
                    <div className="flex items-center gap-1.5 bg-[#0b0e14]/60 p-1.5 border border-slate-800 rounded-lg">
                      <input
                        type="color"
                        value={sColor}
                        onChange={(e) => setSColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="font-mono text-[10px] text-slate-400">{sColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-2.5 rounded-xl transition shadow-lg shadow-indigo-500/20"
              >
                Crear Club Oficial
              </button>
            </form>
          </div>
        </div>

        {/* Right List: Created Teams Grid */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 h-64 border border-dashed border-slate-800 rounded-2xl bg-[#161b26]/30">
              <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin inline-block mb-3"></span>
              <span className="text-slate-400 text-xs text-center">Cargando equipos del entrenador...</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 h-full border border-dashed border-slate-800 rounded-2xl bg-[#161b26]/10 text-center">
              <Shield className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="font-bold text-slate-300">Ningún club registrado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                No tienes equipos fundados todavía. Utiliza el formulario lateral para fundar tu primer equipo de Fútbol o Waterpolo en un clic.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-[#161b26] border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all relative flex flex-col justify-between group"
                >
                  <div>
                    {/* Team Visual Header Card */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center relative shadow-inner overflow-hidden border border-slate-800"
                          style={{ backgroundColor: team.primaryColor }}
                        >
                          <div
                            className="absolute inset-y-0 left-1/3 right-1/3 transform rotate-12"
                            style={{ backgroundColor: team.secondaryColor }}
                          />
                          {team.sport === 'football' ? (
                            <Shield className="w-5 h-5 text-slate-950 drop-shadow relative z-10" />
                          ) : (
                            <Waves className="w-5 h-5 text-slate-950 drop-shadow relative z-10" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-md text-white group-hover:text-indigo-400 transition truncate max-w-[160px]">
                            {team.name}
                          </h3>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold flex items-center gap-1">
                            {team.sport === 'football' ? (
                              <>
                                <Shield className="w-2.5 h-2.5 text-indigo-500/70" /> Fútbol
                              </>
                            ) : (
                              <>
                                <Waves className="w-2.5 h-2.5 text-cyan-500/70" /> Waterpolo
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Delete actions */}
                      {deletingId === team.id ? (
                        <div className="bg-[#0b0e14] p-1.5 rounded-lg flex items-center gap-1.5 border border-red-900 z-10">
                          <span className="text-[9px] text-red-400 font-bold">¿Borrar?</span>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="text-[9px] bg-red-600 hover:bg-red-500 text-white font-bold px-1.5 py-0.5 rounded"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-1.5 py-0.5 rounded"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(team.id)}
                          className="p-1 text-slate-600 hover:text-red-400 hover:bg-[#0b0e14]/80 rounded h-7 w-7 flex items-center justify-center transition"
                          title="Eliminar Equipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-xs border-t border-slate-800/40 pt-3">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-slate-500" /> Plantilla e Indicadores
                        </span>
                        <span className="font-semibold text-slate-300">Escalable</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" /> Fecha Fundación
                        </span>
                        <span className="font-mono text-[10px] text-slate-300">
                          {new Date(team.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onTeamSelected(team)}
                    className="w-full mt-5 bg-[#0b0e14]/70 group-hover:bg-indigo-600 hover:!bg-indigo-500 text-slate-300 group-hover:text-white font-bold text-xs py-2.5 rounded-xl border border-slate-800/60 group-hover:border-transparent transition flex items-center justify-center gap-1.5 shadow"
                  >
                    <span>Entrar al Vestuario</span>
                    <Shield className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
