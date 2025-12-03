import React, { useState } from 'react';
import { Match, Player, Team, TournamentData, MatchEvent, MatchEventType, Position } from '../types';
import { Calendar, CheckCircle, Clock, Save, X, Trophy, Shirt } from 'lucide-react';
import { generateId } from '../utils/storage';

interface TournamentBracketProps {
  tournament: TournamentData;
  players: Player[];
  updateTournament: (t: TournamentData) => void;
  isAdmin: boolean;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ tournament, players, updateTournament, isAdmin }) => {
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  
  // Helpers to get names
  const getTeamName = (id: string) => tournament.teams.find(t => t.id === id)?.name || '???';
  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '???';

  // --- Modal Logic ---
  const openMatchModal = (match: Match) => {
    if (!isAdmin) return; // Prevent opening if not admin
    setEditingMatch({ ...match }); // Clone to avoid direct mutation
  };

  const closeMatchModal = () => {
    setEditingMatch(null);
  };

  const saveMatch = () => {
    if (!editingMatch) return;
    
    // Check if penalties are needed
    if (editingMatch.isPlayoff && editingMatch.homeScore === editingMatch.awayScore && editingMatch.phase === 'final') {
        if (editingMatch.penaltyHome === undefined || editingMatch.penaltyAway === undefined) {
            alert("Em caso de empate na final, preencha os pênaltis!");
            return;
        }
    }

    const updatedMatches = tournament.matches.map(m => m.id === editingMatch.id ? { ...editingMatch, finished: true } : m);
    
    // Logic to generate next phase if group stage is done
    let newTournamentState = { ...tournament, matches: updatedMatches };
    
    // Check if we need to generate playoffs
    const groupMatches = updatedMatches.filter(m => m.phase === 'group');
    const allGroupFinished = groupMatches.every(m => m.finished);
    const hasSemis = updatedMatches.some(m => m.phase === 'semi');

    if (allGroupFinished && !hasSemis) {
       newTournamentState = generateSemis(newTournamentState);
    } else if (hasSemis) {
        const semisMatches = updatedMatches.filter(m => m.phase === 'semi');
        const allSemisFinished = semisMatches.every(m => m.finished);
        const hasFinal = updatedMatches.some(m => m.phase === 'final');
        
        if (allSemisFinished && !hasFinal) {
            newTournamentState = generateFinal(newTournamentState);
        }
    }

    updateTournament(newTournamentState);
    closeMatchModal();
  };

  const addEvent = (type: MatchEventType, teamId: string, playerId: string) => {
    if (!editingMatch) return;
    
    const newEvent: MatchEvent = {
        id: generateId(),
        type,
        teamId,
        playerId
    };

    const newEvents = [...editingMatch.events, newEvent];
    
    // Update score based on goals
    const homeGoals = newEvents.filter(e => e.type === 'goal' && e.teamId === editingMatch.homeTeamId).length;
    const awayGoals = newEvents.filter(e => e.type === 'goal' && e.teamId === editingMatch.awayTeamId).length;

    setEditingMatch({
        ...editingMatch,
        events: newEvents,
        homeScore: homeGoals,
        awayScore: awayGoals
    });
  };

  const removeEvent = (eventId: string) => {
      if (!editingMatch) return;
      const newEvents = editingMatch.events.filter(e => e.id !== eventId);
       // Update score
      const homeGoals = newEvents.filter(e => e.type === 'goal' && e.teamId === editingMatch.homeTeamId).length;
      const awayGoals = newEvents.filter(e => e.type === 'goal' && e.teamId === editingMatch.awayTeamId).length;
      
      setEditingMatch({
          ...editingMatch,
          events: newEvents,
          homeScore: homeGoals,
          awayScore: awayGoals
      });
  };

  // --- Logic for Standings & Playoffs ---
  const calculateStandings = (t: TournamentData) => {
    const stats: Record<string, { id: string, name: string, pts: number, w: number, d: number, l: number, gf: number, ga: number, gd: number }> = {};
    
    t.teams.forEach(team => {
        stats[team.id] = { id: team.id, name: team.name, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 };
    });

    t.matches.filter(m => m.phase === 'group' && m.finished).forEach(match => {
        const h = stats[match.homeTeamId];
        const a = stats[match.awayTeamId];
        
        h.gf += match.homeScore;
        h.ga += match.awayScore;
        a.gf += match.awayScore;
        a.ga += match.homeScore;

        if (match.homeScore > match.awayScore) {
            h.pts += 3; h.w++; a.l++;
        } else if (match.awayScore > match.homeScore) {
            a.pts += 3; a.w++; h.l++;
        } else {
            h.pts += 1; h.d++; a.pts += 1; a.d++;
        }
    });

    Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
    
    return Object.values(stats).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.w !== a.w) return b.w - a.w;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
    });
  };

  const generateSemis = (t: TournamentData): TournamentData => {
      const standings = calculateStandings(t);
      if (standings.length < 4) return t; // Should not happen

      const semi1: Match = {
          id: generateId(), round: 100, phase: 'semi', isPlayoff: true, finished: false, events: [],
          homeTeamId: standings[0].id, awayTeamId: standings[3].id, homeScore: 0, awayScore: 0
      };
      
      const semi2: Match = {
        id: generateId(), round: 100, phase: 'semi', isPlayoff: true, finished: false, events: [],
        homeTeamId: standings[1].id, awayTeamId: standings[2].id, homeScore: 0, awayScore: 0
      };

      return { ...t, matches: [...t.matches, semi1, semi2] };
  };

  const generateFinal = (t: TournamentData): TournamentData => {
      const semis = t.matches.filter(m => m.phase === 'semi');
      if (semis.length < 2) return t;

      const getWinner = (match: Match, homeIsHigherSeed: boolean) => {
          if (match.homeScore > match.awayScore) return match.homeTeamId;
          if (match.awayScore > match.homeScore) return match.awayTeamId;
          return homeIsHigherSeed ? match.homeTeamId : match.homeTeamId; // Logic: 1st and 2nd have advantage of draw.
      };

      // Semi 1 was 1st(Home) vs 4th(Away). 1st has advantage.
      const winner1 = getWinner(semis[0], true);
      // Semi 2 was 2nd(Home) vs 3rd(Away). 2nd has advantage.
      const winner2 = getWinner(semis[1], true);

      const finalMatch: Match = {
          id: generateId(), round: 200, phase: 'final', isPlayoff: true, finished: false, events: [],
          homeTeamId: winner1, awayTeamId: winner2, homeScore: 0, awayScore: 0, penaltyHome: 0, penaltyAway: 0
      };

      return { ...t, matches: [...t.matches, finalMatch] };
  };

  // --- Helpers for Modal Dropdowns ---
  const getPlayersForTeam = (teamId: string) => {
      const team = tournament.teams.find(t => t.id === teamId);
      if (!team) return [];
      return team.playerIds.map(pid => players.find(p => p.id === pid)).filter(Boolean) as Player[];
  };

  // Get options for Goalkeeper dropdown (Team Players + Global GKs)
  const getGoalkeeperOptions = (teamId: string) => {
      // 1. Players in the team
      const teamPlayers = getPlayersForTeam(teamId);
      
      // 2. All global players registered as GK
      const globalGKs = players.filter(p => p.position === Position.GK);
      
      // 3. Combine and deduplicate
      const combined = [...teamPlayers];
      globalGKs.forEach(gk => {
          if (!combined.find(p => p.id === gk.id)) {
              combined.push(gk);
          }
      });

      return combined.sort((a, b) => a.name.localeCompare(b.name));
  };

  // --- Rendering Helpers ---
  const groupMatches = tournament.matches.filter(m => m.phase === 'group');
  const semiMatches = tournament.matches.filter(m => m.phase === 'semi');
  const finalMatches = tournament.matches.filter(m => m.phase === 'final');

  return (
    <div className="space-y-8 p-4">
      
      {/* Group Stage */}
      <div>
          <h3 className="text-xl font-bold text-soccer-500 mb-4 border-b border-gray-700 pb-2">Fase de Grupos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupMatches.map(match => (
                <MatchCard 
                    key={match.id} 
                    match={match} 
                    players={players}
                    getTeamName={getTeamName} 
                    onClick={() => openMatchModal(match)}
                    disabled={!isAdmin}
                />
            ))}
          </div>
      </div>

      {/* Semis */}
      {semiMatches.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-yellow-500 mb-4 border-b border-gray-700 pb-2">Semifinais (Vantagem do Empate para 1º e 2º)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {semiMatches.map((match, idx) => (
                    <MatchCard 
                        key={match.id} 
                        match={match} 
                        players={players}
                        getTeamName={getTeamName} 
                        onClick={() => openMatchModal(match)}
                        label={idx === 0 ? "1º Colocado x 4º Colocado" : "2º Colocado x 3º Colocado"}
                        disabled={!isAdmin}
                    />
                ))}
            </div>
          </div>
      )}

      {/* Final */}
      {finalMatches.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-purple-500 mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                <Trophy /> Final (Empate = Pênaltis)
            </h3>
            <div className="max-w-md mx-auto">
                {finalMatches.map(match => (
                    <MatchCard 
                        key={match.id} 
                        match={match} 
                        players={players}
                        getTeamName={getTeamName} 
                        onClick={() => openMatchModal(match)}
                        isFinal
                        disabled={!isAdmin}
                    />
                ))}
            </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingMatch && isAdmin && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-600">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800 z-10">
              <h3 className="font-bold text-xl">Editar Resultado</h3>
              <button onClick={closeMatchModal}><X /></button>
            </div>
            
            <div className="p-6 space-y-6">
                {/* Score & Goalkeeper Display */}
                <div className="flex justify-around items-start text-3xl font-bold">
                    {/* Home Team */}
                    <div className="text-center w-1/3 flex flex-col gap-2">
                        <div className="text-sm text-gray-400">{getTeamName(editingMatch.homeTeamId)}</div>
                        <div className="bg-gray-900 p-4 rounded text-soccer-500 border border-gray-700">{editingMatch.homeScore}</div>
                        
                        {/* Home GK Select */}
                        <div className="flex items-center gap-2 mt-2">
                            <Shirt size={16} className="text-yellow-500" />
                            <select 
                                value={editingMatch.homeGoalkeeperId || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, homeGoalkeeperId: e.target.value || undefined})}
                                className="w-full text-xs p-2 rounded bg-gray-700 border-none text-white focus:ring-1 focus:ring-yellow-500"
                            >
                                <option value="">Goleiro...</option>
                                {getGoalkeeperOptions(editingMatch.homeTeamId).map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.position === Position.GK && !getPlayersForTeam(editingMatch.homeTeamId).find(tp => tp.id === p.id) ? '(Ext)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="text-gray-500 text-xl pt-8">X</div>
                    
                    {/* Away Team */}
                    <div className="text-center w-1/3 flex flex-col gap-2">
                        <div className="text-sm text-gray-400">{getTeamName(editingMatch.awayTeamId)}</div>
                        <div className="bg-gray-900 p-4 rounded text-soccer-500 border border-gray-700">{editingMatch.awayScore}</div>
                        
                        {/* Away GK Select */}
                        <div className="flex items-center gap-2 mt-2">
                            <Shirt size={16} className="text-yellow-500" />
                            <select 
                                value={editingMatch.awayGoalkeeperId || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, awayGoalkeeperId: e.target.value || undefined})}
                                className="w-full text-xs p-2 rounded bg-gray-700 border-none text-white focus:ring-1 focus:ring-yellow-500"
                            >
                                <option value="">Goleiro...</option>
                                {getGoalkeeperOptions(editingMatch.awayTeamId).map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.position === Position.GK && !getPlayersForTeam(editingMatch.awayTeamId).find(tp => tp.id === p.id) ? '(Ext)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Penalties Input (Only Final + Draw) */}
                {editingMatch.phase === 'final' && editingMatch.homeScore === editingMatch.awayScore && (
                     <div className="bg-purple-900/30 p-4 rounded border border-purple-500/50">
                         <h4 className="text-center text-purple-300 font-bold mb-3">Pênaltis</h4>
                         <div className="flex justify-center gap-8 items-center">
                            <input 
                                type="number" 
                                className="w-16 p-2 bg-gray-900 text-center rounded border border-purple-500" 
                                value={editingMatch.penaltyHome ?? ''}
                                onChange={(e) => setEditingMatch({...editingMatch, penaltyHome: parseInt(e.target.value) || 0})}
                            />
                            <span>vs</span>
                            <input 
                                type="number" 
                                className="w-16 p-2 bg-gray-900 text-center rounded border border-purple-500"
                                value={editingMatch.penaltyAway ?? ''}
                                onChange={(e) => setEditingMatch({...editingMatch, penaltyAway: parseInt(e.target.value) || 0})}
                            />
                         </div>
                     </div>
                )}

                {/* Event Logging */}
                <div className="grid grid-cols-2 gap-4">
                    <TeamEventPanel 
                        teamId={editingMatch.homeTeamId} 
                        tournament={tournament} 
                        players={players} 
                        addEvent={addEvent} 
                        teamName={getTeamName(editingMatch.homeTeamId)}
                    />
                     <TeamEventPanel 
                        teamId={editingMatch.awayTeamId} 
                        tournament={tournament} 
                        players={players} 
                        addEvent={addEvent}
                        teamName={getTeamName(editingMatch.awayTeamId)}
                    />
                </div>

                {/* Event List */}
                <div className="bg-gray-900 p-4 rounded">
                    <h4 className="font-bold text-sm text-gray-400 mb-2">Eventos da Partida</h4>
                    {editingMatch.events.length === 0 && <p className="text-xs text-gray-600">Nenhum evento registrado</p>}
                    <ul className="space-y-2">
                        {editingMatch.events.map((evt, idx) => (
                            <li key={idx} className="flex justify-between items-center bg-gray-800 p-2 rounded text-sm border border-gray-700">
                                <span>
                                    <span className={`font-bold ${evt.teamId === editingMatch.homeTeamId ? 'text-blue-400' : 'text-red-400'}`}>
                                        {evt.teamId === editingMatch.homeTeamId ? getTeamName(editingMatch.homeTeamId) : getTeamName(editingMatch.awayTeamId)}
                                    </span>
                                    {' - '}
                                    {getPlayerName(evt.playerId)}
                                    {' '}
                                    <span className="uppercase text-xs font-bold px-1 rounded bg-gray-700">
                                        {evt.type === 'goal' && '⚽ Gol'}
                                        {evt.type === 'assist' && '👟 Assist'}
                                        {evt.type === 'yellow' && '🟨 Amarelo'}
                                        {evt.type === 'red' && '🟥 Vermelho'}
                                    </span>
                                </span>
                                <button onClick={() => removeEvent(evt.id)} className="text-red-500 hover:text-red-400"><X size={14} /></button>
                            </li>
                        ))}
                    </ul>
                </div>

            </div>
            
            <div className="p-4 border-t border-gray-700 bg-gray-800 sticky bottom-0 z-10">
                <button onClick={saveMatch} className="w-full bg-soccer-600 hover:bg-soccer-500 text-white font-bold py-3 rounded flex items-center justify-center gap-2">
                    <Save /> Salvar Resultado
                </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const MatchCard: React.FC<{ 
    match: Match, 
    getTeamName: (id: string) => string, 
    players: Player[], 
    onClick: () => void, 
    label?: string, 
    isFinal?: boolean, 
    disabled?: boolean 
}> = ({ match, getTeamName, players, onClick, label, isFinal, disabled }) => {
    
    // Process events for tooltip
    const eventsToDisplay = match.events.filter(e => ['goal', 'yellow', 'red'].includes(e.type));
    const getEventIcon = (type: MatchEventType) => {
        switch(type) {
            case 'goal': return '⚽';
            case 'yellow': return '🟨';
            case 'red': return '🟥';
            default: return '';
        }
    };
    const getPlayerName = (id: string) => players.find(p => p.id === id)?.name.split(' ')[0] || '???';
    const getGKName = (id?: string) => players.find(p => p.id === id)?.name.split(' ')[0];

    // Determine Winner for Visual Highlight
    const getWinnerId = () => {
        if (!match.finished) return null;
        if (match.homeScore > match.awayScore) return match.homeTeamId;
        if (match.awayScore > match.homeScore) return match.awayTeamId;
        
        // Tie scenarios
        if (match.phase === 'final') {
            if ((match.penaltyHome || 0) > (match.penaltyAway || 0)) return match.homeTeamId;
            if ((match.penaltyAway || 0) > (match.penaltyHome || 0)) return match.awayTeamId;
        }
        // Semi-final tie breaker (Advantage to Home/Higher Seed as per app logic)
        if (match.phase === 'semi') {
            return match.homeTeamId;
        }
        return null; // Group stage draw (no visual winner)
    };

    const winnerId = getWinnerId();

    return (
        <div 
            onClick={onClick}
            className={`relative bg-gray-800 rounded-lg p-4 border transition-all group
                ${disabled ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-gray-750 hover:border-soccer-500'}
                ${match.finished ? 'border-soccer-800' : 'border-gray-700'}
                ${isFinal ? 'ring-2 ring-yellow-500 bg-gradient-to-b from-gray-800 to-gray-900' : ''}
            `}
        >
            <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1"><Calendar size={12}/> {match.phase === 'group' ? `Rodada ${match.round}` : (match.phase === 'semi' ? 'Semifinal' : 'Final')}</span>
                {match.finished ? <span className="text-soccer-500 flex items-center gap-1"><CheckCircle size={12}/> Finalizado</span> : <span className="flex items-center gap-1"><Clock size={12}/> Pendente</span>}
            </div>
            {label && <div className="text-center text-xs text-yellow-500 font-bold mb-2">{label}</div>}
            
            <div className="flex justify-between items-center">
                {/* Home Team */}
                <div className="flex-1 text-center">
                    <div className={`font-bold text-lg truncate px-1 flex items-center justify-center gap-1 ${
                        winnerId === match.homeTeamId ? 'text-green-400 drop-shadow-sm' : (winnerId ? 'text-gray-500 opacity-70' : 'text-gray-100')
                    }`}>
                        {winnerId === match.homeTeamId && <Trophy size={14} className="text-yellow-500" />}
                        {getTeamName(match.homeTeamId)}
                    </div>
                    {match.homeGoalkeeperId && <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-center gap-1"><Shirt size={10} className="text-yellow-600"/> {getGKName(match.homeGoalkeeperId)}</div>}
                </div>
                
                {/* Score Box */}
                <div className={`bg-gray-900 px-3 py-1 rounded font-mono font-bold text-xl min-w-[80px] text-center border border-gray-700 transition-colors ${!disabled ? 'group-hover:border-soccer-500' : ''}`}>
                    {match.finished ? `${match.homeScore} - ${match.awayScore}` : 'VS'}
                </div>
                
                {/* Away Team */}
                <div className="flex-1 text-center">
                    <div className={`font-bold text-lg truncate px-1 flex items-center justify-center gap-1 ${
                        winnerId === match.awayTeamId ? 'text-green-400 drop-shadow-sm' : (winnerId ? 'text-gray-500 opacity-70' : 'text-gray-100')
                    }`}>
                        {getTeamName(match.awayTeamId)}
                        {winnerId === match.awayTeamId && <Trophy size={14} className="text-yellow-500" />}
                    </div>
                    {match.awayGoalkeeperId && <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-center gap-1"><Shirt size={10} className="text-yellow-600"/> {getGKName(match.awayGoalkeeperId)}</div>}
                </div>
            </div>
            {match.phase === 'final' && match.finished && match.homeScore === match.awayScore && (
                <div className="text-center text-xs text-purple-400 mt-2 font-bold">
                    Pênaltis: {match.penaltyHome} - {match.penaltyAway}
                </div>
            )}

            {/* Tooltip on Hover */}
            {match.finished && eventsToDisplay.length > 0 && (
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-gray-900 border border-gray-600 rounded-lg shadow-xl pointer-events-none p-2">
                    <div className="text-[10px] uppercase text-gray-400 font-bold mb-1 text-center border-b border-gray-700 pb-1">Eventos</div>
                    <ul className="space-y-1">
                        {eventsToDisplay.map((e, idx) => (
                            <li key={idx} className="text-xs flex items-center gap-1 text-gray-200">
                                <span>{getEventIcon(e.type)}</span>
                                <span className={`font-semibold ${e.teamId === match.homeTeamId ? 'text-blue-300' : 'text-red-300'}`}>
                                    {getPlayerName(e.playerId)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    );
};

const TeamEventPanel: React.FC<{ teamId: string, teamName: string, tournament: TournamentData, players: Player[], addEvent: (t: MatchEventType, tid: string, pid: string) => void }> = ({ teamId, teamName, tournament, players, addEvent }) => {
    const team = tournament.teams.find(t => t.id === teamId);
    const teamPlayers = team ? team.playerIds.map(pid => players.find(p => p.id === pid)).filter(Boolean) as Player[] : [];

    const [selectedPlayer, setSelectedPlayer] = useState<string>('');

    return (
        <div className="bg-gray-900 p-3 rounded border border-gray-700">
            <h5 className="font-bold text-center mb-2 text-sm truncate">{teamName}</h5>
            <select 
                className="w-full bg-gray-800 p-2 rounded text-sm mb-2 border border-gray-600 outline-none"
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
            >
                <option value="">Selecione Jogador</option>
                {teamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
                <button disabled={!selectedPlayer} onClick={() => addEvent('goal', teamId, selectedPlayer)} className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs py-1 rounded">⚽ Gol</button>
                <button disabled={!selectedPlayer} onClick={() => addEvent('assist', teamId, selectedPlayer)} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs py-1 rounded">👟 Assis.</button>
                <button disabled={!selectedPlayer} onClick={() => addEvent('yellow', teamId, selectedPlayer)} className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-xs py-1 rounded">🟨 Amarelo</button>
                <button disabled={!selectedPlayer} onClick={() => addEvent('red', teamId, selectedPlayer)} className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs py-1 rounded">🟥 Vermelho</button>
            </div>
        </div>
    );
};