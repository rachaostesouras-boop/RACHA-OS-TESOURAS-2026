export enum Position {
  GK = 'Goleiro',
  DEF = 'Zagueiro',
  MID = 'Meio-Campo',
  FWD = 'Atacante'
}

export interface Player {
  id: string;
  name: string;
  position: Position;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[]; // Max 6
}

export type MatchEventType = 'goal' | 'assist' | 'yellow' | 'red';

export interface MatchEvent {
  id: string;
  playerId: string;
  teamId: string;
  type: MatchEventType;
  minute?: number;
}

export interface Match {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  finished: boolean;
  events: MatchEvent[];
  isPlayoff?: boolean;
  phase?: 'group' | 'semi' | 'final';
  penaltyHome?: number;
  penaltyAway?: number;
  homeGoalkeeperId?: string;
  awayGoalkeeperId?: string;
}

export interface TournamentData {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'finished';
  teamCount: 4 | 5;
  teams: Team[];
  matches: Match[];
  createdAt: number;
  finishedAt?: number;
}

// For Annual Ranking calculation
export interface HistoricalStat {
  playerId: string;
  goals: number;
  assists: number;
}