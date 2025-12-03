import React, { useState, useEffect } from 'react';
import { TournamentData, Player, Match } from '../types';
import { getHistoricalTournaments, deleteHistoricalTournament, updateHistoricalTournament, HISTORY_KEY } from '../utils/storage';
import { Trophy, Calendar, Medal, List, AlertCircle, Crown, Trash2, Pencil, Check, X, Shirt, Users, AlertTriangle } from 'lucide-react';
import { Standings } from './Standings';

interface TournamentSummaryProps {
  players: Player[];
  isAdmin: boolean;
}

export const TournamentSummary: React.FC<TournamentSummaryProps> = ({ players, isAdmin }) => {
  const [history, setHistory] = useState<TournamentData[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  
  // Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const loadHistory = () => {
    const data = getHistoricalTournaments();
    // Sort by date descending (prefer finishedAt, fallback to createdAt)
    const sorted = data.sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0));
    setHistory(sorted);
    // If selectedId is empty or no longer exists in history, select the first one
    if (sorted.length > 0) {
      if (!selectedId || !sorted.find(t => t.id === selectedId)) {
          setSelectedId(sorted[0].id);
      }
    } else {
        setSelectedId('');
    }
  };

  useEffect(() => {
    loadHistory();

    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === HISTORY_KEY) {
            loadHistory();
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const selectedTournament = history.find(t => t.id === selectedId) || history[0];

  const handleDeleteClick = () => {
      if (!selectedId) return;
      setShowDeleteModal(true);
  };

  const confirmDelete = () => {
      if (!selectedId) return;
      
      const success = deleteHistoricalTournament(selectedId);
      if (success) {
          // Force reload history
          const data = getHistoricalTournaments();
          const sorted = data.sort((a, b) => (b.finishedAt || b.createdAt || 0) - (a.finishedAt || a.createdAt || 0));
          setHistory(sorted);
          
          // Reset selection
          if (sorted.length > 0) {
              setSelectedId(sorted[0].id);
          } else {
              setSelectedId('');
          }
          
          // Force update for other components
          window.dispatchEvent(new Event('storage'));
          
          setShowDeleteModal(false);
          // Optional: Add a toast notification here if desired, or keep generic alert/silent
      } else {
          alert("Erro ao apagar torneio.");
          setShowDeleteModal(false);
      }
  };

  const handleStartEdit = () => {
      if (!selectedTournament) return;
      // Default name to "DD/MM/YYYY - X Times" if it's the default format, or the custom name
      const defaultName = selectedTournament.name === 'RACHA OS TESOURAS 2026' 
        ? `${formatDate(selectedTournament.finishedAt || selectedTournament.createdAt)}` 
        : selectedTournament.name;
        
      setEditName(defaultName);
      setIsEditing(true);
  };

  const handleSaveEdit = () => {
      if (!selectedTournament || !editName.trim()) return;

      const updated = { ...selectedTournament, name: editName.trim() };
      const success = updateHistoricalTournament(updated);
      
      if (success) {
          // Refresh list locally
          const updatedHistory = history.map(t => t.id === updated.id ? updated : t);
          setHistory(updatedHistory);
          setIsEditing(false);
      } else {
          alert('Erro ao atualizar nome.');
      }
  };

  const getPlayerName = (id: string) => players.find(p => p.id === id)?.name || '???';
  const getTeamName = (id: string, t: TournamentData) => t.teams?.find(team => team.id === id)?.name || '???';

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Data desconhecida';
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate Stats for this tournament SAFELY
  const getTournamentStats = (t: TournamentData) => {
    const stats: Record<string, { goals: number, assists: number, yellow: number, red: number }> = {};
    
    if (t && Array.isArray(t.matches)) {
        t.matches.forEach(m => {
            if (Array.isArray(m.events)) {
                m.events.forEach(e => {
                    if (!stats[e.playerId]) stats[e.playerId] = { goals: 0, assists: 0, yellow: 0, red: 0 };
                    if (e.type === 'goal') stats[e.playerId].goals++;
                    if (e.type === 'assist') stats[e.playerId].assists++;
                    if (e.type === 'yellow') stats[e.playerId].yellow++;
                    if (e.type === 'red') stats[e.playerId].red++;
                });
            }
        });
    }
    return Object.entries(stats).map(([pid, data]) => ({ playerId: pid, ...data }));
  };

  if (history.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center">
        <List size={64} className="mb-6 opacity-30" />
        <h3 className="text-xl font-bold mb-2">Histórico Vazio</h3>
        <p>Nenhum torneio foi finalizado e arquivado ainda.</p>
        <p className="text-sm mt-4 text-gray-600 max-w-md">
            Vá até a aba "Torneio" e clique em "Encerrar Torneio" ao final das partidas para salvar o histórico aqui.
        </p>
      </div>
    );
  }

  if (!selectedTournament) return <div className="p-8 text-center">Carregando dados...</div>;

  const stats = getTournamentStats(selectedTournament);
  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).slice(0, 5).filter(s => s.goals > 0);
  const topAssists = [...stats].sort((a, b) => b.assists - a.assists).slice(0, 5).filter(s => s.assists > 0);

  // Filter Matches
  const semiMatches = selectedTournament.matches?.filter(m => m.phase === 'semi') || [];
  const finalMatch = selectedTournament.matches?.find(m => m.phase === 'final');

  // Determine Champion Logic Helper
  const getMatchWinner = (match: Match) => {
      if (!match.finished) return null;
      if (match.phase === 'final') {
          if (match.homeScore > match.awayScore) return match.homeTeamId;
          if (match.awayScore > match.homeScore) return match.awayTeamId;
          if ((match.penaltyHome || 0) > (match.penaltyAway || 0)) return match.homeTeamId;
          return match.awayTeamId;
      } else {
          // Semis: Advantage to higher seed (usually Home in this app logic)
          if (match.homeScore >= match.awayScore) return match.homeTeamId;
          return match.awayTeamId;
      }
  };

  const championId = finalMatch ? getMatchWinner(finalMatch) : null;

  return (
    <div className="p-4 space-y-8 pb-24 animate-in fade-in duration-500 relative">
      
      {/* Selector */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-md">
        <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2 font-bold uppercase tracking-wider">
           <Calendar size={16} /> Histórico de Torneios
        </label>
        <div className="flex gap-2">
            {!isEditing ? (
                <select 
                    value={selectedId || (selectedTournament ? selectedTournament.id : '')} 
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="flex-1 bg-gray-900 text-white p-3 rounded border border-gray-600 outline-none focus:border-soccer-500 focus:ring-1 focus:ring-soccer-500 transition-all"
                >
                {history.map(t => {
                    // Display Logic: If name is default, show date. If custom, show custom name + date
                    const displayName = t.name === 'RACHA OS TESOURAS 2026' 
                        ? `${formatDate(t.finishedAt || t.createdAt)}` 
                        : `${t.name} (${formatDate(t.finishedAt || t.createdAt)})`;
                    
                    return (
                        <option key={t.id} value={t.id}>
                            {displayName} — {t.teamCount} Times
                        </option>
                    );
                })}
                </select>
            ) : (
                <div className="flex-1 flex gap-2">
                    <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome do Torneio (Ex: Final da Copa)"
                        className="flex-1 bg-gray-900 text-white p-3 rounded border border-soccer-500 outline-none"
                        autoFocus
                    />
                    <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded"><Check /></button>
                    <button onClick={() => setIsEditing(false)} className="bg-gray-600 hover:bg-gray-500 text-white px-4 rounded"><X /></button>
                </div>
            )}

            {isAdmin && !isEditing && (
                <div className="flex gap-1">
                    <button 
                        onClick={handleStartEdit}
                        className="bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 hover:border-blue-500 p-3 rounded transition-colors flex items-center justify-center"
                        title="Editar nome do torneio"
                    >
                        <Pencil size={20} />
                    </button>
                    <button 
                        onClick={handleDeleteClick}
                        className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 hover:border-red-500 p-3 rounded transition-colors flex items-center justify-center"
                        title="Excluir este histórico"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Champion Banner */}
      {championId ? (
          <div className="bg-gradient-to-br from-yellow-700/30 to-yellow-900/50 border border-yellow-600/50 p-8 rounded-xl flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-yellow-500/5 blur-3xl rounded-full transform scale-150"></div>
              <Trophy size={56} className="text-yellow-400 mb-3 relative z-10" />
              <div className="text-yellow-200 text-xs uppercase tracking-[0.2em] font-bold relative z-10 mb-1">Grande Campeão</div>
              <div className="text-4xl font-black text-white relative z-10 drop-shadow-xl tracking-tight">
                  {getTeamName(championId, selectedTournament)}
              </div>
          </div>
      ) : (
          <div className="bg-gray-800/50 border border-gray-700 border-dashed p-6 rounded-lg text-center text-gray-500 flex flex-col items-center">
             <AlertCircle className="mb-2 opacity-50" />
             <p>Este torneio não possui um campeão definido (Final não realizada).</p>
          </div>
      )}

      {/* Playoffs Summary Section */}
      {(semiMatches.length > 0 || finalMatch) && (
          <div>
            <h3 className="text-xl font-bold text-gray-200 mb-4 pl-3 border-l-4 border-yellow-500 flex items-center gap-2">
                <Crown className="text-yellow-500" size={24} /> Fase Final
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Semis Column */}
                <div className="space-y-4 lg:col-span-1 flex flex-col justify-center">
                    <h4 className="text-center text-gray-400 text-xs uppercase font-bold mb-2">Semifinais</h4>
                    {semiMatches.map(m => {
                        const winnerId = getMatchWinner(m);
                        return (
                            <div key={m.id} className="bg-gray-800 p-3 rounded border border-gray-700 relative">
                                <div className={`flex justify-between items-center mb-1 ${winnerId === m.homeTeamId ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                                    <span className="text-sm">{getTeamName(m.homeTeamId, selectedTournament)}</span>
                                    <span className="bg-gray-900 px-2 py-0.5 rounded text-xs">{m.homeScore}</span>
                                </div>
                                <div className={`flex justify-between items-center ${winnerId === m.awayTeamId ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                                    <span className="text-sm">{getTeamName(m.awayTeamId, selectedTournament)}</span>
                                    <span className="bg-gray-900 px-2 py-0.5 rounded text-xs">{m.awayScore}</span>
                                </div>
                                {/* Connector line for desktop */}
                                <div className="hidden lg:block absolute -right-6 top-1/2 w-6 h-0.5 bg-gray-700"></div>
                            </div>
                        );
                    })}
                </div>

                {/* Final Column */}
                <div className="lg:col-span-2 flex flex-col justify-center items-center">
                    <h4 className="text-center text-yellow-500 text-xs uppercase font-bold mb-2">Grande Final</h4>
                    {finalMatch ? (
                        <div className="bg-gray-900 p-6 rounded-xl border-2 border-yellow-600/50 w-full max-w-md relative shadow-2xl">
                             <div className="flex justify-between items-center mb-4">
                                <div className={`flex-1 text-center ${getMatchWinner(finalMatch) === finalMatch.homeTeamId ? 'text-yellow-400 font-bold scale-110' : 'text-gray-300'} transition-transform`}>
                                    <div className="text-lg md:text-xl leading-tight">{getTeamName(finalMatch.homeTeamId, selectedTournament)}</div>
                                </div>
                                <div className="mx-4 font-mono text-2xl font-bold text-white bg-gray-800 px-4 py-2 rounded border border-gray-700">
                                    {finalMatch.homeScore} - {finalMatch.awayScore}
                                </div>
                                <div className={`flex-1 text-center ${getMatchWinner(finalMatch) === finalMatch.awayTeamId ? 'text-yellow-400 font-bold scale-110' : 'text-gray-300'} transition-transform`}>
                                    <div className="text-lg md:text-xl leading-tight">{getTeamName(finalMatch.awayTeamId, selectedTournament)}</div>
                                </div>
                             </div>
                             {finalMatch.homeScore === finalMatch.awayScore && (
                                 <div className="text-center text-sm text-purple-400 font-bold bg-purple-900/20 py-1 rounded">
                                     Pênaltis: {finalMatch.penaltyHome} - {finalMatch.penaltyAway}
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div className="text-gray-500 italic">Final não realizada</div>
                    )}
                </div>
            </div>
          </div>
      )}

      {/* Standings Reuse - Now Clearly Labeled */}
      <div className="border-t border-gray-700 pt-6">
         <Standings tournament={selectedTournament} />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-700 pt-6">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow">
              <h3 className="font-bold text-soccer-500 mb-4 flex items-center gap-2 text-lg border-b border-gray-700 pb-2">
                  <Medal size={20}/> Top Artilheiros
              </h3>
              <ul className="space-y-3">
                  {topScorers.length === 0 && <li className="text-gray-500 text-sm italic text-center py-2">Nenhum gol registrado</li>}
                  {topScorers.map((s, i) => (
                      <li key={s.playerId} className="flex justify-between items-center text-sm p-2 bg-gray-900/50 rounded hover:bg-gray-900 transition-colors">
                          <span className="flex items-center gap-2">
                              <span className={`font-bold w-6 text-center ${i === 0 ? 'text-yellow-500' : 'text-gray-500'}`}>{i+1}º</span>
                              {getPlayerName(s.playerId)}
                          </span>
                          <span className="font-bold text-soccer-500 bg-soccer-900/30 px-2 py-1 rounded min-w-[30px] text-center">{s.goals}</span>
                      </li>
                  ))}
              </ul>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow">
              <h3 className="font-bold text-blue-400 mb-4 flex items-center gap-2 text-lg border-b border-gray-700 pb-2">
                  <Medal size={20}/> Top Assistências
              </h3>
              <ul className="space-y-3">
                  {topAssists.length === 0 && <li className="text-gray-500 text-sm italic text-center py-2">Nenhuma assistência</li>}
                  {topAssists.map((s, i) => (
                      <li key={s.playerId} className="flex justify-between items-center text-sm p-2 bg-gray-900/50 rounded hover:bg-gray-900 transition-colors">
                          <span className="flex items-center gap-2">
                               <span className={`font-bold w-6 text-center ${i === 0 ? 'text-blue-400' : 'text-gray-500'}`}>{i+1}º</span>
                               {getPlayerName(s.playerId)}
                          </span>
                          <span className="font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded min-w-[30px] text-center">{s.assists}</span>
                      </li>
                  ))}
              </ul>
          </div>
      </div>

      {/* Team Rosters */}
      <div className="border-t border-gray-700 pt-6">
          <h3 className="text-xl font-bold text-gray-200 mb-4 pl-3 border-l-4 border-blue-500 flex items-center gap-2">
            <Users /> Escalação dos Times
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedTournament.teams.map(team => (
                  <div key={team.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm hover:border-gray-600 transition-colors">
                      <div className="font-bold text-lg text-soccer-500 mb-3 border-b border-gray-700 pb-2 flex justify-between items-end">
                          <span>{team.name}</span>
                          <span className="text-xs text-gray-500 font-normal">{team.playerIds.length} jogadores</span>
                      </div>
                      <ul className="space-y-2">
                          {team.playerIds.map(pid => {
                              const player = players.find(p => p.id === pid);
                              return (
                                  <li key={pid} className="text-sm text-gray-300 flex items-center justify-between">
                                      <span className="font-medium">{player ? player.name : 'Jogador excluído'}</span>
                                      <span className="text-[10px] uppercase bg-gray-900 px-1.5 py-0.5 rounded text-gray-500 border border-gray-800">
                                          {player ? player.position : 'N/A'}
                                      </span>
                                  </li>
                              );
                          })}
                          {team.playerIds.length === 0 && <li className="text-xs text-gray-500 italic">Nenhum jogador registrado.</li>}
                      </ul>
                  </div>
              ))}
          </div>
      </div>

      {/* Matches List */}
      <div>
          <h3 className="text-xl font-bold text-gray-200 mb-4 pl-3 border-l-4 border-gray-600 flex items-center gap-2">
            <List /> Histórico Completo das Partidas
          </h3>
          <div className="space-y-3">
              {(selectedTournament.matches || []).map(m => (
                  <div key={m.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col gap-2 shadow-sm hover:border-gray-600 transition-colors">
                      <div className="flex justify-between text-xs text-gray-400 uppercase font-bold tracking-wider">
                          <span>{m.phase === 'group' ? `Rodada ${m.round}` : (m.phase === 'semi' ? 'Semifinal' : 'Final')}</span>
                          {m.phase === 'final' && m.penaltyHome !== undefined && (
                              <span className="text-purple-400 bg-purple-900/20 px-2 rounded">
                                  Pênaltis: {m.penaltyHome} - {m.penaltyAway}
                              </span>
                          )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                          <div className="flex-1 text-right">
                              <div className="font-bold text-gray-200 text-sm md:text-base truncate">{getTeamName(m.homeTeamId, selectedTournament)}</div>
                              {m.homeGoalkeeperId && (
                                  <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                                     {getPlayerName(m.homeGoalkeeperId).split(' ')[0]} <Shirt size={10} className="text-yellow-600"/>
                                  </div>
                              )}
                          </div>

                          <span className="mx-4 bg-gray-900 px-4 py-2 rounded-md font-mono font-bold border border-gray-700 text-lg shadow-inner">
                              {m.homeScore} - {m.awayScore}
                          </span>

                          <div className="flex-1 text-left">
                              <div className="font-bold text-gray-200 text-sm md:text-base truncate">{getTeamName(m.awayTeamId, selectedTournament)}</div>
                              {m.awayGoalkeeperId && (
                                  <div className="text-[10px] text-gray-400 flex items-center justify-start gap-1 mt-0.5">
                                     <Shirt size={10} className="text-yellow-600"/> {getPlayerName(m.awayGoalkeeperId).split(' ')[0]}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
              {(!selectedTournament.matches || selectedTournament.matches.length === 0) && (
                  <p className="text-gray-500 text-center italic">Nenhuma partida registrada.</p>
              )}
          </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-red-900/30 p-4 rounded-full mb-4 border border-red-700/50">
                        <AlertTriangle size={48} className="text-red-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Excluir Histórico?</h3>
                    <p className="text-gray-400 leading-relaxed">
                        Tem certeza que deseja apagar o torneio <br/> 
                        <span className="text-white font-bold">{selectedTournament.name}</span>?
                    </p>
                    <div className="mt-4 bg-red-900/20 border border-red-900/50 p-3 rounded text-sm text-red-200 font-bold w-full">
                        ⚠️ Esta ação não pode ser desfeita.
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteModal(false)} 
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete} 
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <Trash2 size={20} /> Apagar permanentemente
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
