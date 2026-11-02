import React, { useState, useEffect } from 'react';
import { Shield, Volume2, VolumeX, Moon, Sun, Clock, Building, History, Plus } from 'lucide-react';
import { Condominium } from '../types/access';
import { soundManager } from '../utils/audio';

interface HeaderBarProps {
  condominiums: Condominium[];
  currentCondo: Condominium;
  onSelectCondo: (condo: Condominium) => void;
  onOpenRegister: () => void;
  onOpenAudit: () => void;
  auditCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  condominiums,
  currentCondo,
  onSelectCondo,
  onOpenRegister,
  onOpenAudit,
  auditCount,
  darkMode,
  onToggleDarkMode,
}) => {
  const [soundActive, setSoundActive] = useState(soundManager.isEnabled());
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSound = () => {
    const newState = soundManager.toggle();
    setSoundActive(newState);
    if (newState) {
      soundManager.playEntry();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Brand & Condominium Switcher */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                Portto<span className="text-emerald-600 dark:text-emerald-400">Hub</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                Portaria Guarita OS
              </span>
            </div>
          </div>

          {/* Condominium selector */}
          <div className="relative hidden md:flex items-center">
            <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={currentCondo.id}
              onChange={(e) => {
                const found = condominiums.find((c) => c.id === e.target.value);
                if (found) onSelectCondo(found);
              }}
              className="pl-8 pr-7 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500 appearance-none"
            >
              {condominiums.map((condo) => (
                <option key={condo.id} value={condo.id}>
                  {condo.name} ({condo.unitsCount} unid.)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zone 2: Fast Portaria Telemetry & Quick Toggles */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          {/* Live Clock with seconds */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-mono tabular-nums font-bold">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{currentTime || '00:00:00'}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={soundActive ? 'Som da portaria ligado (clique para mutar)' : 'Som mutado (clique para ativar)'}
            className={`p-2 rounded-lg transition-colors border ${
              soundActive
                ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
          >
            {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={darkMode ? 'Modo Guarita Diurno' : 'Modo Guarita Noturno (Anti-Ofuscamento)'}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>

        {/* Zone 3: Primary Fast-Lane Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAudit}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 min-h-[40px]"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Auditoria</span>
            <span className="text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
              {auditCount}
            </span>
          </button>

          <button
            onClick={onOpenRegister}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-lg shadow-sm transition-all flex items-center gap-1.5 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">+ Novo Cadastro</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* Mobile Condominium Switcher */}
      <div className="md:hidden px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <select
          value={currentCondo.id}
          onChange={(e) => {
            const found = condominiums.find((c) => c.id === e.target.value);
            if (found) onSelectCondo(found);
          }}
          className="w-full text-xs font-medium bg-transparent text-slate-800 dark:text-slate-200 focus:outline-hidden"
        >
          {condominiums.map((condo) => (
            <option key={condo.id} value={condo.id}>
              {condo.name} ({condo.city})
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
