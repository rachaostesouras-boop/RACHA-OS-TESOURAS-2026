import React from 'react';
import { TournamentData } from '../types';

interface StandingsProps {
  tournament: TournamentData;
}

export const Standings: React.FC<StandingsProps> = ({ tournament }) => {
  const calculateStandings = () => {
    const stats: Record<string, { id: string, name: string, pts: number, w: number, d: number, l: number, gf: number, ga: number, gd: number }> = {};
    
    // Initialize
    tournament.teams.forEach(team => {
        stats[team.id] = { id: team.id, name: team.name, pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 };
    });

    // Compute Group Phase
    tournament.matches.filter(m => m.phase === 'group' && m.finished).forEach(match => {
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
        if (b.pts !== a.pts) return b.pts - a.pts; // Pontos
        if (b.w !== a.w) return b.w - a.w; // Vitórias
        if (b.gd !== a.gd) return b.gd - a.gd; // Saldo
        return b.gf - a.gf; // Gols Pro
    });
  };

  const tableData = calculateStandings();

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-soccer-500">Classificação (Fase de Grupos)</h2>
      <div className="overflow-x-auto bg-gray-800 rounded-lg shadow border border-gray-700">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs uppercase bg-gray-900 text-gray-400">
            <tr>
              <th className="px-4 py-3">Pos</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3 text-center" title="Pontos">PTS</th>
              <th className="px-4 py-3 text-center" title="Vitórias">V</th>
              <th className="px-4 py-3 text-center" title="Empates">E</th>
              <th className="px-4 py-3 text-center" title="Derrotas">D</th>
              <th className="px-4 py-3 text-center" title="Gols Pró">GP</th>
              <th className="px-4 py-3 text-center" title="Gols Contra">GC</th>
              <th className="px-4 py-3 text-center" title="Saldo de Gols">SG</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((team, index) => (
              <tr key={team.id} className={`border-b border-gray-700 ${index < 4 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                <td className="px-4 py-3">
                    <span className={`
                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${index === 0 ? 'bg-yellow-500 text-black' : 
                          index === 1 ? 'bg-gray-400 text-black' : 
                          index === 2 ? 'bg-orange-700 text-white' : 
                          index === 3 ? 'bg-blue-600 text-white' : 'bg-gray-700'}
                    `}>
                        {index + 1}
                    </span>
                </td>
                <td className="px-4 py-3 font-bold text-white whitespace-nowrap">{team.name}</td>
                <td className="px-4 py-3 text-center font-bold text-soccer-500">{team.pts}</td>
                <td className="px-4 py-3 text-center">{team.w}</td>
                <td className="px-4 py-3 text-center">{team.d}</td>
                <td className="px-4 py-3 text-center">{team.l}</td>
                <td className="px-4 py-3 text-center">{team.gf}</td>
                <td className="px-4 py-3 text-center">{team.ga}</td>
                <td className="px-4 py-3 text-center font-bold">{team.gd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-gray-500 space-y-1">
          <p><span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>1º Lugar: Semifinal (Vantagem do empate)</p>
          <p><span className="inline-block w-3 h-3 bg-gray-400 rounded-full mr-2"></span>2º Lugar: Semifinal (Vantagem do empate)</p>
          <p><span className="inline-block w-3 h-3 bg-orange-700 rounded-full mr-2"></span>3º Lugar: Semifinal</p>
          <p><span className="inline-block w-3 h-3 bg-blue-600 rounded-full mr-2"></span>4º Lugar: Semifinal</p>
      </div>
    </div>
  );
};
