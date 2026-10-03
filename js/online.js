/* =========================================================
   online.js — repertório guardado num repositório do GitHub
   Sem servidor e sem banco: o repositório É o armazenamento.

     cifras.json            o mesmo JSON do exportar/importar
     audio/<idDaFaixa>.ext  um arquivo por faixa, enviado uma única vez

   Ler um repositório público não exige token; escrever exige.
   Este arquivo não toca na tela nem no armazenamento local: recebe
   funções pra isso. Assim roda igual no navegador e num teste.
   ========================================================= */

const GH_API = 'https://api.github.com';
const GH_RAW = 'https://raw.githubusercontent.com';
const GH_JSON = 'cifras.json';
const GH_PASTA = 'audio';
const GH_MAX_ARQUIVO = 45 * 1024 * 1024;     // a API recusa arquivo muito grande

class GHErro extends Error {
  constructor(msg, status){ super(msg); this.name = 'GHErro'; this.status = status || 0; }
}

/** "dono/repo" válido? */
function ghRepoValido(repo){
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/.test(String(repo || '').trim());
}

function ghExtensao(tipo){
  const t = String(tipo || '').toLowerCase();
  if(t.indexOf('mp4') >= 0 || t.indexOf('m4a') >= 0 || t.indexOf('aac') >= 0) return 'm4a';
  if(t.indexOf('webm') >= 0) return 'webm';
  if(t.indexOf('mpeg') >= 0 || t.indexOf('mp3') >= 0) return 'mp3';
  if(t.indexOf('ogg') >= 0) return 'ogg';
  if(t.indexOf('wav') >= 0) return 'wav';
  return 'bin';
}
function ghCaminhoFaixa(t){
  return GH_PASTA + '/' + String(t.id).replace(/[^A-Za-z0-9_-]/g, '_') + '.' + ghExtensao(t.type);
}

/** bytes -> base64, em pedaços (um String.fromCharCode gigante estoura a pilha) */
function ghBase64DeBytes(bytes){
  let bin = '';
  const N = 0x8000;
  for(let i = 0; i < bytes.length; i += N) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + N));
  return btoa(bin);
}
async function ghBase64DeBlob(blob){ return ghBase64DeBytes(new Uint8Array(await blob.arrayBuffer())); }
function ghBase64DeTexto(txt){ return ghBase64DeBytes(new TextEncoder().encode(txt)); }

function ghTodasFaixas(dados){
  const l = [];
  (dados.songs || []).forEach(s => (s.tracks || []).forEach(t => l.push(t)));
  return l;
}

/** Chamada à API. Devolve a Response; quem chama decide o que é erro. */
async function ghChamar(cfg, caminho, opt){
  opt = opt || {};
  const h = Object.assign({ 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opt.headers || {});
  if(cfg.token) h.Authorization = 'Bearer ' + cfg.token;
  if(opt.body) h['Content-Type'] = 'application/json';
  // Sem token o GitHub guarda a resposta por ~60s num cache compartilhado — inclusive
  // um "não encontrado". Um parâmetro que muda a cada chamada obriga a resposta real;
  // sem isso a banda baixaria a versão de um minuto atrás logo depois de um envio.
  if(!cfg.token && (!opt.method || opt.method === 'GET'))
    caminho += (caminho.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now() + Math.floor(Math.random() * 1000);
  try{
    return await fetch(GH_API + caminho, { method: opt.method || 'GET', headers: h, body: opt.body, cache: 'no-store' });
  }catch(e){
    throw new GHErro('Sem conexão com o GitHub. Confira a internet.', 0);
  }
}

/** Transforma a resposta de erro em algo que dá pra entender e agir */
async function ghFalha(r, oQue){
  let detalhe = '';
  try{ detalhe = ((await r.json()).message || ''); }catch(e){}
  const limite = r.headers.get('x-ratelimit-remaining') === '0';
  let msg;
  if(r.status === 401) msg = 'Token inválido ou vencido. Gere outro no GitHub e cole em Ajustes.';
  else if(r.status === 403 && limite) msg = 'Limite de acessos do GitHub atingido. Espere alguns minutos e tente de novo.';
  else if(r.status === 403) msg = 'O token não tem permissão de escrita nesse repositório (precisa de "Contents: Read and write").';
  else if(r.status === 404) msg = 'Repositório não encontrado. Confira o nome (dono/repositório) e se o token dá acesso a ele.';
  else if(r.status === 409) msg = 'O GitHub mudou enquanto enviava. Tente de novo.';
  else if(r.status === 413 || r.status === 422) msg = 'O GitHub recusou ' + oQue + (detalhe ? ' (' + detalhe + ')' : '') + '.';
  else msg = 'Erro do GitHub ao ' + oQue + ' (' + r.status + (detalhe ? ': ' + detalhe : '') + ').';
  return new GHErro(msg, r.status);
}

/** Tudo que existe no repositório: Map caminho -> sha. Repositório vazio = Map vazio. */
async function ghListar(cfg){
  const r = await ghChamar(cfg, '/repos/' + cfg.repo + '/git/trees/HEAD?recursive=1');
  if(r.status === 404 || r.status === 409){
    // 404 pode ser "repositório não existe" ou só "ainda sem nenhum commit": distingue
    const rr = await ghChamar(cfg, '/repos/' + cfg.repo);
    if(!rr.ok) throw await ghFalha(rr, 'abrir o repositório');
    return new Map();
  }
  if(!r.ok) throw await ghFalha(r, 'listar o repositório');
  const j = await r.json();
  const m = new Map();
  (j.tree || []).forEach(x => { if(x.type === 'blob') m.set(x.path, x.sha); });
  return m;
}

/** O token consegue escrever? (pra avisar antes de começar um envio longo) */
async function ghPodeEscrever(cfg){
  const r = await ghChamar(cfg, '/repos/' + cfg.repo);
  if(!r.ok) throw await ghFalha(r, 'abrir o repositório');
  const j = await r.json();
  return { escreve: !!(j.permissions && j.permissions.push), privado: !!j.private, nome: j.full_name };
}

async function ghGravar(cfg, caminho, base64, sha, mensagem){
  const corpo = { message: mensagem, content: base64 };
  if(sha) corpo.sha = sha;
  const r = await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + caminho, { method: 'PUT', body: JSON.stringify(corpo) });
  if(!r.ok) throw await ghFalha(r, 'gravar ' + caminho);
  return (await r.json()).content.sha;
}

async function ghApagar(cfg, caminho, sha, mensagem){
  const r = await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + caminho,
    { method: 'DELETE', body: JSON.stringify({ message: mensagem, sha: sha }) });
  if(!r.ok && r.status !== 404) throw await ghFalha(r, 'apagar ' + caminho);
}

/**
 * ENVIAR: o repositório passa a espelhar este aparelho.
 * Ordem importa: primeiro os áudios, depois o JSON, por último a limpeza —
 * assim quem baixar no meio do envio nunca recebe um JSON apontando pra áudio
 * que ainda não subiu, e um envio interrompido continua de onde parou.
 *
 *   dados           objeto no formato do exportar (songs, events...)
 *   io.blobDaFaixa  async (idDaFaixa) -> Blob | null
 *   io.progresso    (texto) -> void
 * devolve { enviadas, jaEstavam, removidas, semArquivo, grandes, versao }
 */
async function ghEnviar(cfg, dados, io){
  io = io || {};
  if(!cfg.token) throw new GHErro('Para enviar é preciso um token. Quem só baixa não precisa.', 401);
  const diga = io.progresso || function(){};
  diga('Lendo o repositório...');
  const remoto = await ghListar(cfg);

  const faixas = ghTodasFaixas(dados);
  const mapa = {};                       // idDaFaixa -> caminho no repositório
  const res = { enviadas: 0, jaEstavam: 0, removidas: 0, semArquivo: 0, grandes: 0, versao: null };

  let n = 0;
  for(const t of faixas){
    n++;
    const caminho = ghCaminhoFaixa(t);
    if(remoto.has(caminho)){ mapa[t.id] = caminho; res.jaEstavam++; continue; }
    const blob = await io.blobDaFaixa(t.id);
    if(!blob){ res.semArquivo++; continue; }
    if(blob.size > GH_MAX_ARQUIVO){ res.grandes++; continue; }
    diga('Enviando áudio ' + n + ' de ' + faixas.length + '...');
    await ghGravar(cfg, caminho, await ghBase64DeBlob(blob), null, 'Áudio: ' + (t.name || t.id));
    mapa[t.id] = caminho;
    res.enviadas++;
  }

  diga('Enviando as cifras...');
  const saida = Object.assign({}, dados, { audios: {}, audioFiles: mapa });
  res.versao = await ghGravar(cfg, GH_JSON, ghBase64DeTexto(JSON.stringify(saida)), remoto.get(GH_JSON) || null,
    'Repertório: ' + (dados.songs || []).length + ' música(s), ' + Object.keys(mapa).length + ' faixa(s)');

  // áudios que não pertencem mais a nenhuma música
  const emUso = new Set(Object.keys(mapa).map(k => mapa[k]));
  const sobras = Array.from(remoto.keys()).filter(p => p.indexOf(GH_PASTA + '/') === 0 && !emUso.has(p));
  let k = 0;
  for(const p of sobras){
    k++;
    diga('Limpando áudios antigos ' + k + ' de ' + sobras.length + '...');
    await ghApagar(cfg, p, remoto.get(p), 'Remove áudio sem uso');
    res.removidas++;
  }
  return res;
}

/** Versão (sha) do cifras.json que está no GitHub agora; null se ainda não existe */
async function ghVersao(cfg){
  return (await ghListar(cfg)).get(GH_JSON) || null;
}

/**
 * BAIXAR, passo 1: só o JSON (leve). Devolve { dados, versao }.
 * Pela API vem sempre atual; sem token ela permite só 60 acessos por hora por
 * rede, então, se estourar, cai pro endereço de arquivo cru (cache de até 5 min).
 */
async function ghBaixarJson(cfg){
  let r = await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + GH_JSON, { headers: { 'Accept': 'application/vnd.github.raw' } });
  if(!r.ok && (r.status === 403 || r.status === 429) && !cfg.token){
    try{ r = await fetch(GH_RAW + '/' + cfg.repo + '/HEAD/' + GH_JSON + '?t=' + Date.now(), { cache: 'no-store' }); }
    catch(e){ throw new GHErro('Sem conexão com o GitHub. Confira a internet.', 0); }
  }
  if(r.status === 404){
    const rr = await ghChamar(cfg, '/repos/' + cfg.repo);
    if(!rr.ok) throw await ghFalha(rr, 'abrir o repositório');
    throw new GHErro('Esse repositório ainda não tem repertório. Alguém precisa enviar primeiro.', 404);
  }
  if(!r.ok) throw await ghFalha(r, 'baixar o repertório');
  let dados;
  try{ dados = JSON.parse(await r.text()); }
  catch(e){ throw new GHErro('O arquivo do GitHub está corrompido (não é um JSON válido).', 0); }
  if(!dados || !Array.isArray(dados.songs)) throw new GHErro('O arquivo do GitHub não parece um repertório de cifras.', 0);
  return { dados: dados };
}

/**
 * BAIXAR, passo 2: os áudios que faltam neste aparelho.
 *   io.jaTem      async (faixa) -> bool   (pula o que já está aqui)
 *   io.progresso  (texto) -> void
 * devolve { blobs: Map(idDaFaixa -> Blob), baixadas, falharam }
 */
async function ghBaixarAudios(cfg, dados, io){
  io = io || {};
  const diga = io.progresso || function(){};
  const arquivos = dados.audioFiles || {};
  const faltam = [];
  for(const t of ghTodasFaixas(dados)){
    if(!arquivos[t.id]) continue;
    if(io.jaTem && await io.jaTem(t)) continue;
    faltam.push(t);
  }
  const blobs = new Map();
  let n = 0, falharam = 0;
  for(const t of faltam){
    n++;
    diga('Baixando áudio ' + n + ' de ' + faltam.length + '...');
    try{
      // com token vai pela API (serve repositório privado); sem token, pelo endereço
      // de arquivo cru, que não gasta o limite de 60 acessos por hora
      const r = cfg.token
        ? await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + arquivos[t.id], { headers: { 'Accept': 'application/vnd.github.raw' } })
        : await fetch(GH_RAW + '/' + cfg.repo + '/HEAD/' + arquivos[t.id]);
      if(!r.ok){ falharam++; continue; }
      blobs.set(t.id, new Blob([await r.arrayBuffer()], { type: t.type || 'application/octet-stream' }));
    }catch(e){ falharam++; }
  }
  return { blobs: blobs, baixadas: blobs.size, falharam: falharam };
}

/** Quantos áudios (e bytes) ainda precisam ser baixados — pra avisar antes */
async function ghFaltamBaixar(dados, jaTem){
  const arquivos = dados.audioFiles || {};
  let n = 0, bytes = 0;
  for(const t of ghTodasFaixas(dados)){
    if(!arquivos[t.id]) continue;
    if(jaTem && await jaTem(t)) continue;
    n++; bytes += (t.size || 0);
  }
  return { faixas: n, bytes: bytes };
}
