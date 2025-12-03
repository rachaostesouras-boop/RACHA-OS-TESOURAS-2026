import React, { useState, useEffect, useRef } from 'react';
import { Player, TournamentData, Match } from './types';
import { getStoredPlayers, saveStoredPlayers, getStoredTournament, saveStoredTournament, archiveTournament, generateId, PLAYERS_KEY, CURRENT_TOURNAMENT_KEY } from './utils/storage';
import { PlayerManager } from './components/PlayerManager';
import { TeamManager } from './components/TeamManager';
import { TournamentBracket } from './components/TournamentBracket';
import { Standings } from './components/Standings';
import { Rankings } from './components/Rankings';
import { TournamentSummary } from './components/TournamentSummary';
import { Trophy, Users, Shield, BarChart2, Table, ClipboardList, Lock, Unlock, LogIn, X, CheckCircle, AlertTriangle, Check, AlertCircle, ArrowRight } from 'lucide-react';

export default function App() {
  // Welcome Screen State
  const [showWelcome, setShowWelcome] = useState(true);

  const [activeTab, setActiveTab] = useState<'players' | 'teams' | 'tournament' | 'standings' | 'ranking' | 'summary'>('players');
  
  // Lazy initialization from storage
  const [players, setPlayers] = useState<Player[]>(() => getStoredPlayers());
  const [tournament, setTournament] = useState<TournamentData | null>(() => getStoredTournament());
  
  // Auth State
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Confirmation Modal State
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);

  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // Refs to track first render to avoid initial save notifications
  const isFirstRenderPlayers = useRef(true);
  const isFirstRenderTournament = useRef(true);

  // Helper to show notification
  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => {
          setNotification(null);
      }, 3000);
  };

  // Load Session Logic
  useEffect(() => {
    // Check session storage for login persistence
    const sessionAdmin = sessionStorage.getItem('racha_is_admin');
    if (sessionAdmin === 'true') setIsAdmin(true);
  }, []);

  // Real-time synchronization across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PLAYERS_KEY) {
        setPlayers(getStoredPlayers());
      }
      if (e.key === CURRENT_TOURNAMENT_KEY) {
        setTournament(getStoredTournament());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Persistence with Notification
  useEffect(() => {
    if (isFirstRenderPlayers.current) {
        isFirstRenderPlayers.current = false;
        return;
    }
    const success = saveStoredPlayers(players);
    if (success) {
        showNotification('Jogadores salvos com sucesso', 'success');
    } else {
        showNotification('Erro ao salvar jogadores', 'error');
    }
  }, [players]);

  useEffect(() => {
    if (isFirstRenderTournament.current) {
        isFirstRenderTournament.current = false;
        return;
    }
    const success = saveStoredTournament(tournament);
    // Don't show notification for null (deletion/clearing) if needed, but here it's fine.
    // If tournament is null it means it was cleared, usually during archiving which has its own flow
    if (success) {
        if (tournament) {
            showNotification('Torneio salvo com sucesso', 'success');
        } 
        // We skip "Torneio salvo" when it is null because that usually happens during archiving which has its own flow
    } else {
        showNotification('Erro ao salvar dados do torneio', 'error');
    }
  }, [tournament]);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Simple hardcoded password for demonstration
      if (passwordInput === 'admin26') {
          setIsAdmin(true);
          sessionStorage.setItem('racha_is_admin', 'true');
          setShowLoginModal(false);
          setPasswordInput('');
          setLoginError('');
      } else {
          setLoginError('Senha incorreta');
      }
  };

  const handleLogout = () => {
      setIsAdmin(false);
      sessionStorage.removeItem('racha_is_admin');
  };

  const handleDeletePlayer = (id: string) => {
      // 1. Remove player from global list
      setPlayers(prev => prev.filter(p => p.id !== id));

      // 2. If there is a draft tournament, remove the player from any teams to avoid "ghost" players
      if (tournament && tournament.status === 'draft') {
          const updatedTeams = tournament.teams.map(t => ({
              ...t,
              playerIds: t.playerIds.filter(pid => pid !== id)
          }));
          
          // Only update tournament if something changed
          const hasChanges = JSON.stringify(updatedTeams) !== JSON.stringify(tournament.teams);
          if (hasChanges) {
              setTournament({ ...tournament, teams: updatedTeams });
          }
      }
  };

  const startTournament = () => {
    if (!tournament) return;

    // Generate Schedule Logic
    const teamIds = tournament.teams.map(t => t.id);
    let matches: Match[] = [];

    // Prompt requested specific ordering
    if (tournament.teamCount === 5) {
        const pairings = [
            [0, 1], [3, 2], [4, 0], [1, 3], [2, 4], 
            [3, 0], [2, 1], [4, 3], [0, 2], [1, 4]
        ];

        matches = pairings.map((pair, idx) => ({
            id: generateId(),
            round: idx + 1,
            homeTeamId: teamIds[pair[0]],
            awayTeamId: teamIds[pair[1]],
            homeScore: 0,
            awayScore: 0,
            finished: false,
            events: [],
            phase: 'group'
        }));

    } else {
        const pairings = [
            [0, 1], [3, 2], [2, 0], [1, 3], [0, 3], [1, 2]
        ];

        matches = pairings.map((pair, idx) => ({
            id: generateId(),
            round: idx + 1,
            homeTeamId: teamIds[pair[0]],
            awayTeamId: teamIds[pair[1]],
            homeScore: 0,
            awayScore: 0,
            finished: false,
            events: [],
            phase: 'group'
        }));
    }

    setTournament({ ...tournament, status: 'active', matches });
    setActiveTab('tournament');
  };

  const handleRequestFinish = () => {
    if (!tournament) return;
    setShowFinishModal(true);
  }

  const handleConfirmFinish = () => {
    if (!tournament) return;

    // 1. Attempt to archive
    const success = archiveTournament(tournament);
    
    if (success) {
        // 2. Clear current tournament state
        setTournament(null);
        setShowFinishModal(false);
        showNotification('Torneio arquivado com sucesso!', 'success');
        
        // 3. Switch to Summary tab
        setTimeout(() => {
            setActiveTab('summary');
            window.scrollTo(0, 0);
        }, 100);
    } else {
        alert("Erro ao salvar histórico. Tente liberar espaço no navegador.");
        showNotification('Erro ao arquivar torneio', 'error');
        setShowFinishModal(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'players':
        return <PlayerManager players={players} setPlayers={setPlayers} onDeletePlayer={handleDeletePlayer} isAdmin={isAdmin} />;
      case 'teams':
        return <TeamManager 
          players={players} 
          tournament={tournament} 
          setTournament={setTournament} 
          startTournament={startTournament}
          isAdmin={isAdmin}
        />;
      case 'tournament':
        return tournament && tournament.status !== 'draft' ? (
          <div className="pb-24">
             <TournamentBracket tournament={tournament} players={players} updateTournament={setTournament} isAdmin={isAdmin} />
             
             {isAdmin && (
                 <div className="p-6 flex justify-center mt-10 border-t border-gray-800 bg-gray-900/50">
                     <button 
                        onClick={handleRequestFinish} 
                        className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white border-2 border-red-800 px-10 py-5 rounded-xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all transform hover:scale-105 hover:shadow-red-900/20"
                     >
                         <CheckCircle size={28} /> ENCERRAR TORNEIO
                     </button>
                 </div>
             )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">Configure os times e inicie o torneio na aba "Times".</p>
            <button onClick={() => setActiveTab('teams')} className="text-soccer-500 underline">Ir para Times</button>
          </div>
        );
      case 'standings':
         return tournament && tournament.status !== 'draft' ? (
            <Standings tournament={tournament} />
         ) : <div className="text-center p-8 text-gray-500">Torneio não iniciado.</div>;
      case 'ranking':
          return tournament ? (
              <Rankings tournament={tournament} players={players} />
          ) : <div className="text-center p-8 text-gray-500">Inicie um torneio ou veja o histórico anual.</div>;
      case 'summary':
          return <TournamentSummary players={players} isAdmin={isAdmin} />;
    }
  };

  // --- WELCOME SCREEN RENDER ---
  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-4 text-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-soccer-900 opacity-90 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517466787929-bc90951d6428?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-20 z-0"></div>
        
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-700 max-w-4xl mx-auto">
           {/* Logo/Icon */}
           <div className="mb-8 relative">
              <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full"></div>
              <Trophy size={80} className="text-yellow-500 relative z-10 drop-shadow-2xl" />
           </div>

           <div className="space-y-2 mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-400 tracking-widest uppercase">
                Bem Vindo ao
              </h2>
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white drop-shadow-2xl leading-none">
                RACHA <span className="text-soccer-500">OS TESOURAS</span>
              </h1>
              <div className="text-4xl md:text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
                2026
              </div>
           </div>

           <button
             onClick={() => setShowWelcome(false)}
             className="group relative px-8 py-5 bg-soccer-600 hover:bg-soccer-500 text-white font-black text-xl md:text-2xl rounded-2xl shadow-2xl transition-all hover:scale-105 hover:shadow-soccer-500/20 border-b-4 border-soccer-800 active:border-b-0 active:translate-y-1"
           >
             <span className="flex items-center gap-3">
               ENTRAR NO SISTEMA 
               <ArrowRight className="group-hover:translate-x-1 transition-transform" strokeWidth={3} />
             </span>
           </button>
           
           <div className="mt-12 flex flex-col items-center gap-2 opacity-60">
              <Shield size={24} className="text-gray-500" />
              <p className="text-gray-500 text-sm font-medium uppercase tracking-widest">Gestão Profissional de Torneios</p>
           </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans relative">
      {/* Notification Toast */}
      {notification && (
          <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border animate-in slide-in-from-top-2 duration-300 ${
              notification.type === 'success' 
              ? 'bg-green-900/90 border-green-500 text-green-100' 
              : 'bg-red-900/90 border-red-500 text-red-100'
          }`}>
              {notification.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
              <span className="font-bold text-sm">{notification.message}</span>
              <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75"><X size={16} /></button>
          </div>
      )}

      {/* Header */}
      <header className="bg-soccer-900 p-3 md:p-4 shadow-lg border-b border-soccer-800 sticky top-0 z-20 flex justify-between items-center gap-2">
        {/* Empty div for layout balance on large screens, hidden on small */}
        <div className="hidden md:block w-32"></div>
        
        <h1 className="text-lg md:text-2xl font-black italic text-center tracking-tighter text-white drop-shadow-md flex-1 md:flex-none">
          <span className="text-soccer-500">RACHA</span> OS TESOURAS 2026
        </h1>
        
        <div className="flex justify-end md:w-32">
            {isAdmin ? (
                <button 
                    onClick={handleLogout} 
                    className="flex items-center gap-1 md:gap-2 bg-red-900/80 hover:bg-red-800 text-red-100 px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold border border-red-700 transition-all shadow-md" 
                    title="Sair do modo Admin"
                >
                    <Unlock size={14} className="md:w-4 md:h-4" />
                    <span>SAIR</span>
                </button>
            ) : (
                <button 
                    onClick={() => setShowLoginModal(true)} 
                    className="flex items-center gap-1 md:gap-2 bg-gray-900 hover:bg-gray-800 text-soccer-400 px-3 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold border border-soccer-700 transition-all shadow-md ring-1 ring-soccer-900/50" 
                    title="Entrar como Admin"
                >
                    <Lock size={14} className="md:w-4 md:h-4" />
                    <span>LOGIN</span>
                </button>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Banner for View Mode */}
        {!isAdmin && (
            <div className="bg-blue-900/30 text-blue-200 text-[10px] md:text-xs text-center py-1 border-b border-blue-900/50 uppercase tracking-wider font-semibold">
                Modo Visitante (Apenas Visualização)
            </div>
        )}
        <div className="max-w-5xl mx-auto w-full">
            {renderContent()}
        </div>
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><LogIn /> Área Restrita</h3>
                    <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-white"><X /></button>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1 font-bold">Senha de Administrador</label>
                        <input 
                            type="password" 
                            className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white focus:border-soccer-500 focus:ring-1 focus:ring-soccer-500 outline-none transition-all"
                            autoFocus
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Digite a senha..."
                        />
                        {loginError && <p className="text-red-400 text-sm mt-2 font-bold bg-red-900/20 p-2 rounded border border-red-900/50">{loginError}</p>}
                    </div>
                    <button type="submit" className="w-full bg-soccer-600 hover:bg-soccer-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
                        ACESSAR SISTEMA
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Finish Tournament Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="bg-yellow-500/10 p-4 rounded-full mb-4">
                        <AlertTriangle size={48} className="text-yellow-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Encerrar Torneio?</h3>
                    <p className="text-gray-400 leading-relaxed">
                        Esta ação irá <span className="text-white font-bold">finalizar o torneio atual</span> e arquivar todos os dados na Súmula.
                    </p>
                    <div className="mt-4 bg-red-900/20 border border-red-900/50 p-3 rounded text-sm text-red-200 font-bold w-full">
                        ⚠️ Esta ação não pode ser desfeita.
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowFinishModal(false)} 
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirmFinish} 
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={20} /> Finalizar Torneio
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Mobile-first Tab Bar */}
      <nav className="bg-gray-800 border-t border-gray-700 sticky bottom-0 z-20 w-full overflow-x-auto">
        <div className="flex justify-between items-center max-w-5xl mx-auto min-w-[350px]">
          <TabButton icon={<Users />} label="Jogadores" isActive={activeTab === 'players'} onClick={() => setActiveTab('players')} />
          <TabButton icon={<Shield />} label="Times" isActive={activeTab === 'teams'} onClick={() => setActiveTab('teams')} />
          <TabButton icon={<Trophy />} label="Torneio" isActive={activeTab === 'tournament'} onClick={() => setActiveTab('tournament')} />
          <TabButton icon={<Table />} label="Classif." isActive={activeTab === 'standings'} onClick={() => setActiveTab('standings')} />
          <TabButton icon={<BarChart2 />} label="Ranking" isActive={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')} />
          <TabButton icon={<ClipboardList />} label="Súmula" isActive={activeTab === 'summary'} onClick={() => setActiveTab('summary')} />
        </div>
      </nav>
    </div>
  );
}

const TabButton: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-3 px-2 w-full min-w-[60px] transition-colors duration-200 ${
      isActive ? 'text-soccer-500 bg-gray-800' : 'text-gray-500 hover:text-gray-300'
    }`}
  >
    <div className={`mb-1 ${isActive ? 'scale-110' : ''} transition-transform`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
    </div>
    <span className="text-[9px] uppercase font-bold tracking-wide">{label}</span>
  </button>
);