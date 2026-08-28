# Cifras

Visualizador de cifras offline para tocar no celular. HTML + CSS + JS puros, sem
dependências, sem build, sem internet.

## Como usar

**No computador (testar):** abra `index.html` direto no navegador, ou rode um
servidor local:

```bash
python -m http.server 8777
```

**No celular (recomendado):** coloque a pasta em qualquer hospedagem estática
(GitHub Pages, Netlify, Vercel — todos grátis), abra no Chrome/Safari e use
"Adicionar à tela de início". Aí ele vira um app: abre em tela cheia, sem barra
de navegador, e funciona 100% offline (service worker + localStorage).

> Abrindo por `file://` também funciona, mas o service worker não é registrado e
> o "adicionar à tela de início" não fica disponível.

## O que dá pra fazer

| | |
|---|---|
| **Cadastrar** | Cola o texto do Cifra Club (Ctrl+V). Título, artista, tom e capotraste são detectados; acordes ficam alinhados na posição certa. |
| **Ajustar acordes** | Modo "Editar acordes": arraste pros lados, toque pra trocar, toque na letra pra inserir um novo. |
| **Mudar o tom** | Botões ▲/▼ ou escolha direta entre os 12 tons. A grafia acompanha o tom (Bb em tom de Fá, A# em tom de Si). |
| **Caber na tela** | Calcula sozinho a maior fonte que faz a música inteira caber, usando de 1 a 4 colunas. Zero scroll. O **A− / A+** ajusta o tamanho *sem sair do modo*: a fonte diminui e as colunas são recalculadas pra continuar cabendo (ao encolher bastante, 3 colunas viram 2, que ficam mais largas e menos apertadas). A+ para no maior tamanho que cabe. |
| **Autoscroll** | Dois modos, salvos por música: **velocidade** (px/s) ou **duração** — você digita "3:40" e ele calcula o ritmo pra terminar junto com a música. Se houver áudio carregado, um botão preenche a duração dele. |
| **Desenhos de acorde** | Toque em qualquer acorde da cifra e veja as posições no braço. Também dá pra ver todos os acordes da música de uma vez, pelo menu. |
| **Áudio** | Um MP3/M4A de referência por música, guardado offline. Botão ↻ faz a rolagem começar junto com o play. |
| **Eventos** | Setlists ordenadas: reordene **arrastando pela alça ≡** ou pelos botões ▲▼. Dentro da cifra aparecem ‹ › pra pular pra próxima. |
| **Backup** | Exporta/importa tudo em JSON (com ou sem os áudios). |
| **Modo palco** | Toque na cifra pra esconder toda a interface. |

Tema **claro** por padrão; o escuro fica em Ajustes.

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

## Atualizando o app depois de editar os arquivos

O service worker serve do cache primeiro e revalida em segundo plano
(*stale-while-revalidate*). Isso deixa o app abrir instantâneo e funcionar sem
internet — mas significa que, depois de alterar um arquivo, **a primeira abertura
ainda mostra a versão antiga** e a segunda já traz a nova.

Se estiver desenvolvendo e quiser ver a mudança na hora, no DevTools:
Application → Storage → *Clear site data*, ou marque "Update on reload".
