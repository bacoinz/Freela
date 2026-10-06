import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { jobsToCSV } from '../domain/csv'
import { toISODate } from '../domain/dates'
import { makeBackup, parseAppData } from '../domain/schema'
import type { AppData, ISODate } from '../domain/types'
import { isNative } from './platform'

/** Pasta em Documentos (no telemóvel) onde ficam as cópias e exportações. */
export const BACKUP_DIR = 'Freela'
const AUTO_RE = /^freela-backup-\d{4}-\d{2}-\d{2}\.json$/
const KEEP_AUTO = 14

const pad2 = (n: number) => String(n).padStart(2, '0')
const stamp = (d = new Date()) => `${toISODate(d)}-${pad2(d.getHours())}${pad2(d.getMinutes())}`

export function backupJSON(data: AppData): string {
  return JSON.stringify(makeBackup(data, new Date().toISOString()), null, 2)
}

async function ensurePublicStorage() {
  // Só é preciso no Android 10 ou anterior; nas versões recentes não pede nada.
  try {
    const p = await Filesystem.checkPermissions()
    if (p.publicStorage !== 'granted') await Filesystem.requestPermissions()
  } catch {
    /* ignora */
  }
}

async function writeDocument(name: string, content: string): Promise<string> {
  await ensurePublicStorage()
  const r = await Filesystem.writeFile({
    path: `${BACKUP_DIR}/${name}`,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  })
  return r.uri
}

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface ExportResult {
  name: string
  where: string
}

async function exportFile(name: string, content: string, mime: string, share: boolean): Promise<ExportResult> {
  if (!isNative) {
    download(name, content, mime)
    return { name, where: 'pasta de transferências do browser' }
  }
  const uri = await writeDocument(name, content)
  if (share) {
    try {
      await Share.share({ title: name, files: [uri], dialogTitle: 'Enviar ou guardar a cópia' })
    } catch {
      /* partilha cancelada — o ficheiro já ficou guardado */
    }
  }
  return { name, where: `Documentos/${BACKUP_DIR}` }
}

/** Cópia de segurança completa (JSON). */
export function exportBackup(data: AppData, share = true): Promise<ExportResult> {
  return exportFile(`freela-copia-${stamp()}.json`, backupJSON(data), 'application/json', share)
}

/** Trabalhos e prestações em CSV (para o Excel). */
export function exportCSV(data: AppData, today: ISODate, share = true): Promise<ExportResult> {
  return exportFile(`freela-${today}.csv`, jobsToCSV(data, today), 'text/csv', share)
}

async function listAutoBackups(): Promise<string[]> {
  try {
    const r = await Filesystem.readdir({ path: BACKUP_DIR, directory: Directory.Documents })
    return r.files
      .map((f) => f.name)
      .filter((n) => AUTO_RE.test(n))
      .sort()
      .reverse()
  } catch {
    return []
  }
}

/**
 * Cópia automática diária em Documentos/Freela (só no telemóvel), se houve alterações
 * desde a última. Guarda as últimas 14. Devolve true se gravou.
 */
export async function autoBackupIfNeeded(data: AppData, today: ISODate): Promise<boolean> {
  if (!isNative) return false
  const s = data.settings
  if (s.lastAutoBackupDate === today) return false
  const changed = !s.lastAutoBackupDate || !s.lastChangeAt || s.lastChangeAt >= `${s.lastAutoBackupDate}T00:00`
  if (!changed) return false
  await writeDocument(`freela-backup-${today}.json`, backupJSON(data))
  for (const old of (await listAutoBackups()).slice(KEEP_AUTO)) {
    await Filesystem.deleteFile({ path: `${BACKUP_DIR}/${old}`, directory: Directory.Documents }).catch(() => undefined)
  }
  return true
}

/** A cópia automática mais recente que se consiga ler (para recuperar dados estragados). */
export async function latestAutoBackup(): Promise<{ name: string; data: AppData } | null> {
  if (!isNative) return null
  for (const name of await listAutoBackups()) {
    try {
      const r = await Filesystem.readFile({ path: `${BACKUP_DIR}/${name}`, directory: Directory.Documents, encoding: Encoding.UTF8 })
      const text = typeof r.data === 'string' ? r.data : await r.data.text()
      return { name, data: parseAppData(JSON.parse(text)) }
    } catch {
      /* tenta a anterior */
    }
  }
  return null
}

/** Guarda o conteúdo estragado (ecrã de recuperação), para não se perder nada. */
export function exportRaw(content: string): Promise<ExportResult> {
  return exportFile(`freela-estragado-${stamp()}.json`, content, 'application/json', false)
}

/** Lê e valida um ficheiro escolhido pelo utilizador. */
export async function readImportFile(file: File): Promise<AppData> {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Este ficheiro não é uma cópia de segurança válida.')
  }
  return parseAppData(raw)
}

/** Antes de importar (substituir tudo), guarda uma cópia dos dados atuais. */
export async function safetyCopy(data: AppData, reason: string): Promise<void> {
  if (!isNative) return
  await writeDocument(`freela-${reason}-${stamp()}.json`, backupJSON(data))
}
