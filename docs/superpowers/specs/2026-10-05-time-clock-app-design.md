# App de Ponto — Planejamento

**Status:** planejamento **aprovado em 05/10/2026** — próximo passo: plano de implementação (nada construído ainda)
**Início:** 05/10/2026 · **Última atualização:** 05/10/2026

---

## 1. Objetivo
App de bater ponto **manual**, com interface clean, para uso nos EUA (Massachusetts), salvo na tela inicial do iPhone. Mostra quanto você tem a receber por semana (horas + gastos reembolsáveis com recibo) e gera um PDF para o patrão conferir.

---

## 2. O que você pediu
- Lançamento manual das horas — o app **não** roda em segundo plano
- Ao bater ponto: **empregador**, **data e hora no mesmo campo**, **localização**
- Localização: endereço + pino **arrastável no mapa**, com a maior precisão possível
- **Configurações**: horário padrão por dia da semana; empregadores (adicionar, editar, excluir) com **valor por hora**
- Mudar o valor por hora afeta **só lançamentos futuros**; o passado nunca muda
- **Saldo semanal** na tela principal, com semanas **passadas e futuras**
- **Exportar PDF em formato vertical de Stories (9:16)** para o patrão, escolhendo o que mostrar, com as fotos dos recibos
- Interface clean, pouco texto, acessível, fácil de usar
- Tecnologia web moderna, instalável na tela inicial
- CSS revisado com **Impeccable** (github.com/pbakaus/impeccable)

---

## 3. Decisões do app
- **App independente** — sem ligação com o Franco's ou qualquer outro app
- **Uso individual** — só o Igor usa; sem contas nem login
- **Lançamento único por turno** — entrada e saída no mesmo registro
- **Intervalo opcional** — minutos de intervalo no lançamento, já preenchidos com o padrão do dia; descontados das horas pagas
- **Hora extra por empregador** — liga/desliga em cada empregador; ligada, horas acima de 40 h na semana com aquele empregador pagam 1,5x
- **Massachusetts** — 1,5x acima de 40 h/semana com o mesmo empregador; sem hora extra diária e sem dobra (igual à regra federal)
- **Semanas futuras sem previsão** — mostram só o que já foi lançado
- **Semana de pagamento única** — dia de início escolhido nas configurações, igual para todos os empregadores
- **Ajuste da hora = horários padrão por dia** — entrada, saída e intervalo já vêm preenchidos; sem arredondamento e sem troca de fuso
- **Dados só no iPhone** — sem servidor e sem banco externo
- **Backup manual** — exportar e importar um arquivo de backup (app Arquivos/iCloud)
- **Interface em inglês, padrão americano** — MM/DD/YYYY, 12 h (AM/PM), US$

---

## 4. Regras de negócio
- O valor por hora fica **gravado em cada lançamento** no momento em que ele é criado
- Cada empregador guarda um **histórico de valores** com a data em que cada um começou a valer
- Saldo da semana = soma de (horas × valor gravado), mais 1,5x nas horas acima de 40 h quando a hora extra estiver ligada para o empregador, **mais os gastos** (reembolso, sem multiplicar e fora da conta da hora extra)
- Editar um lançamento antigo **não** troca o valor gravado nele
- Hora extra conta por empregador, em ordem de horário: as horas que passam de 40 na semana pagam 1,5x o valor gravado nos lançamentos em que caíram
- O saldo da tela inicial soma todos os empregadores da semana
- Um turno que passa da meia-noite ou da virada da semana pertence ao dia/semana da **entrada**
- Saída antes da entrada, ou intervalo maior que o turno, não salva e mostra o erro no campo
- Se você trocar o empregador de um lançamento antigo, ele passa a usar o valor desse empregador vigente na data do lançamento
- Apagar um empregador **arquiva**: ele sai das opções de novo lançamento, mas lançamentos e saldos passados continuam intactos

---

## 5. UI/UX — telas aprovadas

**Visual geral**
- Tema segue o iPhone (claro/escuro automático)
- Cor de destaque neutra: preto no claro, branco no escuro; cor só para avisos (ex.: erro em vermelho)

**Início — "Saldo em destaque"**
- Topo: engrenagem (Settings) e compartilhar (Export); sem barra de abas embaixo
- Navegação da semana: ‹ Oct 4 – 10 ›
- Valor da semana grande no centro, total de horas logo abaixo
- Lista simples: dia · empregador · horas
- Botão redondo "+" no canto para novo lançamento
- Segurar o dedo num lançamento abre menu com Edit e Delete (Delete pede confirmação)

**Novo lançamento — página única**
- Empregadores em botões no topo
- In e Out: data e hora juntas no mesmo campo (ex.: "Mon, Oct 5 · 7:00 AM")
- Break (minutos)
- Local, de três formas:
  - GPS (posição atual)
  - **Digitar o endereço** num campo de busca, com sugestões enquanto digita — para quando você não está no local; ao tocar no campo vazio, aparecem os **últimos endereços usados** (um toque escolhe)
  - Arrastar o pino no mapa para ajustar
- Endereço escolhido aparece embaixo do mapa
- Botão "Save" mostrando o total de horas

**Settings**
- Employers: lista com valor/h + "Add employer"
- Work: Default schedule (por dia: In – Out · Break, ou Off); Week starts on
- Data: Export backup, Import backup

**Edit employer**
- Name, Hourly rate, Overtime 1.5× after 40 h (liga/desliga)
- Rate history (valores com a data em que começaram a valer)
- Aviso "New rate applies to new entries only"
- Delete employer (arquiva)

**Export week**
- Semana aberta na tela
- Employers: marca um, alguns ou todos
- Show (liga/desliga, sempre começa tudo ligado):
  - **Valores, cada um separado:** Regular pay (horas normais), Overtime pay (hora extra), Expenses (recibos) — ver seção 7
  - Hourly rate (valor por hora)
  - Addresses
  - Times and break
- "Share PDF" → menu de compartilhar do iPhone (WhatsApp, Mensagens, e-mail, salvar em Arquivos)

**PDF para o patrão (formato 9:16, um arquivo)**
- **Página 1 — relatório de horas** (desenho aprovado abaixo)
- **Páginas seguintes — um recibo por página (aprovado):** no topo "RECEIPT 1 OF 2", descrição, empregador · data e valor grande; foto grande embaixo; número da página no rodapé (ex.: "Page 2 of 3"); recibo com mais de uma foto ocupa uma página por foto; o patrão pode dar zoom sem perder qualidade
- Sem gastos na semana, ou com Expenses desligado: o PDF tem só a página 1
- Os recibos só entram no PDF quando Expenses estiver ligado

**Página 1 — relatório**
- Tudo centralizado, com espaçamento generoso
- Topo: "TIME REPORT", empregador, semana (+ valor/h se Hourly rate ligado)
- Total de horas grande no centro (sempre aparece)
- **Bloco de valores — uma linha para cada valor ligado, cada uma com o seu total:**
  - Regular pay — horas normais e valor (ex.: 40 h · $1,280.00)
  - Overtime pay — horas extras e valor (ex.: 11.5 h · $552.00)
  - Expenses — total dos recibos (ex.: $175.50)
  - **Total** — soma só das linhas que estão aparecendo; a conta sempre fecha na tela
  - Se nenhuma linha de valor estiver ligada, o bloco inteiro (inclusive o Total) some
- Lista de dias — linha 1: dia + data, entrada–saída (se Times ligado), horas; linha 2 pequena e cinza: intervalo (se Times ligado) · endereço (se Addresses ligado)
- Sem nome no rodapé
- Tudo desligado: empregador, semana, total de horas e horas de cada dia
- Overtime pay desligado não esconde as horas: o total de horas e as horas de cada dia continuam completos

---

## 6. Tecnologia
**Decidido:**
- **Hospedagem: GitHub Pages** — grátis, https; hospeda só os arquivos do app (os lançamentos ficam no iPhone). No plano grátis o repositório é público: o código fica visível, os dados não
- O endereço do app não deve mudar depois de instalado (o iOS liga os dados ao endereço); se mudar, migrar pelo backup
- **PWA** (instala na tela inicial, sem App Store e sem mensalidade)
- **Base: React + TypeScript + Vite**, com componentes acessíveis (Radix/shadcn) + Tailwind
- **Mapa: MapLibre + OpenFreeMap**, endereços pelo OpenStreetMap (Nominatim para converter a posição em endereço; Photon para a busca com sugestões enquanto digita) — grátis, sem chave e sem cadastro; GPS do iPhone em alta precisão + pino arrastável para corrigir
- Dados: armazenamento local (IndexedDB), pedindo ao iOS armazenamento persistente
- Fotos dos recibos: reduzidas no aparelho antes de salvar (para não encher o iPhone) e incluídas no arquivo de backup
- PDF de exportação gerado no próprio aparelho (biblioteca de PDF no navegador), com as fotos dos recibos em boa resolução
- Impeccable para auditar e polir o CSS antes da entrega

---

## 7. Gastos / reembolso (novo — telas aprovadas)
**O que você pediu:**
- Lançar gastos, com opção de incluir o **recibo**
- Caso de uso: você passa o seu cartão para comprar material e acerta isso no pagamento (salário)

**Decidido:**
- Cada gasto é ligado a **um empregador**
- O valor entra no saldo da semana como **reembolso**, separado das horas (não conta para a hora extra)
- Recibo: **câmera ou galeria**, até 3 fotos por gasto; as fotos ficam no iPhone e entram no backup
- Campos: **valor (US$)**, **descrição** e fotos do recibo; sem campo de loja
- A data do gasto é **automática (hoje)**, só para ele cair na semana certa; pode ser ajustada se o gasto for de outro dia
- PDF para o patrão: item **Expenses** na lista Show (começa ligado); ligado, a página 1 mostra a linha Expenses com o total a reembolsar e a descrição + valor de cada gasto, e cada recibo ganha uma página própria com a foto; desligado, nada de gastos aparece e o Total não os soma
- **Tela inicial:** o gasto é uma linha na lista da semana (ícone de recibo · dia · descrição · valor); o saldo grande soma horas + gastos, e a linha de baixo mostra o detalhe (ex.: "38.5 h · $1,240.00 + $175.50 expenses")
- **Novo gasto:** o botão "+" abre uma escolha entre **Time entry** e **Expense**
- **Formulário de gasto:** empregadores em botões no topo; Description; Amount; Date (hoje); até 3 fotos do recibo (câmera ou galeria); botão "Save" mostrando o valor
- **Editar/apagar:** segurar o dedo na linha do gasto abre Edit e Delete (pede confirmação), igual aos lançamentos de horas
- **Export week:** novo item **Expenses** na lista Show; ligado, a página 1 ganha um bloco com descrição + valor de cada gasto e o total a reembolsar, o Total geral soma os gastos, e as fotos dos recibos entram nas páginas seguintes
- **Empregador arquivado:** os gastos dele continuam nas semanas passadas
---

## 8. Perguntas em aberto (app de ponto)
_(nenhuma)_ — o mapa abre na sua posição pelo GPS; se o GPS demorar, abre no último endereço usado

---

## 9. Próximos passos
1. ~~Regras do app~~ ✓
2. ~~Desenho das telas (UI/UX)~~ ✓
3. ~~Tecnologia e hospedagem~~ ✓
4. ~~Você aprova este documento~~ ✓
5. Plano de implementação ← **estamos aqui**
6. Construção
