# Freela — como testar, gerar a APK e instalar no telemóvel

A app é 100% local: não há servidor nem contas, e os dados ficam só no telemóvel (ou no browser, quando testas no PC).

---

## 1. Testar no PC (browser)

```bash
npm run dev
```

Abre <http://localhost:5173>. A app está pensada para o telemóvel, por isso fica melhor com a janela estreita (no Chrome: F12 → ícone do telemóvel).

**Opcional: abrir no browser do telemóvel pela rede de casa.**

```bash
npm run dev -- --host
```

No telemóvel, abre `http://<IP-do-PC>:5173`. O IP aparece no terminal. Continua tudo na rede local, nada vai para a internet.

> No browser não há notificações, impressão digital nem cópias automáticas. Em **Definições → Lembretes** vês a lista do que a app vai lembrar no telemóvel.
> Os dados do browser são separados dos da app no telemóvel. Para os levar de um lado para o outro, usa **Definições → Dados → Exportar/Importar**.

---

## 2. Preparar o PC para gerar a APK (só uma vez)

Precisas de duas coisas: o **Android SDK** e o **Java 21**. Neste PC já está tudo instalado.

1. **Android SDK** (as ferramentas da Google), em `%LOCALAPPDATA%\Android\Sdk`. Há duas formas de o instalar:
   - **Pelo Android Studio** (<https://developer.android.com/studio>): abre-o uma vez, escolhe a instalação **Standard** e aceita as licenças. Ocupa 1 a 3 GB, porque inclui o emulador.
   - **Só o essencial**, cerca de 280 MB. Foi assim que se fez neste PC:
     1. Descarrega as «Command line tools only» em <https://developer.android.com/studio#command-line-tools-only>.
     2. Descompacta a pasta `cmdline-tools` para `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`.
     3. Corre no PowerShell (o `--no-metrics` desliga o envio de estatísticas de uso para a Google):

        ```powershell
        & "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\android.exe" --no-metrics sdk install platform-tools platforms/android-36 build-tools/35.0.0
        ```
2. **Java 21**, que o Capacitor 8 exige. O Java 25 que vem com o Android Studio recente é novo demais para o Gradle do projeto.
   - Neste PC está em `%LOCALAPPDATA%\Android\jdk-21`: é o Eclipse Temurin 21 (<https://adoptium.net>), só descompactado.
   - Também serve instalá-lo com `winget install EclipseAdoptium.Temurin.21.JDK`.
   - O script escolhe sozinho um Java do 21 ao 24. O teu Java 17 global não é alterado.
3. Não precisas de abrir o projeto no Android Studio; o script trata de tudo.

---

## 3. Gerar a APK

```bash
npm run apk
```

O ficheiro aparece em `release\Freela-v1.0.0.apk`. A primeira vez demora alguns minutos, porque o Gradle descarrega o que precisa; as seguintes são rápidas.

---

## 4. Instalar no telemóvel

### Opção A — por cabo USB (a mais simples para atualizar)

1. No telemóvel, ativa as **Opções de programador**: Definições → Acerca do telefone → toca 7 vezes em «Número de compilação».
2. Em Definições → Sistema → Opções de programador, liga a **Depuração USB**.
3. Liga o telemóvel ao PC e aceita o pedido «Permitir depuração USB».
4. No PC:

   ```bash
   npm run apk:install
   ```

### Opção B — copiar o ficheiro

1. Copia `release\Freela-v1.0.0.apk` para o telemóvel: por cabo, em modo «Transferência de ficheiros».
2. No telemóvel, abre o ficheiro com o gestor de ficheiros.
3. Se o Android pedir, permite «Instalar apps desconhecidas» para o gestor de ficheiros.
4. O Play Protect pode avisar que a app é desconhecida. É normal numa app feita por ti: escolhe «Instalar mesmo assim».

### Na primeira vez que abres a app

- **Notificações:** aceita, para receberes os lembretes de pagamentos e de prazos.
- **Bloqueio:** liga-se sozinho se o telemóvel tiver impressão digital ou PIN, e começa a pedir a partir da segunda vez que abres a app. Podes desligá-lo em Definições.

---

## 5. Atualizar a app (sem perder dados)

1. Aumenta a versão em `package.json` (ex.: `"version": "1.0.1"`).
2. Corre `npm run apk`.
3. Instala por cima, com `npm run apk:install` ou abrindo a APK nova no telemóvel. **Os dados mantêm-se.**

> ⚠️ **Nunca desinstales a app**: desinstalar apaga os dados. Se tiveres mesmo de o fazer, exporta antes uma cópia de segurança.

---

## 6. A chave de assinatura — GUARDA UMA CÓPIA

A pasta **`keystore\`** tem dois ficheiros:
- `freela-release.jks`
- `keystore.properties`

O Android só aceita atualizações assinadas com esta chave. Se a perderes, para instalar uma versão nova vais ter de desinstalar a app, e isso apaga os dados.

**Copia a pasta `keystore\` para uma pen USB ou outro disco.** Não a partilhes com ninguém. Não está no git de propósito.

---

## 7. Cópias de segurança dos dados

- **Automáticas:** todos os dias, se houve alterações, a app grava `Documentos/Freela/freela-backup-AAAA-MM-DD.json` e guarda as últimas 14.
- **Manuais:** em Definições → Dados → **Exportar cópia de segurança**. Também há «Exportar para Excel (CSV)».
- **Para o PC:**
  1. Liga o telemóvel por USB.
  2. Escolhe «Transferência de ficheiros».
  3. Copia a pasta `Documentos/Freela`.

  Faz isto de vez em quando. As cópias que ficam no telemóvel não te protegem se o perderes.
- **Restaurar:** em Definições → Dados → **Importar cópia de segurança**. Também funciona no ecrã de recuperação, se os dados alguma vez não abrirem.

---

## 8. Problemas comuns

| Problema | O que fazer |
|---|---|
| «App não instalada» ao atualizar | A APK nova foi assinada com outra chave, ou tem uma versão mais baixa. Usa a mesma pasta `keystore\` e aumenta a versão. |
| Não chegam notificações | Definições do Android → Apps → Freela → Notificações: liga-as. Em Definições → Lembretes da app, usa «Enviar notificação de teste». A poupança de bateria pode atrasar um pouco os lembretes. |
| `npm run apk` diz que não encontra o Java 21 ou o SDK | Vê o ponto 2. Se o Java 21 estiver noutra pasta, define a variável `FREELA_JAVA_HOME` com o caminho dessa pasta. |
| O Gradle falha com «Unsupported class file major version 69» | Está a usar o Java 25. Instala o Java 21 (ponto 2); o script passa a usá-lo sozinho. |
