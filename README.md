# Cifras

Visualizador de cifras offline para tocar no celular. HTML + CSS + JS puros, sem
dependências, sem build, sem internet.

**No ar em: https://gianzortea.github.io/cifras/**

Abra esse endereço no celular e use "Adicionar à tela de início" — a partir daí
ele abre como app, em tela cheia, e funciona no modo avião.

## Como usar

**No computador (testar):** abra `index.html` direto no navegador, ou rode um
servidor local:

```bash
python -m http.server 8777
```

**No celular:** abra https://gianzortea.github.io/cifras/ e use "Adicionar à
tela de início". Vira um app: tela cheia, sem barra de navegador, 100% offline
(service worker + localStorage).

**Publicar uma nova versão:** `git push` — o GitHub Pages reconstrói sozinho em
1 a 2 minutos. Ao mudar arquivos, suba também o número em `const CACHE` no
`sw.js`, senão o cache antigo continua valendo.

> Abrindo por `file://` também funciona, mas o service worker não é registrado e
> o "adicionar à tela de início" não fica disponível.

## O que dá pra fazer

| | |
|---|---|
| **Cadastrar** | Cola o texto do Cifra Club (Ctrl+V). Título, artista, tom e capotraste são detectados; acordes ficam alinhados na posição certa. Linha em branco vira só um respiro pequeno; para abrir um **espaço de uma linha inteira**, escreva `---` sozinho numa linha (vários `---` somam). Texto entre asteriscos (`*Refrão 2x*`, `Santo *santo*`) aparece em **negrito**, sem os asteriscos; os acordes da linha continuam em cima das mesmas sílabas. |
| **Ajustar acordes** | Modo "Editar acordes": arraste pros lados, toque pra trocar, toque na letra pra inserir um novo. Nesse modo dá pra **dar zoom com dois dedos e arrastar a vista em qualquer direção**, para acertar posição com precisão. |
| **Desfazer / refazer** | Botões ↶ ↷ na barra do modo edição e no menu ⋮ da cifra (Ctrl+Z / Ctrl+Y no computador). Vale pra mover, trocar, inserir e remover acorde, "Simplificar acordes" e "Fixar o tom". Até **20 passos** por música, só na memória: continua valendo se você sair e voltar na mesma música, e recomeça ao abrir outra ou fechar o app. Zoom, colunas e tom da tela ficam de fora. |
| **Mudar o tom** | Botões ▲/▼ ou escolha direta entre os 12 tons. A grafia acompanha o tom (Bb em tom de Fá, A# em tom de Si). |
| **Caber na tela** | Calcula sozinho a maior fonte que faz a música caber sem tocar na tela. **No máximo 2 colunas** numa tela — 3 colunas num celular deixam a coluna estreita demais pra uma linha de cifra. O botão de colunas fixa em 1 ou 2 quando você quiser. O **A− / A+** ajusta o tamanho; se passar do que cabe, aí sim vira página. |
| **Autoscroll** | Dois modos, salvos por música: **velocidade** (px/s) ou **duração** — você digita "3:40" e ele calcula o ritmo pra terminar junto com a música. Se houver áudio carregado, um botão preenche a duração dele. |
| **Desenhos de acorde** | Toque em qualquer acorde da cifra e veja as posições no braço. Também dá pra ver todos os acordes da música de uma vez, pelo menu. |
| **Áudio** | **Várias faixas por música** (original, sua gravação, playback...), guardadas offline; uma toca por vez. Com mais de uma, o player mostra o **número** da faixa (`#01`, `#02` — o nome fica na lista) e esse botão abre a lista pra trocar. Cada faixa tem nome editável e **recorte próprio** (onde começa e onde termina — tocando, pause no ponto e toque em *◉ aqui*, ou digite `10`, `0:10`, `1:05.5`). Botão **−5s** volta cinco segundos sem parar a música (e sem sair do recorte). Botão ↻ faz a rolagem começar junto com o play — com ele ligado, o −5s volta a cifra junto; a rolagem por duração usa o tamanho do trecho. |
| **Gravar** | Botão **● Gravar** na cifra: grava pelo microfone ali mesmo, com a letra na tela, e ao parar salva como **mais uma faixa** (nunca substitui as que já existem). Barra com relógio e medidor de volume; continua visível no modo palco. Depois abre o recorte de início/fim. |
| **Eventos** | Setlists ordenadas: reordene **arrastando pela alça ≡** ou pelos botões ▲▼. Dentro da cifra aparecem ‹ › pra pular pra próxima. Ao criar (ou editar) dá pra marcar **Evento particular**: fica só neste aparelho, com a etiqueta "particular" na lista — não entra na sincronia nem no JSON do GitHub (vai só no backup exportado). Tornar particular um evento já publicado o retira do GitHub e dos outros aparelhos. **Arquivar** (menu ⋮ do evento) tira o evento da lista sem apagar nada; **Arquivados (N)**, no fim da lista, mostra os arquivados com o botão Desarquivar. Arquivar é um dado do evento, então sincroniza: vale pra banda toda (menos em evento particular). |
| **Backup** | Dois JSONs: **Exportar cifras** (leve, sem os áudios) e **Exportar com áudios** (embute os arquivos em base64, ~34% maior que a soma dos MP3 — o tamanho estimado aparece no botão). Importar oferece mesclar ou substituir. |
| **Ajustar com IA** | Última opção do menu ⋮ da cifra: você escreve o pedido ("no refrão, troque o F#m por D", "organize nas partes da música") e um modelo gratuito da OpenRouter devolve a cifra alterada. O app mostra **o que muda, linha a linha**, e só aplica se você tocar em Aplicar — e entra no desfazer. |
| **Online (GitHub)** | Ligado por padrão: o repertório (cifras, eventos **e áudios**) fica num repositório do GitHub. Quem abre o app sem ter entrado vê um aviso: **Entrar** (pede a **senha da banda**, uma vez por aparelho) ou **Continuar offline**. Depois de entrar é tudo automático: o app baixa as novidades ao abrir e **publica sozinho** o que for alterado, sempre mesclando antes — ninguém apaga o trabalho de ninguém. Tudo continua guardado no aparelho e funciona sem internet. Dá pra desligar em Ajustes. |
| **Modo palco** | Toque na cifra pra esconder toda a interface. |
| **Zoom** | Pinça com dois dedos em **qualquer modo**, inclusive *caber na tela* (no computador: Ctrl + roda ou pinça no trackpad). É uma lupa: amplia sem refazer o layout, então voltar ao 100% (no botão `150% ✕`) deixa tudo exatamente como estava. |

Tema **claro** por padrão; o escuro fica em Ajustes.

### O que mais aumenta a fonte no "caber na tela"

Não é coluna — é **espaçamento**. Numa música de 34 linhas com linha mais longa
de 45 caracteres, num celular de 373px úteis:

| espaçamento | fonte |
|---|---|
| normal | 11,0px |
| **compacto** (padrão) | **12,7px** |
| mínimo | 13,5px |

Coluna funciona ao contrário do que parece: forçar 2 colunas nessa mesma música
dá **6,6px**, quase metade. Cada coluna vira 164px e uma linha de 45 caracteres
só cabe ali com fonte minúscula. Duas colunas só compensam em música **longa com
linhas curtas** — e nesse caso o modo automático já escolhe sozinho.

## Estrutura

```
index.html          casca do app
css/style.css       tema (escuro/claro), layout mobile
js/chords.js        acordes: reconhecimento, transposição, simplificação
js/parser.js        texto colado -> modelo de linhas com acordes posicionados
js/diagrams.js      desenhos de acorde (abertos, pestana e busca no braço)
js/store.js         localStorage (músicas/eventos) + IndexedDB (áudios)
js/online.js        enviar/baixar o repertório num repositório do GitHub
js/ia.js            "Ajustar com IA": conversa com a OpenRouter e guarda da chave
js/app.js           rotas, telas e o visualizador
sw.js               cache offline
manifest.json       instalação como app
```

## Backup e áudio

`Exportar cifras (.json)` leva cifras, eventos e ajustes — alguns KB, dá pra
mandar por WhatsApp. **Os arquivos de áudio não vão nesse JSON**, só o nome
deles.

`Exportar com áudios` embute cada MP3 dentro do próprio JSON, codificado em
base64. Isso infla ~34%: 120 KB de áudio viram ~161 KB de arquivo. Com um
repertório grande, o arquivo passa fácil de centenas de MB — por isso o botão
mostra o tamanho estimado antes, e fica desativado quando não há nenhum áudio.

Na importação, quem manda é o arquivo que existe de verdade: se o backup veio
sem os áudios, a música deixa de anunciar que tem um (nada de ♫ mentiroso na
lista). Reimportar o backup leve **no mesmo aparelho** preserva os áudios que já
estavam ali, porque a checagem é feita no arquivo e não no rótulo.

## Modo online (GitHub como armazenamento)

Sem servidor e sem banco: um repositório público do GitHub guarda os dados
([cifras-dados](https://github.com/gianzortea/cifras-dados)).

```
cifras.json            o mesmo JSON do exportar/importar, + audioFiles {idDaFaixa: caminho}
audio/<idDaFaixa>.ext  um arquivo por faixa
```

**Quem não entrou** (offline): a cada abertura do app aparece o aviso "Repertório
da banda" com *Entrar* e *Continuar offline*, e a lista ganha uma faixa "Offline"
com o botão Entrar. Nada vai nem vem do GitHub. Com o online desligado em Ajustes
não há aviso nenhum.

**Quem entrou** sincroniza sozinho. Uma sincronia é: ler o GitHub → juntar com o
aparelho → baixar os áudios que faltam → gravar no aparelho → publicar, se houver
o que publicar. Ela roda ao abrir o app, ~4 s depois de qualquer alteração, ao sair
de uma cifra, ao voltar pro app depois de 2 minutos e quando a internet volta.
**Com uma cifra aberta não roda nunca** — nem rede, nem tela mudando no meio da
música; o que foi alterado ali (edição, gravação) sobe ao sair. O estado aparece
ao lado do número de músicas: *sincronizando… / ✓ sincronizado / sem internet*.

**Só publica quando o conteúdo muda.** O que sobe é a música sem os ajustes do
aparelho (`ghMusicaPublica`), e antes de enviar o app compara uma impressão
digital do repertório (`ghAssinatura`: chaves e listas em ordem fixa) com a do
GitHub. Sem isso, dois aparelhos ficariam se reenviando o mesmo repertório pra
sempre, e mexer no zoom geraria um envio.

**Publicar**: a ordem é áudios → JSON → limpeza dos áudios sem uso, pra quem baixar
no meio nunca receber um JSON apontando pra áudio que ainda não subiu; e um envio
interrompido continua de onde parou na sincronia seguinte.

**Consequências do automático** que a tela avisa: excluir uma música (ou evento)
estando conectado exclui pra banda toda; "Apagar tudo" limpa só o aparelho, e o
repertório volta na sincronia seguinte. Token cancelado no GitHub → o aparelho
volta a ser offline e é convidado a entrar de novo.

### Várias pessoas editando

**Senha da banda.** Pra gravar no GitHub é preciso uma credencial. O token de quem
cuida do repertório fica no próprio repositório (`acesso.json`), cifrado com a
senha (PBKDF2-SHA256, 600 mil rodadas → AES-GCM). Quem digita a senha certa
recupera o token e o aparelho passa a sincronizar.

O arquivo é público, então a senha é a única barreira e pode ser testada sem
limite de tentativas. Por isso ela tem tamanho mínimo: medido num PC de 12
núcleos, 4 números caem em 65 segundos; 8 letras e números levam ~580 anos. O
app recusa senha fraca. Tirar o acesso de alguém não é trocar a senha — é gerar
outro token, apagar o antigo no GitHub e publicar senha nova (o arquivo antigo
continua no histórico do git, cifrado com a senha antiga).

**Mescla.** Por música vale a edição mais recente (`editadoEm`, que só
anda quando o *conteúdo* muda — mexer em zoom ou tom não conta). As faixas de áudio
são unidas dos dois lados: ninguém perde uma gravação porque outro corrigiu a letra.
Música que nunca teve edição datada (cópia de antes do `editadoEm`) tem data só
estimada, e data estimada não vence edição nem exclusão datada: um aparelho
parado há semanas não desfaz, por ter mexido no zoom, a correção que alguém publicou.

**Exclusões** ficam num registro (`apagadas: {id: quando}`) que viaja no JSON.
Sem ele, a música que um apagou voltaria na sincronia do outro. Aparelho zerado
não tem registro, então recebe tudo de volta em vez de apagar o repertório.

**Corrida.** O envio informa ao GitHub qual versão está substituindo. Se outra
pessoa publicou no meio, o GitHub recusa e o app refaz a sincronia sozinho (até 3
vezes), mesclando com a versão nova. O mesmo vale se o próprio aparelho mudou
enquanto a sincronia falava com o GitHub: ela recomeça em vez de gravar por cima.

**O que é de cada aparelho** e nunca vem de fora numa música que já existe:
tamanho de letra, colunas, tom e velocidade da rolagem. Pra mudar o tom de todo
mundo, "Fixar o tom" no menu da música reescreve os acordes no tom da tela.

Detalhes que custaram descobrir:

- **Cache de leitura sem token.** A API guarda por ~60s a resposta de quem lê sem
  token — inclusive um "não encontrado". Cada leitura leva um parâmetro novo na
  URL pra vir sempre a versão atual.
- **Limite de 60 leituras por hora** pra quem não tem token (por rede, então uma
  banda inteira no mesmo wi-fi divide). Por isso só o JSON vai pela API; os áudios
  vêm de `raw.githubusercontent.com`, que não conta nesse limite.
- **O token nunca sai do aparelho**: fica fora de toda exportação e do JSON
  enviado (`settingsParaExportar`). O repositório é público, então isso importa.
- **Testes nunca escrevem no repositório de dados de verdade.** `cifras-dados` é
  o repertório real da banda; a sincronia é testada com um GitHub simulado no
  navegador (`fetch` trocado por um repositório em memória).
- Tetos do GitHub: arquivo de até ~45 MB pela API e repositório recomendado
  abaixo de 1 GB — umas 250 faixas de 4 minutos a ~1 MB por minuto.

## Ajustar com IA

Usa o roteador de modelos gratuitos da OpenRouter (`openrouter/free`), direto do
navegador — sem servidor.

**A chave não está no código.** O app é público (repositório e GitHub Pages), então
qualquer chave escrita nele seria de todo mundo. Ela é colada uma vez em
**Ajustes → IA** por quem cuida do repertório e fica em dois lugares:

- no aparelho, nos ajustes (fora de backup e de sincronia, como o token);
- em `ia.json`, no repositório de dados, **cifrada** (AES-GCM) com uma chave derivada
  do token do GitHub. Só quem entrou com a senha da banda tem o token, então só a
  banda abre. Os outros aparelhos buscam a chave sozinhos no primeiro uso; se ela for
  trocada, a OpenRouter recusa a antiga e o app busca a nova.

A segurança da chave da IA é, portanto, a da senha da banda. Trocar o token do
GitHub exige salvar a chave de novo (o app faz isso sozinho no aparelho de quem
troca). Vale manter um limite de gasto na chave, do lado da OpenRouter.

**O que vai e o que volta.** Vai a cifra daquela música (título, artista, tom da
tela, letra e acordes) e o pedido. Pro modelo os acordes vão embutidos na letra —
`San[G]to` — porque alinhar acorde por coluna de espaços é onde ele mais erra; na
volta o app converte de novo, e um acorde que já existia volta exatamente como
estava guardado, mesmo com o tom mudado na tela.

**Nada é aplicado sozinho.** A resposta vira uma proposta com o resumo do modelo, as
linhas que saem e as que entram, e avisos quando a letra mudou ou a resposta veio
menor que a original. Aplicar é um passo do desfazer.

**Modelo gratuito é loteria.** O roteador sorteia o modelo a cada chamada: nos testes
uma resposta levou 4 s, outra 84 s, outra passou de 3 minutos, e uma caiu num classificador que só respondeu
"safe". Por isso cada pedido tenta até 3 vezes (100 s cada) quando a resposta vem fora
do formato, cortada ou não vem; erro de chave ou de limite de uso não é repetido. A
OpenRouter limita os pedidos gratuitos por dia, e esse limite é da chave — ou seja,
dividido pela banda.

## Faixas de áudio

Cada música tem uma lista `tracks`, e o arquivo de cada faixa fica no IndexedDB
sob o **id da faixa**:

```js
tracks: [ { id, name, type, size, dur, gravado, start, end } ],   // start/end = recorte, em segundos
trackAtiva: 'id-da-faixa-que-o-player-toca'
```

No formato antigo havia um áudio só (`audio`, `audioStart`, `audioEnd`) e o
arquivo ficava sob o id da música. A conversão é feita na leitura, e a faixa
**herda o id da música** — assim o arquivo que já está no aparelho continua
valendo sem ser movido, e backups antigos importam direto.

Ao importar, se uma música do arquivo tem o mesmo id de outra diferente que já
existe aqui, ela entra com faixas de ids novos: sem isso as duas passariam a
dividir o mesmo arquivo. "Substituir tudo" apaga os arquivos das músicas que
saíram, mas só depois de gravar a lista nova com sucesso.

## Gravação

O gravador usa o `MediaRecorder` do navegador — nada de biblioteca. Detalhes que
importam:

- **Formato:** MP4/AAC quando o aparelho suporta (toca em qualquer celular e já
  traz a duração no arquivo), senão WebM/Opus. A 128 kbps dá ~1 MB por minuto.
- **WebM sai sem duração:** o `<audio>` abre com `duration = Infinity`, o que
  quebraria a barra de posição e o recorte. O app guarda a duração que ele mesmo
  mediu ao gravar e, ao abrir, pede uma posição absurda (`currentTime = 1e101`)
  pra forçar o navegador a varrer o arquivo e descobrir a duração real.
- **Sem filtros de voz:** cancelamento de eco, supressão de ruído e ganho
  automático ficam desligados — eles tratam violão e canto como ruído.
- **Não perde tomada:** regravar só troca o áudio antigo ao parar e salvar;
  sair da música no meio salva em vez de descartar.
- **Precisa de HTTPS** (ou localhost): o navegador só libera o microfone em
  contexto seguro. No endereço do GitHub Pages funciona, inclusive offline.

## Onde os dados ficam

- **localStorage** — músicas, eventos, preferências. Leve, síncrono, ~5 MB.
- **IndexedDB** — arquivos de áudio, que são pesados demais pro localStorage.

Tudo fica **só no aparelho**. Trocou de celular ou limpou os dados do navegador,
os dados vão junto — por isso exporte um JSON de vez em quando.

## Modelo de dados

Cada linha da cifra é guardada separando letra e acordes, o que é o que permite
arrastar acorde e transpor sem estragar o alinhamento:

```js
{ t: 'l', text: 'Today is gonna be the day',
  ch: [ {p: 0, c: 'Em7'}, {p: 14, c: 'G'} ] }   // p = coluna do caractere
```

Outros tipos de linha: `{t:'s'}` seção, `{t:'tab'}` tablatura, `{t:'b'}` branco
(respiro pequeno), `{t:'gap'}` espaço de uma linha — escrito como `---` no editor.

O tom é guardado como está na fonte original + um deslocamento (`transpose`),
então dá pra voltar ao original a qualquer momento sem perder nada.

## Como os desenhos de acorde são gerados

Em três camadas, nessa ordem:

1. **Acordes abertos clássicos** — tabela pequena com o que todo mundo toca
   (C `x32010`, G `320003`, D `xx0232`, Am, Em, B7...).
2. **Formas móveis de pestana** — E-form (tônica na 6ª corda) e A-form (tônica
   na 5ª), deslocadas pra casa certa. Cobre F, Bm, Bb, F#m, Cm e companhia.
3. **Busca no braço** — só pro que sobrou (`Bm7b5`, `C9`, `Am/G`, `Bdim7`...).
   Enumera as combinações possíveis e pontua por: nº de cordas soando, cordas
   soltas, quantidade de dedos, altura no braço e esticada do indicador.

Por isso `D/F#` sai `200232` e não uma invenção lá na 10ª casa.

## Como a atualização chega no celular

Automática, sem reinstalar nada. Ao abrir o app com internet, o navegador baixa
o `sw.js`; se mudou, o service worker novo instala, pré-carrega os arquivos e
assume no lugar do antigo.

A página que já está na tela continua com o código velho carregado na memória —
por isso o app **avisa** em vez de trocar embaixo do seu pé: aparece uma barra
"Nova versão disponível · Atualizar · Depois". Tocar em *Atualizar* recarrega e
pronto; ignorar também funciona, porque na próxima abertura já entra a nova.

**O aviso nunca aparece com uma cifra aberta.** Se a atualização chega enquanto
você está tocando, ela fica guardada e a barra só surge quando você volta para a
lista. Em Ajustes há ainda *Procurar atualização*, para conferir antes de um
evento, e a versão instalada aparece no rodapé (`Cifras v9`).

### Publicando uma nova versão

```bash
python bump-version.py
```

Isso sobe o número em `sw.js` (`const CACHE`) e nas URLs dos scripts em
`index.html` (`app.js?v=12`) de uma vez só — depois é `git push` e o Pages
reconstrói em 1 a 2 minutos.

Os dois lugares importam: o `CACHE` faz o service worker se ver como novo, e a
query nas URLs impede o navegador de servir um `app.js` velho do próprio cache
HTTP. Sem a query, dá pra passar horas caçando um bug que já estava corrigido no
disco.

Por isso a instalação do service worker busca os arquivos com `cache: 'reload'`:
sem isso ele podia gravar no cache offline uma cópia velha vinda do cache HTTP.
