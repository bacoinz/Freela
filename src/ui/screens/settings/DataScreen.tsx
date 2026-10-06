import { Download, FileSpreadsheet, FolderOpen, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDateShort } from '../../../domain/dates'
import type { AppData } from '../../../domain/types'
import { appStore, commit, useData } from '../../../data/app'
import { exportBackup, exportCSV, readImportFile, safetyCopy } from '../../../data/backup'
import { isNative } from '../../../data/platform'
import { Button } from '../../components/Button'
import { choose, confirm, toast, toastError } from '../../components/Feedback'
import { AppBar, Card, Page, Section } from '../../components/Layout'
import { useToday } from '../../hooks'

/** Resumo de uma cópia (para confirmar antes de importar). */
export function backupSummary(d: AppData): string {
  const dates = d.jobs.map((j) => j.workDate).sort()
  const range = dates.length ? ` (de ${formatDateShort(dates[0]!)} a ${formatDateShort(dates.at(-1)!)})` : ''
  return `${d.jobs.length} trabalho${d.jobs.length === 1 ? '' : 's'}${range}, ${d.payers.length} pagador${d.payers.length === 1 ? '' : 'es'} guardado${d.payers.length === 1 ? '' : 's'}, ${d.recurring.length} rendimento${d.recurring.length === 1 ? '' : 's'} fixo${d.recurring.length === 1 ? '' : 's'}.`
}

/** Escolher um ficheiro de cópia e substituir os dados (com confirmação e cópia de segurança antes). */
export async function importFromFile(file: File): Promise<boolean> {
  try {
    const imported = await readImportFile(file)
    const ok = await choose(
      'Substituir os dados atuais?',
      [{ value: true, label: 'Substituir pelos da cópia', tone: 'danger' }],
      `A cópia tem ${backupSummary(imported)} Os dados atuais são substituídos${isNative ? ' (antes disso, a app guarda uma cópia deles em Documentos/Freela)' : ''}.`,
    )
    if (!ok) return false
    const current = appStore.getState().data
    if (current) await safetyCopy(current, 'antes-de-importar')
    appStore.getState().replaceAll(imported)
    toast('Cópia importada')
    return true
  } catch (e) {
    toastError(e)
    return false
  }
}

export function DataScreen() {
  const data = useData()
  const today = useToday()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }

  const doBackup = () =>
    run('backup', async () => {
      const r = await exportBackup(data)
      commit((d) => ({ ...d, settings: { ...d.settings, lastExportAt: new Date().toISOString() } }), { touch: false })
      toast(`Cópia guardada em ${r.where}`)
    })

  const doCSV = () =>
    run('csv', async () => {
      const r = await exportCSV(data, today)
      toast(`Ficheiro para o Excel guardado em ${r.where}`)
    })

  const wipe = async () => {
    const ok = await confirm({
      title: 'Apagar todos os dados?',
      message: 'Trabalhos, pagadores, rendimentos fixos e prazos voltam ao início. Antes disso, a app guarda uma cópia (no telemóvel).',
      confirmLabel: 'Apagar tudo',
      danger: true,
    })
    if (!ok) return
    const sure = await confirm({ title: 'Tens a certeza?', message: 'Não dá para desfazer (a não ser importando uma cópia).', confirmLabel: 'Sim, apagar', danger: true })
    if (!sure) return
    await safetyCopy(data, 'antes-de-apagar')
    appStore.getState().startFresh()
    toast('Dados apagados')
  }

  const lastAuto = data.settings.lastAutoBackupDate
  const lastExport = data.settings.lastExportAt?.slice(0, 10)

  return (
    <>
      <AppBar title="Dados e cópias" back="/definicoes" />
      <Page>
        <Card className="flex gap-3 p-4">
          <ShieldCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-success" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed">
            <p className="font-semibold">Os teus dados ficam só neste {isNative ? 'telemóvel' : 'browser'}.</p>
            <p className="text-muted">
              {isNative
                ? `Todos os dias a app guarda uma cópia automática em Documentos/Freela (as últimas 14).${lastAuto ? ` Última: ${formatDateShort(lastAuto)}.` : ''}`
                : 'No browser não há cópia automática — exporta à mão de vez em quando.'}
            </p>
            <p className="text-muted">Última exportação: {lastExport ? formatDateShort(lastExport) : 'nunca'}.</p>
          </div>
        </Card>

        <Section title="Exportar">
          <div className="flex flex-col gap-2">
            <Button icon={Download} loading={busy === 'backup'} onClick={() => void doBackup()}>
              Exportar cópia de segurança
            </Button>
            <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'csv'} onClick={() => void doCSV()}>
              Exportar para Excel (CSV)
            </Button>
          </div>
          <p className="px-1 text-sm leading-relaxed text-muted">
            {isNative
              ? 'Os ficheiros ficam em Documentos/Freela e abre-se o menu Partilhar (podes enviá-los para onde quiseres, ou cancelar).'
              : 'Os ficheiros vão para a pasta de transferências do browser.'}
          </p>
        </Section>

        <Section title="Importar">
          <Button variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>
            Importar cópia de segurança
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importFromFile(file)
            }}
          />
          <p className="px-1 text-sm leading-relaxed text-muted">Substitui os dados atuais pelos da cópia (pede confirmação primeiro).</p>
        </Section>

        {isNative && (
          <Section title="Copiar para o PC">
            <Card className="flex gap-3 p-4 text-sm leading-relaxed text-muted">
              <FolderOpen aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p>
                Liga o telemóvel ao PC por cabo USB, escolhe «Transferência de ficheiros» no aviso do telemóvel e copia a pasta{' '}
                <b className="text-ink">Documentos/Freela</b> para o PC.
              </p>
            </Card>
          </Section>
        )}

        <Section title="Zona perigosa">
          <Button variant="danger-outline" icon={Trash2} onClick={() => void wipe()}>
            Apagar todos os dados
          </Button>
        </Section>
      </Page>
    </>
  )
}
