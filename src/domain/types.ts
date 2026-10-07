// Tipos do domínio. Sem lógica, sem React, sem Capacitor.

/** Data local no formato 'AAAA-MM-DD'. */
export type ISODate = string
/** Mês no formato 'AAAA-MM'. */
export type Period = string
/** Valor em cêntimos (inteiro). 150,50 € = 15050. */
export type Cents = number

export interface Category {
  id: string
  name: string
  color: string
  archived?: boolean
}

export interface Payer {
  id: string
  name: string
  color: string
  archived?: boolean
}

export interface PaymentMethod {
  id: string
  name: string
  archived?: boolean
}

/** Uma prestação de um trabalho. Está recebida quando tem `receivedDate`. */
export interface Installment {
  id: string
  amount: Cents
  dueDate?: ISODate
  expectedMethodId?: string
  receivedDate?: ISODate
  methodId?: string
}

export interface Job {
  id: string
  title: string
  categoryId: string
  /** Pagador guardado… */
  payerId?: string
  /** …ou pagador avulso ("só desta vez"). */
  payerName?: string
  workDate: ISODate
  /** % para investir, copiada das definições ao criar. */
  investPct: number
  notes?: string
  /** 1 = pagamento único; 2 = início + fim; N = personalizado. */
  installments: Installment[]
  /** Preenchidos quando o trabalho foi criado por um rendimento fixo mensal. */
  recurringId?: string
  period?: Period
  createdAt: string
  updatedAt: string
}

/** Rendimento fixo mensal (ex.: aulas na escola de música). */
export interface RecurringIncome {
  id: string
  title: string
  categoryId: string
  payerId: string
  amount: Cents
  /** Dia previsto do pagamento (1–31; em meses curtos usa-se o último dia). */
  dayOfMonth: number
  /**
   * Em que mês chega o pagamento de cada mês de trabalho: no próprio mês (por omissão)
   * ou no seguinte (ex.: o trabalho de setembro é pago a 15 de outubro).
   */
  payMonth?: 'same' | 'next'
  methodId?: string
  investPct?: number
  /** Meses de trabalho que contam (1–12). */
  months: number[]
  /** Primeiro mês a gerar. */
  startPeriod: Period
  skippedPeriods: Period[]
  active: boolean
}

export type ObligationKind = 'pagamento' | 'declaracao' | 'outro'

/** Dia do mês, ou 'last' para o último dia. */
export type DayOfMonth = number | 'last'

export type ObligationSchedule =
  | { type: 'monthly'; day: DayOfMonth }
  | { type: 'months'; months: number[]; day: DayOfMonth }
  | { type: 'yearly'; month: number; day: DayOfMonth }
  | { type: 'once'; date: ISODate }

export type ReminderStart =
  /** Dia 1 do mês do prazo. */
  | { type: 'dueMonthStart' }
  /** Data fixa no ano do prazo (ex.: 1 de abril para o IRS). */
  | { type: 'fixedDate'; month: number; day: number }
  /** N dias antes do prazo. */
  | { type: 'daysBefore'; days: number }

export type ReminderRule =
  /** Dias fixos do mês do prazo (ex.: SS → 10 e 15). */
  | { type: 'daysOfMonth'; days: number[] }
  /** De N em N dias a partir de `from`, até ao prazo ou até estar feito. */
  | {
      type: 'repeat'
      everyDays: number
      from: ReminderStart
      until: 'due' | 'done'
      onDueDay: boolean
    }

export interface ObligationRule {
  id: string
  title: string
  kind: ObligationKind
  schedule: ObligationSchedule
  reminders: ReminderRule
  defaultAmount?: Cents
  active: boolean
  /** Ocorrências com prazo antes desta data são ignoradas. */
  startDate: ISODate
  /** Identificador do modelo pré-carregado (ex.: 'ss-pagamento'). */
  template?: string
  notes?: string
}

export type ObligationStatus = 'done' | 'notApplicable'

/** Guarda o que fizeste numa ocorrência (ou uma data alterada). */
export interface ObligationRecord {
  ruleId: string
  /** Prazo original calculado pela regra — identifica a ocorrência. */
  originalDate: ISODate
  dueDateOverride?: ISODate
  status?: ObligationStatus
  /** Data em que foi feito/pago. */
  date?: ISODate
  amountPaid?: Cents
  notes?: string
}

export type CalendarColorMode = 'status' | 'payer'

export interface Settings {
  investPct: number
  overdueDays: number
  remindersEnabled: boolean
  reminderHour: number
  calendarColorMode: CalendarColorMode
  lockEnabled: boolean
  /** Já se decidiu (automaticamente ou pelo utilizador) se o bloqueio fica ligado. */
  lockInitialized?: boolean
  lastAutoBackupDate?: ISODate
  lastExportAt?: string
  lastChangeAt?: string
}

export interface AppData {
  schemaVersion: 1
  jobs: Job[]
  recurring: RecurringIncome[]
  obligationRules: ObligationRule[]
  obligationRecords: ObligationRecord[]
  categories: Category[]
  payers: Payer[]
  methods: PaymentMethod[]
  settings: Settings
}

/** Dependências injetadas nas operações (facilita os testes). */
export interface OpsContext {
  newId: () => string
  /** Data/hora atual em ISO (para createdAt/updatedAt). */
  nowISO: () => string
  /** Hoje, 'AAAA-MM-DD' (hora local). */
  today: ISODate
}
