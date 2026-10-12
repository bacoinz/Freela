import {
  Banknote,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  Car,
  CreditCard,
  Droplet,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  Guitar,
  Headphones,
  HeartPulse,
  House,
  Landmark,
  ListChecks,
  Mic,
  Music,
  PiggyBank,
  Plane,
  Receipt,
  ShieldCheck,
  Smartphone,
  Stamp,
  Users,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ObligationKind, ObligationRule } from '../domain/types'

/** Ícone por defeito de cada tipo de prazo. */
export const KIND_ICON: Record<ObligationKind, LucideIcon> = {
  pagamento: Banknote,
  declaracao: FileText,
  outro: ListChecks,
}

/** Ícones que se podem escolher para um prazo (o id é o que fica guardado). */
export const OBLIGATION_ICONS: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'banknote', label: 'Dinheiro', Icon: Banknote },
  { id: 'file', label: 'Documento', Icon: FileText },
  { id: 'list', label: 'Tarefa', Icon: ListChecks },
  { id: 'landmark', label: 'Estado', Icon: Landmark },
  { id: 'stamp', label: 'Carimbo', Icon: Stamp },
  { id: 'calculator', label: 'Contas', Icon: Calculator },
  { id: 'receipt', label: 'Fatura', Icon: Receipt },
  { id: 'card', label: 'Cartão', Icon: CreditCard },
  { id: 'piggy', label: 'Poupança', Icon: PiggyBank },
  { id: 'shield', label: 'Seguro', Icon: ShieldCheck },
  { id: 'guitar', label: 'Guitarra', Icon: Guitar },
  { id: 'music', label: 'Música', Icon: Music },
  { id: 'mic', label: 'Microfone', Icon: Mic },
  { id: 'headphones', label: 'Áudio', Icon: Headphones },
  { id: 'house', label: 'Casa', Icon: House },
  { id: 'building', label: 'Prédio', Icon: Building2 },
  { id: 'car', label: 'Carro', Icon: Car },
  { id: 'plane', label: 'Viagem', Icon: Plane },
  { id: 'zap', label: 'Luz', Icon: Zap },
  { id: 'droplet', label: 'Água', Icon: Droplet },
  { id: 'flame', label: 'Gás', Icon: Flame },
  { id: 'wifi', label: 'Internet', Icon: Wifi },
  { id: 'phone', label: 'Telemóvel', Icon: Smartphone },
  { id: 'health', label: 'Saúde', Icon: HeartPulse },
  { id: 'school', label: 'Formação', Icon: GraduationCap },
  { id: 'work', label: 'Trabalho', Icon: Briefcase },
  { id: 'people', label: 'Pessoas', Icon: Users },
  { id: 'tools', label: 'Manutenção', Icon: Wrench },
  { id: 'gift', label: 'Presente', Icon: Gift },
  { id: 'calendar', label: 'Calendário', Icon: CalendarClock },
]

const BY_ID = new Map(OBLIGATION_ICONS.map((i) => [i.id, i.Icon]))

/** Ícone de um prazo: o escolhido ou, se não houver (ou já não existir), o do tipo. */
export function ruleIcon(rule: Pick<ObligationRule, 'kind' | 'icon'>): LucideIcon {
  return (rule.icon && BY_ID.get(rule.icon)) || KIND_ICON[rule.kind]
}
