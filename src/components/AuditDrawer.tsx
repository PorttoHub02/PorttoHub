import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpLeft, AlertTriangle, UserPlus, Download, Printer, Filter } from 'lucide-react';
import { MovementAuditLog } from '../types/access';

interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: MovementAuditLog[];
  condoName: string;
}

export const AuditDrawer: React.FC<AuditDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  condoName,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'all') return true;
    return log.type === filterType;
  });

  const exportCSV = () => {
    const headers = [
      'Data/Hora',
      'Tipo',
      'Nome',
      'Categoria',
      'Unidade',
      'Crachá',
      'Placa',
      'Operador',
      'Permanência (min)',
    ];
    const rows = filteredLogs.map((l) => [
      new Date(l.timestamp).toLocaleString('pt-BR'),
      l.type.toUpperCase(),
      `"${l.personName}"`,
      l.category,
      `"${l.unit}"`,
      l.badgeNumber || '-',
      l.vehiclePlate || '-',
      `"${l.operator}"`,
      l.durationMinutes || '-',
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_portaria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity"
    >
      <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Auditoria em Tempo Real</span>
              <span className="text-xs font-normal text-slate-500 font-mono">
                ({filteredLogs.length} registros)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
              {condoName}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={exportCSV}
              title="Exportar CSV"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              title="Imprimir Registro"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2 overflow-x-auto text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {[
            { id: 'all', label: 'Todos' },
            { id: 'entrada', label: 'Entradas' },
            { id: 'saida', label: 'Saídas' },
            { id: 'alerta_tempo', label: 'Alertas de Tempo' },
            { id: 'cadastro', label: 'Cadastros' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors font-medium ${
                filterType === f.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Log stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhuma movimentação registrada para este filtro.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const date = new Date(log.timestamp);
              const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const dateStr = date.toLocaleDateString('pt-BR');

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-xs flex items-start gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="pt-0.5">
                    {log.type === 'entrada' && (
                      <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                    )}
                    {log.type === 'saida' && (
                      <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <ArrowUpLeft className="w-4 h-4" />
                      </div>
                    )}
                    {log.type === 'alerta_tempo' && (
                      <div className="p-1.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    )}
                    {log.type === 'cadastro' && (
                      <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <UserPlus className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {log.personName}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                        {timeStr}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {log.unit}
                      </span>
                      {log.badgeNumber && (
                        <span>
                          · Crachá: <strong className="font-mono text-slate-800 dark:text-slate-200">#{log.badgeNumber}</strong>
                        </span>
                      )}
                      {log.vehiclePlate && (
                        <span>
                          · Placa: <strong className="font-mono text-slate-800 dark:text-slate-200">{log.vehiclePlate}</strong>
                        </span>
                      )}
                      {log.durationMinutes !== undefined && (
                        <span>
                          · Permanência: <strong className="font-mono text-slate-800 dark:text-slate-200">{log.durationMinutes} min</strong>
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-between">
                      <span>{dateStr} · Operador: {log.operator}</span>
                      {log.residentNotified && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          WhatsApp enviado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
