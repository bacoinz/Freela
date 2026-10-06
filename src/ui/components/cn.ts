import { twMerge } from 'tailwind-merge'

/**
 * Junta classes CSS, ignorando valores falsos. Em conflitos do Tailwind (ex.: "w-full" e "w-16"),
 * fica a última — assim um componente pode afinar o estilo base.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '))
}
