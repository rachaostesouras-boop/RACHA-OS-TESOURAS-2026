import React, { useState } from 'react';
import { Player, Team, TournamentData, Position } from '../types';
import { Users, Shield, ArrowRight } from 'lucide-react';
import { generateId } from '../utils/storage';

interface TeamManagerProps {
  players: Player[];
  tournament: TournamentData | null;
  setTournament: (t: TournamentData) => void;
  startTournament: () => void;
  isAdmin: boolean;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ players, tournament, setTournament, startTournament, isAdmin }) => {
  const [teamCount, setTeamCount] = useState<4 | 5>(4);

  // Initialize draft if not exists
  React.useEffect(() => {
    if (!tournament) {
      const initialTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Time ${i + 1}`,
        playerIds: []
      }));
      
      setTournament({
        id: generateId(),
        name: 'RACHA OS TESOURAS 2026',
        status: 'draft',
        teamCount: teamCount,
        teams: initialTeams,
        matches: [],
        createdAt: Date.now()
      });
    } else {
        // Sync local state with tournament prop if it exists
        if (tournament.teamCount !== teamCount) {
            setTeamCount(tournament.teamCount);
        }
    }
  }, [teamCount, tournament, setTournament]);

  const handleTeamCountChange = (count: 4 | 5) => {
    if (tournament?.teamCount === count) return;

    // Check if any players are already assigned
    const hasPlayersAssigned = tournament?.teams.some(t => t.playerIds.length > 0);

    if (hasPlayersAssigned) {
        if (!confirm('Mudar o número de times irá reiniciar a montagem dos times e remover os jogadores atuais. Continuar?')) {
            return;
        }
    }

    setTeamCount(count);
    // Reset tournament with new count
    const initialTeams: Team[] = Array.from({ length: count }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Time ${i + 1}`,
        playerIds: []
    }));
    
    setTournament({
        id: generateId(),
        name: 'RACHA OS TESOURAS 2026',
        status: 'draft',
        teamCount: count,
        teams: initialTeams,
        matches: [],
        createdAt: Date.now()
    });
  };

  const togglePlayerInTeam = (teamId: string, playerId: string) => {
    if (!isAdmin || !tournament) return;

    const updatedTeams = tournament.teams.map(team => {
      // Remove if already in this team
      if (team.id === teamId) {
        if (team.playerIds.includes(playerId)) {
          return { ...team, playerIds: team.playerIds.filter(id => id !== playerId) };
        }
        // Add if not full (max 6)
        if (team.playerIds.length < 6) {
          // Check if player is already in ANY other team
          const isAssigned = tournament.teams.some(t => t.playerIds.includes(playerId));
          if (!isAssigned) {
            return { ...team, playerIds: [...team.playerIds, playerId] };
          } else {
             alert("Jogador já está em um time! Remova-o primeiro.");
             return team;
          }
        } else {
            alert("Máximo de 6 jogadores por time.");
            return team;
        }
      }
      return team;
    });

    setTournament({ ...tournament, teams: updatedTeams });
  };

  const removePlayerFromTeam = (teamId: string, playerId: string) => {
      if (!isAdmin || !tournament) return;
      const updatedTeams = tournament.teams.map(team => {
          if (team.id === teamId) {
              return { ...team, playerIds: team.playerIds.filter(id => id !== playerId)};
          }
          return team;
      });
      setTournament({ ...tournament, teams: updatedTeams });
  }

  if (!tournament) return <div className="p-8 text-center">Carregando gerenciador...</div>;

  const assignedPlayerIds = new Set(tournament.teams.flatMap(t => t.playerIds));
  const unassignedPlayers = players.filter(p => !assignedPlayerIds.has(p.id));

  // Group unassigned players by position
  const groupedPlayers = {
    [Position.GK]: unassignedPlayers.filter(p => p.position === Position.GK),
    [Position.DEF]: unassignedPlayers.filter(p => p.position === Position.DEF),
    [Position.MID]: unassignedPlayers.filter(p => p.position === Position.MID),
    [Position.FWD]: unassignedPlayers.filter(p => p.position === Position.FWD),
  };

  const renderPlayerItem = (player: Player) => (
      <div key={player.id} className="bg-gray-900 p-2 rounded text-sm text-gray-300 flex justify-between items-center border border-gray-700 mb-1 hover:bg-gray-800 transition-colors">
            <div>
                <span className="font-bold text-white">{player.name}</span>
            </div>
            {tournament.status === 'draft' && isAdmin && (
                <div className="flex gap-1">
                    {tournament.teams.map((team, idx) => (
                        <button 
                        key={team.id}
                        onClick={() => togglePlayerInTeam(team.id, player.id)}
                        className="w-6 h-6 rounded bg-soccer-900 hover:bg-soccer-600 text-white text-xs flex items-center justify-center border border-soccer-700 transition-colors"
                        title={`Adicionar ao ${team.name}`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
  );

  return (
    <div className="p-4 space-y-6">
      {tournament.status === 'draft' && isAdmin && (
        <div className="bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
          <h3 className="text-lg font-bold mb-3 text-white">Configuração do Torneio (Admin)</h3>
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => handleTeamCountChange(4)}
              className={`flex-1 py-3 px-4 rounded font-bold transition-all ${
                tournament.teamCount === 4 ? 'bg-soccer-600 text-white ring-2 ring-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              4 Times
            </button>
            <button
              type="button"
              onClick={() => handleTeamCountChange(5)}
              className={`flex-1 py-3 px-4 rounded font-bold transition-all ${
                tournament.teamCount === 5 ? 'bg-soccer-600 text-white ring-2 ring-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              5 Times
            </button>
          </div>
          
          <button 
            type="button"
            onClick={startTournament}
            disabled={tournament.teams.some(t => t.playerIds.length === 0)}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-lg shadow-lg transition-colors"
          >
            <Shield size={24} /> INICIAR TORNEIO <ArrowRight />
          </button>
          {tournament.teams.some(t => t.playerIds.length === 0) && (
             <p className="text-red-400 text-xs text-center mt-2">Todos os times precisam ter pelo menos 1 jogador.</p>
          )}
        </div>
      )}

      {tournament.status === 'draft' && !isAdmin && (
          <div className="bg-gray-800 p-6 rounded-lg text-center border border-gray-700">
              <Shield size={48} className="mx-auto text-soccer-500 mb-4 opacity-50"/>
              <h3 className="text-xl font-bold mb-2">Aguardando Início</h3>
              <p className="text-gray-400">O administrador está organizando os times. Acompanhe a formação abaixo.</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Unassigned Players Pool - ONLY VISIBLE IF ADMIN OR IF YOU WANT USERS TO SEE WHO IS LEFT */}
        {/* Show it always so users know who is available */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col h-[500px]">
          <div className="p-3 bg-gray-700 font-bold text-white border-b border-gray-600 flex justify-between items-center">
            <span>Jogadores Disponíveis</span>
            <span className="bg-gray-600 px-2 py-1 rounded text-xs">{unassignedPlayers.length}</span>
          </div>
          <div className="p-2 overflow-y-auto flex-1 space-y-4 scrollbar-thin scrollbar-thumb-gray-600">
             
             {/* Goleiros */}
             {groupedPlayers[Position.GK].length > 0 && (
                 <div>
                     <div className="text-xs font-bold text-yellow-500 uppercase px-2 py-1 bg-yellow-900/20 border-l-2 border-yellow-500 mb-2">
                         Goleiros ({groupedPlayers[Position.GK].length})
                     </div>
                     {groupedPlayers[Position.GK].map(renderPlayerItem)}
                 </div>
             )}

             {/* Zagueiros */}
             {groupedPlayers[Position.DEF].length > 0 && (
                 <div>
                     <div className="text-xs font-bold text-blue-400 uppercase px-2 py-1 bg-blue-900/20 border-l-2 border-blue-500 mb-2">
                         Zagueiros ({groupedPlayers[Position.DEF].length})
                     </div>
                     {groupedPlayers[Position.DEF].map(renderPlayerItem)}
                 </div>
             )}

             {/* Meias */}
             {groupedPlayers[Position.MID].length > 0 && (
                 <div>
                     <div className="text-xs font-bold text-green-400 uppercase px-2 py-1 bg-green-900/20 border-l-2 border-green-500 mb-2">
                         Meio-Campo ({groupedPlayers[Position.MID].length})
                     </div>
                     {groupedPlayers[Position.MID].map(renderPlayerItem)}
                 </div>
             )}

             {/* Atacantes */}
             {groupedPlayers[Position.FWD].length > 0 && (
                 <div>
                     <div className="text-xs font-bold text-red-400 uppercase px-2 py-1 bg-red-900/20 border-l-2 border-red-500 mb-2">
                         Atacantes ({groupedPlayers[Position.FWD].length})
                     </div>
                     {groupedPlayers[Position.FWD].map(renderPlayerItem)}
                 </div>
             )}

            {unassignedPlayers.length === 0 && <p className="text-gray-500 text-center p-4">Todos jogadores alocados</p>}
          </div>
        </div>

        {/* Teams List */}
        {tournament.teams.map((team) => (
          <div key={team.id} className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col">
            <div className="p-3 bg-soccer-900 font-bold text-white border-b border-soccer-700 flex justify-between items-center">
               <span>{team.name}</span>
               <span className={`text-xs px-2 py-1 rounded ${team.playerIds.length === 6 ? 'bg-red-500' : 'bg-soccer-600'}`}>
                 {team.playerIds.length}/6
               </span>
            </div>
            <div className="p-2 space-y-2">
              {team.playerIds.map(pid => {
                const player = players.find(p => p.id === pid);
                if (!player) return null;
                return (
                  <div key={pid} className="flex justify-between items-center bg-gray-700 p-2 rounded border border-gray-600">
                    <span className="text-white text-sm">{player.name} <span className="text-gray-400 text-xs">({player.position})</span></span>
                    {tournament.status === 'draft' && isAdmin && (
                        <button onClick={() => removePlayerFromTeam(team.id, pid)} className="text-red-400 hover:text-red-300 p-1">
                            <Users size={14} />
                        </button>
                    )}
                  </div>
                );
              })}
              {team.playerIds.length === 0 && (
                  <div className="text-gray-500 text-sm italic text-center py-4">Arraste ou adicione jogadores</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};