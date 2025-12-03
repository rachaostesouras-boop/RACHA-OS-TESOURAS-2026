import React, { useState, useMemo, useEffect } from 'react';
import { Player, TournamentData, Position } from '../types';
import { Trophy, TrendingUp, History, Crown, BarChart3, Medal, Filter, Shield, Calendar } from 'lucide-react';
import { getHistoricalTournaments, HISTORY_KEY } from '../utils/storage';

interface RankingsProps {
  tournament: TournamentData;
  players: Player[];
}

export const Rankings: React.FC<RankingsProps> = ({ tournament, players }) => {
  const [view, setView] = useState<'current' | 'annual'>('annual');
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const [activePosTab, setActivePosTab] = useState<Position>(Position.GK);

  // Month Selection State
  const getCurrentMonthKey = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === HISTORY_KEY) {
            setHistoryTrigger(prev => prev + 1);
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '???';
  const getPlayerPos = (id: string) => players.find(p => p.id === id)?.position || '';

  // --- HELPERS ---
  const getMonthKey = (timestamp: number) => {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatMonth = (key: string) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // --- CALCULATION LOGIC ---

  // 1. General/Outfield Ranking (Based on Team Rosters)
  const calculateRanking = (tournamentsToProcess: TournamentData[]) => {
    const stats = new Map<string, { 
        id: string; 
        points: number; 
        matches: number; 
        wins: number; 
        draws: number; 
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
    }>();

    tournamentsToProcess.forEach(t => {
        if (!t) return;
        const teamMap = new Map<string, string[]>();
        t.teams.forEach(team => teamMap.set(team.id, team.playerIds));

        t.matches.forEach(m => {
            if (!m.finished) return;

            let homePts = 0, awayPts = 0;
            let homeW = 0, homeD = 0, homeL = 0;
            let awayW = 0, awayD = 0, awayL = 0;

            if (m.homeScore > m.awayScore) {
                homePts = 3; homeW = 1; awayL = 1;
            } else if (m.awayScore > m.homeScore) {
                awayPts = 3; awayW = 1; homeL = 1;
            } else {
                homePts = 1; awayPts = 1;
                homeD = 1; awayD = 1;
            }

            // Distribute to Home Players (Roster based)
            const homePlayers = teamMap.get(m.homeTeamId) || [];
            homePlayers.forEach(pid => {
                const s = stats.get(pid) || { id: pid, points: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
                s.points += homePts;
                s.matches += 1;
                s.wins += homeW;
                s.draws += homeD;
                s.losses += homeL;
                s.goalsFor += m.homeScore;
                s.goalsAgainst += m.awayScore;
                stats.set(pid, s);
            });

            // Distribute to Away Players (Roster based)
            const awayPlayers = teamMap.get(m.awayTeamId) || [];
            awayPlayers.forEach(pid => {
                const s = stats.get(pid) || { id: pid, points: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
                s.points += awayPts;
                s.matches += 1;
                s.wins += awayW;
                s.draws += awayD;
                s.losses += awayL;
                s.goalsFor += m.awayScore;
                s.goalsAgainst += m.homeScore;
                stats.set(pid, s);
            });
        });
    });

    return Array.from(stats.values())
        .filter(s => players.some(p => p.id === s.id))
        .map(s => ({...s, goalDiff: s.goalsFor - s.goalsAgainst}))
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            return a.matches - b.matches;
        });
  };

  // 2. Goalkeeper Specific Ranking (Based on MATCH ASSIGNMENTS)
  const calculateGKStats = (tournamentsToProcess: TournamentData[]) => {
      const stats = new Map<string, { 
        id: string; 
        points: number; 
        matches: number; 
        wins: number; 
        draws: number; 
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
      }>();

      tournamentsToProcess.forEach(t => {
          if (!t) return;
          t.matches.forEach(m => {
              if (!m.finished) return;

              let homePts = 0, awayPts = 0;
              let homeW = 0, homeD = 0, homeL = 0;
              let awayW = 0, awayD = 0, awayL = 0;

              if (m.homeScore > m.awayScore) {
                  homePts = 3; homeW = 1; awayL = 1;
              } else if (m.awayScore > m.homeScore) {
                  awayPts = 3; awayW = 1; homeL = 1;
              } else {
                  homePts = 1; awayPts = 1;
                  homeD = 1; awayD = 1;
              }

              // Update Home GK
              if (m.homeGoalkeeperId) {
                  const pid = m.homeGoalkeeperId;
                  const s = stats.get(pid) || { id: pid, points: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
                  s.points += homePts;
                  s.matches += 1;
                  s.wins += homeW;
                  s.draws += homeD;
                  s.losses += homeL;
                  s.goalsFor += m.homeScore; // Team scored
                  s.goalsAgainst += m.awayScore; // Team conceded (GK conceded)
                  stats.set(pid, s);
              }

              // Update Away GK
              if (m.awayGoalkeeperId) {
                  const pid = m.awayGoalkeeperId;
                  const s = stats.get(pid) || { id: pid, points: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
                  s.points += awayPts;
                  s.matches += 1;
                  s.wins += awayW;
                  s.draws += awayD;
                  s.losses += awayL;
                  s.goalsFor += m.awayScore; // Team scored
                  s.goalsAgainst += m.homeScore; // Team conceded (GK conceded)
                  stats.set(pid, s);
              }
          });
      });

      return Array.from(stats.values())
        .map(s => ({...s, goalDiff: s.goalsFor - s.goalsAgainst}))
        .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            // For GKs, fewer goals against is usually better, but sticking to standard Points table logic (GD)
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            return a.matches - b.matches;
        });
  };

  // --- MEMOS ---

  // 1. General Ranking (Annual or Current)
  const generalRanking = useMemo(() => {
    const list = view === 'annual' ? [...getHistoricalTournaments(), tournament] : [tournament];
    const validList = list.filter(t => t !== null) as TournamentData[];
    return calculateRanking(validList);
  }, [tournament, players, view, historyTrigger]);

  // 2. Monthly Ranking (For Position Table)
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      months.add(getCurrentMonthKey());
      const history = getHistoricalTournaments();
      history.forEach(t => months.add(getMonthKey(t.finishedAt || t.createdAt)));
      return Array.from(months).sort().reverse();
  }, [historyTrigger, tournament]);

  const monthlyRanking = useMemo(() => {
      const history = getHistoricalTournaments();
      const allTournaments = [...history, tournament].filter(t => t !== null) as TournamentData[];
      
      const filteredTournaments = allTournaments.filter(t => {
          const tDate = getMonthKey(t.finishedAt || t.createdAt);
          return tDate === selectedMonth;
      });

      // KEY CHANGE: If Active Tab is GK, use specific GK logic (match assignments)
      // If other positions, use general team logic filtered by position
      if (activePosTab === Position.GK) {
          return calculateGKStats(filteredTournaments);
      } else {
          return calculateRanking(filteredTournaments);
      }
  }, [selectedMonth, historyTrigger, tournament, players, activePosTab]);

  // Filter Monthly Ranking for the active position tab
  const positionRanking = useMemo(() => {
      // For GK, calculateGKStats already returns valid GK stats, but we double check if we want to enforce Position.GK role
      // However, a defender playing as GK should appear in GK stats.
      // So if activePosTab is GK, we don't strictly filter by 'player.position', we assume anyone who played GK is valid.
      // BUT, usually we want to see registered GKs.
      // Let's filter by registered position to keep the tables clean as per "Ranking por Posição".
      return monthlyRanking.filter(stat => getPlayerPos(stat.id) === activePosTab);
  }, [monthlyRanking, activePosTab, players]);

  // 3. Stats (Goals, Assists, Cards)
  const activeStatsRaw = useMemo(() => {
    const history = getHistoricalTournaments();
    const stats: Record<string, { goals: number, assists: number }> = {};
    
    const process = (t: TournamentData) => {
        t.matches.forEach(m => {
            m.events.forEach(evt => {
                if (!stats[evt.playerId]) stats[evt.playerId] = { goals: 0, assists: 0 };
                if (evt.type === 'goal') stats[evt.playerId].goals++;
                if (evt.type === 'assist') stats[evt.playerId].assists++;
            });
        });
    };

    if (view === 'annual') {
        history.forEach(process);
        if (tournament) process(tournament);
    } else {
        if (tournament) process(tournament);
    }

    return Object.entries(stats).map(([pid, data]) => ({ playerId: pid, ...data }));
  }, [tournament, historyTrigger, view]);

  // 4. Champions Count
  const championStats = useMemo(() => {
      const history = getHistoricalTournaments();
      const stats: Record<string, number> = {};
      
      history.forEach(t => {
          if (t.status === 'finished') {
              const finalMatch = t.matches.find(m => m.phase === 'final' && m.finished);
              if (finalMatch) {
                   let winnerId = null;
                   if (finalMatch.homeScore > finalMatch.awayScore) winnerId = finalMatch.homeTeamId;
                   else if (finalMatch.awayScore > finalMatch.homeScore) winnerId = finalMatch.awayTeamId;
                   else {
                       const pH = finalMatch.penaltyHome || 0;
                       const pA = finalMatch.penaltyAway || 0;
                       if (pH > pA) winnerId = finalMatch.homeTeamId;
                       else winnerId = finalMatch.awayTeamId;
                   }

                   if (winnerId) {
                       const team = t.teams.find(tm => tm.id === winnerId);
                       if (team) {
                           team.playerIds.forEach(pid => {
                               stats[pid] = (stats[pid] || 0) + 1;
                           });
                       }
                   }
              }
          }
      });

      return Object.entries(stats)
        .map(([pid, count]) => ({ playerId: pid, titles: count }))
        .sort((a, b) => b.titles - a.titles)
        .filter(s => s.titles > 0);
  }, [historyTrigger]);

  // Separate GK Ranking (Annual Points - as requested)
  // This uses calculateGKStats on ALL history
  const annualGKRanking = useMemo(() => {
      const history = getHistoricalTournaments();
      const list = [...history, tournament].filter(t => t !== null) as TournamentData[];
      const fullGKStats = calculateGKStats(list);
      // Filter only for players registered as GK
      return fullGKStats.filter(stat => getPlayerPos(stat.id) === Position.GK);
  }, [historyTrigger, tournament, players]);

  const topScorers = [...activeStatsRaw].sort((a, b) => b.goals - a.goals).filter(s => s.goals > 0);
  const topAssists = [...activeStatsRaw].sort((a, b) => b.assists - a.assists).filter(s => s.assists > 0);
  
  const maxGoals = Math.max(...topScorers.map(s => s.goals), 1);
  const maxAssists = Math.max(...topAssists.map(s => s.assists), 1);

  const getPositionBg = (pos: Position) => {
    switch(pos) {
      case Position.GK: return 'bg-yellow-600 hover:bg-yellow-500';
      case Position.DEF: return 'bg-blue-600 hover:bg-blue-500';
      case Position.MID: return 'bg-green-600 hover:bg-green-500';
      case Position.FWD: return 'bg-red-600 hover:bg-red-500';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="p-4 space-y-8 animate-in fade-in duration-500">
      {/* View Toggle */}
      <div className="flex bg-gray-800 p-1 rounded-lg shadow-lg border border-gray-700">
          <button 
            onClick={() => setView('annual')}
            className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'annual' ? 'bg-soccer-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            <History size={16} /> Ranking Anual
          </button>
          <button 
            onClick={() => setView('current')}
            className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all ${view === 'current' ? 'bg-soccer-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
          >
            <TrendingUp size={16} /> Torneio Atual
          </button>
      </div>

      {/* --- SECTION 1: GENERAL POINTS RANKING --- */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
             <div className="flex items-center gap-2 text-white font-black text-lg uppercase italic tracking-wider">
                 <Medal className="text-yellow-500" /> Ranking Geral
             </div>
             <div className="text-xs text-gray-400 font-normal">
                 (V=3, E=1, D=0)
             </div>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                      <tr>
                          <th className="px-4 py-3 text-center w-12">#</th>
                          <th className="px-4 py-3">Jogador</th>
                          <th className="px-4 py-3 text-center text-white bg-gray-700/30">PTS</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell">J</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-green-400">V</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-gray-400">E</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-red-400">D</th>
                          <th className="px-2 py-3 text-center font-bold text-blue-300" title="Saldo de Gols">SG</th>
                          <th className="px-2 py-3 text-center hidden md:table-cell text-xs">%</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                      {generalRanking.length === 0 && (
                          <tr><td colSpan={9} className="p-8 text-center text-gray-500 italic">Nenhuma pontuação registrada ainda.</td></tr>
                      )}
                      {generalRanking.map((stat, idx) => {
                          const performance = stat.matches > 0 ? Math.round((stat.points / (stat.matches * 3)) * 100) : 0;
                          return (
                              <tr key={stat.id} className="hover:bg-gray-700/50 transition-colors">
                                  <td className="px-4 py-3 text-center">
                                      <span className={`
                                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                        ${idx === 0 ? 'bg-yellow-500 text-black shadow-yellow-500/20 shadow-lg' : 
                                          idx === 1 ? 'bg-gray-300 text-black' : 
                                          idx === 2 ? 'bg-orange-600 text-white' : 'text-gray-500'}
                                      `}>
                                          {idx + 1}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="font-bold text-white">{getPlayerName(stat.id)}</div>
                                      <div className="text-[10px] text-gray-500">{getPlayerPos(stat.id)}</div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-black text-lg text-white bg-gray-700/20 border-x border-gray-700/50">
                                      {stat.points}
                                  </td>
                                  <td className="px-2 py-3 text-center hidden sm:table-cell">{stat.matches}</td>
                                  <td className="px-2 py-3 text-center hidden sm:table-cell font-bold text-green-500">{stat.wins}</td>
                                  <td className="px-2 py-3 text-center hidden sm:table-cell text-gray-400">{stat.draws}</td>
                                  <td className="px-2 py-3 text-center hidden sm:table-cell text-red-400">{stat.losses}</td>
                                  <td className="px-2 py-3 text-center font-bold text-blue-300">{stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}</td>
                                  <td className="px-2 py-3 text-center hidden md:table-cell text-xs text-gray-500">{performance}%</td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>

      {/* --- SECTION 2: MONTHLY RANKING BY POSITION --- */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-700">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                 <div className="flex items-center gap-2 text-white font-black text-lg uppercase italic tracking-wider">
                     <Filter className="text-gray-400" /> Ranking Mensal por Posição
                 </div>
                 
                 {/* Month Selector */}
                 <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-600">
                    <Calendar size={16} className="text-gray-400 ml-2"/>
                    <select 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-white text-sm font-bold p-1 outline-none cursor-pointer"
                    >
                        {availableMonths.map(m => (
                            <option key={m} value={m} className="bg-gray-800">
                                {capitalize(formatMonth(m))}
                            </option>
                        ))}
                    </select>
                 </div>
             </div>

             <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-thin scrollbar-thumb-gray-600">
                {Object.values(Position).map(pos => (
                    <button
                        key={pos}
                        onClick={() => setActivePosTab(pos)}
                        className={`
                            px-4 py-2 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2
                            ${activePosTab === pos ? `text-white ${getPositionBg(pos)} border-transparent shadow-lg` : 'bg-gray-700 text-gray-400 border-gray-700 hover:bg-gray-600'}
                        `}
                    >
                        {pos}
                    </button>
                ))}
             </div>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
                      <tr>
                          <th className="px-4 py-3 text-center w-12">#</th>
                          <th className="px-4 py-3">Jogador</th>
                          <th className="px-4 py-3 text-center text-white bg-gray-700/30">PTS</th>
                          <th className="px-2 py-3 text-center hidden xs:table-cell">J</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-green-400">V</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-gray-400">E</th>
                          <th className="px-2 py-3 text-center hidden sm:table-cell text-red-400">D</th>
                          <th className="px-2 py-3 text-center font-bold text-blue-300">SG</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                      {positionRanking.length === 0 && (
                          <tr><td colSpan={8} className="p-8 text-center text-gray-500 italic">
                              {activePosTab === Position.GK 
                                ? `Nenhum goleiro escalado em ${formatMonth(selectedMonth)}.`
                                : `Nenhum ${activePosTab.toLowerCase()} pontuou em ${formatMonth(selectedMonth)}.`
                              }
                          </td></tr>
                      )}
                      {positionRanking.map((stat, idx) => (
                          <tr key={stat.id} className="hover:bg-gray-700/50 transition-colors">
                              <td className="px-4 py-3 text-center">
                                  <span className={`text-xs font-bold ${idx === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                                      {idx + 1}º
                                  </span>
                              </td>
                              <td className="px-4 py-3">
                                  <div className="font-bold text-white">{getPlayerName(stat.id)}</div>
                              </td>
                              <td className="px-4 py-3 text-center font-black text-lg text-white bg-gray-700/20 border-x border-gray-700/50">
                                  {stat.points}
                              </td>
                              <td className="px-2 py-3 text-center hidden xs:table-cell">{stat.matches}</td>
                              <td className="px-2 py-3 text-center hidden sm:table-cell font-bold text-green-500">{stat.wins}</td>
                              <td className="px-2 py-3 text-center hidden sm:table-cell text-gray-400">{stat.draws}</td>
                              <td className="px-2 py-3 text-center hidden sm:table-cell text-red-400">{stat.losses}</td>
                              <td className="px-2 py-3 text-center font-bold text-blue-300">{stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* --- SECTION 3: STATS CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Titles */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col shadow-lg">
              <div className="bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-2 text-yellow-400 font-bold uppercase text-sm tracking-wide">
                  <Crown size={16} /> Títulos (Histórico)
              </div>
              <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
                  <table className="w-full text-sm">
                      <tbody>
                          {championStats.length === 0 && (
                              <tr><td className="p-6 text-center text-gray-500 italic text-xs">Nenhum campeão registrado</td></tr>
                          )}
                          {championStats.map((stat, idx) => (
                              <tr key={stat.playerId} className="border-b border-gray-700 last:border-0 hover:bg-gray-750">
                                  <td className="p-3">
                                      <div className="flex items-center gap-3">
                                          <span className="text-xs font-bold text-yellow-600/50 w-4">{idx + 1}</span>
                                          <div>
                                            <div className="font-bold text-gray-200">{getPlayerName(stat.playerId)}</div>
                                            <div className="text-[10px] text-gray-500">{getPlayerPos(stat.playerId)}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="p-3 text-right font-bold text-yellow-500">
                                      {stat.titles} <span className="text-[10px] text-yellow-700 uppercase">Copas</span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Top GK (Annual Points) */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col shadow-lg">
              <div className="bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-2 text-yellow-500 font-bold uppercase text-sm tracking-wide">
                  <Shield size={16} /> Top Goleiros (Geral)
              </div>
              <div className="p-0 flex-1 overflow-y-auto max-h-[400px]">
                  <table className="w-full text-sm">
                      <tbody>
                          {annualGKRanking.length === 0 && (
                              <tr><td className="p-6 text-center text-gray-500 italic text-xs">Nenhum goleiro pontuou</td></tr>
                          )}
                          {annualGKRanking.slice(0, 10).map((stat, idx) => (
                              <tr key={stat.id} className="border-b border-gray-700 last:border-0 hover:bg-gray-750">
                                  <td className="p-3">
                                      <div className="flex items-center gap-3">
                                          <span className="text-xs font-bold text-yellow-600/50 w-4">{idx + 1}</span>
                                          <div className="font-bold text-gray-200">{getPlayerName(stat.id)}</div>
                                      </div>
                                  </td>
                                  <td className="p-3 text-right font-bold text-yellow-500">
                                      {stat.points} <span className="text-[10px] text-gray-500 uppercase">Pts</span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Scorers */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col shadow-lg">
              <div className="bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-2 text-soccer-500 font-bold uppercase text-sm tracking-wide">
                  <Trophy size={16} /> Artilharia
              </div>
              <div className="p-4 flex-1 overflow-y-auto max-h-[400px] space-y-4">
                  {topScorers.length === 0 && <div className="text-center text-gray-500 italic py-4 text-xs">Sem gols</div>}
                  {topScorers.map((stat, idx) => {
                      const percentage = (stat.goals / maxGoals) * 100;
                      return (
                          <div key={stat.playerId} className="relative group">
                              <div className="flex justify-between items-end mb-1">
                                  <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold w-4 text-center ${idx === 0 ? 'text-yellow-500' : 'text-gray-600'}`}>{idx + 1}</span>
                                      <div className="text-sm font-bold text-gray-200">{getPlayerName(stat.playerId)}</div>
                                  </div>
                                  <div className="font-mono font-bold text-soccer-400">{stat.goals}</div>
                              </div>
                              <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                                  <div 
                                      className="bg-soccer-600 h-1.5 rounded-full transition-all duration-1000 ease-out group-hover:bg-soccer-500" 
                                      style={{ width: `${percentage}%` }}
                                  ></div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* Assists */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col shadow-lg">
              <div className="bg-gray-900 p-3 border-b border-gray-700 flex items-center gap-2 text-blue-400 font-bold uppercase text-sm tracking-wide">
                  <BarChart3 size={16} /> Assistências
              </div>
              <div className="p-4 flex-1 overflow-y-auto max-h-[400px] space-y-4">
                  {topAssists.length === 0 && <div className="text-center text-gray-500 italic py-4 text-xs">Sem assistências</div>}
                  {topAssists.map((stat, idx) => {
                      const percentage = (stat.assists / maxAssists) * 100;
                      return (
                          <div key={stat.playerId} className="relative group">
                              <div className="flex justify-between items-end mb-1">
                                  <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold w-4 text-center ${idx === 0 ? 'text-blue-400' : 'text-gray-600'}`}>{idx + 1}</span>
                                      <div className="text-sm font-bold text-gray-200">{getPlayerName(stat.playerId)}</div>
                                  </div>
                                  <div className="font-mono font-bold text-blue-400">{stat.assists}</div>
                              </div>
                              <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                                  <div 
                                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000 ease-out group-hover:bg-blue-500" 
                                      style={{ width: `${percentage}%` }}
                                  ></div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

      </div>
    </div>
  );
};