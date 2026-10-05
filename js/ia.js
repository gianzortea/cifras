/* =========================================================
   ia.js — ajustar a cifra pedindo a um modelo de IA (OpenRouter)

   Não conhece a tela nem o armazenamento: converte a cifra pra um texto que o
   modelo entende, faz a chamada, lê a resposta e compara com o que havia.

   A CHAVE da OpenRouter nunca fica no código nem em texto aberto em repositório
   nenhum (o app é público). Ela vive em dois lugares:
     - neste aparelho, nos ajustes (fora de toda exportação);
     - no repositório de dados, em ia.json, cifrada com uma chave derivada do
       token do GitHub — que só tem quem entrou com a senha da banda.
   ========================================================= */

const IA_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Os modelos que dá pra escolher em Ajustes. O gratuito é um roteador: sorteia um
// modelo grátis a cada chamada. O pago gasta os créditos da chave.
const IA_MODELOS = {
  gratis:    { id: 'openrouter/free',     nome: 'Gratuito',     pago: false },
  gpt41mini: { id: 'openai/gpt-4.1-mini', nome: 'GPT-4.1 mini', pago: true }
};
function iaModelo(qual){ return IA_MODELOS[qual] || IA_MODELOS.gratis; }
const IA_ARQUIVO = 'ia.json';
const IA_ESPERA = 100000;                      // por tentativa; modelo gratuito às vezes leva minutos
const IA_TENTATIVAS = 3;

class IAErro extends Error {
  constructor(msg, status){ super(msg); this.name = 'IAErro'; this.status = status; }
}

/* ---------- cifra <-> texto com os acordes embutidos ----------
   Pro modelo, acorde em cima da letra (alinhado por espaços) é frágil: ele erra a
   coluna. Embutido na letra — "San[G]to" — o acorde fica preso à sílaba.
     ## Refrão        seção
     ---              espaço de uma linha
     (vazia)          respiro
     tablatura        como está */

/** lines -> texto. `nome(acorde)` dá o acorde como aparece na tela (com o tom aplicado). */
function iaParaTexto(lines, nome){
  nome = nome || ((c) => c);
  return (lines || []).map(l => {
    if(l.t === 'b') return '';
    if(l.t === 'gap') return '---';
    if(l.t === 's') return '## ' + l.text;
    if(l.t === 'tab') return l.text;
    let txt = l.text || '';
    const chs = (l.ch || []).slice().sort((a, b) => a.p - b.p);
    for(let i = chs.length - 1; i >= 0; i--){          // de trás pra frente: inserir não desloca os anteriores
      const c = chs[i];
      if(txt.length < c.p) txt += ' '.repeat(c.p - txt.length);
      txt = txt.slice(0, c.p) + '[' + nome(c.c) + ']' + txt.slice(c.p);
    }
    return txt;
  }).join('\n');
}

/** texto -> lines. `guardar(acorde)` converte o acorde da tela pro que fica guardado. */
function iaDeTexto(texto, guardar){
  guardar = guardar || ((c) => c);
  const out = [];
  String(texto || '').replace(/\r/g, '').split('\n').forEach(bruta => {
    const linha = bruta.replace(/\s+$/, '');
    if(!linha.trim()){ if(out.length && out[out.length - 1].t !== 'b') out.push({ t: 'b' }); return; }
    if(isGapLine(linha)){ out.push({ t: 'gap' }); return; }
    let m = linha.match(/^\s*#{1,6}\s*(.+?)\s*:?\s*$/);
    if(!m){
      // "[Refrão]" sozinho na linha: o modelo às vezes escreve seção assim, por hábito
      const s = linha.match(/^\s*\[([^\[\]]+)\]\s*:?\s*$/);
      if(s && !parseChord(s[1].trim())) m = s;
    }
    if(m){ out.push({ t: 's', text: m[1].replace(/^[*\[\s]+|[*\]\s]+$/g, '') }); return; }
    if(isTabLine(linha)){ out.push({ t: 'tab', text: linha }); return; }
    let text = '', fim = 0, r;
    const ch = [], re = /\[([^\[\]\n]{1,14})\]/g;
    while((r = re.exec(linha))){
      const tok = r[1].trim();
      text += linha.slice(fim, r.index);
      if(parseChord(tok)) ch.push({ p: text.length, c: guardar(tok) });
      else text += r[0];                               // colchete que não é acorde fica na letra
      fim = r.index + r[0].length;
    }
    text += linha.slice(fim);
    out.push({ t: 'l', text: text.replace(/\s+$/, ''), ch: ch });
  });
  while(out.length && out[out.length - 1].t === 'b') out.pop();
  return out;
}

/** A resposta do modelo virando lines — inclusive se ele ignorou o formato pedido */
function iaLinhas(texto, guardar, originalTinhaAcordes){
  guardar = guardar || ((c) => c);
  const embutido = iaDeTexto(texto, guardar);
  if(!originalTinhaAcordes || embutido.some(l => l.ch && l.ch.length)) return embutido;
  // nenhum acorde embutido: ou ele tirou todos, ou devolveu acordes em cima da letra.
  // O leitor normal do app entende os dois casos.
  const lidas = parseCifra(String(texto || '').replace(/^[ \t]*#{1,6}[ \t]*(.+?)[ \t]*$/gm, '[$1]')).lines;
  lidas.forEach(l => (l.ch || []).forEach(c => { c.c = guardar(c.c); }));
  return lidas;
}

/* ---------- a conversa com o modelo ---------- */

const IA_SISTEMA = [
  'Você edita cifras de violão dentro de um aplicativo. Recebe a cifra atual de uma música e um pedido do músico.',
  '',
  'FORMATO DA CIFRA — use exatamente o mesmo na resposta:',
  '- Os acordes ficam entre colchetes, dentro da letra, colados antes da sílaba em que são tocados: San[G]to, santo [D]é o Senhor',
  '- Linha só de acordes (intro, solo): [G]  [D]  [Em]  [C]',
  '- Nome de seção: uma linha começando com "## ". Nomes usuais: ## Intro, ## Primeira parte, ## Segunda parte, ## Pré-refrão, ## Refrão, ## Ponte, ## Solo, ## Final',
  '- Linha em branco separa os blocos. "---" sozinho numa linha abre um espaço maior.',
  '- Texto entre asteriscos aparece em negrito: *2x*',
  '- Linhas de tablatura (como E|--0--2--|) devem ser copiadas sem alteração.',
  '',
  'REGRAS:',
  '1. Faça somente o que foi pedido. Não mude letra, acordes, ordem nem seções que o pedido não menciona, e não corrija nada por conta própria.',
  '2. Devolva a cifra INTEIRA, do começo ao fim, mesmo que só uma linha tenha mudado. Nunca resuma, nunca use "..." nem "(repete)".',
  '3. Não invente letra que não está na cifra.',
  '4. Ao organizar a música em partes, use o que você sabe da música e a própria estrutura da letra (trechos que se repetem costumam ser o refrão).',
  '5. Se o pedido for só uma pergunta, ou for impossível ou ambíguo demais, não devolva a cifra: responda apenas no resumo.',
  '',
  'RESPOSTA — exatamente neste formato, sem nada antes nem depois:',
  '<cifra>',
  '(a cifra inteira, já alterada)',
  '</cifra>',
  '<resumo>',
  '(uma ou duas frases em português dizendo o que mudou — ou a resposta à pergunta)',
  '</resumo>'
].join('\n');

/** meta { title, artist, key } — o tom é o que está na tela */
function iaMensagens(meta, textoCifra, pedido){
  meta = meta || {};
  return [
    { role: 'system', content: IA_SISTEMA },
    { role: 'user', content:
        'Música: ' + (meta.title || 'sem título') + (meta.artist ? ' — ' + meta.artist : '') + '\n' +
        (meta.key ? 'Tom: ' + meta.key + '\n' : '') +
        '\n<cifra>\n' + textoCifra + '\n</cifra>\n\nPedido: ' + String(pedido || '').trim() }
  ];
}

/** Chama o modelo. Devolve { texto, modelo }. opt.sinal = AbortSignal pra cancelar; opt.modelo = chave de IA_MODELOS. */
async function iaPedir(chave, mensagens, opt){
  opt = opt || {};
  if(!chave) throw new IAErro('A IA não está configurada.', 0);
  const modelo = iaModelo(opt.modelo);
  let r;
  try{
    r = await fetch(IA_URL, {
      method: 'POST', signal: opt.sinal,
      headers: { 'Authorization': 'Bearer ' + chave, 'Content-Type': 'application/json', 'X-Title': 'Cifras' },
      // "pensar pouco" só faz sentido no roteador gratuito, onde pode cair um modelo que raciocina por minutos
      body: JSON.stringify(Object.assign({ model: modelo.id, messages: mensagens, temperature: 0.2 },
                                         modelo.pago ? {} : { reasoning: { effort: 'low' } }))
    });
  }catch(e){
    if(e && e.name === 'AbortError') throw new IAErro('Cancelado.', -1);
    throw new IAErro('Sem conexão com a IA. Confira a internet.', 0);
  }
  let j = null;
  try{ j = await r.json(); }catch(e){}
  // a OpenRouter às vezes devolve o erro dentro de uma resposta 200
  const erro = (j && j.error) || (j && j.choices && j.choices[0] && j.choices[0].error) || null;
  if(!r.ok || erro){
    const st = r.ok ? (+(erro && erro.code) || 502) : r.status;
    let msg;
    if(st === 401) msg = 'A chave da IA não foi aceita (inválida ou desativada).';
    else if(st === 402) msg = modelo.pago ? 'A chave da IA está sem créditos pra usar o ' + modelo.nome + '. Em Ajustes → IA dá pra voltar pro modelo gratuito.'
                                          : 'A chave da IA está sem créditos.';
    else if(st === 403) msg = 'A IA recusou este pedido.';
    else if(st === 404) msg = modelo.pago ? 'O modelo ' + modelo.nome + ' não está disponível pra essa chave.'
                                          : 'Nenhum modelo gratuito disponível pra essa chave agora. Na OpenRouter, a privacidade da conta precisa permitir os modelos gratuitos.';
    else if(st === 408 || st === 504) msg = 'A IA demorou demais pra responder. Tente de novo.';
    else if(st === 429) msg = modelo.pago ? 'Muitos pedidos seguidos. Espere um pouco e tente de novo.'
                                          : 'Limite de uso gratuito atingido. Espere um pouco e tente de novo.';
    else msg = 'O serviço de IA falhou agora (' + st + '). Tente de novo.';
    throw new IAErro(msg, st);
  }
  const m = j && j.choices && j.choices[0] && j.choices[0].message;
  const texto = m && typeof m.content === 'string' ? m.content : '';
  if(!texto.trim()) throw new IAErro('O modelo não respondeu nada. Tente de novo.', 502);
  return { texto: texto, modelo: (j && j.model) || '' };
}

/** Separa a cifra e o resumo da resposta. { cifra: texto|null, resumo, cortada } */
function iaLerResposta(txt){
  const t = String(txt || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  let cifra = null, cortada = false;
  const c = t.match(/<cifra>[ \t]*\n?([\s\S]*?)\n?[ \t]*<\/cifra>/i);
  if(c) cifra = c[1].replace(/^[ \t]*```[a-z]*[ \t]*\n/i, '').replace(/\n[ \t]*```[ \t]*$/, '');
  else if(/<cifra>/i.test(t)) cortada = true;          // abriu e não fechou: a resposta foi cortada no meio
  if(cifra !== null && !cifra.trim()) cifra = null;    // <cifra></cifra> vazio = "não mexi em nada"
  const r = t.match(/<resumo>\s*([\s\S]*?)\s*(?:<\/resumo>|$)/i);
  let resumo = r ? r[1].trim() : '';
  const noFormato = !!(c || r);
  if(!noFormato && !cortada) resumo = t.trim();        // respondeu fora do formato: o texto cru
  return { cifra: cifra, resumo: resumo, cortada: cortada, noFormato: noFormato };
}

/**
 * Pede e insiste. O roteador gratuito sorteia o modelo a cada chamada: às vezes cai
 * num que demora minutos, ou num que nem é de conversa (um classificador que só
 * responde "safe"). Resposta fora do formato, cortada ou lenta demais = tenta de
 * novo, que o sorteio muda. Erros que não adianta repetir (chave, limite) sobem na hora.
 *   opt.modelo     chave de IA_MODELOS (padrão: o gratuito)
 *   opt.sinal      AbortSignal do botão Cancelar
 *   opt.aoTentar   (numero, total) -> void
 * devolve { cifra, resumo, modelo }
 */
async function iaPedirCifra(chave, mensagens, opt){
  opt = opt || {};
  let ultimo = null;
  for(let n = 1; n <= IA_TENTATIVAS; n++){
    if(opt.aoTentar) opt.aoTentar(n, IA_TENTATIVAS);
    const ctl = new AbortController();
    let estourou = false;
    const relogio = setTimeout(() => { estourou = true; ctl.abort(); }, opt.espera || IA_ESPERA);
    const cancelar = () => ctl.abort();
    if(opt.sinal){
      if(opt.sinal.aborted){ clearTimeout(relogio); throw new IAErro('Cancelado.', -1); }
      opt.sinal.addEventListener('abort', cancelar);
    }
    try{
      const resp = await iaPedir(chave, mensagens, { sinal: ctl.signal, modelo: opt.modelo });
      const lido = iaLerResposta(resp.texto);
      if(lido.noFormato && !lido.cortada) return { cifra: lido.cifra, resumo: lido.resumo, modelo: resp.modelo };
      ultimo = new IAErro(lido.cortada ? 'A resposta da IA veio cortada no meio. Tente de novo.'
                                       : 'A IA não respondeu direito agora. Tente de novo em instantes.', 502);
    }catch(e){
      if(e.status === -1 && estourou) ultimo = new IAErro('A IA demorou demais pra responder. Tente de novo.', 408);
      else if(e.status === -1 || [0, 401, 402, 403, 404, 429].indexOf(e.status) >= 0) throw e;
      else ultimo = e;
    }finally{
      clearTimeout(relogio);
      if(opt.sinal) opt.sinal.removeEventListener('abort', cancelar);
    }
  }
  throw ultimo;
}

/** Diferença entre duas listas de textos: [{ op: 'eq'|'del'|'add', v }] */
function iaDiff(a, b){
  const n = a.length, m = b.length, L = [];
  for(let i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
  for(let i = n - 1; i >= 0; i--)
    for(let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while(i < n && j < m){
    if(a[i] === b[j]){ ops.push({ op: 'eq', v: a[i] }); i++; j++; }
    else if(L[i + 1][j] >= L[i][j + 1]){ ops.push({ op: 'del', v: a[i] }); i++; }
    else { ops.push({ op: 'add', v: b[j] }); j++; }
  }
  while(i < n) ops.push({ op: 'del', v: a[i++] });
  while(j < m) ops.push({ op: 'add', v: b[j++] });
  return ops;
}

/* ---------- a chave, compartilhada com a banda sem ficar exposta ----------
   Cifrada com uma chave derivada do token do GitHub. O token tem entropia de
   sobra (não é senha de gente), então não precisa de derivação lenta. Quem não
   entrou com a senha da banda não tem o token e não abre o arquivo. */

async function iaChaveDoToken(token){
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cifras-ia-v1:' + token));
  return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function iaCifrarChave(chaveIA, token){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, await iaChaveDoToken(token), new TextEncoder().encode(chaveIA));
  return { v: 1, alg: 'AES-GCM', iv: ghB64(iv), dado: ghB64(dado) };
}
async function iaDecifrarChave(pacote, token){
  try{
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ghDeB64(pacote.iv) }, await iaChaveDoToken(token), ghDeB64(pacote.dado));
    return new TextDecoder().decode(claro);
  }catch(e){
    throw new IAErro('A chave da IA do repertório foi protegida com um acesso antigo. Quem cuida do repertório precisa salvar a chave de novo em Ajustes → IA.', 409);
  }
}
function iaChaveValida(k){ return /^sk-or-[A-Za-z0-9_-]{20,}$/.test(String(k || '').trim()); }

/** Publica a chave (cifrada) no repositório de dados, pra quem entrou com a senha da banda */
async function iaPublicarChave(cfg, chaveIA){
  if(!cfg.token) throw new GHErro('Só quem está conectado ao repertório pode publicar a chave.', 401);
  const pacote = await iaCifrarChave(chaveIA, cfg.token);
  const remoto = await ghListar(cfg);
  await ghGravar(cfg, IA_ARQUIVO, ghBase64DeTexto(JSON.stringify(pacote)), remoto.get(IA_ARQUIVO) || null, 'Atualiza a chave da IA');
}
/** Busca a chave publicada. null se o repertório não tem. */
async function iaBuscarChave(cfg){
  if(!cfg.token) return null;
  const r = await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + IA_ARQUIVO, { headers: { 'Accept': 'application/vnd.github.raw' } });
  if(r.status === 404) return null;
  if(!r.ok) throw await ghFalha(r, 'buscar a chave da IA');
  let pacote;
  try{ pacote = JSON.parse(await r.text()); }catch(e){ throw new IAErro('O arquivo da chave da IA está corrompido.', 0); }
  return iaDecifrarChave(pacote, cfg.token);
}
