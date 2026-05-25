/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, Copy, Check, Terminal, ExternalLink, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../db';

export default function SupabaseOnboarding() {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 flex flex-col justify-center items-center px-4 py-8 relative overflow-y-auto font-sans">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl z-10 space-y-8 my-auto">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center bg-indigo-600/10 text-indigo-400 w-16 h-16 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5 mb-4">
            <Database className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Conexión con Supabase Requerida
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
            Has configurado la aplicación en modo exclusivo en la nube sin datos locales de demo ni modo autónomo. Sigue estos sencillos pasos para conectar tu base de datos en tiempo real.
          </p>
        </div>

        {/* Steps Card */}
        <div className="bg-[#161b26] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs rounded-full w-6 h-6 shrink-0">
                  1
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Crear Proyecto</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Regístrate gratis o inicia sesión en{' '}
                <a 
                  href="https://supabase.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 font-semibold transition"
                >
                  supabase.com <ExternalLink className="w-3 h-3" />
                </a>{' '}
                y crea un nuevo proyecto de base de datos.
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs rounded-full w-6 h-6 shrink-0">
                  2
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Añadir Claves</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                En este editor de AI Studio, haz clic en la pestaña <strong>Settings</strong> (icono de engranaje) arriba a la derecha y añade las siguientes claves:
              </p>
              <div className="bg-[#0b0e14] border border-slate-800/80 rounded-lg p-2 font-mono text-[10px] space-y-1 text-slate-400">
                <div>VITE_SUPABASE_URL</div>
                <div>VITE_SUPABASE_ANON_KEY</div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-xs rounded-full w-6 h-6 shrink-0">
                  3
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Ejecutar SQL</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Abre el <strong>SQL Editor</strong> en tu panel de Supabase y ejecuta el esquema de base de datos necesario para crear las tablas automáticamente.
              </p>
            </div>

          </div>

          {/* Collapsible SQL Schema Section */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b0e14] border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Terminal className="text-indigo-400 w-5 h-5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">Esquema SQL de Inicialización</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Necesario para crear las tablas teams, players, matches, tactics...</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowSql(!showSql)}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
                >
                  {showSql ? 'Ocultar Código' : 'Ver Esquema'}
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600/50 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg border border-indigo-500/30 transition shadow-lg shadow-indigo-950/20"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar SQL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {showSql && (
              <div className="relative animate-fade-in">
                <pre className="bg-[#0b0e14] border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-56 leading-relaxed">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Guardarás datos en tu base de datos Supabase en tiempo real.</span>
            </div>
            <button
              onClick={handleReload}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-500/20 group cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span>Verificar Conexión y Recargar</span>
            </button>
          </div>

        </div>

        {/* Informational Hint */}
        <div className="flex items-start gap-3 bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 text-xs text-slate-400 leading-relaxed max-w-lg mx-auto">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <p>
            <strong>Nota de seguridad:</strong> AI Studio gestiona las claves de forma segura para ti. Una vez añadidas en la pestaña Settings, tus credenciales nunca se exponen al navegador de los usuarios públicos y se conectan perfectamente.
          </p>
        </div>
      </div>
    </div>
  );
}
