import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpLeft,
  MessageSquare,
  Car,
  UserCheck,
  Building2,
  HardHat,
  Users,
  PlusCircle,
  Sparkles,
  PhoneCall,
  Volume2,
} from 'lucide-react';
import { AccessPerson, AccessCategory, MovementAuditLog } from '../types/access';
import { soundManager } from '../utils/audio';
import { openWhatsAppNotification } from '../utils/whatsapp';

interface PrestadoresObrasProps {
  condoId: string;
  people: AccessPerson[];
  onUpdatePeople: (people: AccessPerson[]) => void;
  onAddAuditLog: (log: MovementAuditLog) => void;
  onOpenNewRegister: () => void;
}

type FilterView = 'all' | 'inside' | 'overdue' | 'prestadores' | 'visitantes' | 'expiring';

export const PrestadoresObras: React.FC<PrestadoresObrasProps> = ({
  condoId,
  people,
  onUpdatePeople,
  onAddAuditLog,
  onOpenNewRegister,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [selectedCategory, setSelectedCategory] = useState<AccessCategory | 'all'>('all');
  const [selectedDurationMap, setSelectedDurationMap] = useState<Record<string, number>>({});
  const [customBadgeMap, setCustomBadgeMap] = useState<Record<string, string>>({});
  const [autoNotifyWhatsApp, setAutoNotifyWhatsApp] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut to focus search input (e.g. press '/' or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || (e.ctrlKey && e.key === 'k')) &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Real-time ticker: forces re-render every 5 seconds to update countdown timers and overdue status
  const [, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((t) => t + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter people strictly belonging to current condominium
  const condoPeople = useMemo(() => {
    return people.filter((p) => p.condoId === condoId);
  }, [people, condoId]);

  // Compute live metrics for fast glance
  const stats = useMemo(() => {
    const insideList = condoPeople.filter((p) => p.currentStay !== undefined);
    const overdueList = insideList.filter((p) => {
      if (!p.currentStay) return false;
      const entered = new Date(p.currentStay.enteredAt).getTime();
      const limitMs = p.currentStay.maxHours * 3600 * 1000;
      return Date.now() > entered + limitMs;
    });
    const prestadoresInside = insideList.filter(
      (p) => p.category === 'prestador' || p.category === 'obra'
    );
    const visitantesInside = insideList.filter(
      (p) => p.category === 'visitante' || p.category === 'familia'
    );

    const todayStr = new Date().toISOString().split('T')[0];
    const expiringSoon = condoPeople.filter((p) => {
      if (!p.validUntil) return false;
      return p.validUntil <= todayStr;
    });

    return {
      total: condoPeople.length,
      insideCount: insideList.length,
      overdueCount: overdueList.length,
      prestadoresInsideCount: prestadoresInside.length,
      visitantesInsideCount: visitantesInside.length,
      expiringCount: expiringSoon.length,
    };
  }, [condoPeople]);

  // Clean normalizing helper for search
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  // PREDITIVE SEARCH & INSTANT FILTERING
  const filteredPeople = useMemo(() => {
    const queryNorm = normalize(searchQuery);

    return condoPeople.filter((p) => {
      // 1. Text Search across: Name, Document, Unit, Vehicle Plate, Company
      if (queryNorm) {
        const nameNorm = normalize(p.name);
        const docNorm = normalize(p.document);
        const unitNorm = normalize(p.unit);
        const plateNorm = normalize(p.vehiclePlate || '');
        const companyNorm = normalize(p.company || '');
        const residentNorm = normalize(p.residentName);

        const matches =
          nameNorm.includes(queryNorm) ||
          docNorm.includes(queryNorm) ||
          unitNorm.includes(queryNorm) ||
          plateNorm.includes(queryNorm) ||
          companyNorm.includes(queryNorm) ||
          residentNorm.includes(queryNorm);

        if (!matches) return false;
      }

      // 2. Quick Status Filters
      const isInside = p.currentStay !== undefined;
      const isOverdue =
        isInside &&
        Date.now() >
          new Date(p.currentStay!.enteredAt).getTime() +
            p.currentStay!.maxHours * 3600 * 1000;

      const todayStr = new Date().toISOString().split('T')[0];
      const isExpiring = p.validUntil ? p.validUntil <= todayStr : false;

      if (filterView === 'inside' && !isInside) return false;
      if (filterView === 'overdue' && !isOverdue) return false;
      if (filterView === 'prestadores' && p.category !== 'prestador' && p.category !== 'obra')
        return false;
      if (filterView === 'visitantes' && p.category !== 'visitante' && p.category !== 'familia')
        return false;
      if (filterView === 'expiring' && !isExpiring) return false;

      // 3. Category Filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [condoPeople, searchQuery, filterView, selectedCategory]);

  // Auto-suggest next badge number based on highest badge inside
  const getSuggestedBadge = (person: AccessPerson): string => {
    if (customBadgeMap[person.id]) return customBadgeMap[person.id];
    const isPrestador = person.category === 'prestador' || person.category === 'obra';
    if (!isPrestador) {
      return `VIS-${Math.floor(Math.random() * 20 + 1).toString().padStart(2, '0')}`;
    }
    const badgesInUse = condoPeople
      .map((p) => parseInt(p.currentStay?.badgeNumber || '0', 10))
      .filter((n) => !isNaN(n) && n > 0);
    const max = badgesInUse.length > 0 ? Math.max(...badgesInUse) : 10;
    return (max + 1).toString().padStart(3, '0');
  };

  // FAST-LANE 1-CLIQUE: REGISTRAR ENTRADA
  const handleFastEntry = (person: AccessPerson) => {
    const isPrestador = person.category === 'prestador' || person.category === 'obra';
    const duration = selectedDurationMap[person.id] || (isPrestador ? 2 : 8);
    const badge = customBadgeMap[person.id] || getSuggestedBadge(person);

    const nowIso = new Date().toISOString();

    const updated = people.map((p) => {
      if (p.id === person.id) {
        return {
          ...p,
          currentStay: {
            enteredAt: nowIso,
            badgeNumber: badge,
            maxHours: duration,
            operator: 'Portaria Principal',
            isOverdue: false,
          },
        };
      }
      return p;
    });

    onUpdatePeople(updated);

    // Audio chime
    soundManager.playEntry();

    // Audit log
    onAddAuditLog({
      id: `log-${Date.now()}`,
      personId: person.id,
      personName: person.name,
      category: person.category,
      condoId,
      type: 'entrada',
      timestamp: nowIso,
      badgeNumber: badge,
      unit: person.unit,
      vehiclePlate: person.vehiclePlate,
      operator: 'Portaria Principal',
      residentNotified: autoNotifyWhatsApp && Boolean(person.residentPhone),
    });

    // Optional WhatsApp dispatch
    if (autoNotifyWhatsApp && person.residentPhone) {
      openWhatsAppNotification(person, badge, duration);
    }
  };

  // FAST-LANE 1-CLIQUE: REGISTRAR SAÍDA
  const handleFastExit = (person: AccessPerson) => {
    if (!person.currentStay) return;

    const enteredTime = new Date(person.currentStay.enteredAt).getTime();
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - enteredTime) / (60 * 1000)));
    const badgeUsed = person.currentStay.badgeNumber;
    const nowIso = new Date().toISOString();

    const updated = people.map((p) => {
      if (p.id === person.id) {
        const { currentStay, ...rest } = p;
        return rest;
      }
      return p;
    });

    onUpdatePeople(updated);

    // Audio exit tone
    soundManager.playExit();

    // Audit log
    onAddAuditLog({
      id: `log-${Date.now()}`,
      personId: person.id,
      personName: person.name,
      category: person.category,
      condoId,
      type: 'saida',
      timestamp: nowIso,
      badgeNumber: badgeUsed,
      durationMinutes: elapsedMinutes,
      unit: person.unit,
      vehiclePlate: person.vehiclePlate,
      operator: 'Portaria Principal',
      residentNotified: false,
    });
  };

  // PRORROGAR TEMPO (+30 min ou +1 hora)
  const handleExtendStay = (person: AccessPerson, extraHours: number) => {
    if (!person.currentStay) return;

    const updated = people.map((p) => {
      if (p.id === person.id && p.currentStay) {
        return {
          ...p,
          currentStay: {
            ...p.currentStay,
            maxHours: p.currentStay.maxHours + extraHours,
            isOverdue: false,
          },
        };
      }
      return p;
    });

    onUpdatePeople(updated);
    soundManager.playEntry();
  };

  // Helper for computing countdown and color state
  const getStayCountdown = (stay: NonNullable<AccessPerson['currentStay']>) => {
    const entered = new Date(stay.enteredAt).getTime();
    const limitMs = stay.maxHours * 3600 * 1000;
    const expiryTime = entered + limitMs;
    const remainingMs = expiryTime - Date.now();
    const isOverdue = remainingMs <= 0;

    const absMs = Math.abs(remainingMs);
    const totalMinutes = Math.floor(absMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const formattedTime = `${hours > 0 ? `${hours}h ` : ''}${minutes}m`;

    // Percentage of time elapsed
    const elapsedMs = Date.now() - entered;
    const fractionRemaining = remainingMs / limitMs;

    let colorState: 'green' | 'yellow' | 'red' = 'green';
    if (isOverdue) {
      colorState = 'red';
    } else if (fractionRemaining < 0.25 || remainingMs < 15 * 60 * 1000) {
      colorState = 'yellow';
    }

    return {
      isOverdue,
      remainingText: isOverdue ? `Estourado há ${formattedTime}` : `Resta ${formattedTime}`,
      formattedTime,
      colorState,
      fractionRemaining,
      elapsedMinutes: Math.floor(elapsedMs / (60 * 1000)),
    };
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP CONTROL BAR: UNIVERSAL PREDICTIVE SEARCH (FOCAL POINT) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Universal Predictive Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Busca rápida: Nome, CPF/RG, Unidade (Casa 142), Placa (ABC-1234) ou Empresa..."
              className="w-full pl-11 pr-24 py-3 sm:py-3.5 text-sm sm:text-base bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-emerald-500 dark:focus:border-emerald-400 transition-all font-medium placeholder:text-slate-400"
              autoFocus
            />

            {/* Quick Clear or Keyboard Shortcut Indicator */}
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
              {searchQuery ? (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-2xs">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Fast WhatsApp toggle */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <label
              htmlFor="auto-whatsapp"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                id="auto-whatsapp"
                type="checkbox"
                checked={autoNotifyWhatsApp}
                onChange={(e) => setAutoNotifyWhatsApp(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>WhatsApp Automático</span>
              </span>
            </label>
          </div>
        </div>

        {/* 2. FAST TELEMETRY SHORTCUTS (SINGLE-PANE METRICS & STATUS FILTERS) */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          {/* Status Quick Selectors */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            <button
              onClick={() => {
                setFilterView('all');
                setSelectedCategory('all');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterView === 'all' && selectedCategory === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Todos</span>
              <span className="font-mono text-[11px] opacity-75">({stats.total})</span>
            </button>

            {/* Overdue Urgent Alert Button */}
            <button
              onClick={() => setFilterView('overdue')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterView === 'overdue'
                  ? 'bg-red-600 text-white font-bold shadow-xs ring-2 ring-red-400'
                  : stats.overdueCount > 0
                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-bold border border-red-300 dark:border-red-800 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Estourados</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-red-600 text-white font-bold">
                {stats.overdueCount}
              </span>
            </button>

            {/* Quem está dentro agora */}
            <button
              onClick={() => setFilterView('inside')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterView === 'inside'
                  ? 'bg-sky-600 text-white font-bold shadow-xs'
                  : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-900/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Dentro Agora</span>
              <span className="font-mono text-[11px] bg-sky-200 dark:bg-sky-900/80 px-1.5 py-0.2 rounded-full font-bold">
                {stats.insideCount}
              </span>
            </button>

            {/* Prestadores & Obras */}
            <button
              onClick={() => setFilterView('prestadores')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterView === 'prestadores'
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <HardHat className="w-3.5 h-3.5" />
              <span>Prestadores / Obras</span>
              <span className="font-mono text-[11px] opacity-75">
                ({stats.prestadoresInsideCount} dentro)
              </span>
            </button>

            {/* Visitantes & Família */}
            <button
              onClick={() => setFilterView('visitantes')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterView === 'visitantes'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Visitantes / Família</span>
              <span className="font-mono text-[11px] opacity-75">
                ({stats.visitantesInsideCount} dentro)
              </span>
            </button>

            {/* Vencendo hoje */}
            {stats.expiringCount > 0 && (
              <button
                onClick={() => setFilterView('expiring')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterView === 'expiring'
                    ? 'bg-amber-500 text-white font-bold'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold border border-amber-300 dark:border-amber-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Vencendo Hoje</span>
                <span className="font-mono text-[11px] bg-amber-200 dark:bg-amber-900 px-1.5 rounded-full font-bold">
                  {stats.expiringCount}
                </span>
              </button>
            )}
          </div>

          {/* Quick search match counter */}
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {searchQuery && (
              <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{filteredPeople.length} encontrado(s)</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* OVERDUE PERSISTENT ALARM BANNER (When any stay is exceeded) */}
      {stats.overdueCount > 0 && filterView !== 'overdue' && (
        <div className="p-3.5 rounded-xl bg-red-600 text-white shadow-lg flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Atenção Portaria: {stats.overdueCount} prestador(es) com tempo de permanência
                estourado!
              </p>
              <p className="text-xs text-red-100">
                Verifique a autorização com o morador ou solicite a saída imediata na guarita.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => soundManager.playAlarm()}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Testar alarme sonoro"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alarme</span>
            </button>
            <button
              onClick={() => setFilterView('overdue')}
              className="px-3.5 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              Filtrar Estourados
            </button>
          </div>
        </div>
      )}

      {/* 3. DYNAMIC LIST OF PEOPLE (HIGH PERFORMANCE TOUCH CARDS) */}
      {filteredPeople.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhuma pessoa ou veículo encontrado
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `Não há registros correspondentes a "${searchQuery}". Deseja cadastrar agora?`
              : 'Não há registros nesta categoria de visualização.'}
          </p>
          <button
            onClick={onOpenNewRegister}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cadastrar Pessoa Agora</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredPeople.map((person) => {
            const isInside = person.currentStay !== undefined;
            const stayInfo = person.currentStay ? getStayCountdown(person.currentStay) : null;
            const isPrestador = person.category === 'prestador' || person.category === 'obra';
            const selectedDuration =
              selectedDurationMap[person.id] || (isPrestador ? 2 : 8);
            const badgeValue =
              customBadgeMap[person.id] ||
              (person.currentStay ? person.currentStay.badgeNumber : getSuggestedBadge(person));

            // Card Border and Color coding
            let cardBg =
              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700';
            if (isInside) {
              if (stayInfo?.isOverdue) {
                cardBg =
                  'bg-red-50/70 dark:bg-red-950/30 border-red-500 dark:border-red-600 animate-urgent-border';
              } else if (stayInfo?.colorState === 'yellow') {
                cardBg =
                  'bg-amber-50/50 dark:bg-amber-950/25 border-amber-400 dark:border-amber-600';
              } else {
                cardBg =
                  'bg-sky-50/40 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800';
              }
            } else if (person.validUntil && person.validUntil <= new Date().toISOString().split('T')[0]) {
              cardBg =
                'bg-amber-50/30 dark:bg-amber-950/15 border-amber-300 dark:border-amber-700';
            }

            return (
              <div
                key={person.id}
                className={`relative rounded-xl border-2 p-4 transition-all shadow-xs flex flex-col justify-between ${cardBg}`}
              >
                {/* Top Section: Category Badge, Name, Status & Identity */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Quiet unboxed metadata header */}
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1">
                        <span
                          className={`font-bold ${
                            person.category === 'prestador'
                              ? 'text-amber-600 dark:text-amber-400'
                              : person.category === 'obra'
                              ? 'text-orange-600 dark:text-orange-400'
                              : person.category === 'visitante'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {person.category === 'obra'
                            ? 'Obra / Reforma'
                            : person.category === 'prestador'
                            ? 'Prestador de Serviço'
                            : person.category === 'visitante'
                            ? 'Visitante'
                            : 'Familiar'}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono">
                          {person.documentType}: {person.document}
                        </span>
                      </div>

                      {/* Person Name */}
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
                        <span>{person.name}</span>
                        {person.company && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                            ({person.company})
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Status Indicator */}
                    <div className="shrink-0 text-right">
                      {isInside ? (
                        <div className="flex flex-col items-end">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold font-mono uppercase tracking-wider flex items-center gap-1 ${
                              stayInfo?.isOverdue
                                ? 'bg-red-600 text-white animate-pulse'
                                : stayInfo?.colorState === 'yellow'
                                ? 'bg-amber-500 text-white'
                                : 'bg-sky-600 text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                            <span>{stayInfo?.isOverdue ? 'TEMPO ESTOURADO' : 'DENTRO'}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            Crachá: <strong className="text-slate-900 dark:text-white font-bold">#{person.currentStay?.badgeNumber}</strong>
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          FORA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Context Grid: Unit, Resident, Vehicle Plate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Destino: <strong className="font-bold text-slate-900 dark:text-white">{person.unit}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Morador: <strong>{person.residentName}</strong>
                      </span>
                    </div>

                    {person.vehiclePlate && (
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Car className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono uppercase font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                          {person.vehiclePlate}
                        </span>
                        {person.vehicleModel && (
                          <span className="text-[11px] text-slate-500 truncate">
                            {person.vehicleModel}
                          </span>
                        )}
                      </div>
                    )}

                    {person.notes && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate sm:col-span-2">
                        Obs: {person.notes}
                      </div>
                    )}
                  </div>

                  {/* LIVE REAL-TIME COUNTDOWN TIMER (If Inside) */}
                  {isInside && stayInfo && (
                    <div
                      className={`mt-3 p-2.5 rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-2 ${
                        stayInfo.isOverdue
                          ? 'bg-red-500/15 border-red-500/40 text-red-950 dark:text-red-200'
                          : stayInfo.colorState === 'yellow'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-950 dark:text-amber-200'
                          : 'bg-sky-500/10 border-sky-400/30 text-sky-950 dark:text-sky-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock
                          className={`w-4 h-4 ${
                            stayInfo.isOverdue
                              ? 'text-red-600 dark:text-red-400 animate-spin'
                              : stayInfo.colorState === 'yellow'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        />
                        <div className="text-xs">
                          <span className="font-bold">{stayInfo.remainingText}</span>
                          <span className="opacity-75 font-mono text-[11px] ml-1.5">
                            (Entrada: {new Date(person.currentStay!.enteredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      </div>

                      {/* Quick extension actions */}
                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <button
                          onClick={() => handleExtendStay(person, 0.5)}
                          title="Prorrogar 30 minutos com autorização"
                          className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-[11px] transition-colors"
                        >
                          +30m
                        </button>
                        <button
                          onClick={() => handleExtendStay(person, 1)}
                          title="Prorrogar 1 hora com autorização"
                          className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-[11px] transition-colors"
                        >
                          +1h
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PRE-ENTRY CONFIGURATION BAR (When Outside & Prestador) */}
                  {!isInside && isPrestador && (
                    <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>Tempo Limite</span>
                        <span>Crachá</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {/* Duration Chips: 1h, 2h, 4h, 8h */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 4, 8].map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() =>
                                setSelectedDurationMap((prev) => ({ ...prev, [person.id]: h }))
                              }
                              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                selectedDuration === h
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {h}h
                            </button>
                          ))}
                        </div>

                        {/* Inline Badge Number Input */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-400">#</span>
                          <input
                            type="text"
                            value={badgeValue}
                            onChange={(e) =>
                              setCustomBadgeMap((prev) => ({
                                ...prev,
                                [person.id]: e.target.value,
                              }))
                            }
                            className="w-16 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-md focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                            placeholder="042"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Section: FAST-LANE 1-CLIQUE ACTION BUTTONS */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {/* Secondary Actions: WhatsApp / Call Morador */}
                  <div className="flex items-center gap-1.5">
                    {person.residentPhone && (
                      <button
                        onClick={() => openWhatsAppNotification(person, badgeValue, selectedDuration)}
                        title={`Enviar WhatsApp para ${person.residentName}`}
                        className="p-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center justify-center min-w-[42px] min-h-[42px]"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}

                    {person.phone && (
                      <a
                        href={`tel:${person.phone}`}
                        title={`Ligar para ${person.name}`}
                        className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors flex items-center justify-center min-w-[42px] min-h-[42px]"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {/* Primary 1-Click Action Button */}
                  <div className="flex-1 max-w-[220px]">
                    {isInside ? (
                      <button
                        onClick={() => handleFastExit(person)}
                        className="w-full py-2.5 px-3 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 active:scale-98 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <ArrowUpLeft className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                        <span>Registrar Saída</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFastEntry(person)}
                        className="w-full py-2.5 px-3 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Dar Entrada (1-Clique)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
