/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Team, Player, Match, Tactic, SupabaseConfig, PlayerStats, CustomStatDefinition, Training, JoinRequest } from './types';

// Helper for generating dynamic UUIDs
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generates a deterministic, unique 6-digit code from any team ID
export function getDeterministicCode(teamId: string): string {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    const char = teamId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const codeValue = (Math.abs(hash) % 900000) + 100000;
  return codeValue.toString();
}

// 1. Detect Config from Environment
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: ENV_SUPABASE_URL,
    anonKey: ENV_SUPABASE_KEY,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  // Deprecated, no-op since configuration is fully handled via Environment Variables/Settings.
}

export function clearSupabaseConfig(): void {
  // Deprecated, no-op since configuration is fully handled via Environment Variables/Settings.
}

export function isSupabaseActive(): boolean {
  const config = getSupabaseConfig();
  return !!(config.url && config.anonKey);
}

// Instantiate Supabase Client lazily or fail with actionable guidance
let supabaseInstance: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error(
      'La base de datos de Supabase no está configurada. Por favor, añade las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en la pestaña Settings de la barra superior del editor.'
    );
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    } catch (e: any) {
      console.error('Failed to initialize Supabase client:', e);
      throw new Error('Error al inicializar el cliente de Supabase: ' + e.message);
    }
  }
  return supabaseInstance;
}

// 2. Persistent session keys for user authentication
const LOCAL_STORAGE_KEYS = {
  USER: 'tt_local_auth_user',
};

// SQL helper string to display in UI for quick Supabase setup!
export const SUPABASE_SQL_SCHEMA = `-- Copia y pega esto en el SQL Editor de tu proyecto Supabase para crear las tablas necesarias:

-- 1. Tabla de Equipos (teams)
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  name text not null,
  sport text not null check (sport in ('football', 'waterpolo')),
  primary_color text not null,
  secondary_color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  custom_stats_config jsonb default '[]'::jsonb,
  access_code text default '123456'
);

-- 2. Tabla de Jugadores (players)
create table if not exists public.players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id text, -- ID de usuario de Supabase Auth vinculado
  name text not null,
  number integer not null,
  position text not null,
  avatar_url text,
  active boolean default true not null,
  stats jsonb default '{"goals": 0, "assists": 0, "yellowCards": 0, "redCards": 0, "custom": {}}'::jsonb not null,
  notes text
);

-- 3. Tabla de Partidos (matches)
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  opponent text not null,
  date text not null,
  time text not null,
  location text not null,
  status text not null check (status in ('future', 'completed')),
  goals_for integer,
  goals_against integer,
  scorers text[],
  callup_ids text[],
  notes text
);

-- 4. Tabla de Pizarras/Tácticas (tactics)
create table if not exists public.tactics (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  description text,
  sport text not null,
  chips jsonb default '[]'::jsonb not null,
  lines jsonb default '[]'::jsonb not null,
  type text not null check (type in ('tactic', 'training')),
  rating integer,
  categories text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabla de Entrenamientos (trainings)
create table if not exists public.trainings (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  date text not null,
  title text not null,
  description text,
  intensity text not null,
  duration integer not null,
  type text not null,
  focus_items text[],
  notes text,
  status text not null,
  votes jsonb default '{}'::jsonb
);

-- 6. Tabla de Solicitudes de Unión (join_requests)
create table if not exists public.join_requests (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  user_email text not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  player_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Desactivar RLS temporalmente o crear políticas permisivas para un correcto funcionamiento
alter table public.teams disable row level security;
alter table public.players disable row level security;
alter table public.matches disable row level security;
alter table public.tactics disable row level security;
alter table public.trainings disable row level security;
alter table public.join_requests disable row level security;
`;

// 3. COMPLETE DB INTERFACE (SUPABASE DRIVEN ONLY)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const DB = {
  // Authentication via Real Supabase Client
  auth: {
    async getUser() {
      try {
        const client = getSupabaseClient();
        const { data } = await client.auth.getUser();
        if (data.user) {
          return { id: data.user.id, email: data.user.email || '' };
        }
      } catch (e) {
        console.warn('Supabase not connected yet or failed:', e);
      }
      return null;
    },

    async signUp(email: string, pass: string) {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({ email, password: pass });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('No se pudo completar el registro. Inténtalo de nuevo.');
      return { id: data.user.id, email: data.user.email || email };
    },

    async signIn(email: string, pass: string) {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Credenciales inválidas o usuario no configurado.');
      return { id: data.user.id, email: data.user.email || email };
    },

    async signOut() {
      try {
        const client = getSupabaseClient();
        await client.auth.signOut();
      } catch (e) {
        console.warn('Sign out failed:', e);
      }
    },
  },

  // Teams Management
  teams: {
    async list(userId: string): Promise<Team[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('teams')
        .select('*')
        .eq('user_id', userId);
      if (error) {
        console.error('Supabase teams get failed:', error);
        throw error;
      }
      return (data || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        sport: t.sport,
        primaryColor: t.primary_color,
        secondaryColor: t.secondary_color,
        createdAt: t.created_at,
        customStatsConfig: t.custom_stats_config,
        accessCode: t.access_code || getDeterministicCode(t.id),
      })) as Team[];
    },

    async save(team: Team): Promise<Team> {
      const client = getSupabaseClient();
      const dto = {
        id: team.id,
        user_id: team.userId,
        name: team.name,
        sport: team.sport,
        primary_color: team.primaryColor,
        secondary_color: team.secondaryColor,
        custom_stats_config: team.customStatsConfig || [],
        access_code: team.accessCode || getDeterministicCode(team.id),
      };
      const { error } = await client.from('teams').upsert(dto);
      if (error) throw new Error(error.message);
      return { ...team, accessCode: dto.access_code };
    },

    async delete(teamId: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client.from('teams').delete().eq('id', teamId);
      if (error) throw new Error(error.message);
    },
  },

  // Players Management (scalable metrics)
  players: {
    async list(teamId: string): Promise<Player[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('players')
        .select('*')
        .eq('team_id', teamId);
      if (error) {
        console.error('Supabase players get failed:', error);
        throw error;
      }
      return (data || []).map((p: any) => ({
        id: p.id,
        teamId: p.team_id,
        userId: p.user_id,
        name: p.name,
        number: p.number,
        position: p.position,
        avatarUrl: p.avatar_url,
        active: p.active,
        stats: p.stats,
        notes: p.notes,
      })) as Player[];
    },

    async save(player: Player): Promise<Player> {
      const client = getSupabaseClient();
      const dto = {
        id: player.id,
        team_id: player.teamId,
        user_id: player.userId || null,
        name: player.name,
        number: player.number,
        position: player.position,
        avatar_url: player.avatarUrl || null,
        active: player.active,
        stats: player.stats,
        notes: player.notes || null,
      };
      const { error } = await client.from('players').upsert(dto);
      if (error) throw new Error(error.message);
      return player;
    },

    async delete(playerId: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client.from('players').delete().eq('id', playerId);
      if (error) throw new Error(error.message);
    },
  },

  // Matches Management
  matches: {
    async list(teamId: string): Promise<Match[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('team_id', teamId);
      if (error) {
        console.error('Supabase matches get failed:', error);
        throw error;
      }
      return (data || []).map((m: any) => ({
        id: m.id,
        teamId: m.team_id,
        opponent: m.opponent,
        date: m.date,
        time: m.time,
        location: m.location,
        status: m.status,
        goalsFor: m.goals_for,
        goalsAgainst: m.goals_against,
        scorers: m.scorers || [],
        callupIds: m.callup_ids || [],
        notes: m.notes,
      })) as Match[];
    },

    async save(match: Match): Promise<Match> {
      const client = getSupabaseClient();
      const dto = {
        id: match.id,
        team_id: match.teamId,
        opponent: match.opponent,
        date: match.date,
        time: match.time,
        location: match.location,
        status: match.status,
        goals_for: match.goalsFor !== undefined ? match.goalsFor : null,
        goals_against: match.goalsAgainst !== undefined ? match.goalsAgainst : null,
        scorers: match.scorers || null,
        callup_ids: match.callupIds || null,
        notes: match.notes || null,
      };
      const { error } = await client.from('matches').upsert(dto);
      if (error) throw new Error(error.message);
      return match;
    },

    async delete(matchId: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client.from('matches').delete().eq('id', matchId);
      if (error) throw new Error(error.message);
    },
  },

  // Tactics Management
  tactics: {
    async list(teamId: string): Promise<Tactic[]> {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('tactics')
        .select('*')
        .eq('team_id', teamId);
      if (error) {
        console.error('Supabase tactics get failed:', error);
        throw error;
      }
      return (data || []).map((t: any) => ({
        id: t.id,
        teamId: t.team_id,
        name: t.name,
        description: t.description,
        sport: t.sport,
        chips: t.chips,
        lines: t.lines,
        createdAt: t.created_at,
        type: t.type || 'tactic',
        rating: t.rating,
        categories: t.categories || [],
      })) as Tactic[];
    },

    async save(tactic: Tactic): Promise<Tactic> {
      const client = getSupabaseClient();
      const dto = {
        id: tactic.id,
        team_id: tactic.teamId,
        name: tactic.name,
        description: tactic.description || null,
        sport: tactic.sport,
        chips: tactic.chips,
        lines: tactic.lines,
        type: tactic.type,
        rating: tactic.rating || null,
        categories: tactic.categories || [],
      };
      const { error } = await client.from('tactics').upsert(dto);
      if (error) throw new Error(error.message);
      return tactic;
    },

    async delete(tacticId: string): Promise<void> {
      const client = getSupabaseClient();
      const { error } = await client.from('tactics').delete().eq('id', tacticId);
      if (error) throw new Error(error.message);
    },
  },

  trainings: {
    async list(teamId: string): Promise<Training[]> {
      const client = getSupabaseClient();
      const { data, error } = await client.from('trainings').select('*').eq('team_id', teamId);
      if (error) {
        console.error('Supabase trainings get failed:', error);
        throw error;
      }
      return (data || []).map(t => ({
        id: t.id,
        teamId: t.team_id,
        date: t.date,
        title: t.title,
        description: t.description,
        intensity: t.intensity,
        duration: t.duration,
        type: t.type,
        focusItems: t.focus_items,
        notes: t.notes,
        status: t.status,
        votes: t.votes || {}
      })) as Training[];
    },
    async save(training: Training): Promise<Training> {
      const client = getSupabaseClient();
      const dto = {
        id: training.id,
        team_id: training.teamId,
        date: training.date,
        title: training.title,
        description: training.description,
        intensity: training.intensity,
        duration: training.duration,
        type: training.type,
        focus_items: training.focusItems,
        notes: training.notes,
        status: training.status,
        votes: training.votes || {},
      };
      const { error } = await client.from('trainings').upsert(dto);
      if (error) throw new Error(error.message);
      return training;
    },
    async vote(trainingId: string, userId: string, type: 'up' | 'down') {
      const client = getSupabaseClient();
      const { data, error: selectError } = await client.from('trainings').select('votes').eq('id', trainingId).single();
      if (selectError) throw selectError;
      const votes = (data?.votes || {}) as Record<string, 'up' | 'down'>;
      votes[userId] = type;
      const { error: updateError } = await client.from('trainings').update({ votes }).eq('id', trainingId);
      if (updateError) throw updateError;
    }
  },

  requests: {
    async listByTeam(teamId: string): Promise<JoinRequest[]> {
      const client = getSupabaseClient();
      const { data, error } = await client.from('join_requests').select('*').eq('team_id', teamId);
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        teamId: r.team_id,
        playerName: r.player_name,
        status: r.status,
        createdAt: r.created_at
      })) as JoinRequest[];
    },
    async listByUser(userId: string): Promise<JoinRequest[]> {
      const client = getSupabaseClient();
      const { data, error } = await client.from('join_requests').select('*').eq('user_id', userId);
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        userEmail: r.user_email,
        teamId: r.team_id,
        playerName: r.player_name,
        status: r.status,
        createdAt: r.created_at
      })) as JoinRequest[];
    },
    async create(req: JoinRequest) {
      const client = getSupabaseClient();
      const { error } = await client.from('join_requests').insert({
        id: req.id,
        user_id: req.userId,
        user_email: req.userEmail,
        team_id: req.teamId,
        player_name: req.playerName,
        status: req.status,
        created_at: req.createdAt
      });
      if (error) throw error;
    },
    async respond(id: string, status: 'accepted' | 'declined') {
      const client = getSupabaseClient();
      const { error } = await client.from('join_requests').update({ status }).eq('id', id);
      if (error) throw error;
    },
    async delete(id: string) {
      const client = getSupabaseClient();
      const { error } = await client.from('join_requests').delete().eq('id', id);
      if (error) throw error;
    }
  },

  global: {
    async listAllTeams(): Promise<Team[]> {
      const client = getSupabaseClient();
      const { data, error } = await client.from('teams').select('*');
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        userId: t.user_id,
        name: t.name,
        sport: t.sport,
        primaryColor: t.primary_color,
        secondaryColor: t.secondary_color,
        createdAt: t.created_at,
        customStatsConfig: t.custom_stats_config,
        accessCode: t.access_code || getDeterministicCode(t.id)
      })) as Team[];
    }
  }
};
