/* =========================================================
   store.js — persistência
   localStorage: músicas, eventos, preferências (texto, leve)
   IndexedDB   : áudios (blobs, pesados)
   ========================================================= */

const LS = {
  songs:    'cifras.songs.v1',
  events:   'cifras.events.v1',
  settings: 'cifras.settings.v1',
  apagadas: 'cifras.apagadas.v1'      // {id: quando} — exclusões, pra sincronia entre aparelhos
};

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function readLS(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ console.warn('LS read', key, e); return fallback; }
}
function writeLS(key, val){
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){
    alert('Não consegui salvar: o armazenamento do navegador está cheio.\n' +
          'Exporte um backup e remova áudios pesados.');
    return false;
  }
}

const DEFAULT_SETTINGS = {
  theme: 'light',
  fontSize: 16,
  fitMode: true,
  scrollSpeed: 26,
  keepAwake: true,
  showChords: true,
  spacing: 'compacto',   // normal | compacto | minimo
  usarOnline: true,      // repertório no GitHub (js/online.js) — ligado por padrão
  ghRepo: '',            // "dono/repositorio"
  ghToken: '',           // só neste aparelho; NUNCA entra em exportação
  ghSinc: 0,             // última sincronização que deu certo

  notation: 'en'   // 'en' = C D E | 'pt' = Dó Ré Mi (só exibição do tom)
};

const Store = {
  songs(){ return readLS(LS.songs, []).map(migrarAudio); },
  saveSongs(list){ const ok = writeLS(LS.songs, list); avisarMudanca(); return ok; },

  events(){ return readLS(LS.events, []); },
  saveEvents(list){ const ok = writeLS(LS.events, list); avisarMudanca(); return ok; },

  settings(){ return Object.assign({}, DEFAULT_SETTINGS, readLS(LS.settings, {})); },
  saveSettings(s){ return writeLS(LS.settings, s); },

  getSong(id){ return this.songs().find(s => s.id === id) || null; },

  upsertSong(song){
    const list = this.songs();
    const i = list.findIndex(s => s.id === song.id);
    const agora = Date.now();
    // editadoEm só anda quando o CONTEÚDO muda. Mexer no zoom ou no tom não pode
    // fazer a cópia deste aparelho parecer "mais nova" que a edição de outra pessoa.
    if(i < 0) song.editadoEm = song.editadoEm || agora;
    else if(assinaturaConteudo(list[i]) !== assinaturaConteudo(song)) song.editadoEm = agora;
    else song.editadoEm = list[i].editadoEm || list[i].updatedAt || agora;
    song.updatedAt = agora;
    if(i >= 0) list[i] = song; else list.unshift(song);
    this.saveSongs(list);
    return song;
  },

  deleteSong(id){
    // pega as faixas ANTES de tirar a música da lista — depois não há mais de onde ler
    const alvo = this.getSong(id);
    const faixas = (alvo && alvo.tracks) || [];
    this.marcarApagado([id].concat(faixas.map(t => t.id)));
    this.saveSongs(this.songs().filter(s => s.id !== id));
    const evs = this.events().map(e => ({...e, songs: (e.songs||[]).filter(x => x !== id)}));
    this.saveEvents(evs);
    faixas.forEach(t => Audio_DB.del(t.id));      // arquivos de todas as faixas
    Audio_DB.del(id);                             // e o do formato antigo, se houver
  },

  getEvent(id){ return this.events().find(e => e.id === id) || null; },

  upsertEvent(ev){
    const list = this.events();
    ev.updatedAt = Date.now();
    const i = list.findIndex(e => e.id === ev.id);
    if(i >= 0) list[i] = ev; else list.unshift(ev);
    this.saveEvents(list);
    return ev;
  },

  deleteEvent(id){
    // evento particular nunca saiu do aparelho: não há exclusão pra avisar a ninguém
    const ev = this.getEvent(id);
    if(!(ev && ev.privado)) this.marcarApagado([id]);
    this.saveEvents(this.events().filter(e => e.id !== id));
  },

  /* Registro de exclusões. Sem ele, o que foi apagado aqui voltaria na próxima
     sincronia, porque o outro aparelho (ou o GitHub) ainda tem a música. */
  apagadas(){ return readLS(LS.apagadas, {}); },
  saveApagadas(m){ const ok = writeLS(LS.apagadas, m || {}); avisarMudanca(); return ok; },
  marcarApagado(ids){
    const m = this.apagadas(), agora = Date.now();
    (ids || []).forEach(id => { if(id) m[id] = agora; });
    this.saveApagadas(m);
  }
};

/* Quem quiser saber que os dados mudaram (a sincronia) pendura uma função em
   Store.aoMudar. Store.silencio = true cala o aviso — a própria sincronia usa isso
   ao gravar o que baixou, senão ela dispararia a si mesma pra sempre. */
function avisarMudanca(){
  if(!Store.silencio && typeof Store.aoMudar === 'function') Store.aoMudar();
}

/** O que conta como conteúdo da música (o que os outros recebem ao sincronizar) */
function assinaturaConteudo(s){
  return JSON.stringify([s.title, s.artist, s.key, s.capo || 0, s.notes || '', s.scrollMode || '', s.scrollDuration || 0,
    s.lines, (s.tracks || []).map(t => [t.id, t.name, t.start || 0, t.end || 0])]);
}

/** Ajustes que podem sair do aparelho. O token e o estado da sincronia ficam de fora:
    o JSON exportado vai pra WhatsApp, e-mail e — no modo online — pra um repositório público. */
function settingsParaExportar(){
  const s = Store.settings();
  ['ghToken', 'ghRepo', 'online', 'usarOnline', 'ghSinc', 'ghBaixou', 'ghEnviou', 'ghVersao'].forEach(k => { delete s[k]; });
  return s;
}

function newSong(partial){
  return Object.assign({
    id: uid(),
    title: 'Sem título',
    artist: '',
    key: '',            // tom original (como cadastrado)
    transpose: 0,       // semitons aplicados na exibição
    capo: 0,
    lines: [],
    scrollSpeed: null,  // null = usa o global
    scrollMode: 'speed', // 'speed' = px/s | 'duration' = terminar em X segundos
    scrollDuration: 0,   // segundos (modo 'duration')
    fontSize: null,
    fitMode: null,
    fitScale: null,     // 1 = maior tamanho que cabe; menor = usuário diminuiu
    fitColsPref: 0,     // 0 = automático; 1 ou 2 = fixado pelo usuário
    notes: '',
    tags: [],
    tracks: [],         // faixas de áudio: {id, name, type, size, dur, gravado, start, end}
    trackAtiva: null,   // id da faixa que o player toca
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, partial || {});
}

/* ---------- faixas de áudio ----------
   Cada música tem uma lista de faixas; o arquivo de cada uma fica no IndexedDB
   sob o id da FAIXA. start/end são o recorte (segundos; end 0 = até o fim).

   Formato antigo: um áudio só, em s.audio, com o arquivo sob o id da MÚSICA.
   Na conversão a faixa herda o id da música — assim o arquivo que já está no
   aparelho continua valendo, sem precisar mover nada. */
function migrarAudio(s){
  if(!s) return s;
  if(s.audio && !(Array.isArray(s.tracks) && s.tracks.length)){
    s.tracks = [{
      id: s.id, name: s.audio.name || 'Áudio', type: s.audio.type || '', size: s.audio.size || 0,
      dur: +s.audio.dur || 0, gravado: !!s.audio.gravado,
      start: +s.audioStart || 0, end: +s.audioEnd || 0
    }];
    s.trackAtiva = s.id;
  }
  if(!Array.isArray(s.tracks)) s.tracks = [];
  delete s.audio; delete s.audioStart; delete s.audioEnd;
  if(!s.tracks.some(t => t.id === s.trackAtiva)) s.trackAtiva = s.tracks.length ? s.tracks[0].id : null;
  return s;
}

function faixaAtiva(s){
  if(!s || !s.tracks || !s.tracks.length) return null;
  return s.tracks.find(t => t.id === s.trackAtiva) || s.tracks[0];
}

/* ---------- IndexedDB para áudio ---------- */
const Audio_DB = (() => {
  const DB = 'cifrasDB', STORE = 'audio';
  let dbp = null;

  function open(){
    if(dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode){
    const db = await open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }
  return {
    async put(id, blob){
      const st = await tx('readwrite');
      return new Promise((res, rej) => {
        const r = st.put(blob, id);
        r.onsuccess = () => res(true); r.onerror = () => rej(r.error);
      });
    },
    async get(id){
      const st = await tx('readonly');
      return new Promise((res) => {
        const r = st.get(id);
        r.onsuccess = () => res(r.result || null); r.onerror = () => res(null);
      });
    },
    async del(id){
      try{
        const st = await tx('readwrite');
        return new Promise((res) => { const r = st.delete(id); r.onsuccess = () => res(true); r.onerror = () => res(false); });
      }catch(e){ return false; }
    },
    async keys(){
      try{
        const st = await tx('readonly');
        return new Promise((res) => { const r = st.getAllKeys(); r.onsuccess = () => res(r.result||[]); r.onerror = () => res([]); });
      }catch(e){ return []; }
    }
  };
})();

/* ---------- helpers de arquivo ---------- */
function blobToDataURL(blob){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}
async function dataURLToBlob(url){
  const r = await fetch(url);
  return await r.blob();
}
function downloadFile(name, text, mime){
  const blob = new Blob([text], {type: mime || 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function humanSize(b){
  if(!b) return '';
  if(b < 1024) return b + ' B';
  if(b < 1048576) return (b/1024).toFixed(0) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
