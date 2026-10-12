import { createBrowserRouter, Navigate } from 'react-router'
import { RootLayout, TabsLayout } from './Root'
import { CalendarScreen } from './screens/CalendarScreen'
import { HomeScreen } from './screens/HomeScreen'
import { InvestScreen } from './screens/InvestScreen'
import { JobDetailScreen } from './screens/JobDetailScreen'
import { JobFormScreen } from './screens/JobFormScreen'
import { JobsScreen } from './screens/JobsScreen'
import { ObligationRuleFormScreen } from './screens/ObligationRuleFormScreen'
import { ObligationRulesScreen } from './screens/ObligationRulesScreen'
import { ObligationsScreen } from './screens/ObligationsScreen'
import { CategoriesScreen, MethodsScreen, PayersScreen } from './screens/settings/ListsScreens'
import { DataScreen } from './screens/settings/DataScreen'
import { RecurringFormScreen } from './screens/settings/RecurringFormScreen'
import { RecurringScreen } from './screens/settings/RecurringScreen'
import { RemindersScreen } from './screens/settings/RemindersScreen'
import { SettingsScreen } from './screens/settings/SettingsScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        Component: TabsLayout,
        children: [
          { index: true, Component: HomeScreen },
          { path: 'trabalhos', Component: JobsScreen },
          { path: 'calendario', Component: CalendarScreen },
          { path: 'obrigacoes', Component: ObligationsScreen },
          // Estatísticas (com os gráficos) só são carregadas quando se abrem.
          { path: 'estatisticas', lazy: async () => ({ Component: (await import('./screens/StatsScreen')).StatsScreen }) },
        ],
      },
      { path: 'trabalhos/novo', Component: JobFormScreen },
      { path: 'trabalhos/:id', Component: JobDetailScreen },
      { path: 'trabalhos/:id/editar', Component: JobFormScreen },
      { path: 'obrigacoes/prazos', Component: ObligationRulesScreen },
      { path: 'obrigacoes/prazos/:id', Component: ObligationRuleFormScreen },
      { path: 'investir', Component: InvestScreen },
      { path: 'definicoes', Component: SettingsScreen },
      { path: 'definicoes/fixos', Component: RecurringScreen },
      { path: 'definicoes/fixos/:id', Component: RecurringFormScreen },
      { path: 'definicoes/lembretes', Component: RemindersScreen },
      { path: 'definicoes/pagadores', Component: PayersScreen },
      { path: 'definicoes/categorias', Component: CategoriesScreen },
      { path: 'definicoes/metodos', Component: MethodsScreen },
      { path: 'definicoes/dados', Component: DataScreen },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
