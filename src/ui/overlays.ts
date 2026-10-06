// Pilha de janelas abertas (folhas, diálogos) para o botão "voltar" do Android as fechar primeiro.

const stack: Array<() => void> = []

/** Regista uma janela aberta; devolve a função para a retirar quando fechar. */
export function pushOverlay(close: () => void): () => void {
  stack.push(close)
  return () => {
    const i = stack.lastIndexOf(close)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** Fecha a janela de cima. Devolve false se não havia nenhuma aberta. */
export function closeTopOverlay(): boolean {
  const close = stack.pop()
  if (!close) return false
  close()
  return true
}
