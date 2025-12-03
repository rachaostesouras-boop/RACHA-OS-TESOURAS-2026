import { Player, TournamentData } from '../types';

export const PLAYERS_KEY = 'racha_players';
export const CURRENT_TOURNAMENT_KEY = 'racha_current_tournament';
export const HISTORY_KEY = 'racha_history';

// Safe ID generator that works in all environments (including non-secure contexts)
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is not available
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

export const getStoredPlayers = (): Player[] => {
  try {
    const data = localStorage.getItem(PLAYERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading players", e);
    return [];
  }
};

export const saveStoredPlayers = (players: Player[]): boolean => {
  try {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
    return true;
  } catch (e) {
    console.error("Error saving players", e);
    return false;
  }
};

export const getStoredTournament = (): TournamentData | null => {
  try {
    const data = localStorage.getItem(CURRENT_TOURNAMENT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error loading tournament", e);
    return null;
  }
};

export const saveStoredTournament = (tournament: TournamentData | null): boolean => {
  try {
    if (tournament) {
      localStorage.setItem(CURRENT_TOURNAMENT_KEY, JSON.stringify(tournament));
    } else {
      localStorage.removeItem(CURRENT_TOURNAMENT_KEY);
    }
    return true;
  } catch (e) {
    console.error("Error saving tournament", e);
    return false;
  }
};

export const getHistoricalTournaments = (): TournamentData[] => {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        const parsed = data ? JSON.parse(data) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Error loading history", e);
        return [];
    }
};

export const deleteHistoricalTournament = (id: string): boolean => {
    try {
        const history = getHistoricalTournaments();
        const newHistory = history.filter(t => t.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        return true;
    } catch (e) {
        console.error("Error deleting history", e);
        return false;
    }
};

export const updateHistoricalTournament = (updatedTournament: TournamentData): boolean => {
    try {
        const history = getHistoricalTournaments();
        const index = history.findIndex(t => t.id === updatedTournament.id);
        if (index !== -1) {
            history[index] = updatedTournament;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            return true;
        }
        return false;
    } catch (e) {
        console.error("Error updating history", e);
        return false;
    }
};

export const archiveTournament = (tournament: TournamentData): boolean => {
    try {
        // Load existing history safely
        let history = getHistoricalTournaments();
        if (!Array.isArray(history)) {
            history = [];
        }
        
        // Add the finished tournament
        history.push({ ...tournament, status: 'finished', finishedAt: Date.now() });
        
        // Save back to storage
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        
        // Clear current tournament from storage
        localStorage.removeItem(CURRENT_TOURNAMENT_KEY);
        
        return true;
    } catch (e) {
        alert("Erro ao arquivar torneio. Verifique o espaço de armazenamento do seu navegador.");
        console.error("Archiving failed:", e);
        return false;
    }
}