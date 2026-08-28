/* =========================================================
   store.js — persistência
   localStorage: músicas, eventos, preferências (texto, leve)
   IndexedDB   : áudios (blobs, pesados)
   ========================================================= */

const LS = {
  songs:    'cifras.songs.v1',
  events:   'cifras.events.v1',
  settings: 'cifras.settings.v1'
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

  notation: 'en'   // 'en' = C D E | 'pt' = Dó Ré Mi (só exibição do tom)
};

const Store = {
  songs(){ return readLS(LS.songs, []); },
  saveSongs(list){ return writeLS(LS.songs, list); },

  events(){ return readLS(LS.events, []); },
  saveEvents(list){ return writeLS(LS.events, list); },

  settings(){ return Object.assign({}, DEFAULT_SETTINGS, readLS(LS.settings, {})); },
  saveSettings(s){ return writeLS(LS.settings, s); },

  getSong(id){ return this.songs().find(s => s.id === id) || null; },

  upsertSong(song){
    const list = this.songs();
    song.updatedAt = Date.now();
    const i = list.findIndex(s => s.id === song.id);
    if(i >= 0) list[i] = song; else list.unshift(song);
    this.saveSongs(list);
    return song;
  },

  deleteSong(id){
    this.saveSongs(this.songs().filter(s => s.id !== id));
    const evs = this.events().map(e => ({...e, songs: (e.songs||[]).filter(x => x !== id)}));
    this.saveEvents(evs);
    Audio_DB.del(id);
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

  deleteEvent(id){ this.saveEvents(this.events().filter(e => e.id !== id)); }
};

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
    audio: null,        // {name, type, size}
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, partial || {});
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
