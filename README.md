# Freela

App Android pessoal, 100% local (sem servidor, sem cloud), para registar ganhos de freelancer:
- trabalhos pagos de uma vez ou em várias prestações, cada uma «pendente» ou já paga (ex.: «450 € · 1/2 pagos · falta 225 €»);
- pagadores guardados (com cor) ou avulsos;
- rendimentos fixos mensais (ex.: aulas numa escola);
- a percentagem para investir (15% por defeito, nas Definições) calculada em cada pagamento;
- prazos e pagamentos ao Estado (Segurança Social, declaração trimestral, e-Fatura, IRS), com lembretes;
- calendário, estatísticas, cópias de segurança e bloqueio com impressão digital.

Feita com React + Vite + Tailwind e empacotada com Capacitor 8.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Abre a app no browser do PC (<http://localhost:5173>) |
| `npm test` | Testes automáticos (Vitest) |
| `npm run build` | Build da web-app (verifica os tipos) |
| `npm run apk` | Gera a APK assinada em `release/` (precisa do Android Studio) |
| `npm run apk:install` | Instala/atualiza a APK no telemóvel ligado por USB |
| `npm run android:icons` | Volta a gerar o ícone e o ecrã de arranque |

Guia completo: [docs/COMO-INSTALAR.md](docs/COMO-INSTALAR.md).

## Organização

- `src/domain/` — regras e cálculos (puro TypeScript, testado): prestações, investimento, rendimentos fixos, obrigações e lembretes, estatísticas, validação de ficheiros.
- `src/data/` — armazenamento (ficheiro privado no Android, `localStorage` no browser), cópias de segurança, notificações, bloqueio.
- `src/ui/` — ecrãs e componentes.
- `android/` — projeto Android gerado pelo Capacitor (manifest sem internet nem backup na cloud).
- `keystore/` — chave de assinatura (**fora do git — guardar cópia!**).
