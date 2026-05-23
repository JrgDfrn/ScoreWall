/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, Info, RefreshCw, Trash2, Key } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, isSupabaseActive, SUPABASE_SQL_SCHEMA } from '../db';

interface SupabaseConfigPanelProps {
  onConfigChanged: () => void;
}

export default function SupabaseConfigPanel({ onConfigChanged }: SupabaseConfigPanelProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    const config = getSupabaseConfig();
    setUrl(config.url);
    setAnonKey(config.anonKey);
    setActive(isSupabaseActive());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !anonKey) {
      setMsg({ text: 'Por favor rellena ambos campos.', type: 'error' });
      return;
    }
    if (!url.startsWith('https://')) {
      setMsg({ text: 'La URL de Supabase debe comenzar con https://', type: 'error' });
      return;
    }

    saveSupabaseConfig({ url, anonKey });
    setActive(true);
    setMsg({ text: 'Credenciales de Supabase guardadas localmente en este navegador.', type: 'success' });
    onConfigChanged();
  };

  const handleClear = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setActive(false);
    setMsg({ text: 'Se han eliminado las credenciales. Volviendo al Almacenamiento Local (Local Storage).', type: 'info' });
    onConfigChanged();
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="supabase-config-panel" className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl max-w-3xl mx-auto my-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
          <Database className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-sans tracking-tight">Conexión a base de datos (Supabase)</h2>
          <p className="text-xs text-slate-400">Vincula tu base de datos en la nube o sigue jugando en local</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm leading-relaxed">
        <div className="flex gap-2.5 items-start">
          <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-medium text-slate-200">¿Cómo funciona?</span>
            <p className="text-slate-400 text-xs text-justify">
              Por defecto, la app funciona en <strong className="text-cyan-400">Modo Local Autónomo</strong>, guardando tus equipos, goles, jugadores y tácticas en tu navegador sin necesidad de internet. Si deseas persistirlos de manera real en tu cuenta de Supabase, introduce la <strong className="text-emerald-400">URL</strong> y la <strong className="text-emerald-400">Anon Key</strong> de tu proyecto abajo.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
            SUPABASE_PROJECT_URL
          </label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition"
            placeholder="https://your-project.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Key className="w-3.5 h-3.5 text-slate-400" /> SUPABASE_ANON_KEY (Pública)
          </label>
          <input
            type="password"
            className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
          />
        </div>

        {msg.text && (
          <div className={`p-3 rounded-xl border text-xs ${
            msg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            'bg-slate-950 border-slate-800 text-indigo-400'
          }`}>
            {msg.text}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Estado actual:</span>
            {active ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Sincronizado con Supabase
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                Modo Local (Sin servidores)
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {active && (
              <button
                type="button"
                onClick={handleClear}
                className="bg-red-950/40 hover:bg-red-900/30 border border-red-900/40 text-red-400 font-medium text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Desconectar
              </button>
            )}
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-600/10 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Guardar Configuración
            </button>
          </div>
        </div>
      </form>

      {/* SQL Setup Helper Drawer */}
      <div className="mt-8 border-t border-slate-800 pt-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" /> Script de Inicialización de Tablas SQL
          </span>
          <button
            onClick={copySQL}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition bg-slate-950 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar SQL</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Si decides enlazar tu propio Supabase, ve a tu panel de Supabase &gt; SQL Editor, pega el siguiente script y ejecútalo para estructurar tu base de datos automáticamente.
        </p>
        <pre className="text-[10px] p-4 bg-slate-950 border border-slate-800 text-slate-300 font-mono rounded-xl overflow-x-auto max-h-48 scrollbar-thin scrollbar-thumb-slate-800">
          {SUPABASE_SQL_SCHEMA}
        </pre>
      </div>
    </div>
  );
}
