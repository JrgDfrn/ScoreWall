import React, { useState, useEffect } from 'react';
import { Team, Player, Match, Training } from '../types';
import { DB } from '../db';
import { 
  Trophy, Users, Calendar, Clock, ThumbsUp, ThumbsDown, 
  ChevronRight, Activity, Target, ShieldCheck, MapPin, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlayerDashboardProps {
  team: Team;
  player: Player;
  userId: string;
}

export default function PlayerDashboard({ team, player, userId }: PlayerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'matches' | 'trainings'>('stats');
  const [matches, setMatches] = useState<Match[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [mList, tList] = await Promise.all([
          DB.matches.list(team.id),
          DB.trainings.list(team.id)
        ]);
        setMatches(mList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setTrainings(tList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        console.error('Error fetching player dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [team.id]);

  const handleVote = async (trainingId: string, vote: 'up' | 'down') => {
    try {
      await DB.trainings.vote(trainingId, userId, vote);
      const updatedList = await DB.trainings.list(team.id);
      setTrainings(updatedList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const getVoteCounts = (training: Training) => {
    const votes = training.votes || {};
    const up = Object.values(votes).filter(v => v === 'up').length;
    const down = Object.values(votes).filter(v => v === 'down').length;
    return { up, down, myVote: votes[userId] };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in text-slate-100">
      {/* PLAYER HEADER AREA */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-[#161b26] border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/10 transition-all duration-700"></div>
        
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center text-3xl font-black shadow-2xl shadow-indigo-500/20 border-4 border-[#161b26]">
            {player.number}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full border-4 border-[#161b26] flex items-center justify-center shadow-lg">
             <ShieldCheck className="w-3 h-3 text-white" />
          </div>
        </div>

        <div className="text-center md:text-left flex-1 space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">{player.name}</h1>
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 rounded-full text-slate-400 self-center md:self-auto">
              ID #{player.id.substring(0, 4)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {player.position}
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-700 hidden md:block"></div>
            <div className="text-sm font-black text-indigo-400 uppercase tracking-widest">{team.name}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
           <div className="bg-[#0b0e14]/50 p-4 rounded-2xl border border-slate-800 text-center">
             <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Goles</p>
             <p className="text-xl font-black text-white">{player.stats.goals}</p>
           </div>
           <div className="bg-[#0b0e14]/50 p-4 rounded-2xl border border-slate-800 text-center">
             <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Asistencias</p>
             <p className="text-xl font-black text-white">{player.stats.assists}</p>
           </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex bg-[#161b26] p-1.5 rounded-2xl border border-slate-800 w-full sm:w-fit mx-auto sm:mx-0 overflow-x-auto custom-scrollbar">
        {[
          { id: 'stats', label: 'Estadísticas', icon: Activity },
          { id: 'matches', label: 'Partidos', icon: Trophy },
          { id: 'trainings', label: 'Entrenamientos', icon: Target }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === 'stats' && (
            <motion.div 
              key="stats-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {/* PRIMARY STATS CARD */}
              <div className="lg:col-span-2 bg-[#161b26] border border-slate-800 rounded-[2rem] p-8 space-y-8">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-lg font-black uppercase italic tracking-tight">Rendimiento General</h3>
                  <Target className="w-5 h-5 text-indigo-400" />
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  {[
                    { label: 'Goles', value: player.stats.goals, color: 'text-emerald-400' },
                    { label: 'Asistencias', value: player.stats.assists, color: 'text-blue-400' },
                    { label: 'T. Amarillas', value: player.stats.yellowCards, color: 'text-amber-400' },
                    { label: 'T. Rojas', value: player.stats.redCards, color: 'text-rose-400' }
                  ].map(s => (
                    <div key={s.label} className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{s.label}</p>
                      <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* CUSTOM STATS GRID */}
                {Object.keys(player.stats.custom || {}).length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Métricas Específicas</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Object.entries(player.stats.custom).map(([id, val]) => (
                        <div key={id} className="bg-[#0b0e14]/50 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between group hover:border-indigo-500/30 transition-all">
                          <span className="text-[9px] font-black uppercase text-slate-400 truncate tracking-tight">{id}</span>
                          <span className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD FOR QUICK TIPS OR ACHIEVEMENTS? */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 border border-indigo-500/50 rounded-[2rem] p-8 text-white space-y-6 shadow-xl shadow-indigo-900/20">
                 <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Trophy className="w-6 h-6" />
                 </div>
                 <div className="space-y-2">
                   <h3 className="text-xl font-black italic uppercase leading-none">MVP del Mes</h3>
                   <p className="text-indigo-200 text-sm leading-relaxed">Tu rendimiento ha sido excepcional. Sigue así para ayudar al equipo a conseguir el campeonato.</p>
                 </div>
                 <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Próximo objetivo</span>
                    <span className="text-xs font-black">+5 Goles</span>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'matches' && (
            <motion.div 
              key="matches-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
               {matches.length === 0 ? (
                 <div className="py-20 text-center bg-[#161b26] border border-dashed border-slate-800 rounded-[2rem]">
                   <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                   <p className="text-slate-500 font-medium">No hay partidos programados todavía.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches.map(match => {
                      const isCompleted = match.status === 'completed';
                      const isCallup = match.callupIds?.includes(player.id);

                      return (
                        <div 
                          key={match.id} 
                          className={`bg-[#161b26] border rounded-3xl p-6 transition-all relative overflow-hidden group ${
                            isCallup ? 'border-indigo-500/40 shadow-lg shadow-indigo-900/5' : 'border-slate-800'
                          }`}
                        >
                          {isCallup && (
                            <div className="absolute top-0 right-0 py-1.5 px-6 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-2xl shadow-lg">
                              CONVOCADO
                            </div>
                          )}

                          <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-[#0b0e14] flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                               <p className="text-xs font-bold text-slate-400">{new Date(match.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                               <p className="text-xs font-black text-white">{match.time} • {match.location}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 py-6 border-y border-white/5">
                            <div className="flex-1 text-right space-y-1">
                               <p className="text-xs font-black text-white truncate">{team.name}</p>
                            </div>
                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                               {isCompleted ? (
                                  <div className="flex items-center gap-2">
                                     <span className="text-2xl font-black text-indigo-400">{match.goalsFor}</span>
                                     <span className="text-slate-700">-</span>
                                     <span className="text-2xl font-black text-white">{match.goalsAgainst}</span>
                                  </div>
                               ) : (
                                  <div className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase rounded-lg border border-amber-500/20">
                                     VS
                                  </div>
                               )}
                            </div>
                            <div className="flex-1 text-left space-y-1">
                               <p className="text-xs font-black text-white truncate">{match.opponent}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                               <MapPin className="w-3 h-3" />
                               {match.location}
                             </div>
                             {match.scorers?.includes(player.name) && (
                               <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase italic">
                                 <Activity className="w-3.5 h-3.5" /> Goleador
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    })}
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'trainings' && (
            <motion.div 
              key="trainings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
               {trainings.length === 0 ? (
                 <div className="py-20 text-center bg-[#161b26] border border-dashed border-slate-800 rounded-[2rem]">
                   <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                   <p className="text-slate-500 font-medium">No hay entrenamientos registrados todavía.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {trainings.map(training => {
                      const { up, down, myVote } = getVoteCounts(training);

                      return (
                        <div key={training.id} className="bg-[#161b26] border border-slate-800 rounded-[2rem] p-8 space-y-6 hover:border-indigo-500/40 transition-all flex flex-col group">
                           <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {new Date(training.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </span>
                                </div>
                                <h4 className="text-xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase italic">{training.title}</h4>
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-[#0b0e14] text-slate-400 rounded-lg border border-slate-800">
                                {training.type}
                              </span>
                           </div>

                           <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{training.description}</p>

                           <div className="flex flex-wrap gap-2">
                              {training.focusItems?.map(item => (
                                <span key={item} className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">{item}</span>
                              ))}
                           </div>

                           <div className="pt-6 border-t border-white/5 flex items-center justify-between mt-auto">
                              <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                   <Clock className="w-3.5 h-3.5" /> {training.duration} min
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 capitalize">
                                   <Activity className="w-3.5 h-3.5" /> Intensidad: {training.intensity}
                                 </div>
                              </div>

                              <div className="flex items-center gap-3 bg-[#0b0e14] p-1.5 rounded-2xl border border-slate-800">
                                 <button 
                                   onClick={() => handleVote(training.id, 'up')}
                                   className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                                     myVote === 'up' 
                                       ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                                       : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5'
                                   }`}
                                 >
                                   <ThumbsUp className="w-4 h-4" />
                                   <span className="text-[10px] font-black">{up}</span>
                                 </button>
                                 <button 
                                   onClick={() => handleVote(training.id, 'down')}
                                   className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                                     myVote === 'down' 
                                       ? 'bg-rose-500 text-white shadow-lg shadow-rose-900/20' 
                                       : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/5'
                                   }`}
                                 >
                                   <ThumbsDown className="w-4 h-4" />
                                   <span className="text-[10px] font-black">{down}</span>
                                 </button>
                              </div>
                           </div>
                        </div>
                      );
                    })}
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
