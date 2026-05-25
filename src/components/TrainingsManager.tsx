/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Team, Tactic } from '../types';
import { DB } from '../db';
import { Search, Filter, Star, Clock, Trash2, ChevronRight, Dumbbell, Award, Target, Edit, Maximize2 } from 'lucide-react';

interface TrainingsManagerProps {
  team: Team;
  onOpenTraining: (tactic: Tactic, mode: 'edit' | 'view') => void;
}

export default function TrainingsManager({ team, onOpenTraining }: TrainingsManagerProps) {
  const [trainings, setTrainings] = useState<Tactic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const fetchTrainings = async () => {
    setLoading(true);
    try {
      const allTactics = await DB.tactics.list(team.id);
      // Filter only trainings
      setTrainings(allTactics.filter(t => t.type === 'training'));
    } catch (e) {
      console.error('Error fetching trainings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, [team.id]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar este entrenamiento permanentemente?')) return;
    try {
      await DB.tactics.delete(id);
      fetchTrainings();
    } catch (e) {
      console.error('Error deleting training:', e);
    }
  };

  const categories = team.sport === 'waterpolo' 
    ? ['piernas', 'chuts', 'partido', 'tactica', 'hombre de mas', 'contras', 'natacion', 'fisico', 'circuito', 'tecnica']
    : ['físico', 'técnica', 'táctica', 'posesión', 'finalización', 'ABP', 'partido', 'circuito', 'velocidad', 'resistencia'];

  const filteredTrainings = trainings.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || (t.categories && t.categories.includes(selectedCategory));
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-[#161b26] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px] animate-fade-in relative group">
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />
      
      {/* Header */}
      <div className="p-6 border-b border-slate-850 flex items-center justify-between relative z-10">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 rounded-lg">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            Gestión de Entrenamientos
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">Visualiza y organiza tus sesiones preparadas</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="bg-[#0b0e14] border border-slate-800 px-3 py-1 rounded-full text-[10px] font-bold text-indigo-400">
             {filteredTrainings.length} Sesiones
           </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-6 py-4 bg-[#0b0e14]/40 border-b border-slate-850 flex flex-col md:flex-row gap-4 relative z-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500/50 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-300 outline-none transition"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 custom-scrollbar whitespace-nowrap max-w-full md:max-w-[300px]">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <button 
            onClick={() => setSelectedCategory('All')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${selectedCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-800/40 text-slate-500 hover:text-slate-300'}`}
          >
            Todo
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition capitalize ${selectedCategory === cat ? 'bg-emerald-600 text-white' : 'bg-slate-800/40 text-slate-500 hover:text-slate-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid List */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
        {loading ? (
          <div className="h-full flex items-center justify-center">
             <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTrainings.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-16 h-16 bg-slate-800/30 rounded-full flex items-center justify-center border border-slate-800">
                <Target className="w-8 h-8 text-slate-600" />
             </div>
             <div>
                <p className="text-sm font-bold text-slate-400">No se encontraron entrenamientos</p>
                <p className="text-xs text-slate-600 mt-1">Usa la pizarra para guardar un entrenamiento nuevo</p>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTrainings.map((train) => (
              <div 
                key={train.id}
                className="bg-[#0b0e14]/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 transition-all duration-300 group/card relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-3 relative z-10">
                   <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px]">
                        {train.name}
                      </h4>
                      <div className="flex text-amber-400 gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-2.5 h-2.5 ${s <= (train.rating || 0) ? 'fill-current' : 'text-slate-800'}`} />
                        ))}
                      </div>
                   </div>
                   <button 
                     onClick={(e) => handleDelete(train.id, e)}
                     className="p-1.5 rounded-lg text-slate-700 hover:text-rose-500 hover:bg-rose-500/10 transition opacity-0 group-hover/card:opacity-100"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                </div>

                <p className="text-[10px] text-slate-500 line-clamp-2 mb-4 h-8 leading-relaxed font-medium italic">
                  {train.description || 'Sin descripción detallada.'}
                </p>

                <div className="flex flex-wrap gap-1 mb-4 h-10 overflow-hidden relative z-10">
                   {train.categories?.map(c => (
                     <span key={c} className="text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md bg-indigo-950/30 text-indigo-400 border border-indigo-900/30">
                       {c}
                     </span>
                   ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/50 relative z-10">
                   <button
                     onClick={() => onOpenTraining(train, 'edit')}
                     className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all text-[9px] font-black uppercase tracking-wider"
                   >
                     <Edit className="w-3 h-3" />
                     <span>Editar</span>
                   </button>
                   <button
                     onClick={() => onOpenTraining(train, 'view')}
                     className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:text-white hover:bg-indigo-600 transition-all text-[9px] font-black uppercase tracking-wider"
                   >
                     <Maximize2 className="w-3 h-3" />
                     <span>Ver/Usar</span>
                   </button>
                </div>

                {/* Card accent gradient */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl -mr-12 -mb-12 rounded-full group-hover/card:bg-indigo-500/10 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
