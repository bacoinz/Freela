# Plano — App "Ganhos" (freelancer, Android, 100% local)

## Contexto

És freelancer (sobretudo música) e queres uma app Android para registar os ganhos mensais:
- **Cada trabalho** tem um tipo (Música / Outro) e um pagador. O pagador pode ser guardado, **com uma cor**, ou avulso (só daquela vez).
- **Cada pagamento** tem um método: transferência, MB WAY, Revolut ou dinheiro.
- **Muitos trabalhos são pagos em 2 vezes** (uma no início, outra no fim). Por isso é preciso ver, por exemplo, "450 € · 1/2 pagos · falta 225 €".
- **Rendimento fixo mensal:** as aulas na escola de música, pagas no início de cada mês.
- **15% para investir** de cada pagamento, calculado automaticamente.
- **Obrigações para com o Estado**, com datas limite e lembretes nas regras que definiste: Segurança Social, declaração trimestral, e-Fatura, IRS.
- **Um calendário** com o que recebeste, o que está previsto receber e o que tens de pagar ou entregar.
- **Estatísticas**: melhor e pior mês, o método por onde entra mais dinheiro, total para investir, etc.

O requisito principal é que **nada fique na internet**: sem Cloudflare nem Vercel, e os dados ficam só no telemóvel. A pasta `C:\AI Projects\Finance-App` está vazia, por isso é um projeto novo.

**Decisões tomadas contigo:**
- Investimento: **só o cálculo** (15% de cada pagamento recebido, sem registar transferências).
- Extras da v1: **lembretes** e **bloqueio com impressão digital**.
- Backups: **só locais** (`allowBackup="false"`).
- Prestações: decido eu a melhor forma.
- Lembretes das obrigações: as tuas regras (tabela abaixo).

## Abordagem

1. Fazemos uma web-app em React, pensada para o telemóvel, e testas no browser do PC (`localhost`).
2. Depois o **Capacitor 8** mete essa mesma web-app dentro de uma APK.
3. A APK traz a app inteira e corre sem servidor e sem internet. A permissão de internet é retirada da APK.
4. Os dados ficam num ficheiro JSON privado da app, no telemóvel.

Não usamos uma PWA porque teria de estar alojada nalgum lado. Não usamos Kotlin nativo porque não aproveitaria a web-app.

**O teu ambiente:**
- Já tens Node 24, npm 11, Git e JDK 17.
- **Falta o Android SDK**: a variável `ANDROID_HOME` aponta para uma pasta que não existe.
- Só antes da fase Android tens de instalar o Android Studio (versão 2025.2.1 ou mais recente). Traz o SDK e o JDK 21 que o Capacitor 8 exige.

**Ferramentas:**
- Vite 8, React 19, TypeScript e Tailwind 4.
- react-router (navegação), Zustand (estado da app) e zod (validação de ficheiros).
- date-fns (datas em PT), Recharts (gráficos) e lucide-react (ícones).
- A fonte vem dentro da app, via `@fontsource`, sem CDN.
- Capacitor 8 com os plugins `android`, `filesystem`, `share`, `app`, `status-bar` e `local-notifications`.
- `@aparajita/capacitor-biometric-auth` para a impressão digital (alternativa: `@capgo/capacitor-native-biometric`).
- `@capacitor/assets` para o ícone e Vitest para os testes.

## Como vais testar

**No browser do PC, primeiro.**
- Corres `npm run dev` e abres `http://localhost:5173`. A app está pensada para o telemóvel, mas funciona no browser.
- Há pontos de controlo no fim das fases 2 e 3.
- Opcional: abrir no browser do telemóvel pela rede de casa, com `npm run dev -- --host` → `http://<IP-do-PC>:5173`. Continua tudo na rede local, nada vai para a internet.

**O que só funciona na APK:**
- impressão digital;
- notificações;
- backups automáticos em Documentos.

No browser, estas três ficam desligadas. Tudo o resto funciona igual.

**Lembretes visíveis no browser:** em Definições → "Próximos lembretes" vês a lista dos lembretes que seriam enviados, com data, hora e texto. Assim confirmas as regras antes de haver APK.

**Os dados do browser são separados dos da app no telemóvel.** Se quiseres levar dados de um para o outro, usas exportar/importar.

## Modelo de dados

Todos os dados estão num único documento JSON com `schemaVersion: 1`.

```ts
AppData {
  schemaVersion: 1
  jobs: Job[]
  recurring: RecurringIncome[]            // rendimentos fixos mensais (ex.: aulas na escola de música)
  obligationRules: ObligationRule[]       // prazos e pagamentos ao Estado (pré-carregados + personalizados)
  obligationRecords: ObligationRecord[]   // pago / entregue / não se aplica, e datas alteradas
  categories: { id, name, color, archived? }[]  // Música, Outro
  payers:     { id, name, color, archived? }[]  // pagadores guardados; cor atribuída automaticamente, editável
  methods:    { id, name, archived? }[]         // Transferência bancária, MB WAY, Revolut, Dinheiro
  settings: { investPct: 15, overdueDays: 30, remindersEnabled: true, reminderHour: 10,
              calendarColorMode: 'estado' | 'pagador', lockEnabled, lastAutoBackupDate?, lastExportAt? }
}
Job {
  id, title, categoryId,
  payerId? | payerName?        // pagador guardado OU avulso ("só desta vez", fica a cinzento)
  workDate: 'AAAA-MM-DD', investPct, notes?,
  installments: Installment[]  // 1 = pagamento único · 2 = início + fim · N = personalizado
  recurringId?, period?: 'AAAA-MM'   // quando foi criado por um rendimento fixo
  createdAt, updatedAt
}
Installment { id, amount: Cents, dueDate?, expectedMethodId?, receivedDate?, methodId? }  // recebida = tem receivedDate
RecurringIncome { id, title, categoryId, payerId, amount: Cents, dayOfMonth, methodId?,
                  months: number[] /* 1–12 */, startPeriod, skippedPeriods: string[], active }
ObligationRule {
  id, title, kind: 'pagamento' | 'declaração' | 'outro', schedule, defaultAmount?, active, template?,
  reminders:
    | { type: 'diasDoMes', days: number[] }                      // ex.: SS → dias 10 e 15 do mês do prazo
    | { type: 'repetir', everyDays: number,
        from: 'inicioMesDoPrazo' | { month, day } | { daysBefore },
        until: 'prazo' | 'feito', onDueDay: boolean }           // ex.: trimestral → 5 em 5 dias até feito
}
  // schedule: mensal(dia) | meses([1,4,7,10], dia | 'último') | anual(mês, dia | 'último') | uma vez(data)
ObligationRecord { ruleId, originalDate, dueDateOverride?, status?: 'feito' | 'naoSeAplica',
                   date?, amountPaid?, notes? }
```

## Regras

São funções puras em `src/domain/`, feitas com TDD.

**Valores e datas:**
- Os valores são guardados em **cêntimos inteiros**, para não haver erros de arredondamento.
- As datas são `AAAA-MM-DD` na hora local.
- O formato é PT: `1234,56 €`. O campo de valor aceita `150`, `150,5`, `1.234,56` ou `12.50`.

**Prestações:**
- O total de um trabalho é a soma das prestações. A lista mostra **"450 € · 1/2 pagos · falta 225 €"** com uma barra de progresso.
- **"2 vezes"** divide 50/50; se sobrar um cêntimo, vai para a 2.ª. A 1.ª fica prevista na data do trabalho e a 2.ª na data que escolheres (o fim).
- **"Personalizado"**: N prestações. A última é sempre o total menos as outras.
- **Se receberes um valor diferente do previsto**, o total combinado mantém-se:
  - se receberes menos, o resto passa a ser uma nova prestação pendente;
  - se receberes mais, as prestações seguintes baixam;
  - se já não houver prestações seguintes, o total sobe.

**Estado de cada trabalho.** É sempre calculado, nunca guardado:

| Estado | Quando |
|---|---|
| `recebido` | todas as prestações recebidas |
| `atrasado` | alguma prestação por receber já passou da data prevista; sem data prevista, conta a data do trabalho + 30 dias |
| `parcial` | algumas prestações recebidas |
| `pendente` | nenhuma prestação recebida |

**Investimento:**
- Em cada prestação recebida: `round(valor × investPct / 100)`. O que ainda falta receber aparece como "previsto".
- "Fica para ti" = recebido − investimento.
- A % fica gravada em cada trabalho. Mudá-la nas Definições só afeta trabalhos novos, e podes alterá-la num trabalho em particular.

**Rendimento fixo mensal** (ex.: "Aulas — Escola de Música X", 600 €, dia 5, por transferência):
- Ao abrir a app (e uma vez por dia), é criado o trabalho de cada mês, de `startPeriod` até ao mês atual.
- Só nos meses escolhidos (por exemplo, setembro a julho) e nunca em duplicado: cada mês é identificado pelo rendimento + mês.
- Fica "a receber" com a data prevista no dia que definiste. Num mês sem dia 31, conta o último dia do mês.
- Ao marcar como recebido podes ajustar o valor desse mês. Mudar o valor do rendimento só afeta os meses seguintes.
- Ao eliminar um destes trabalhos, a app pergunta **"Saltar este mês?"**, para não o voltar a criar.
- Os meses futuros aparecem no calendário como "previsto".

**Pagadores:**
- Quando escreves um nome, aparecem sugestões dos pagadores guardados e dos avulsos que já usaste.
- Se o nome for novo, escolhes **"Só desta vez"** (avulso) ou **"Guardar pagador"**.
- Um pagador guardado recebe automaticamente uma cor de uma paleta de 12. Podes mudá-la nas Definições.
- Os avulsos ficam a cinzento. Nas Definições, um avulso pode passar a guardado; os trabalhos com esse nome são atualizados.
- Nas estatísticas, os avulsos são agrupados pelo nome.

**Obrigações:**
- As ocorrências são calculadas a partir das regras.
- O botão muda conforme o tipo: **"Pago"** (guarda a data e o valor pago, já preenchido com o valor habitual), **"Entregue"** ou **"Feito"**.
- **"Não se aplica"** serve, por exemplo, para não haver IRS a pagar nesse ano. Arquiva a ocorrência e pára os lembretes.
- Podes mudar a data de uma ocorrência (para quando há prorrogações).
- Uma categoria, pagador ou método em uso não se apaga: **arquiva-se**. Sai das listas, mas o histórico mantém-se.

## Prazos do Estado e lembretes

São modelos que podes editar ou desligar, e podes acrescentar prazos teus. **Os lembretes param assim que marcas a ocorrência como pago, entregue, feito ou não se aplica.**

| Modelo | Data limite | Lembretes (as tuas regras) | Ativo |
|---|---|---|---|
| Pagar Segurança Social (mês anterior) | dia 20 de cada mês | **dia 10 e dia 15** desse mês | sim |
| Declaração trimestral à Segurança Social | último dia de jan, abr, jul e out | **de 5 em 5 dias** a partir do dia 1 desse mês, **até marcares feito** (continua depois do prazo) | sim |
| Validar faturas no e-Fatura | último dia de fevereiro | **de 5 em 5 dias durante fevereiro** (1, 6, 11, 16, 21, 26) | sim |
| Entregar a declaração de IRS | 30 de junho | **1 vez por semana de 1 de abril até 30 de junho** | sim |
| Pagar IRS (se houver imposto a pagar) | 31 de agosto | **1 vez por semana a partir de 1 de agosto até ao prazo, e no próprio dia** | sim |
| Pagamentos por conta de IRS | 20 de jul, 20 de set e 20 de dez | 7 dias antes e no dia | **não** (só se te aplicar) |

**Aviso na app:** "Prazos de referência (2026). Se o prazo calhar a um fim de semana ou feriado, passa para o dia útil seguinte; a app mostra a data normal para teres margem. Confirma sempre no Portal das Finanças e na Segurança Social Direta."

## Ecrãs

Tudo em PT-PT, com uma barra de navegação em baixo: **Início · Trabalhos · Calendário · Obrigações · Estatísticas**. As **Definições** abrem no ⚙️ do Início.

O pagador aparece sempre com a sua cor (um círculo com as iniciais) em todas as listas e no detalhe.

- **Início.** Escolhes o mês (`‹ outubro 2026 ›`).
  - Cartões: Recebido · Para investir (15%) · Fica para ti, e uma linha "Pago ao Estado este mês".
  - Cartão do **rendimento fixo**: "Aulas — Escola X: 600 € · previsto dia 5" ou "recebido ✓".
  - **A receber**: total, nº de trabalhos e atrasados a vermelho, com as prestações e o botão **Recebido**.
  - **Próximos prazos**: as próximas 3 obrigações dos 30 dias seguintes, com o botão Pago/Entregue/Feito.
  - Os últimos recebimentos.
  - Um aviso se não exportas um backup há mais de 30 dias.
  - O botão **+** para um trabalho novo.
- **Trabalhos.**
  - Separadores **A receber | Todos**, pesquisa e filtros (estado, categoria, pagador, método, ano).
  - Lista agrupada por mês, com o total de cada mês e "1/2 pagos" com barra.
  - **Detalhe de um trabalho**:
    - cada prestação com o valor, a data prevista e o estado, e **Recebido** ou "Recebida a dd/mm por MB WAY" (com anular);
    - "Falta receber: 225 €" e o investimento;
    - editar, duplicar e eliminar.
- **Folha "Recebido".** Três campos: o valor (já preenchido com a prestação), a data (hoje) e o método (o previsto ou o último que usaste).
- **Formulário de trabalho.**
  - Valor total, descrição, categoria e data do trabalho.
  - Pagador, com sugestões e "Só desta vez" / "Guardar".
  - **Pagamento: [Único] [2 vezes] [Personalizado]**, com uma linha por prestação: valor, data prevista e "já recebida ✓" (data + método).
  - "15% para investir = 67,50 €", com a % editável.
  - Notas.
- **Calendário.** Grelha do mês, a começar à segunda-feira, com o seletor de cores **[Estado | Pagador]**.
  - **Estado**: 🟢 recebido, 🔵 previsto receber (prestações e rendimentos fixos, incluindo meses futuros), 🔴 obrigação por fazer, ⚪ obrigação feita.
  - **Pagador**: os rendimentos aparecem com a cor do pagador; bolinha cheia = recebido, só contorno = previsto. As obrigações continuam como 🔴/⚪.
  - Tocar num dia mostra a lista desse dia com as ações.
  - Por baixo, o resumo do mês e a legenda.
- **Obrigações.**
  - As atrasadas aparecem no topo; depois, as próximas agrupadas por mês, com "faltam 3 dias", "hoje" ou "atrasado há 2 dias".
  - Botões Pago/Entregue/Feito e "Não se aplica".
  - Histórico com o total pago ao Estado por ano.
  - "Gerir prazos": os modelos, os teus prazos personalizados e as regras de lembrete de cada um.
  - O aviso legal.
- **Estatísticas.** Escolhes o período: Este ano · Ano anterior · Últimos 12 meses · Tudo. Os valores contam pela data em que recebeste:
  - total recebido, média mensal, nº de trabalhos e valor médio, mais a comparação com o ano anterior;
  - **melhor e pior mês**, contando todos os meses do período até ao mês atual, incluindo meses a 0 €;
  - barras mensais divididas por categoria, mais a linha da média;
  - **por método** (o que mais rende em destaque), **por categoria** e **fixo vs variável**;
  - **por pagador**, nas cores dos pagadores: total, nº de trabalhos, média, **tempo médio até pagar** e quanto deve neste momento;
  - **investimento**: acumulado, no período, por mês e previsto;
  - **pago ao Estado** por mês e por ano;
  - **pendentes**: total, em atraso e o mais antigo.
- **Definições.**
  - % para investir e nº de dias até um pagamento contar como atrasado.
  - **Rendimentos fixos**.
  - **Lembretes**: ligar/desligar, hora (10:00), "testar notificação" e a lista **Próximos lembretes**.
  - Bloqueio com impressão digital.
  - Categorias, **pagadores (com a cor de cada um)** e métodos.
  - Dados: exportar backup, exportar CSV e importar.
  - Versão da app.

**Visual:**
- Simples, com números grandes.
- Tema claro ou escuro automático, conforme o telemóvel.
- Respeita as barras do sistema Android (edge-to-edge).

## Armazenamento e backups

**Como os dados são guardados:**
- No Android, os dados ficam em `ganhos.json` na pasta privada da app (`Directory.Data`). Cada gravação é atómica: escreve primeiro um `.tmp` e depois renomeia.
- No browser, usa `localStorage`.
- As gravações entram numa fila e tudo é gravado quando a app vai para segundo plano.
- O ficheiro é validado com zod e há migrações por `schemaVersion`.

**Backup automático:**
- Uma vez por dia, se houve alterações, a app grava `Documentos/Ganhos/ganhos-backup-AAAA-MM-DD.json` e guarda os últimos 14.
- Podes copiá-los para o PC por cabo USB.

**Exportar:**
- Backup em JSON e CSV para o Excel (separador `;`, UTF-8 com BOM).
- Os ficheiros são gravados em Documentos/Ganhos e abre-se o menu Partilhar (usar é opcional).
- No browser, o ficheiro é descarregado.

**Importar:**
1. Escolhes o ficheiro no seletor do sistema.
2. A app valida o ficheiro.
3. Mostra um resumo.
4. Pede confirmação.
5. Faz um backup de segurança dos dados atuais.
6. Substitui os dados.

**Recuperação:** se o ficheiro principal falhar ao abrir, aparece um ecrã que oferece o backup automático mais recente ou importar um ficheiro.

**AndroidManifest:**
- `allowBackup="false"`.
- `<uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>`.
- Isto tem de ser confirmado no telemóvel. Se a app não abrir sem a permissão, reponho-a; a app não faz pedidos à rede de qualquer forma.
- As permissões de armazenamento só são pedidas no Android 10 ou anterior (`maxSdkVersion="29"`).

## Lembretes e bloqueio

**Lembretes:**
- `planReminders(data, agora)` é uma função pura e testada. Funciona também no browser, para a lista "Próximos lembretes".
- Junta tudo o que há para lembrar nos próximos 60 dias, à hora definida (por defeito 10:00):
  - **Prestações em atraso**: um lembrete por semana, a contar da data de atraso.
  - **Obrigações**: com as regras da tabela anterior. Nunca para ocorrências marcadas como pago, entregue, feito ou não se aplica.
- No máximo **uma notificação por dia**, com o resumo. Por exemplo: "Hoje: pagar Segurança Social (até dia 20) · declaração trimestral por entregar · 2 pagamentos em atraso (450 €)".
- Na APK usa `@capacitor/local-notifications`. No Android 13 ou mais recente, a app pede autorização para notificações.
- Os lembretes são todos cancelados e recriados ao abrir a app e depois de cada alteração. Tocar na notificação abre o ecrã certo.

**Bloqueio** (só na APK):
- Usa a impressão digital, com o PIN ou padrão do telemóvel como alternativa.
- Pede ao abrir a app e ao voltar depois de mais de 1 minuto em segundo plano. Esse minuto de margem evita bloquear ao abrir o Partilhar ou o seletor de ficheiros.
- Vem ligado por defeito se o telemóvel tiver bloqueio de ecrã configurado.

## Estrutura do projeto

```
src/domain/  types, money, dates, installments, jobs (estado e investimento), payers (cores, avulsos), recurring,
             obligations (ocorrências, modelos PT, regras de lembrete), ops (operações puras), stats,
             calendar (eventos por dia), reminders, schema (zod e migrações), csv, defaults   ← 100% testável
src/data/    storage (+ nativo/web), store (Zustand: chama ops e grava), backup, notifications, lock, platform
src/ui/      components/ (BottomNav, MoneyInput, ChipSelect, PayerPicker, PayerAvatar, ColorPicker,
             InstallmentsEditor, Sheet, MonthGrid, StatCard, ProgressBar…), screens/, charts/
android/     gerado pelo Capacitor
scripts/build-apk.ps1
docs/        design e COMO-INSTALAR.md (em PT)
```

## Fases

**0. Preparação**
- `git init` (só local).
- Guardar este design em `docs/superpowers/specs/2026-10-06-ganhos-design.md`.
- Criar o projeto Vite + React + TS + Tailwind + Vitest e o `.gitignore`.

**1. Domínio, com TDD**
- money, dates, prestações, estados, investimento, pagadores e cores, rendimentos fixos, obrigações e regras de lembrete, eventos do calendário, stats, reminders, schema e csv.
- O armazenamento para o browser e o store.

**2. Interface principal**
- Navegação, formulário (com prestações e pagadores com cor), Trabalhos, detalhe, folha "Recebido" e Início.
- **Ponto de controlo: testas no browser do PC.**

**3. O resto da interface**
- Calendário (Estado/Pagador), Obrigações, rendimentos fixos, Estatísticas e Definições (incluindo "Próximos lembretes").
- Exportar, importar e CSV.
- **Ponto de controlo: testas tudo no browser.**

**4. Android.** Precisa do Android Studio instalado: instalas tu, ou eu corro `winget install Google.AndroidStudio` com a tua autorização. No assistente de instalação és tu que aceitas as licenças do SDK.
- `npx cap add android`, com:
  - appId `pt.freelance.ganhos`, que é definitivo depois da primeira instalação;
  - nome "Ganhos";
  - ícone gerado com `@capacitor/assets`.
- Ligar o armazenamento nativo, os backups em Documentos, as notificações, o bloqueio, o botão "voltar", a barra de estado e as margens seguras.
- Manifest: `allowBackup=false` e sem INTERNET.
- **Chave de assinatura própria:**
  - Ficheiros: `keystore/ganhos-release.jks` e `keystore.properties`, ambos fora do git.
  - A password é gerada e fica guardada no ficheiro.
  - **Tens de guardar uma cópia destes dois ficheiros noutro sítio.** Sem eles não dá para atualizar a app sem a desinstalar, e desinstalar apaga os dados.
- **`scripts/build-apk.ps1`:**
  1. Faz o build web.
  2. Corre `cap sync`.
  3. Corre `gradlew assembleRelease`, apontando `JAVA_HOME` só durante o build para o JDK 21 do Android Studio. O teu JDK 17 global não muda.
  4. Copia a APK para `release/Ganhos-vX.Y.Z.apk`.
  - O versionCode é tirado da versão da app.

**5. Instalação e verificação no telemóvel**
- Guia `docs/COMO-INSTALAR.md`:
  - instalar e atualizar, com `adb install -r` ou copiando a APK para o telemóvel;
  - instalar uma versão nova por cima mantém os dados;
  - como copiar os backups para o PC.

## Verificação

- **`npm test`.** Testes do domínio para:
  - arredondamento dos 15% e leitura de valores PT;
  - divisão em prestações e acerto de diferenças;
  - estados;
  - rendimento fixo: sem duplicados, saltar mês, meses ativos e dia 31;
  - ocorrências das obrigações: último dia de fevereiro e de cada trimestre, datas alteradas, "não se aplica";
  - **regras de lembrete**:
    - a SS lembra só nos dias 10 e 15;
    - a declaração trimestral lembra de 5 em 5 dias até estar feita, mesmo depois do prazo;
    - o e-Fatura lembra de 5 em 5 dias só em fevereiro;
    - a entrega do IRS lembra todas as semanas de 1 de abril a 30 de junho;
    - o pagamento do IRS lembra todas as semanas a partir de 1 de agosto e também no dia 31;
    - os lembretes param quando se marca feito;
    - aparece uma só notificação por dia;
  - eventos do calendário;
  - stats: melhor e pior mês com meses a 0 €, por método, pagador e avulsos, fixo vs variável, pago ao Estado;
  - importação e CSV.
- **`npm run build`.** Tem de terminar sem erros de tipos.
- **Browser do Claude**, em tamanho de telemóvel (375×812):
  1. Trabalho de 450 € em 2 vezes com um pagador avulso: "0/2" → "1/2 pagos · falta 225 €" (33,75 € para investir) → "Recebido" (67,50 €).
  2. Receber 200 € numa prestação de 225 € cria uma prestação pendente de 25 €.
  3. Pagador guardado com uma cor: a cor aparece na lista, nas estatísticas e no Calendário em modo Pagador.
  4. Rendimento fixo "Aulas", 600 €, dia 5, de setembro a julho: é criado uma vez, não se duplica e saltar um mês funciona.
  5. Obrigações: a declaração trimestral aparece com prazo 31/10/2026. "Próximos lembretes" mostra 11, 16, 21, 26 e 31 de outubro (e também hoje, dia 6, se ainda não forem 10:00), depois 5 de novembro… até a marcares feita. A SS mostra 10 e 15 de outubro; marcá-la como paga (120 €) remove esses lembretes e atualiza "Pago ao Estado".
  6. O Calendário em modo Estado e em modo Pagador.
  7. As Estatísticas estão coerentes.
  8. Exportar e voltar a importar deixa os dados iguais.
  9. O tema escuro funciona.
  10. A consola não tem erros e não há nenhum pedido de rede fora do localhost.
- **No telemóvel:**
  - A app abre em modo de avião.
  - Os dados continuam lá depois de reabrir e depois de instalar uma APK nova por cima.
  - O bloqueio funciona.
  - Chegam a notificação de teste e as notificações reais, com o resumo diário.
  - O backup aparece em Documentos/Ganhos.
  - Importar pelo seletor de ficheiros funciona.
  - O botão "voltar" funciona e o ecrã não fica tapado pelas barras do sistema.

## Ideias para depois (fora da v1)

- Reserva para impostos (uma % automática) e "recibo emitido ✓".
- Despesas e lucro real.
- Objetivo mensal.
- Horas trabalhadas e €/hora.
- Foto do recibo.
- Modo privado.
- Widget no ecrã inicial.
- Registo das transferências para investimento.
- Ajuste automático dos prazos a feriados e dias úteis.
