import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  UserCheck,
  CreditCard,
  Car,
  Home,
  ShieldCheck,
  Building2,
  HardHat,
  ArrowRight,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getCondominioAtivoId } from '../services/condominioService';

export type CriterioBusca = 'CPF' | 'RG' | 'Placa' | 'Nome' | 'Unidade';

interface MenuPrincipalBuscaAcessoProps {
  condominioId?: string;
  usuarioLogado?: any;
  onNovoAcesso: (dadosIniciais?: { criterio?: CriterioBusca; valor?: string }) => void;
  onSelecionarCadastro?: (cadastro: any) => void;
  onNavegarModulo?: (modulo: string) => void;
}

export default function MenuPrincipalBuscaAcesso({
  condominioId,
  usuarioLogado,
  onNovoAcesso,
  onSelecionarCadastro,
  onNavegarModulo,
}: MenuPrincipalBuscaAcessoProps) {
  const [criterioAtivo, setCriterioAtivo] = useState<CriterioBusca>('Nome');
  const [termoBusca, setTermoBusca] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const idCondominioEfetivo = condominioId || getCondominioAtivoId(usuarioLogado);

  const criterios: { id: CriterioBusca; rotulo: string; icone: React.ComponentType<{ className?: string }>; placeholderExemplo: string }[] = [
    { id: 'CPF', rotulo: 'CPF', icone: CreditCard, placeholderExemplo: 'Ex: 000.000.000-00' },
    { id: 'RG', rotulo: 'RG', icone: ShieldCheck, placeholderExemplo: 'Ex: 00.000.000-0' },
    { id: 'Placa', rotulo: 'Placa', icone: Car, placeholderExemplo: 'Ex: ABC-1234 ou BRA2E19' },
    { id: 'Nome', rotulo: 'Nome', icone: UserCheck, placeholderExemplo: 'Ex: Carlos Silva' },
    { id: 'Unidade', rotulo: 'Unidade', icone: Home, placeholderExemplo: 'Ex: Casa 142 ou Apt 84' },
  ];

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPainelAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Atalho de teclado '/' para focar na busca imediatamente
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setPainelAberto(true);
      } else if (e.key === 'Escape' && painelAberto) {
        setPainelAberto(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [painelAberto]);

  // Busca preditiva em tempo real conforme digitação
  useEffect(() => {
    if (!termoBusca.trim() || !idCondominioEfetivo) {
      setResultados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        const termo = termoBusca.trim().toLowerCase();
        let query = supabase
          .from('prestadores')
          .select('id, nome_completo, nome_profissional, documento, empresa, unidade, bloco, placa_veiculo, perfil_acesso, status_acesso')
          .eq('condominio_id', idCondominioEfetivo)
          .limit(8);

        // Aplica filtro específico dependendo da aba ativa
        if (criterioAtivo === 'CPF' || criterioAtivo === 'RG') {
          query = query.ilike('documento', `%${termo}%`);
        } else if (criterioAtivo === 'Placa') {
          query = query.ilike('placa_veiculo', `%${termo}%`);
        } else if (criterioAtivo === 'Unidade') {
          query = query.ilike('unidade', `%${termo}%`);
        } else {
          // Nome ou Geral
          query = query.or(`nome_completo.ilike.%${termo}%,nome_profissional.ilike.%${termo}%,empresa.ilike.%${termo}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
          setResultados(data);
        } else {
          setResultados([]);
        }
      } catch (err) {
        console.warn('Erro na busca preditiva:', err);
        setResultados([]);
      } finally {
        setCarregando(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [termoBusca, criterioAtivo, idCondominioEfetivo]);

  const criterioConfigAtual = useMemo(() => {
    return criterios.find((c) => c.id === criterioAtivo) || criterios[3];
  }, [criterioAtivo]);

  const handleSelecionarItem = (item: any) => {
    setPainelAberto(false);
    if (onSelecionarCadastro) {
      onSelecionarCadastro(item);
    } else if (onNavegarModulo) {
      onNavegarModulo('prestadores');
    }
  };

  const handleCriarNovoAcesso = () => {
    setPainelAberto(false);
    onNovoAcesso({
      criterio: criterioAtivo,
      valor: termoBusca.trim() || undefined
    });
  };

  return (
    <div ref={containerRef} className="relative w-full z-20">
      {/* ========================================================================= */}
      {/* 1. ABAS DE FILTRO DE PESQUISA (CPF, RG, PLACA, NOME, UNIDADE) */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-900/90 dark:bg-slate-900/95 rounded-t-2xl border-t border-x border-slate-700/80 shadow-xs overflow-x-auto">
        {criterios.map((crit) => {
          const Icone = crit.icone;
          const ativo = criterioAtivo === crit.id;
          return (
            <button
              key={crit.id}
              type="button"
              onClick={() => {
                setCriterioAtivo(crit.id);
                inputRef.current?.focus();
                setPainelAberto(true);
              }}
              className={`flex-1 min-w-[70px] sm:min-w-[85px] py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap select-none ${
                ativo
                  ? 'bg-emerald-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Icone className={`w-3.5 h-3.5 ${ativo ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{crit.rotulo}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. CAMPO DE BUSCA (LOGO ABAIXO DAS ABAS) */}
      {/* ========================================================================= */}
      <div className="relative bg-white dark:bg-slate-900 rounded-b-2xl border-b border-x border-slate-300 dark:border-slate-700/80 shadow-md transition-all">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            onFocus={() => setPainelAberto(true)}
            placeholder="Digite para buscar um cadastro"
            className="w-full bg-transparent text-slate-900 dark:text-white text-sm sm:text-base font-semibold pl-11 pr-24 py-3 sm:py-3.5 rounded-b-2xl focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          <div className="absolute right-3 flex items-center gap-1.5">
            {termoBusca ? (
              <button
                type="button"
                onClick={() => {
                  setTermoBusca('');
                  inputRef.current?.focus();
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-2xs">
                /
              </kbd>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PAINEL DE ORIENTAÇÃO E AÇÃO (DROPDOWN SUSPENSO) */}
      {/* ========================================================================= */}
      {painelAberto && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Mensagem Orientativa para o Operador & Botão de Ação */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-850/90 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  Digite para buscar antes de registrar um novo acesso
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Buscando pelo critério: <strong className="text-emerald-600 dark:text-emerald-400">{criterioConfigAtual.rotulo}</strong> ({criterioConfigAtual.placeholderExemplo})
                </p>
              </div>
            </div>

            {/* Botão de ação interativo com ícone de adição e texto "+ Novo acesso" */}
            <button
              type="button"
              onClick={handleCriarNovoAcesso}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer min-h-[42px] shrink-0"
              title="Registrar novo acesso"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Novo acesso</span>
            </button>
          </div>

          {/* Resultados da Busca em Tempo Real */}
          {carregando ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Buscando cadastros no sistema...</span>
            </div>
          ) : termoBusca.trim() && resultados.length > 0 ? (
            <div className="p-2 divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Resultados encontrados ({resultados.length})</span>
                <span className="text-[10px] lowercase font-normal">Clique para ver detalhes</span>
              </div>
              {resultados.map((item) => {
                const ehVisitante = item.perfil_acesso === 'autorizado';
                const estaDentro = item.status_acesso === 'DENTRO' || item.status_acesso === 'EM_ANDAMENTO';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelecionarItem(item)}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                        ehVisitante ? 'bg-purple-600' : 'bg-blue-600'
                      }`}>
                        {ehVisitante ? <UserCheck className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.nome_profissional || item.nome_completo}
                          </h4>
                          {estaDentro && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Dentro
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {item.unidade && (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Destino: {item.unidade} {item.bloco || ''}
                            </span>
                          )}
                          {item.documento && (
                            <span>• Doc: <strong className="font-mono">{item.documento}</strong></span>
                          )}
                          {item.placa_veiculo && (
                            <span>• Placa: <strong className="font-mono uppercase">{item.placa_veiculo}</strong></span>
                          )}
                          {item.empresa && (
                            <span className="truncate">• {item.empresa}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-emerald-500 transition-colors">
                      <span className="text-xs font-semibold hidden sm:inline">Acessar</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : termoBusca.trim() && resultados.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Nenhum cadastro encontrado para <strong>"{termoBusca}"</strong> com critério <strong>{criterioConfigAtual.rotulo}</strong>.
              </p>
              <button
                type="button"
                onClick={handleCriarNovoAcesso}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Cadastrar como Novo Acesso</span>
              </button>
            </div>
          ) : (
            <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Selecione a aba desejada (CPF, RG, Placa, Nome, Unidade) e comece a digitar.</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-400">
                ESC para fechar
              </kbd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
