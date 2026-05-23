/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team } from './types';
import { DB, isSupabaseActive } from './db';
import LoginScreen from './components/LoginScreen';
import TeamSelector from './components/TeamSelector';
import TacticalWhiteboard from './components/TacticalWhiteboard';
import PlayersManager from './components/PlayersManager';
import MatchesManager from './components/MatchesManager';
import SupabaseConfigPanel from './components/SupabaseConfigPanel';
import { Shield, Waves, ChevronLeft, Calendar, Users, LayoutDashboard, Database, Info } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<'whiteboard' | 'players' | 'matches'>('whiteboard');
  const [showSbConfig, setShowSbConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSupbConnected, setIsSupbConnected] = useState(false);

  // Authenticate user on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const activeUser = await DB.auth.getUser();
        setUser(activeUser);
        setIsSupbConnected(isSupabaseActive());
      } catch (e) {
        console.error('Error during auto authorization:', e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (authenticatedUser: { id: string; email: string }) => {
    setUser(authenticatedUser);
    setIsSupbConnected(isSupabaseActive());
  };

  const handleLogOut = async () => {
    await DB.auth.signOut();
    setUser(null);
    setActiveTeam(null);
  };

  // Callback to propagate metadata changes (e.g. adding custom statistics metrics)
  const handleTeamUpdated = (updatedTeam: Team) => {
    setActiveTeam(updatedTeam);
  };

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

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 font-sans selection:bg-indigo-500/30 selection:text-white flex flex-col leading-relaxed">
      
      {/* GLOBAL BANNER NOTIFYING DATABASE BACKEND TYPE STATUS */}
      <div className="bg-[#161b26] border-b border-slate-800 py-2 px-4 text-center text-[10px] flex items-center justify-center gap-1.5 font-medium leading-none text-slate-400 z-50">
        {isSupbConnected ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Servicio en la nube activo: Conectado a Supabase en tiempo real.</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            <span>Ejecutando en Modo Autónomo: Datos almacenados de forma segura en tu navegador local.</span>
          </>
        )}
      </div>

      {/* 2. ROOT DASHBOARD: Select or Found Teams */}
      {!activeTeam ? (
        <div className="space-y-4 flex-1">
          <TeamSelector
            userId={user.id}
            onSelectTeam={(team) => {
              setActiveTeam(team);
              setActiveTab('whiteboard'); // reset to whiteboard tab
            }}
            onLogOut={handleLogOut}
            onToggleSupabaseSettings={() => setShowSbConfig(!showSbConfig)}
            showSupabaseIcon={isSupbConnected}
          />
          {showSbConfig && (
            <div className="px-4 pb-12 max-w-6xl mx-auto">
              <SupabaseConfigPanel onConfigChanged={() => setIsSupbConnected(isSupabaseActive())} />
            </div>
          )}
        </div>
      ) : (
        
        // 3. TEAM INTERACTIVE WORKSPACE (Sleek Split-Pane Layout)
        <div className="flex-1 flex overflow-hidden min-h-[calc(100vh-32px)]">
          
          {/* LEFT SIDEBAR NAVIGATION (Desktop & Tablet) */}
          <aside className="w-64 bg-[#161b26] border-r border-slate-800 hidden md:flex flex-col shrink-0">
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                {/* Brand Logo Header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
                    S
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    SportHub <span className="text-indigo-500">Pro</span>
                  </h1>
                </div>
                
                {/* Dashboard Tabs Selector Navigation */}
                <nav className="space-y-1.5">
                  <button
                    onClick={() => setActiveTab('whiteboard')}
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

              {/* Sidebar bottom current selected team details */}
              <div className="bg-[#0b0e14]/50 rounded-xl p-4 border border-slate-800/80">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold font-mono">Equipo Actual</p>
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
                    <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider mt-0.5 block font-mono">
                      {activeTeam.sport === 'football' ? '⚽ Fútbol' : '🤽 Waterpolo'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT CONTAINER AREA */}
          <div className="flex-1 flex flex-col bg-[#0b0e14] overflow-y-auto">
            
            {/* Header Area */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 sm:px-8 bg-[#0b0e14]/90 backdrop-blur-sm sticky top-0 z-40">
              <div className="flex items-center gap-4">
                <h2 className="text-sm sm:text-md font-bold text-white tracking-tight uppercase">
                  {activeTab === 'whiteboard' ? 'Pizarra de Estrategia' : activeTab === 'players' ? 'Gestión de Plantilla' : 'Calendario y Resultados'}
                </h2>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-[#161b26] border border-slate-800 rounded text-[9px] text-slate-400 uppercase font-bold tracking-widest font-mono">
                  Active
                </span>
              </div>

              {/* Action buttons on the right */}
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setActiveTeam(null)}
                  className="bg-[#161b26] hover:bg-[#202737] border border-slate-800 text-[11px] text-slate-300 hover:text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition font-semibold"
                  title="Volver a la selección de equipos"
                >
                  Cambiar Equipo
                </button>
                <div 
                  className="w-8 h-8 rounded-lg bg-indigo-600 border border-indigo-400/20 hidden sm:flex items-center justify-center text-xs font-black text-white cursor-default shadow-md select-none"
                  title={`Sesión iniciada como: ${user.email}`}
                >
                  {user.email[0].toUpperCase()}
                </div>
              </div>
            </header>

            {/* MOBILE COMPACT HUB HEADERBAR (Only shown under md screen scale breakpoint) */}
            <nav className="md:hidden flex justify-around bg-[#161b26]/90 border-b border-slate-800 p-2 gap-1 sticky top-16 z-30 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('whiteboard')}
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

            {/* DYNAMIC ACTIVE VIEWPORTS */}
            <main className="flex-1 p-3 sm:p-6 mb-16 relative z-10 animate-fade-in">
              {activeTab === 'whiteboard' ? (
                <TacticalWhiteboard team={activeTeam} />
              ) : activeTab === 'players' ? (
                <PlayersManager team={activeTeam} onTeamUpdated={handleTeamUpdated} />
              ) : (
                <MatchesManager team={activeTeam} />
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
