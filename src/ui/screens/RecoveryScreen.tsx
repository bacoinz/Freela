import { CircleAlert, Download, History, RotateCcw, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppData } from '../../domain/types'
import { appStore, useApp } from '../../data/app'
import { exportRaw, latestAutoBackup } from '../../data/backup'
import { Button } from '../components/Button'
import { confirm, toast, toastError } from '../components/Feedback'
import { Card } from '../components/Layout'
import { backupSummary, importFromFile } from './settings/DataScreen'

/** Quando os dados guardados não se conseguem ler: recuperar sem perder nada. */
export function RecoveryScreen() {
  const error = useApp((s) => s.error)
  const raw = useApp((s) => s.corruptRaw)
  const fileRef = useRef<HTMLInputElement>(null)
  const [auto, setAuto] = useState<{ name: string; data: AppData } | null | undefined>(undefined)

  useEffect(() => {
    void latestAutoBackup().then(setAuto)
  }, [])

  const restoreAuto = async () => {
    if (!auto) return
    const ok = await confirm({ title: 'Restaurar a cópia automática?', message: `${auto.name}: ${backupSummary(auto.data)}`, confirmLabel: 'Restaurar' })
    if (ok) {
      appStore.getState().replaceAll(auto.data)
      toast('Dados restaurados')
    }
  }

  const fresh = async () => {
    const ok = await confirm({
      title: 'Começar do zero?',
      message: 'A app fica vazia. Guarda primeiro o ficheiro estragado se quiseres tentar recuperá-lo mais tarde.',
      confirmLabel: 'Começar do zero',
      danger: true,
    })
    if (ok) appStore.getState().startFresh()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4" style={{ paddingTop: 'calc(var(--sat) + 32px)', paddingBottom: 'calc(var(--sab) + 32px)' }}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <CircleAlert aria-hidden className="size-7" />
        </span>
        <h1 className="text-xl font-bold">Não foi possível abrir os teus dados</h1>
        <p className="text-sm text-muted">{error}</p>
      </div>
      <Card className="flex flex-col gap-2 p-4">
        {auto && (
          <Button icon={History} onClick={() => void restoreAuto()}>
            Restaurar a última cópia automática
          </Button>
        )}
        <Button variant={auto ? 'secondary' : 'primary'} icon={Upload} onClick={() => fileRef.current?.click()}>
          Importar uma cópia de segurança
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
        {raw && (
          <Button
            variant="secondary"
            icon={Download}
            onClick={() =>
              void exportRaw(raw)
                .then((r) => toast(`Ficheiro guardado em ${r.where}`))
                .catch(toastError)
            }
          >
            Guardar o ficheiro estragado
          </Button>
        )}
        <Button variant="danger-outline" icon={RotateCcw} onClick={() => void fresh()}>
          Começar do zero
        </Button>
      </Card>
    </div>
  )
}
