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
  // Quem sincroniza mesclou com UMA versão do GitHub. Se outra pessoa enviou depois
  // disso, gravar por cima apagaria o trabalho dela: para e pede pra sincronizar de novo.
  const mudou = () => new GHErro('Outra pessoa enviou enquanto você sincronizava. Toque em Enviar de novo: o app junta as duas versões.', 409);
  if(io.confereVersao && (remoto.get(GH_JSON) || null) !== (io.versaoEsperada || null)) throw mudou();

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
  try{
    // o sha diz ao GitHub qual versão está sendo substituída; se não for mais a atual, ele recusa
    res.versao = await ghGravar(cfg, GH_JSON, ghBase64DeTexto(JSON.stringify(saida)), remoto.get(GH_JSON) || null,
      'Repertório: ' + (dados.songs || []).length + ' música(s), ' + Object.keys(mapa).length + ' faixa(s)');
  }catch(e){
    if(io.confereVersao && (e.status === 409 || e.status === 422)) throw mudou();
    throw e;
  }

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
    const e = new GHErro('Esse repositório ainda não tem repertório. Alguém precisa enviar primeiro.', 404);
    e.semRepertorio = true;
    throw e;
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

/* =========================================================
   VÁRIAS PESSOAS EDITANDO
   ========================================================= */

/** Quando o CONTEÚDO da música mudou pela última vez (zoom e afins não contam) */
function ghCarimbo(x){ return +x.editadoEm || +x.updatedAt || +x.createdAt || 0; }
function ghClone(x){ return JSON.parse(JSON.stringify(x)); }

/**
 * Junta o repertório deste aparelho com o do GitHub, sem ninguém apagar o trabalho
 * de ninguém. Por música: vale a edição mais recente. `apagadas` {id: quando} é o
 * registro de exclusões — sem ele, o que um apagou voltaria na sincronia do outro.
 *
 *   local, remoto   { songs, events, apagadas }
 *   manter          campos que são de cada aparelho (tamanho de letra, tom...) e
 *                   por isso nunca vêm de fora numa música que já existe aqui
 * devolve { songs, events, apagadas, resumo }
 */
function ghMesclar(local, remoto, manter){
  manter = manter || [];
  const apag = {};
  [remoto.apagadas, local.apagadas].forEach(m => {
    for(const k in (m || {})) apag[k] = Math.max(apag[k] || 0, +m[k] || 0);
  });
  const morto = (x) => !!apag[x.id] && apag[x.id] >= ghCarimbo(x);
  const resumo = { novas: 0, atualizadas: 0, removidas: 0, minhasNovas: 0, minhasEdicoes: 0 };

  const juntar = (L, R, ehMusica) => {
    const doGitHub = new Map(R.map(x => [x.id, x]));
    const vistos = new Set(), out = [];
    for(const l of L){
      vistos.add(l.id);
      const r = doGitHub.get(l.id);
      if(!r){
        if(morto(l)){ if(ehMusica) resumo.removidas++; }
        else { out.push(ghClone(l)); if(ehMusica) resumo.minhasNovas++; }
        continue;
      }
      const cl = ghCarimbo(l), cr = ghCarimbo(r);
      if(apag[l.id] && apag[l.id] >= Math.max(cl, cr)){ if(ehMusica) resumo.removidas++; continue; }
      let v;
      if(cr > cl){
        v = ghClone(r);
        manter.forEach(k => { if(l[k] !== undefined) v[k] = l[k]; });
        if(ehMusica) resumo.atualizadas++;
      } else {
        v = ghClone(l);
        if(cl > cr && ehMusica) resumo.minhasEdicoes++;
      }
      if(ehMusica){
        // faixas de áudio: união dos dois lados. Perder uma gravação porque outra
        // pessoa mexeu na letra da mesma música seria o pior desfecho possível.
        const outro = cr > cl ? l : r;
        v.tracks = (v.tracks || []).slice();
        const tem = new Set(v.tracks.map(t => t.id));
        (outro.tracks || []).forEach(t => { if(!tem.has(t.id)) v.tracks.push(ghClone(t)); });
        v.tracks = v.tracks.filter(t => !apag[t.id]);
        const ativa = [l.trackAtiva, v.trackAtiva].find(id => v.tracks.some(t => t.id === id));
        v.trackAtiva = ativa || (v.tracks[0] ? v.tracks[0].id : null);
      }
      out.push(v);
    }
    for(const r of R){
      if(vistos.has(r.id) || morto(r)) continue;
      const v = ghClone(r);
      if(ehMusica){ v.tracks = (v.tracks || []).filter(t => !apag[t.id]); resumo.novas++; }
      out.push(v);
    }
    return out;
  };

  const songs = juntar(local.songs || [], remoto.songs || [], true);
  const ids = new Set(songs.map(s => s.id));
  const events = juntar(local.events || [], remoto.events || [], false)
    .map(e => Object.assign(e, { songs: (e.songs || []).filter(id => ids.has(id)) }));
  return { songs: songs, events: events, apagadas: apag, resumo: resumo };
}

/** "Substituir tudo": o aparelho vira cópia do GitHub (só os ajustes de tela ficam) */
function ghEspelhar(local, remoto, manter){
  const meus = new Map((local.songs || []).map(s => [s.id, s]));
  const songs = (remoto.songs || []).map(r => {
    const v = ghClone(r), l = meus.get(r.id);
    if(l) (manter || []).forEach(k => { if(l[k] !== undefined) v[k] = l[k]; });
    return v;
  });
  return { songs: songs, events: ghClone(remoto.events || []), apagadas: ghClone(remoto.apagadas || {}),
           resumo: { novas: songs.length, atualizadas: 0, removidas: 0, minhasNovas: 0, minhasEdicoes: 0 } };
}

/* ---------- senha da banda ----------
   O token de quem mantém o repertório fica no repositório, cifrado com a senha.
   Como o arquivo é público, a senha é a ÚNICA barreira e pode ser testada sem
   limite de tentativas no computador de qualquer um — por isso ela precisa ser
   longa, e a derivação da chave é lenta de propósito. */
const GH_ACESSO = 'acesso.json';
const GH_RODADAS = 600000;

function ghB64(bytes){ return ghBase64DeBytes(new Uint8Array(bytes)); }
function ghDeB64(txt){
  const bin = atob(txt), b = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
function ghSenhaLimpa(s){ return String(s || '').normalize('NFKC').trim().replace(/\s+/g, ' '); }

/** A senha aguenta alguém tentando adivinhar? { ok, motivo, bits } */
function ghSenhaForte(senha){
  const s = ghSenhaLimpa(senha);
  let alfabeto = 0;
  if(/[a-z]/.test(s)) alfabeto += 26;
  if(/[A-Z]/.test(s)) alfabeto += 26;
  if(/[0-9]/.test(s)) alfabeto += 10;
  if(/[^A-Za-z0-9]/.test(s)) alfabeto += 20;
  const bits = Math.round(s.length * Math.log2(alfabeto || 1));
  const fracas = ['12345678', '123456789', '1234567890', 'password', 'senha123', 'qwertyui', 'abcdefgh', '11111111', 'cifras123', 'igreja123'];
  let motivo = '';
  if(s.length < 8) motivo = 'Muito curta: use pelo menos 8 caracteres.';
  else if(/^(.)\1+$/.test(s)) motivo = 'Um caractere repetido não é senha.';
  else if(fracas.indexOf(s.toLowerCase()) >= 0) motivo = 'Essa é das primeiras que alguém tentaria.';
  else if(bits < 40) motivo = /^[0-9]+$/.test(s)
    ? 'Só números precisa de pelo menos 12 dígitos. Melhor misturar letras, ou usar uma frase.'
    : 'Ainda fraca: aumente, misture letras e números, ou use uma frase de 3 ou 4 palavras.';
  return { ok: !motivo, motivo: motivo, bits: bits };
}

async function ghChave(senha, sal, rodadas){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(ghSenhaLimpa(senha)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: rodadas, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function ghCifrarToken(token, senha){
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const dado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, await ghChave(senha, sal, GH_RODADAS), new TextEncoder().encode(token));
  return { v: 1, kdf: 'PBKDF2-SHA256', rodadas: GH_RODADAS, sal: ghB64(sal), iv: ghB64(iv), dado: ghB64(dado) };
}

async function ghDecifrarToken(pacote, senha){
  try{
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ghDeB64(pacote.iv) },
      await ghChave(senha, ghDeB64(pacote.sal), +pacote.rodadas || GH_RODADAS), ghDeB64(pacote.dado));
    return new TextDecoder().decode(claro);
  }catch(e){
    throw new GHErro('Senha incorreta.', 401);       // AES-GCM confere a integridade: senha errada não decifra
  }
}

/** Quem tem o token publica a senha da banda */
async function ghPublicarAcesso(cfg, senha){
  const forca = ghSenhaForte(senha);
  if(!forca.ok) throw new GHErro(forca.motivo, 0);
  if(!cfg.token) throw new GHErro('Só quem já tem acesso de envio pode definir a senha.', 401);
  const pacote = await ghCifrarToken(cfg.token, senha);
  const remoto = await ghListar(cfg);
  await ghGravar(cfg, GH_ACESSO, ghBase64DeTexto(JSON.stringify(pacote)), remoto.get(GH_ACESSO) || null, 'Atualiza a senha da banda');
}

async function ghRemoverAcesso(cfg){
  const remoto = await ghListar(cfg);
  if(remoto.has(GH_ACESSO)) await ghApagar(cfg, GH_ACESSO, remoto.get(GH_ACESSO), 'Remove a senha da banda');
}

/** O repertório tem senha da banda publicada? */
async function ghTemAcesso(cfg){
  return (await ghListar(cfg)).has(GH_ACESSO);
}

/** Membro da banda: troca a senha pelo token. Devolve o token ou lança GHErro. */
async function ghEntrarComSenha(repo, senha){
  const cfg = { repo: repo };
  let r = await ghChamar(cfg, '/repos/' + repo + '/contents/' + GH_ACESSO, { headers: { 'Accept': 'application/vnd.github.raw' } });
  if(!r.ok && (r.status === 403 || r.status === 429)){
    try{ r = await fetch(GH_RAW + '/' + repo + '/HEAD/' + GH_ACESSO + '?t=' + Date.now(), { cache: 'no-store' }); }
    catch(e){ throw new GHErro('Sem conexão com o GitHub. Confira a internet.', 0); }
  }
  if(r.status === 404) throw new GHErro('Esse repertório ainda não tem senha da banda. Peça pra quem cuida dele definir uma.', 404);
  if(!r.ok) throw await ghFalha(r, 'buscar o acesso');
  let pacote;
  try{ pacote = JSON.parse(await r.text()); }catch(e){ throw new GHErro('O arquivo de acesso está corrompido.', 0); }
  return ghDecifrarToken(pacote, senha);
}

/* ---------- sincronizar: planejar (sem efeito nenhum) e executar ---------- */

/**
 * Lê o GitHub e calcula o que vai acontecer, sem mudar nada. A tela usa isso pra
 * pedir confirmação com números de verdade.
 *   io.local()            -> { songs, events, apagadas }
 *   io.jaTem(faixa)       -> async bool
 *   opt { substituir, manter }
 */
async function ghPlanejar(cfg, io, opt){
  opt = opt || {};
  let sha = null, remoto = null;
  if(cfg.token){
    // pelo sha: garante que o conteúdo lido é exatamente a versão que o envio vai substituir
    sha = (await ghListar(cfg)).get(GH_JSON) || null;
    if(sha){
      const r = await ghChamar(cfg, '/repos/' + cfg.repo + '/git/blobs/' + sha, { headers: { 'Accept': 'application/vnd.github.raw' } });
      if(!r.ok) throw await ghFalha(r, 'baixar o repertório');
      try{ remoto = JSON.parse(await r.text()); }
      catch(e){ throw new GHErro('O arquivo do GitHub está corrompido (não é um JSON válido).', 0); }
    }
  } else {
    try{ remoto = (await ghBaixarJson(cfg)).dados; }
    catch(e){ if(!e.semRepertorio) throw e; }
  }
  const local = io.local();
  const vazio = { songs: [], events: [], apagadas: {} };
  const resultado = opt.substituir ? ghEspelhar(local, remoto || vazio, opt.manter)
                                   : ghMesclar(local, remoto || vazio, opt.manter);
  const arquivos = (remoto && remoto.audioFiles) || {};
  const faltam = [];
  for(const t of ghTodasFaixas(resultado)){
    if(!arquivos[t.id]) continue;
    if(await io.jaTem(t)) continue;
    faltam.push(t);
  }
  return { cfg: cfg, sha: sha, temRemoto: !!remoto, enviadoEm: remoto && remoto.exportedAt, resultado: resultado,
           arquivos: arquivos, faltam: faltam, bytesFaltam: faltam.reduce((a, t) => a + (t.size || 0), 0) };
}

/**
 * Executa o plano: baixa os áudios que faltam, grava no aparelho e (se pedido) envia.
 *   io.guardarBlob(id, blob), io.salvar(resultado), io.blobDaFaixa(id),
 *   io.empacotar(resultado) -> objeto no formato do exportar, io.progresso(texto)
 */
async function ghExecutar(plano, io, opt){
  opt = opt || {};
  const cfg = plano.cfg, diga = io.progresso || function(){};
  const res = { baixadas: 0, falharam: 0, envio: null };
  let n = 0;
  for(const t of plano.faltam){
    n++;
    diga('Baixando áudio ' + n + ' de ' + plano.faltam.length + '...');
    try{
      const r = cfg.token
        ? await ghChamar(cfg, '/repos/' + cfg.repo + '/contents/' + plano.arquivos[t.id], { headers: { 'Accept': 'application/vnd.github.raw' } })
        : await fetch(GH_RAW + '/' + cfg.repo + '/HEAD/' + plano.arquivos[t.id]);
      if(!r.ok){ res.falharam++; continue; }
      await io.guardarBlob(t.id, new Blob([await r.arrayBuffer()], { type: t.type || 'application/octet-stream' }));
      res.baixadas++;
    }catch(e){ res.falharam++; }
  }
  diga('Guardando no aparelho...');
  await io.salvar(plano.resultado);
  if(opt.enviar){
    res.envio = await ghEnviar(cfg, io.empacotar(plano.resultado),
      { blobDaFaixa: io.blobDaFaixa, progresso: diga, confereVersao: true, versaoEsperada: plano.sha });
  }
  return res;
}
