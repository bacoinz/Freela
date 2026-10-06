import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'

/** Onde ficam os dados da app (um único documento JSON). */
export interface DataStorage {
  describe: string
  load(): Promise<string | null>
  save(json: string): Promise<void>
}

const WEB_KEY = 'ganhos:data'

/** No browser (testes no PC): localStorage. */
export const webStorage: DataStorage = {
  describe: 'browser (localStorage)',
  async load() {
    try {
      return localStorage.getItem(WEB_KEY)
    } catch {
      return null
    }
  },
  async save(json) {
    localStorage.setItem(WEB_KEY, json)
  },
}

const FILE = 'ganhos.json'
const TMP = 'ganhos.json.tmp'

async function readText(path: string): Promise<string> {
  const r = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
  return typeof r.data === 'string' ? r.data : await r.data.text()
}

/**
 * No Android: ficheiro privado da app. Gravação atómica — escreve um .tmp e renomeia,
 * para que uma gravação interrompida nunca estrague o ficheiro principal.
 */
export const nativeStorage: DataStorage = {
  describe: 'ficheiro privado da app (Android)',
  async load() {
    try {
      return await readText(FILE)
    } catch {
      // Sem ficheiro principal: pode ter havido uma gravação interrompida a meio da troca.
      try {
        return await readText(TMP)
      } catch {
        return null
      }
    }
  },
  async save(json) {
    await Filesystem.writeFile({ path: TMP, data: json, directory: Directory.Data, encoding: Encoding.UTF8 })
    try {
      await Filesystem.rename({ from: TMP, to: FILE, directory: Directory.Data, toDirectory: Directory.Data })
    } catch {
      await Filesystem.deleteFile({ path: FILE, directory: Directory.Data }).catch(() => undefined)
      await Filesystem.rename({ from: TMP, to: FILE, directory: Directory.Data, toDirectory: Directory.Data })
    }
  },
}
