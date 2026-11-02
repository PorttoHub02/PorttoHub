export type AccessCategory = 'prestador' | 'obra' | 'visitante' | 'familia';

export type AccessStatus = 'fora' | 'dentro' | 'vencido_hoje' | 'bloqueado';

export interface AccessPerson {
  id: string;
  condoId: string;
  name: string;
  category: AccessCategory;
  document: string; // CPF or RG
  documentType: 'CPF' | 'RG';
  unit: string; // e.g. "Casa 142", "Torre B - Apt 84"
  residentName: string;
  residentPhone?: string; // WhatsApp
  phone?: string;
  company?: string; // e.g. "Pinturas & Reformas Silva", "Claro Fibra"
  vehiclePlate?: string; // e.g. "BRA2E19", "ABC-1234"
  vehicleModel?: string; // e.g. "Fiorino Branca"
  photoUrl?: string;
  validUntil?: string; // ISO date for authorization expiry
  currentStay?: {
    enteredAt: string; // ISO timestamp
    badgeNumber: string; // Crachá
    maxHours: number; // 1, 2, 4, 8
    operator: string;
    isOverdue?: boolean;
  };
  notes?: string;
  createdAt: string;
}

export interface MovementAuditLog {
  id: string;
  personId: string;
  personName: string;
  category: AccessCategory;
  condoId: string;
  type: 'entrada' | 'saida' | 'alerta_tempo' | 'cadastro';
  timestamp: string;
  badgeNumber?: string;
  durationMinutes?: number;
  unit: string;
  vehiclePlate?: string;
  operator: string;
  residentNotified?: boolean;
}

export interface Condominium {
  id: string;
  name: string;
  city: string;
  unitsCount: number;
}
