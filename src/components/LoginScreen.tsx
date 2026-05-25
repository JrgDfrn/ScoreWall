/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, KeyRound, Mail, ArrowRight } from 'lucide-react';
import { DB } from '../db';

interface LoginScreenProps {
  onLoginSuccess: (user: { id: string; email: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor rellena todos los campos.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      if (isRegister) {
        const user = await DB.auth.signUp(email, password);
        onLoginSuccess(user);
      } else {
        const user = await DB.auth.signIn(email, password);
        onLoginSuccess(user);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error en la autenticación. Revisa tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      {/* Background Stadium Accent Lights */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />

      <div className="w-full max-w-md z-10 animate-fade-in">
        {/* App Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-indigo-600 w-12 h-12 rounded-xl shadow-lg shadow-indigo-500/20 mb-4 border border-indigo-400/20 text-white font-extrabold text-2xl">
            S
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            SportTactics <span className="text-indigo-500">Pro</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
            Gestión de equipos, alineaciones, partidos y pizarra táctica de alto rendimiento.
          </p>
        </div>

        {/* Authentication Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#161b26] border border-slate-800 rounded-2xl p-7 shadow-2xl relative"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </h2>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMsg('');
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
            >
              {isRegister ? '¿Ya tienes cuenta?' : '¿Nuevo entrenador? Regístrate'}
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> Correo Electrónico
              </label>
              <input
                type="email"
                required
                className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition outline-none"
                placeholder="entrenador@deportes.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-500" /> Contraseña (Min 6 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full bg-[#0b0e14] border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 transition outline-none"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-3 rounded-xl transition shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <span>{isRegister ? 'Crear Club' : 'Entrar al Vestuario'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
