import { AccessPerson } from '../types/access';

export function formatWhatsAppMessage(
  person: AccessPerson,
  badge?: string,
  stayHours?: number
): string {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isPrestador = person.category === 'prestador' || person.category === 'obra';

  let msg = `*PORTTOHUB - AVISO DE PORTARIA*\n\n`;
  msg += `Olá, morador(a) da *${person.unit}*!\n`;

  if (isPrestador) {
    msg += `Informamos que o prestador de serviço *${person.name}*`;
    if (person.company) msg += ` (${person.company})`;
    msg += ` acabou de ter a entrada autorizada na portaria.\n\n`;
    if (badge) msg += `🏷️ *Crachá de Acesso:* #${badge}\n`;
    if (stayHours) msg += `⏱️ *Tempo Limite Estipulado:* ${stayHours} hora(s)\n`;
  } else {
    msg += `Informamos que seu visitante/convidado *${person.name}* deu entrada na portaria.\n\n`;
  }

  if (person.vehiclePlate) {
    msg += `🚗 *Veículo:* ${person.vehiclePlate} ${person.vehicleModel ? `(${person.vehicleModel})` : ''}\n`;
  }

  msg += `🕒 *Horário:* ${time}\n`;
  msg += `\nQualquer dúvida ou irregularidade, contate a portaria imediatamente.`;

  return msg;
}

export function openWhatsAppNotification(
  person: AccessPerson,
  badge?: string,
  stayHours?: number
): void {
  const phone = person.residentPhone || person.phone;
  if (!phone) return;

  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const message = formatWhatsAppMessage(person, badge, stayHours);
  const encoded = encodeURIComponent(message);

  window.open(`https://wa.me/${fullPhone}?text=${encoded}`, '_blank', 'noopener,noreferrer');
}
