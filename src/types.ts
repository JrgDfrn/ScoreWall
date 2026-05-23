/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SportType = 'football' | 'waterpolo';

export interface CustomStatDefinition {
  id: string;
  name: string;
  category: 'performance' | 'discipline' | 'physical';
  defaultValue: number;
}

export interface Team {
  id: string;
  userId: string;
  name: string;
  sport: SportType;
  primaryColor: string;
  secondaryColor: string;
  createdAt: string;
  customStatsConfig?: CustomStatDefinition[]; // Dynamically added stat metrics
}

export interface PlayerStats {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  // Scalable dynamically configured custom metrics (e.g. saves, fouls, blocks, minutes)
  custom: Record<string, number>;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  number: number;
  position: string;
  avatarUrl?: string;
  active: boolean;
  stats: PlayerStats;
  notes?: string;
}

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  status: 'future' | 'completed';
  goalsFor?: number;
  goalsAgainst?: number;
  scorers?: string[]; // IDs or names of players who scored
  notes?: string;
}

export interface ChipState {
  id: string;
  label: string;
  number?: number;
  x: number; // Percentages (0 to 100) on the field for responsive scaling
  y: number;
  color: string;
  type: 'player' | 'ball' | 'cone' | 'referee' | 'opponent';
}

export interface LineDrawState {
  id: string;
  points: { x: number; y: number }[]; // coordinates as percentage percentages (0-100)
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'arrow';
}

export interface Tactic {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  sport: SportType;
  chips: ChipState[];
  lines: LineDrawState[];
  createdAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
