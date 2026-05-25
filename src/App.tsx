/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team, Player, UserRole } from './types';
import { DB, isSupabaseActive } from './db';
import LoginScreen from './components/LoginScreen';
import SupabaseOnboarding from './components/SupabaseOnboarding';
import TeamSelector from './components/TeamSelector';
import TacticalWhiteboard from './components/TacticalWhiteboard';
import TrainingsManager from './components/TrainingsManager';
import PlayersManager from './components/PlayersManager';
import MatchesManager from './components/MatchesManager';
import TeamSearch from './components/TeamSearch';
import PlayerDashboard from './components/PlayerDashboard';
import JoinRequestsManager from './components/JoinRequestsManager';
import { Shield, Waves, ChevronLeft, Calendar, Users, LayoutDashboard, Database, Info, Dumbbell, LogOut, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [coachedTeams, setCoachedTeams] = useState<Team[]>([]);
  const [playerMemberships, setPlayerMemberships] = useState<{team: Team, player: Player}[]>([]);
  const [viewMode, setViewMode] = useState<'coach' | 'player'>('coach');
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<'whiteboard' | 'trainings' | 'players' | 'matches'>('whiteboard');
  const [loading, setLoading] = useState(true);
  const [isSupbConnected, setIsSupbConnected] = useState(false);
  const [selectedTacticId, setSelectedTacticId] = useState<string | null>(null);
  const [whiteboardFullscreen, setWhiteboardFullscreen] = useState(false);
  const [roster, setRoster] = useState<Player[]>([]);

  const fetchRoster = async () => {
    if (activeTeam) {
      try {
        const players = await DB.players.list(activeTeam.id);
        setRoster(players);
      } catch (err) {
        console.error('Error fetching roster:', err);
      }
    }
  };

  // Authenticate user on mount and determine role
  const checkSession = async () => {
    try {
      const activeUser = await DB.auth.getUser();
      setUser(activeUser);
      setIsSupbConnected(isSupabaseActive());

      if (activeUser) {
        // 1. Fetch teams I coach
        const coached = await DB.teams.list(activeUser.id);
        setCoachedTeams(coached);

        // 2. Fetch teams where I am a player
        const allTeams = await DB.global.listAllTeams();
        const memberships: {team: Team, player: Player}[] = [];
        
        for (const t of allTeams) {
          const players = await DB.players.list(t.id);
          const found = players.find(p => p.userId === activeUser.id);
          if (found) {
            memberships.push({ team: t, player: found });
          }
        }
        setPlayerMemberships(memberships);

        // Set default view mode based on what they have
        if (coached.length === 0 && memberships.length > 0) {
          setViewMode('player');
        }
      }
    } catch (e) {
      console.error('Error during auto authorization:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    fetchRoster();
  }, [activeTeam]);

  const handleLoginSuccess = (authenticatedUser: { id: string; email: string }) => {
    setUser(authenticatedUser);
    setIsSupbConnected(isSupabaseActive());
    checkSession(); // Refresh roles
  };

  const handleLogOut = async () => {
    await DB.auth.signOut();
    setUser(null);
    setActiveTeam(null);
    setCoachedTeams([]);
    setPlayerMemberships([]);
    setViewMode('coach');
  };

  // Callback to propagate metadata changes (e.g. adding custom statistics metrics)
  const handleTeamUpdated = (updatedTeam: Team) => {
    setActiveTeam(updatedTeam);
  };

  // Check if Supabase is configured first. If not, show Onboarding setup instructions.
  if (!isSupabaseActive()) {
    return <SupabaseOnboarding />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a13] text-slate-100 flex flex-col justify-center items-center font-sans">
        <span className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin inline-block mb-3"></span>
        <h2 className="text-sm font-semibold tracking-wide text-slate-400">Preparando pizarra táctica...</h2>
      </div>
    );
  }

  // 1. UNRECOGNIZED SESSIONS: Render Authentic Login screen
  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // 2. ACTIVE TEAM VIEW (Route based on viewMode)
  if (activeTeam) {
    if (viewMode === 'player') {
      const currentMembership = roster.find(p => p.userId === user.id) || playerMemberships.find(m => m.team.id === activeTeam.id)?.player;
      if (currentMembership) {
        return (
          <div className="min-h-screen bg-[#0b0e14] flex flex-col">
            <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#161b26]/50 backdrop-blur-md">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">S</div>
                  <h1 className="text-sm font-black uppercase tracking-tight text-white border-l border-white/10 pl-3 italic">Panel de <span className="text-indigo-400">Jugador</span></h1>
               </div>
               <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveTeam(null)}
                    className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition flex items-center gap-2"
                  >
                     <ArrowLeft className="w-3.5 h-3.5" /> Volver al Inicio
                  </button>
                  <div className="w-px h-4 bg-white/10"></div>
                  <button 
                    onClick={handleLogOut}
                    className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-400 transition"
                  >
                    Cerrar Sesión
                  </button>
               </div>
            </header>
            <main className="flex-1 overflow-y-auto">
               <PlayerDashboard team={activeTeam} player={currentMembership} userId={user.id} />
            </main>
          </div>
        );
      } else {
        return (
          <div className="min-h-screen bg-[#0b0e14] flex flex-col justify-center items-center">
             <span className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin inline-block mb-3"></span>
             <p className="text-slate-400 text-xs font-black uppercase tracking-wider">Buscando vinculación con jugador...</p>
             <button 
               onClick={async () => {
                 await checkSession();
                 await fetchRoster();
               }}
               className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition animate-pulse"
             >
               Reintentar Sincronización
             </button>
             <button 
               onClick={() => {
                 setActiveTeam(null);
               }}
               className="mt-2 text-slate-500 hover:text-slate-300 text-xs font-bold uppercase transition"
             >
               Volver
             </button>
          </div>
        );
      }
    }
  }

  // 3. MAIN ENTRY HUB (Coach & Player unified entry)
  if (!activeTeam) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex flex-col font-sans">
        <div className="bg-[#161b26] border-b border-slate-800 py-2 px-4 text-center text-[10px] flex items-center justify-center gap-1.5 font-medium text-slate-400">
           <span className={`w-1.5 h-1.5 rounded-full ${isSupbConnected ? 'bg-emerald-400' : 'bg-orange-400'}`}></span>
           <span>{isSupbConnected ? 'Cloud Sync Active' : 'Local Sandbox Mode'}</span>
        </div>

        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b0e14]">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-xl shadow-indigo-900/20">S</div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tighter text-white">SportHub <span className="text-indigo-500 italic">Central</span></h1>
                <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest -mt-1 opacity-60">Unified Platform</p>
              </div>
           </div>
           <button 
             onClick={handleLogOut}
             className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-black uppercase text-slate-500 hover:text-white transition"
           >
             Cerrar Sesión
           </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
           <div className="max-w-6xl mx-auto space-y-12">
             
             <div className="flex justify-center">
                <div className="bg-[#161b26] p-1.5 rounded-[1.5rem] border border-slate-800 flex gap-1">
                   <button 
                     onClick={() => setViewMode('coach')}
                     className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
                       viewMode === 'coach' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                     }`}
                   >
                     <Shield className="w-4 h-4" /> Entrenador
                   </button>
                   <button 
                     onClick={() => setViewMode('player')}
                     className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${
                       viewMode === 'player' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                     }`}
                   >
                     <Users className="w-4 h-4" /> Jugador
                   </button>
                </div>
             </div>

             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {viewMode === 'coach' ? (
                  <div key="coach-view">
                    <TeamSelector 
                       userId={user.id} 
                       onTeamSelected={(team) => {
                         setActiveTeam(team);
                         setActiveTab('whiteboard');
                       }} 
                       onLogOut={handleLogOut}
                    />
                  </div>
                ) : (
                  <div key="player-view" className="space-y-16">
                    {playerMemberships.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                           <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                              <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                              Tus Equipos
                           </h3>
                           <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">{playerMemberships.length} Activos</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {playerMemberships.map(({team, player}) => (
                             <button
                               key={team.id}
                               onClick={() => setActiveTeam(team)}
                               className="relative bg-[#161b26] border border-slate-800 rounded-[2rem] p-8 text-left hover:border-indigo-500/50 transition-all group overflow-hidden shadow-xl"
                             >
                               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>
                               <div className="flex items-center justify-between mb-6">
                                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-900/40">
                                    {player.number}
                                  </div>
                                  <Shield className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 transition-colors" />
                               </div>
                               <h4 className="text-xl font-black text-white italic truncate group-hover:text-indigo-400 transition-colors uppercase leading-tight">{team.name}</h4>
                               <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{player.position}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{team.sport}</span>
                               </div>
                             </button>
                           ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-16 border-t border-white/5">
                      <TeamSearch 
                        userId={user.id} 
                        userEmail={user.email} 
                        onJoinRequested={checkSession} 
                        onSelectTeam={async (team) => {
                          setLoading(true);
                          await checkSession();
                          setViewMode('player');
                          setActiveTeam(team);
                          setLoading(false);
                        }}
                      />
                    </div>
                  </div>
                )}
             </div>
           </div>
        </main>

      </div>
    );
  }

  // 5. COACH TEAM WORKSPACE
  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-white flex flex-col leading-relaxed">
      
      <div className="bg-indigo-600/10 border-b border-indigo-500/10 py-2 px-4 text-center text-[10px] flex items-center justify-center gap-1.5 font-medium leading-none text-indigo-400 z-50">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
        <span>Sincronización en la nube activa • Base de Datos de Alto Rendimiento</span>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-[calc(100vh-32px)]">
        
        <aside className="w-64 bg-[#161b26] border-r border-slate-800 hidden md:flex flex-col shrink-0">
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <button 
                onClick={() => setActiveTeam(null)}
                className="flex items-center gap-3 mb-8 w-full group transition-all"
              >
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                  S
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white text-left">
                  SportHub <span className="text-indigo-500">Pro</span>
                </h1>
              </button>
              
              <nav className="space-y-1.5">
                <button
                  onClick={() => {
                    setSelectedTacticId(null);
                    setWhiteboardFullscreen(false);
                    setActiveTab('whiteboard');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-xs font-medium ${
                    activeTab === 'whiteboard'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Pizarra Táctica</span>
                </button>

                <button
                  onClick={() => setActiveTab('trainings')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-xs font-medium ${
                    activeTab === 'trainings'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Dumbbell className="w-4 h-4 shrink-0" />
                  <span>Entrenamientos</span>
                </button>

                <button
                  onClick={() => setActiveTab('players')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-xs font-medium ${
                    activeTab === 'players'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Jugadores / Plantilla</span>
                </button>

                <button
                  onClick={() => setActiveTab('matches')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-xs font-medium ${
                    activeTab === 'matches'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 font-bold'
                      : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Partidos / Fixture</span>
                </button>
              </nav>
            </div>

            <div className="bg-[#0b0e14]/50 rounded-xl p-4 border border-slate-800/80">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold font-mono text-center">Modo Entrenador</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden border border-slate-800 shrink-0"
                  style={{ backgroundColor: activeTeam.primaryColor }}
                >
                  <div
                    className="absolute inset-y-0 left-1/3 right-1/3 transform rotate-12"
                    style={{ backgroundColor: activeTeam.secondaryColor }}
                  />
                  {activeTeam.sport === 'football' ? (
                    <Shield className="w-4 h-4 text-slate-950 drop-shadow relative z-10" />
                  ) : (
                    <Waves className="w-4 h-4 text-slate-950 drop-shadow relative z-10" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate text-white leading-tight">{activeTeam.name}</p>
                  <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider mt-0.5 block font-mono flex items-center gap-1">
                    {activeTeam.sport === 'football' ? (
                      <>
                        < Shield className="w-2.5 h-2.5" /> Fútbol
                      </>
                    ) : (
                      <>
                        <Waves className="w-2.5 h-2.5" /> Waterpolo
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col bg-[#0b0e14] overflow-y-auto">
          
          <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-8 bg-[#0b0e14]/90 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <h2 className="text-sm sm:text-md font-bold text-white tracking-tight uppercase">
                {activeTab === 'whiteboard' ? 'Pizarra de Estrategia' : activeTab === 'trainings' ? 'Planificación de Entrenamientos' : activeTab === 'players' ? 'Gestión de Plantilla' : 'Calendario y Resultados'}
              </h2>
            </div>

            <div className="flex items-center gap-3.5">
              <button
                onClick={() => setActiveTeam(null)}
                className="bg-[#161b26] hover:bg-[#202737] border border-slate-800 text-[11px] text-slate-300 hover:text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition font-semibold flex items-center gap-2"
                title="Volver a la selección de equipos"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Cambiar Equipo
              </button>
              <div 
                className="w-8 h-8 rounded-lg bg-indigo-600 border border-indigo-400/20 hidden sm:flex items-center justify-center text-xs font-black text-white cursor-default shadow-md select-none"
                title={`Sesión iniciada como: ${user.email}`}
              >
                {user.email[0].toUpperCase()}
              </div>
            </div>
          </header>

          <nav className="md:hidden flex justify-around bg-[#161b26]/90 border-b border-slate-800 p-2 gap-1 sticky top-16 z-30 backdrop-blur-sm">
            <button
              onClick={() => {
                setSelectedTacticId(null);
                setWhiteboardFullscreen(false);
                setActiveTab('whiteboard');
              }}
              className={`flex-1 text-[11px] py-2 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition ${
                activeTab === 'whiteboard'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Pizarra</span>
            </button>

            <button
              onClick={() => setActiveTab('trainings')}
              className={`flex-1 text-[11px] py-2 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition ${
                activeTab === 'trainings'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 border border-transparent'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Entrenos</span>
            </button>

            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 text-[11px] py-2 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition ${
                activeTab === 'players'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Plantilla</span>
            </button>

            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-1 text-[11px] py-2 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition ${
                activeTab === 'matches'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 border border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Partidos</span>
            </button>
          </nav>

          <main className={`flex-1 p-3 sm:p-6 mb-16 relative animate-fade-in ${activeTab === 'whiteboard' ? 'z-[100]' : 'z-10'} space-y-6`}>
            
            {activeTab === 'players' && (
              <JoinRequestsManager 
                team={activeTeam} 
                players={roster} 
                onUpdated={() => {
                  checkSession();
                  fetchRoster();
                }} 
              />
            )}

            {activeTab === 'whiteboard' ? (
              <TacticalWhiteboard 
                team={activeTeam} 
                initialTacticId={selectedTacticId || undefined} 
                initialFullscreen={whiteboardFullscreen}
                onExit={() => {
                  if (whiteboardFullscreen) {
                    setActiveTab('trainings');
                  }
                  setWhiteboardFullscreen(false);
                }}
              />
            ) : activeTab === 'trainings' ? (
              <TrainingsManager 
                team={activeTeam} 
                onOpenTraining={(tactic, mode) => {
                  setSelectedTacticId(tactic.id);
                  setWhiteboardFullscreen(mode === 'view');
                  setActiveTab('whiteboard');
                }} 
              />
            ) : activeTab === 'players' ? (
              <PlayersManager team={activeTeam} onTeamUpdated={handleTeamUpdated} />
            ) : (
              <MatchesManager team={activeTeam} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
