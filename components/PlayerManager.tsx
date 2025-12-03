import React, { useState } from 'react';
import { Player, Position } from '../types';
import { Plus, Trash2, User, Pencil, Check, X } from 'lucide-react';
import { generateId } from '../utils/storage';

interface PlayerManagerProps {
  players: Player[];
  setPlayers: (players: Player[]) => void;
  isAdmin: boolean;
  onDeletePlayer?: (id: string) => void;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({ players, setPlayers, isAdmin, onDeletePlayer }) => {
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState<Position>(Position.MID);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPos, setEditPos] = useState<Position>(Position.MID);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const newPlayer: Player = {
      id: generateId(),
      name: newName.trim(),
      position: newPos
    };
    setPlayers([...players, newPlayer]);
    setNewName('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este jogador?')) {
        if (onDeletePlayer) {
            onDeletePlayer(id);
        } else {
            setPlayers(players.filter(p => p.id !== id));
        }
    }
  };

  const startEditing = (player: Player) => {
      setEditingId(player.id);
      setEditName(player.name);
      setEditPos(player.position);
  };

  const cancelEditing = () => {
      setEditingId(null);
      setEditName('');
  };

  const saveEditing = (id: string) => {
      if (!editName.trim()) return;
      
      const updatedPlayers = players.map(p => {
          if (p.id === id) {
              return { ...p, name: editName.trim(), position: editPos };
          }
          return p;
      });
      
      setPlayers(updatedPlayers);
      setEditingId(null);
  };

  const getPositionColor = (pos: Position) => {
    switch(pos) {
      case Position.GK: return 'bg-yellow-600';
      case Position.DEF: return 'bg-blue-600';
      case Position.MID: return 'bg-green-600';
      case Position.FWD: return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  
  // Group by position for display
  const grouped = {
    [Position.GK]: sortedPlayers.filter(p => p.position === Position.GK),
    [Position.DEF]: sortedPlayers.filter(p => p.position === Position.DEF),
    [Position.MID]: sortedPlayers.filter(p => p.position === Position.MID),
    [Position.FWD]: sortedPlayers.filter(p => p.position === Position.FWD),
  };

  return (
    <div className="p-4 space-y-6">
      {isAdmin && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-soccer-500 flex items-center gap-2">
            <User /> Adicionar Jogador
            </h2>
            <div className="flex flex-col md:flex-row gap-4">
            <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do Jogador"
                className="flex-1 p-3 bg-gray-700 rounded text-white focus:ring-2 focus:ring-soccer-500 outline-none"
            />
            <select
                value={newPos}
                onChange={(e) => setNewPos(e.target.value as Position)}
                className="p-3 bg-gray-700 rounded text-white focus:ring-2 focus:ring-soccer-500 outline-none"
            >
                {Object.values(Position).map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
                ))}
            </select>
            <button
                onClick={handleAdd}
                className="bg-soccer-600 hover:bg-soccer-500 text-white p-3 rounded font-bold flex items-center justify-center gap-2 transition-colors"
            >
                <Plus size={20} /> Adicionar
            </button>
            </div>
        </div>
      )}

      {!isAdmin && (
          <div className="bg-gray-800/50 p-3 rounded text-center text-gray-400 text-sm mb-4">
              Você está em modo visualização. Faça login como admin para adicionar jogadores.
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(grouped).map(([pos, playersGroup]) => (
          <div key={pos} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div className={`p-2 font-bold text-center text-white ${getPositionColor(pos as Position)}`}>
              {pos} ({playersGroup.length})
            </div>
            <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
              {playersGroup.length === 0 && <p className="text-gray-500 text-center italic text-sm p-4">Nenhum jogador</p>}
              {playersGroup.map(player => (
                <div key={player.id} className="bg-gray-700 p-2 rounded hover:bg-gray-600 transition-colors">
                  {editingId === player.id ? (
                      <div className="flex items-center gap-2">
                          <input 
                              type="text" 
                              value={editName} 
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 bg-gray-900 text-white p-1 rounded text-sm border border-soccer-500 outline-none w-full"
                              autoFocus
                          />
                           <select 
                                value={editPos}
                                onChange={(e) => setEditPos(e.target.value as Position)}
                                className="bg-gray-900 text-white p-1 rounded text-xs border border-gray-600 outline-none w-16"
                            >
                                {Object.values(Position).map(p => <option key={p} value={p}>{p.substring(0,3)}</option>)}
                            </select>
                          <div className="flex gap-1">
                              <button onClick={() => saveEditing(player.id)} className="p-1 bg-green-700 rounded hover:bg-green-600 text-white"><Check size={14}/></button>
                              <button onClick={cancelEditing} className="p-1 bg-red-700 rounded hover:bg-red-600 text-white"><X size={14}/></button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{player.name}</span>
                        {isAdmin && (
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => startEditing(player)} 
                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-2 rounded transition-all"
                                    title="Editar Jogador"
                                >
                                    <Pencil size={18} />
                                </button>
                                <button 
                                    onClick={() => handleDelete(player.id)} 
                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-2 rounded transition-all"
                                    title="Excluir Jogador"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                      </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};