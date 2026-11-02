import React, { useState } from 'react';
import { X, UserPlus, ShieldCheck, Car, Building2, Phone, FileText } from 'lucide-react';
import { AccessCategory, AccessPerson } from '../types/access';

interface QuickRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  condoId: string;
  onSave: (person: AccessPerson, enterImmediately: boolean, badge?: string, hours?: number) => void;
}

export const QuickRegisterModal: React.FC<QuickRegisterModalProps> = ({
  isOpen,
  onClose,
  condoId,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccessCategory>('prestador');
  const [document, setDocument] = useState('');
  const [unit, setUnit] = useState('');
  const [residentName, setResidentName] = useState('');
  const [residentPhone, setResidentPhone] = useState('');
  const [company, setCompany] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [notes, setNotes] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('050');
  const [maxHours, setMaxHours] = useState<number>(2);

  if (!isOpen) return null;

  const handleSubmit = (enterImmediately: boolean) => {
    if (!name.trim() || !unit.trim()) {
      alert('Por favor, preencha ao menos Nome e Unidade.');
      return;
    }

    const newPerson: AccessPerson = {
      id: `p-${Date.now()}`,
      condoId,
      name: name.trim(),
      category,
      document: document.trim() || 'Não informado',
      documentType: document.length > 12 ? 'CPF' : 'RG',
      unit: unit.trim(),
      residentName: residentName.trim() || 'Morador Responsável',
      residentPhone: residentPhone.trim(),
      company: company.trim() || undefined,
      vehiclePlate: vehiclePlate.trim().toUpperCase() || undefined,
      vehicleModel: vehicleModel.trim() || undefined,
      notes: notes.trim() || undefined,
      validUntil: new Date(Date.now() + 30 * 86400 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };

    onSave(newPerson, enterImmediately, badgeNumber, maxHours);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cadastro Expresso de Portaria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registro rápido em menos de 30 segundos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
              Tipo de Acesso
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'prestador', label: 'Prestador', desc: 'Serviço Avulso' },
                  { id: 'obra', label: 'Obra / Reforma', desc: 'Construção' },
                  { id: 'visitante', label: 'Visitante', desc: 'Social' },
                  { id: 'familia', label: 'Familiar', desc: 'Acesso Livre' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2.5 text-left rounded-lg border transition-all text-xs ${
                    category === cat.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-semibold shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm">{cat.label}</div>
                  <div className="text-[11px] opacity-75">{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Ferreira dos Santos"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                CPF ou RG
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="Ex: 000.000.000-00"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unidade / Casa de Destino *
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ex: Casa 142 ou Bloco 3 Apt 42"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Morador Responsável
              </label>
              <input
                type="text"
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                placeholder="Ex: Dra. Helena Vasconcelos"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            {(category === 'prestador' || category === 'obra') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Empresa / Razão Social
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Ex: Claro Fibra, Silva Pinturas"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                WhatsApp do Morador (Para aviso)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={residentPhone}
                  onChange={(e) => setResidentPhone(e.target.value)}
                  placeholder="Ex: 11987654321"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Placa do Veículo
              </label>
              <div className="relative">
                <Car className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="Ex: BRA2E19 ou ABC-1234"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono uppercase font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Modelo / Cor do Veículo
              </label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Ex: Fiorino Branca, Corolla Preto"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações de Portaria
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Autorizado via interfone às 14:10"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Quick immediate entry config */}
          {(category === 'prestador' || category === 'obra') && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60 rounded-lg space-y-2">
              <div className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center justify-between">
                <span>Parâmetros de Entrada Imediata</span>
                <span className="text-[11px] font-normal text-sky-700 dark:text-sky-300">
                  Caso deseje liberar agora
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-sky-800 dark:text-sky-300 block mb-1">
                    Número do Crachá
                  </label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 rounded-md"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-sky-800 dark:text-sky-300 block mb-1">
                    Tempo Limite de Permanência
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[1, 2, 4, 8].map((hrs) => (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setMaxHours(hrs)}
                        className={`py-1 text-xs font-bold rounded-md transition-colors ${
                          maxHours === hrs
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-200 dark:border-sky-800'
                        }`}
                      >
                        {hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-xs"
          >
            Apenas Salvar Cadastro
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <span>Salvar e Dar Entrada Imediata</span>
          </button>
        </div>
      </div>
    </div>
  );
};
