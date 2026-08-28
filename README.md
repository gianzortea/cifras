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
| **Cadastrar** | Cola o texto do Cifra Club (Ctrl+V). Título, artista, tom e capotraste são detectados; acordes ficam alinhados na posição certa. |
| **Ajustar acordes** | Modo "Editar acordes": arraste pros lados, toque pra trocar, toque na letra pra inserir um novo. Nesse modo dá pra **dar zoom com dois dedos e arrastar a vista em qualquer direção**, para acertar posição com precisão. |
| **Mudar o tom** | Botões ▲/▼ ou escolha direta entre os 12 tons. A grafia acompanha o tom (Bb em tom de Fá, A# em tom de Si). |
| **Caber na tela** | Calcula sozinho a maior fonte que faz a música caber sem tocar na tela. **No máximo 2 colunas** numa tela — 3 colunas num celular deixam a coluna estreita demais pra uma linha de cifra. O botão de colunas fixa em 1 ou 2 quando você quiser. O **A− / A+** ajusta o tamanho; se passar do que cabe, aí sim vira página. |
| **Autoscroll** | Dois modos, salvos por música: **velocidade** (px/s) ou **duração** — você digita "3:40" e ele calcula o ritmo pra terminar junto com a música. Se houver áudio carregado, um botão preenche a duração dele. |
| **Desenhos de acorde** | Toque em qualquer acorde da cifra e veja as posições no braço. Também dá pra ver todos os acordes da música de uma vez, pelo menu. |
| **Áudio** | Um MP3/M4A de referência por música, guardado offline. Botão ↻ faz a rolagem começar junto com o play. |
| **Eventos** | Setlists ordenadas: reordene **arrastando pela alça ≡** ou pelos botões ▲▼. Dentro da cifra aparecem ‹ › pra pular pra próxima. |
| **Backup** | Dois JSONs: **Exportar cifras** (leve, sem os áudios) e **Exportar com áudios** (embute os arquivos em base64, ~34% maior que a soma dos MP3 — o tamanho estimado aparece no botão). Importar oferece mesclar ou substituir. |
| **Modo palco** | Toque na cifra pra esconder toda a interface. |

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

Outros tipos de linha: `{t:'s'}` seção, `{t:'tab'}` tablatura, `{t:'b'}` branco.

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
