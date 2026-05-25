/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Team, Player, Match, Tactic, SupabaseConfig, PlayerStats, CustomStatDefinition, Training, JoinRequest } from './types';

// Helper for generating dynamic UUIDs
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 1. Detect Config from Environment OR LocalStorage Override
const anyMeta = import.meta as any;
const ENV_SUPABASE_URL = (anyMeta.env?.VITE_SUPABASE_URL as string) || '';
const ENV_SUPABASE_KEY = (anyMeta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

export function getSupabaseConfig(): SupabaseConfig {
  const localUrl = localStorage.getItem('team_tactics_sb_url') || '';
  const localKey = localStorage.getItem('team_tactics_sb_key') || '';
  return {
    url: localUrl || ENV_SUPABASE_URL,
    anonKey: localKey || ENV_SUPABASE_KEY,
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem('team_tactics_sb_url', config.url.trim());
  localStorage.setItem('team_tactics_sb_key', config.anonKey.trim());
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem('team_tactics_sb_url');
  localStorage.removeItem('team_tactics_sb_key');
}

export function isSupabaseActive(): boolean {
  const config = getSupabaseConfig();
  return !!(config.url && config.anonKey);
}

// Instantiate Supabase Client lazily to avoid crashing
let supabaseInstance: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseActive()) {
    supabaseInstance = null;
    return null;
  }
  if (!supabaseInstance) {
    const config = getSupabaseConfig();
    try {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

// 2. Local Storage Fallback Data Providers
const LOCAL_STORAGE_KEYS = {
  TEAMS: 'tt_local_teams',
  PLAYERS: 'tt_local_players',
  MATCHES: 'tt_local_matches',
  TACTICS: 'tt_local_tactics',
  TRAININGS: 'tt_local_trainings',
  REQUESTS: 'tt_local_requests',
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
  custom_stats_config jsonb default '[]'::jsonb
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

// Helper: load from localStorage
function getLocalItem<T>(key: string, defaultValue: T): T {
  const item = localStorage.getItem(key);
  if (!item) return defaultValue;
  try {
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

// Helper: save to localStorage
function setLocalItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Seed INITIAL DEMO DATA for a rich immediate experience if empty!
export function checkAndSeedLocalData(userId: string) {
  const teams = getLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, []);
  if (teams.length === 0) {
    const demoTeamId = 'demo-team-id';
    
    // Create Football Demo Team
    const demoTeam: Team = {
      id: demoTeamId,
      userId: userId,
      name: 'Galácticos FC',
      sport: 'football',
      primaryColor: '#3b82f6', // blue
      secondaryColor: '#f59e0b', // amber
      createdAt: new Date().toISOString(),
      customStatsConfig: [
        { id: 'saves', name: 'Paradas de Portero', category: 'performance', defaultValue: 0 },
        { id: 'fouls', name: 'Faltas Cometidas', category: 'discipline', defaultValue: 0 },
        { id: 'mvps', name: 'Premios MVP', category: 'performance', defaultValue: 0 }
      ]
    };
    
    // Create Waterpolo Demo Team
    const demoTeamWpId = 'demo-team-wp-id';
    const demoTeamWp: Team = {
      id: demoTeamWpId,
      userId: userId,
      name: 'Tiburones WP',
      sport: 'waterpolo',
      primaryColor: '#06b6d4', // cyan
      secondaryColor: '#ec4899', // pink
      createdAt: new Date().toISOString(),
      customStatsConfig: [
        { id: 'exclusions', name: 'Exclusiones (20s)', category: 'discipline', defaultValue: 0 },
        { id: 'saves_wp', name: 'Paradas del Portero', category: 'performance', defaultValue: 0 }
      ]
    };

    const demoPlayers: Player[] = [
      // Football Players
      {
        id: 'p1',
        teamId: demoTeamId,
        name: 'Carlos Puyol (Capitán)',
        number: 5,
        position: 'Defensa',
        active: true,
        stats: { goals: 2, assists: 1, yellowCards: 3, redCards: 0, custom: { saves: 0, fouls: 8, mvps: 1 } },
        notes: 'Líder de la defensa. Excelente al corte y juego aéreo.'
      },
      {
        id: 'p2',
        teamId: demoTeamId,
        name: 'Lionel Messi',
        number: 10,
        position: 'Delantero',
        active: true,
        stats: { goals: 24, assists: 12, yellowCards: 1, redCards: 0, custom: { saves: 0, fouls: 2, mvps: 6 } },
        notes: 'Habilidad extrema. Lanzador de faltas principal.'
      },
      {
        id: 'p3',
        teamId: demoTeamId,
        name: 'Iker Casillas',
        number: 1,
        position: 'Portero',
        active: true,
        stats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, custom: { saves: 42, fouls: 0, mvps: 2 } },
        notes: 'Reflejos de gato. Muy seguro bajo palos.'
      },
      // Waterpolo Players
      {
        id: 'p4',
        teamId: demoTeamWpId,
        name: 'Felipe Perrone',
        number: 10,
        position: 'Atacante',
        active: true,
        stats: { goals: 11, assists: 8, yellowCards: 1, redCards: 0, custom: { exclusions: 2, saves_wp: 0 } },
        notes: 'Director de juego y goleador consagrado.'
      },
      {
        id: 'p5',
        teamId: demoTeamWpId,
        name: 'Dani López Pinedo',
        number: 1,
        position: 'Portero',
        active: true,
        stats: { goals: 0, assists: 2, yellowCards: 0, redCards: 0, custom: { exclusions: 0, saves_wp: 36 } },
        notes: 'Muro imbatible en la portería.'
      }
    ];

    const demoMatches: Match[] = [
      {
        id: 'm1',
        teamId: demoTeamId,
        opponent: 'Titanes del Norte',
        date: '2026-06-02',
        time: '18:00',
        location: 'Estadio Metropolitano',
        status: 'future',
        notes: 'Partido clave para el liderato de liga. Llevar equipación azul.'
      },
      {
        id: 'm2',
        teamId: demoTeamId,
        opponent: 'Depor Real',
        date: '2026-05-18',
        time: '20:30',
        location: 'Campo de Entrenamiento Central',
        status: 'completed',
        goalsFor: 4,
        goalsAgainst: 2,
        notes: 'Gran remontada en la segunda mitad. Goles de Lionel (3) y Puyol (1).'
      },
      // Waterpolo Matches
      {
        id: 'm3',
        teamId: demoTeamWpId,
        opponent: 'CN Sabadell',
        date: '2026-06-10',
        time: '12:00',
        location: 'Piscina Municipal Pere Serrat',
        status: 'future',
        notes: 'Semifinales de Copa. Máxima concentración en defensa.'
      },
      {
        id: 'm4',
        teamId: demoTeamWpId,
        opponent: 'CN Barceloneta',
        date: '2026-05-12',
        time: '19:00',
        location: 'Club Natació Barcelona',
        status: 'completed',
        goalsFor: 9,
        goalsAgainst: 8,
        notes: 'Final de liga épica decidida en el último segundo por Perrone.'
      }
    ];

    const demoTactics: Tactic[] = [
      {
        id: 't1',
        teamId: demoTeamId,
        name: 'Presión Alta 4-3-3',
        description: 'Táctica ofensiva para forzar el error en salida de balón del rival.',
        sport: 'football',
        chips: [
          { id: 'c1', label: 'GK', number: 1, x: 50, y: 88, color: '#10b981', type: 'player' },
          { id: 'c2', label: 'DEF_I', number: 5, x: 30, y: 68, color: '#3b82f6', type: 'player' },
          { id: 'c3', label: 'DEF_D', number: 4, x: 70, y: 68, color: '#3b82f6', type: 'player' },
          { id: 'c4', label: 'MC', number: 8, x: 50, y: 48, color: '#3b82f6', type: 'player' },
          { id: 'c5', label: 'EXT_I', number: 11, x: 22, y: 25, color: '#3b82f6', type: 'player' },
          { id: 'c6', label: 'EXT_D', number: 7, x: 78, y: 25, color: '#3b82f6', type: 'player' },
          { id: 'c7', label: 'DEL', number: 10, x: 50, y: 20, color: '#3b82f6', type: 'player' },
          { id: 'c_ball', label: 'Balón', x: 50, y: 35, color: '#ffffff', type: 'ball' }
        ],
        lines: [
          { id: 'l1', points: [{ x: 50, y: 48 }, { x: 50, y: 35 }], color: '#f59e0b', width: 3, style: 'arrow' },
          { id: 'l2', points: [{ x: 22, y: 25 }, { x: 42, y: 21 }], color: '#10b981', width: 2, style: 'dashed' }
        ],
        createdAt: new Date().toISOString(),
        type: 'tactic'
      },
      {
        id: 't2',
        teamId: demoTeamWpId,
        name: 'Ataque en Superioridad 6 contra 5',
        description: 'Distribución en arco para circulación rápida y disparo del extremo izquierdo.',
        sport: 'waterpolo',
        chips: [
          { id: 'c_wp1', label: 'GK', number: 1, x: 50, y: 92, color: '#10b981', type: 'player' },
          { id: 'c_wp2', label: 'Punta', number: 10, x: 50, y: 40, color: '#06b6d4', type: 'player' },
          { id: 'c_wp3', label: 'Atac1', number: 4, x: 25, y: 55, color: '#06b6d4', type: 'player' },
          { id: 'c_wp4', label: 'Atac2', number: 7, x: 75, y: 55, color: '#06b6d4', type: 'player' },
          { id: 'c_wp5', label: 'L_Izq', number: 2, x: 15, y: 70, color: '#06b6d4', type: 'player' },
          { id: 'c_wp6', label: 'L_Der', number: 3, x: 85, y: 70, color: '#06b6d4', type: 'player' },
          { id: 'c_ball_wp', label: 'Balón', x: 75, y: 55, color: '#f59e0b', type: 'ball' }
        ],
        lines: [
          { id: 'l_wp1', points: [{ x: 75, y: 55 }, { x: 50, y: 40 }], color: '#ec4899', width: 3, style: 'arrow' }
        ],
        createdAt: new Date().toISOString(),
        type: 'tactic'
      }
    ];

    setLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, [demoTeam, demoTeamWp]);
    setLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, demoPlayers);
    setLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, demoMatches);
    setLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, demoTactics);
  }
}

// 3. COMPLETE DB INTERFACE (UNIFYING LOCAL AND SUPABASE)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const DB = {
  // Authentication Mocking + Real
  auth: {
    async getUser() {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.auth.getUser();
          if (data.user) {
            return { id: data.user.id, email: data.user.email };
          }
        }
      }
      // Local Auth
      const user = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
      if (user) {
        try {
          return JSON.parse(user) as { id: string; email: string };
        } catch {
          return null;
        }
      }
      return null;
    },

    async signUp(email: string, pass: string) {
      await delay(800);
      // If client-side URL is filled, register via Supabase
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.auth.signUp({ email, password: pass });
          if (error) throw new Error(error.message);
          return { id: data.user?.id || 'sb-user', email: data.user?.email || email };
        }
      }
      // Local Auth Register
      const mockId = 'local-user-' + generateUUID().substring(0, 8);
      const session = { id: mockId, email };
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(session));
      // Seed initial teams/whiteboards for this local user!
      checkAndSeedLocalData(mockId);
      return session;
    },

    async signIn(email: string, pass: string) {
      await delay(800);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
          if (error) throw new Error(error.message);
          return { id: data.user?.id || 'sb-user', email: data.user?.email || email };
        }
      }
      // Local Auth Login (any password works for simple browser-storage mode)
      const mockId = 'local-user-' + email.split('@')[0];
      const session = { id: mockId, email };
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(session));
      checkAndSeedLocalData(mockId);
      return session;
    },

    async signOut() {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          await client.auth.signOut();
        }
      }
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
    },
  },

  // Teams Management
  teams: {
    async list(userId: string): Promise<Team[]> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('teams')
            .select('*')
            .eq('user_id', userId);
          if (error) {
            console.error('Supabase teams get failed:', error);
          } else if (data) {
            return data.map((t: any) => ({
              id: t.id,
              userId: t.user_id,
              name: t.name,
              sport: t.sport,
              primaryColor: t.primary_color,
              secondaryColor: t.secondary_color,
              createdAt: t.created_at,
              customStatsConfig: t.custom_stats_config,
            })) as Team[];
          }
        }
      }
      // Local Storage
      const allTeams = getLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, []);
      return allTeams.filter((t) => t.userId === userId);
    },

    async save(team: Team): Promise<Team> {
      await delay(400);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const dto = {
            id: team.id,
            user_id: team.userId,
            name: team.name,
            sport: team.sport,
            primary_color: team.primaryColor,
            secondary_color: team.secondaryColor,
            custom_stats_config: team.customStatsConfig || [],
          };
          const { error } = await client.from('teams').upsert(dto);
          if (error) throw new Error(error.message);
          return team;
        }
      }
      // Local Storage
      const allTeams = getLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, []);
      const index = allTeams.findIndex((t) => t.id === team.id);
      if (index >= 0) {
        allTeams[index] = team;
      } else {
        allTeams.push(team);
      }
      setLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, allTeams);
      return team;
    },

    async delete(teamId: string): Promise<void> {
      await delay(400);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client.from('teams').delete().eq('id', teamId);
          if (error) throw new Error(error.message);
          return;
        }
      }
      // Local Storage
      let allTeams = getLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, []);
      allTeams = allTeams.filter((t) => t.id !== teamId);
      setLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, allTeams);

      // Cascading deletes locally
      let allPlayers = getLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, []);
      setLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, allPlayers.filter((p) => p.teamId !== teamId));

      let allMatches = getLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, []);
      setLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, allMatches.filter((m) => m.teamId !== teamId));

      let allTactics = getLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, []);
      setLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, allTactics.filter((t) => t.teamId !== teamId));
    },
  },

  // Players Management (scalable metrics)
  players: {
    async list(teamId: string): Promise<Player[]> {
      await delay(200);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('players')
            .select('*')
            .eq('team_id', teamId);
          if (error) {
            console.error('Supabase players get failed:', error);
          } else if (data) {
            return data.map((p: any) => ({
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
          }
        }
      }
      // Local Storage
      const allPlayers = getLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, []);
      return allPlayers.filter((p) => p.teamId === teamId);
    },

    async save(player: Player): Promise<Player> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
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
        }
      }
      // Local Storage
      const allPlayers = getLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, []);
      const index = allPlayers.findIndex((p) => p.id === player.id);
      if (index >= 0) {
        allPlayers[index] = player;
      } else {
        allPlayers.push(player);
      }
      setLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, allPlayers);
      return player;
    },

    async delete(playerId: string): Promise<void> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client.from('players').delete().eq('id', playerId);
          if (error) throw new Error(error.message);
          return;
        }
      }
      // Local Storage
      let allPlayers = getLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, []);
      allPlayers = allPlayers.filter((p) => p.id !== playerId);
      setLocalItem<Player[]>(LOCAL_STORAGE_KEYS.PLAYERS, allPlayers);
    },
  },

  // Matches Management
  matches: {
    async list(teamId: string): Promise<Match[]> {
      await delay(200);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('matches')
            .select('*')
            .eq('team_id', teamId);
          if (error) {
            console.error('Supabase matches get failed:', error);
          } else if (data) {
            return data.map((m: any) => ({
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
          }
        }
      }
      // Local Storage
      const allMatches = getLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, []);
      return allMatches.filter((m) => m.teamId === teamId);
    },

    async save(match: Match): Promise<Match> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
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
        }
      }
      // Local Storage
      const allMatches = getLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, []);
      const index = allMatches.findIndex((m) => m.id === match.id);
      if (index >= 0) {
        allMatches[index] = match;
      } else {
        allMatches.push(match);
      }
      setLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, allMatches);
      return match;
    },

    async delete(matchId: string): Promise<void> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client.from('matches').delete().eq('id', matchId);
          if (error) throw new Error(error.message);
          return;
        }
      }
      // Local Storage
      let allMatches = getLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, []);
      allMatches = allMatches.filter((m) => m.id !== matchId);
      setLocalItem<Match[]>(LOCAL_STORAGE_KEYS.MATCHES, allMatches);
    },
  },

  // Tactics Management
  tactics: {
    async list(teamId: string): Promise<Tactic[]> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('tactics')
            .select('*')
            .eq('team_id', teamId);
          if (error) {
            console.error('Supabase tactics get failed:', error);
          } else if (data) {
            return data.map((t: any) => ({
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
          }
        }
      }
      // Local Storage
      const allTactics = getLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, []);
      return allTactics.filter((t) => t.teamId === teamId);
    },

    async save(tactic: Tactic): Promise<Tactic> {
      await delay(400);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
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
        }
      }
      // Local Storage
      const allTactics = getLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, []);
      const index = allTactics.findIndex((t) => t.id === tactic.id);
      if (index >= 0) {
        allTactics[index] = tactic;
      } else {
        allTactics.push(tactic);
      }
      setLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, allTactics);
      return tactic;
    },

    async delete(tacticId: string): Promise<void> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { error } = await client.from('tactics').delete().eq('id', tacticId);
          if (error) throw new Error(error.message);
          return;
        }
      }
      // Local Storage
      let allTactics = getLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, []);
      allTactics = allTactics.filter((t) => t.id !== tacticId);
      setLocalItem<Tactic[]>(LOCAL_STORAGE_KEYS.TACTICS, allTactics);
    },
  },

  trainings: {
    async list(teamId: string): Promise<Training[]> {
      await delay(200);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('trainings').select('*').eq('team_id', teamId);
          if (data) return data.map(t => ({
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
        }
      }
      return getLocalItem<Training[]>(LOCAL_STORAGE_KEYS.TRAININGS, []).filter(t => t.teamId === teamId);
    },
    async save(training: Training): Promise<Training> {
      await delay(300);
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
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
          await client.from('trainings').upsert(dto);
        }
      }
      const all = getLocalItem<Training[]>(LOCAL_STORAGE_KEYS.TRAININGS, []);
      const idx = all.findIndex(t => t.id === training.id);
      if (idx >= 0) all[idx] = training; else all.push(training);
      setLocalItem(LOCAL_STORAGE_KEYS.TRAININGS, all);
      return training;
    },
    async vote(trainingId: string, userId: string, type: 'up' | 'down') {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('trainings').select('votes').eq('id', trainingId).single();
          const votes = (data?.votes || {}) as Record<string, 'up' | 'down'>;
          votes[userId] = type;
          await client.from('trainings').update({ votes }).eq('id', trainingId);
        }
      }
      const all = getLocalItem<Training[]>(LOCAL_STORAGE_KEYS.TRAININGS, []);
      const t = all.find(x => x.id === trainingId);
      if (t) {
        if (!t.votes) t.votes = {};
        t.votes[userId] = type;
        setLocalItem(LOCAL_STORAGE_KEYS.TRAININGS, all);
      }
    }
  },

  requests: {
    async listByTeam(teamId: string): Promise<JoinRequest[]> {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('join_requests').select('*').eq('team_id', teamId);
          if (data) return data.map(r => ({
            id: r.id,
            userId: r.user_id,
            userEmail: r.user_email,
            teamId: r.team_id,
            playerName: r.player_name,
            status: r.status,
            createdAt: r.created_at
          })) as JoinRequest[];
        }
      }
      return getLocalItem<JoinRequest[]>(LOCAL_STORAGE_KEYS.REQUESTS, []).filter(r => r.teamId === teamId);
    },
    async listByUser(userId: string): Promise<JoinRequest[]> {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('join_requests').select('*').eq('user_id', userId);
          if (data) return data.map(r => ({
            id: r.id,
            userId: r.user_id,
            userEmail: r.user_email,
            teamId: r.team_id,
            playerName: r.player_name,
            status: r.status,
            createdAt: r.created_at
          })) as JoinRequest[];
        }
      }
      return getLocalItem<JoinRequest[]>(LOCAL_STORAGE_KEYS.REQUESTS, []).filter(r => r.userId === userId);
    },
    async create(req: JoinRequest) {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          await client.from('join_requests').insert({
            id: req.id,
            user_id: req.userId,
            user_email: req.userEmail,
            team_id: req.teamId,
            player_name: req.playerName,
            status: req.status,
            created_at: req.createdAt
          });
        }
      }
      const all = getLocalItem<JoinRequest[]>(LOCAL_STORAGE_KEYS.REQUESTS, []);
      all.push(req);
      setLocalItem(LOCAL_STORAGE_KEYS.REQUESTS, all);
    },
    async respond(id: string, status: 'accepted' | 'declined') {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          await client.from('join_requests').update({ status }).eq('id', id);
        }
      }
      const all = getLocalItem<JoinRequest[]>(LOCAL_STORAGE_KEYS.REQUESTS, []);
      const r = all.find(x => x.id === id);
      if (r) {
        r.status = status;
        setLocalItem(LOCAL_STORAGE_KEYS.REQUESTS, all);
      }
    }
  },

  global: {
    async listAllTeams(): Promise<Team[]> {
      if (isSupabaseActive()) {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('teams').select('*');
          if (data) return data.map(t => ({
            id: t.id,
            userId: t.user_id,
            name: t.name,
            sport: t.sport,
            primaryColor: t.primary_color,
            secondaryColor: t.secondary_color,
            createdAt: t.created_at,
            customStatsConfig: t.custom_stats_config
          })) as Team[];
        }
      }
      return getLocalItem<Team[]>(LOCAL_STORAGE_KEYS.TEAMS, []);
    }
  }
};
