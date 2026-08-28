/* =========================================================
   app.js — UI, rotas e lógica do visualizador
   ========================================================= */

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const APP = $('#app');

let S = Store.settings();

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function toast(msg, ms){
  const t = document.createElement('div');
  t.textContent = msg;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), ms || 2000);
}
function applyTheme(){
  document.documentElement.dataset.theme = S.theme;
  const m = document.querySelector('meta[name=theme-color]');
  if(m) m.content = S.theme === 'light' ? '#fbfbfd' : '#0f1115';
}

/* ---------------- modal / bottom sheet ---------------- */
function sheet(html, onMount){
  closeSheet();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="sheet">' + html + '</div>';
  ov.addEventListener('click', e => { if(e.target === ov) closeSheet(); });
  $('#modal-root').appendChild(ov);
  if(onMount) onMount($('.sheet', ov), ov);
  return ov;
}
function closeSheet(){ $('#modal-root').innerHTML = ''; }

function confirmSheet(title, text, okLabel, onOk){
  sheet(
    '<h3>' + esc(title) + '</h3>' +
    '<p style="color:var(--fg2);margin:0 0 16px">' + esc(text) + '</p>' +
    '<div class="row">' +
      '<button class="btn" data-x="no">Cancelar</button>' +
      '<button class="btn primary" data-x="yes" style="background:var(--danger);border-color:var(--danger)">' + esc(okLabel) + '</button>' +
    '</div>',
    (el) => {
      $('[data-x=no]', el).onclick = closeSheet;
      $('[data-x=yes]', el).onclick = () => { closeSheet(); onOk(); };
    }
  );
}

/* ---------------- router ---------------- */
function go(hash){ location.hash = hash; }

function parseRoute(){
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = {};
  if(qs) qs.split('&').forEach(kv => { const [k,v] = kv.split('='); q[k] = decodeURIComponent(v || ''); });
  return { parts, q };
}

function render(){
  teardownViewer();
  const { parts, q } = parseRoute();
  const [a, b] = parts;
  if(!a)                     return viewList();
  if(a === 'new')            return viewEditor(null);
  if(a === 'edit'  && b)     return viewEditor(b);
  if(a === 'song'  && b)     return viewSong(b, q);
  if(a === 'events')         return viewEvents();
  if(a === 'event' && b)     return viewEvent(b);
  if(a === 'settings')       return viewSettings();
  return viewList();
}
window.addEventListener('hashchange', render);

/* ---------------- componentes ---------------- */
function tabbar(active){
  return '<nav class="tabbar">' +
    '<button data-nav="/"         class="' + (active==='songs'?'on':'')  + '"><i>&#9834;</i>Músicas</button>' +
    '<button data-nav="/events"   class="' + (active==='events'?'on':'') + '"><i>&#9776;</i>Eventos</button>' +
    '<button data-nav="/settings" class="' + (active==='cfg'?'on':'')    + '"><i>&#9881;</i>Ajustes</button>' +
  '</nav>';
}
function bindNav(root){
  $$('[data-nav]', root).forEach(b => b.onclick = () => go('#' + b.dataset.nav));
}

/* =========================================================
   LISTA DE MÚSICAS
   ========================================================= */
let listFilter = '';

function viewList(){
  const all = Store.songs();
  const f = listFilter.trim().toLowerCase();
  const songs = f
    ? all.filter(s => (s.title + ' ' + s.artist + ' ' + (s.tags||[]).join(' ')).toLowerCase().includes(f))
    : all;
  songs.sort((x,y) => x.title.localeCompare(y.title, 'pt'));

  APP.innerHTML =
    '<header class="topbar"><div class="ttl"><b>Minhas cifras</b>' +
      '<small>' + all.length + ' música' + (all.length===1?'':'s') + '</small></div>' +
      '<button class="iconbtn" id="btnSort">&#8645;</button></header>' +
    '<div class="content">' +
      '<div class="searchbar"><input id="q" placeholder="Buscar música ou artista" value="' + esc(listFilter) + '"></div>' +
      '<div id="list">' + (songs.length ? songs.map(songCard).join('') : emptyState()) + '</div>' +
    '</div>' +
    '<button class="fab" id="btnAdd">+</button>' +
    tabbar('songs');

  bindNav(APP);
  const q = $('#q');
  q.oninput = () => {
    listFilter = q.value;
    const v = listFilter.trim().toLowerCase();
    const r = v ? all.filter(s => (s.title+' '+s.artist).toLowerCase().includes(v)) : all;
    r.sort((x,y) => x.title.localeCompare(y.title,'pt'));
    $('#list').innerHTML = r.length ? r.map(songCard).join('') : emptyState();
    bindCards();
  };
  $('#btnAdd').onclick = () => go('#/new');
  $('#btnSort').onclick = () => sortSheet(all);
  bindCards();
}

function emptyState(){
  return '<div class="empty"><div style="font-size:44px">&#9834;</div>' +
    '<h3>Nenhuma cifra ainda</h3>' +
    '<p>Toque no <b>+</b> e cole uma cifra do Cifra Club.</p></div>';
}

function songCard(s){
  const k = keyOf(s);
  return '<div class="card" data-song="' + s.id + '">' +
    '<div class="info"><b>' + esc(s.title) + '</b>' +
    '<small>' + esc(s.artist || '—') + (s.audio ? ' &nbsp;&#9835;' : '') + '</small></div>' +
    (k ? '<span class="badge key">' + esc(k) + '</span>' : '') +
    '<button class="iconbtn" data-more="' + s.id + '" style="width:32px;height:32px;font-size:15px">&#8942;</button>' +
  '</div>';
}

function bindCards(){
  $$('[data-song]').forEach(c => {
    c.onclick = e => {
      if(e.target.closest('[data-more]')) return;
      go('#/song/' + c.dataset.song);
    };
  });
  $$('[data-more]').forEach(b => b.onclick = e => { e.stopPropagation(); songMenu(b.dataset.more); });
}

function songMenu(id){
  const s = Store.getSong(id);
  if(!s) return;
  sheet(
    '<h3>' + esc(s.title) + '</h3>' +
    '<button class="opt" data-a="open"><i>&#9654;</i> Abrir</button>' +
    '<button class="opt" data-a="edit"><i>&#9998;</i> Editar</button>' +
    '<button class="opt" data-a="dup"><i>&#10697;</i> Duplicar</button>' +
    '<button class="opt" data-a="txt"><i>&#8681;</i> Exportar esta cifra (.json)</button>' +
    '<div class="sep"></div>' +
    '<button class="opt danger" data-a="del"><i>&#128465;</i> Excluir</button>',
    (el) => {
      $('[data-a=open]', el).onclick = () => { closeSheet(); go('#/song/' + id); };
      $('[data-a=edit]', el).onclick = () => { closeSheet(); go('#/edit/' + id); };
      $('[data-a=dup]',  el).onclick = () => {
        const c = JSON.parse(JSON.stringify(s));
        c.id = uid(); c.title = s.title + ' (cópia)'; c.audio = null;
        Store.upsertSong(c); closeSheet(); render(); toast('Duplicada');
      };
      $('[data-a=txt]',  el).onclick = () => {
        downloadFile(slug(s.title) + '.json', JSON.stringify({ version:1, songs:[s] }, null, 2));
        closeSheet();
      };
      $('[data-a=del]',  el).onclick = () => {
        closeSheet();
        confirmSheet('Excluir música', 'Isso remove "' + s.title + '" e o áudio dela. Não dá pra desfazer.', 'Excluir',
          () => { Store.deleteSong(id); render(); toast('Excluída'); });
      };
    }
  );
}

function sortSheet(){
  sheet('<h3>Ordenar por</h3>' +
    '<button class="opt" data-s="title"><i>A</i> Título</button>' +
    '<button class="opt" data-s="recent"><i>&#8635;</i> Modificadas recentemente</button>',
    (el) => {
      $$('[data-s]', el).forEach(b => b.onclick = () => {
        const list = Store.songs();
        if(b.dataset.s === 'title') list.sort((a,c) => a.title.localeCompare(c.title,'pt'));
        else list.sort((a,c) => (c.updatedAt||0) - (a.updatedAt||0));
        Store.saveSongs(list); closeSheet(); render();
      });
    });
}
const ACCENT_RE = new RegExp('[\\u0300-\\u036f]', 'g');
function slug(s){
  return String(s).normalize('NFD').replace(ACCENT_RE, '')
    .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'cifra';
}

/* =========================================================
   EDITOR (colar nova / editar texto)
   ========================================================= */
function viewEditor(id){
  const s = id ? Store.getSong(id) : null;
  const raw = s ? serializeCifra(s.lines) : '';

  APP.innerHTML =
    '<header class="topbar">' +
      '<button class="iconbtn" id="back">&#8249;</button>' +
      '<div class="ttl"><b>' + (s ? 'Editar cifra' : 'Nova cifra') + '</b>' +
      '<small>' + (s ? esc(s.title) : 'Cole o texto do Cifra Club') + '</small></div>' +
      '<button class="iconbtn on" id="save">&#10003;</button>' +
    '</header>' +
    '<div class="content">' +
      '<div class="row">' +
        '<div class="field"><label>Título</label><input id="f_title" value="' + esc(s ? s.title : '') + '" placeholder="Nome da música"></div>' +
      '</div>' +
      '<div class="field"><label>Artista</label><input id="f_artist" value="' + esc(s ? s.artist : '') + '" placeholder="Opcional"></div>' +
      '<div class="row">' +
        '<div class="field"><label>Tom original</label><input id="f_key" value="' + esc(s ? s.key : '') + '" placeholder="auto"></div>' +
        '<div class="field"><label>Capotraste</label><input id="f_capo" type="number" min="0" max="11" value="' + (s ? (s.capo||0) : 0) + '"></div>' +
      '</div>' +
      (s ? '' : '<button class="btn" id="paste" style="margin-bottom:14px">&#128203; Colar da área de transferência</button>') +
      '<div class="field"><label>Cifra</label>' +
        '<textarea id="f_body" spellcheck="false" placeholder="Ctrl+V aqui a cifra copiada&#10;&#10;[Intro] G  D  Em  C&#10;&#10;G            D&#10;Exemplo de letra aqui">' + esc(raw) + '</textarea>' +
        '<div class="hint">Cole exatamente como está no site: os acordes acima da letra são detectados e alinhados automaticamente.</div>' +
      '</div>' +
      '<button class="btn primary" id="save2">Salvar cifra</button>' +
    '</div>';

  $('#back').onclick = () => history.back();
  const doSave = () => saveEditor(s);
  $('#save').onclick = doSave;
  $('#save2').onclick = doSave;

  const pasteBtn = $('#paste');
  if(pasteBtn) pasteBtn.onclick = async () => {
    try{
      const t = await navigator.clipboard.readText();
      if(t){ $('#f_body').value = t; autoTitle(t); toast('Colado!'); }
      else toast('Área de transferência vazia');
    }catch(e){
      toast('Use Ctrl+V / segurar e colar no campo');
      $('#f_body').focus();
    }
  };

  $('#f_body').addEventListener('paste', () => {
    setTimeout(() => autoTitle($('#f_body').value), 30);
  });
}

function autoTitle(text){
  if($('#f_title').value.trim()) return;
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  if(!lines.length) return;
  // Cifra Club costuma começar com "Título" e depois "Artista"
  if(lines[0] && !isChordLine(lines[0]) && lines[0].length < 70){
    $('#f_title').value = lines[0];
    if(lines[1] && !isChordLine(lines[1]) && lines[1].length < 60 && !/^tom:/i.test(lines[1]) && !$('#f_artist').value)
      $('#f_artist').value = lines[1];
  }
}

/** Remove do corpo as 1as linhas que só repetem título/artista (padrão Cifra Club) */
function stripHeaderLines(lines, heads){
  const out = lines.slice();
  for(const h of heads){
    if(!h) continue;
    const i = out.findIndex(l => l.t !== 'b');
    if(i < 0) break;
    const l = out[i];
    const plain = l.t === 'l' && (!l.ch || !l.ch.length);
    if(plain && l.text.trim().toLowerCase() === h.trim().toLowerCase()) out.splice(i, 1);
  }
  while(out.length && out[0].t === 'b') out.shift();
  return out;
}

function saveEditor(existing){
  const body = $('#f_body').value;
  if(!body.trim()){ toast('Cole a cifra primeiro'); return; }
  const { lines, meta } = parseCifra(body);

  let s = existing || newSong();
  s.title  = $('#f_title').value.trim()  || meta.title  || 'Sem título';
  s.artist = $('#f_artist').value.trim() || meta.artist || '';
  s.key    = $('#f_key').value.trim()    || meta.key    || '';
  s.capo   = parseInt($('#f_capo').value, 10) || meta.capo || 0;
  s.lines  = stripHeaderLines(lines, [s.title, s.artist]);
  if(existing) s.transpose = 0;   // texto foi reescrito no tom exibido
  Store.upsertSong(s);
  toast('Salvo');
  go('#/song/' + s.id);
}

/* =========================================================
   VISUALIZADOR
   ========================================================= */
const V = {
  song: null, ev: null, evIndex: -1,
  edit: false, zen: false,
  scrolling: false, raf: null, lastTs: 0, acc: 0, pps: 0, limit: Infinity,
  audioEl: null, audioURL: null, followAudio: false,
  wake: null
};

function keyOf(s){
  if(!s || !s.key) return '';
  return transposeKey(s.key, s.transpose || 0);
}
function dispChord(c, s){
  const t = s.transpose || 0;
  if(!t) return c;
  return transposeChord(c, t, preferFlatFor(keyOf(s)));
}
function toStored(txt, s){
  const t = s.transpose || 0;
  if(!t) return txt;
  return transposeChord(txt, -t, preferFlatFor(s.key));
}

function viewSong(id, q){
  const s = Store.getSong(id);
  if(!s){ go('#/'); return; }
  V.song = s; V.edit = false; V.zen = false;

  V.ev = q.ev ? Store.getEvent(q.ev) : null;
  V.evIndex = V.ev ? (V.ev.songs || []).indexOf(id) : -1;

  const fit = s.fitMode === null || s.fitMode === undefined ? S.fitMode : s.fitMode;
  const spd = s.scrollSpeed == null ? S.scrollSpeed : s.scrollSpeed;

  APP.innerHTML =
    '<div class="viewer' + (fit ? ' fit' : '') + (S.showChords ? '' : ' nochords') + '" id="viewer">' +
      '<header class="topbar">' +
        '<button class="iconbtn" id="back">&#8249;</button>' +
        '<div class="ttl"><b>' + esc(s.title) + '</b><small>' +
          esc(s.artist || '') + (s.artist ? ' · ' : '') +
          'Tom ' + (keyOf(s) || '?') + (s.capo ? ' · capo ' + s.capo : '') +
          (V.ev ? ' · ' + esc(V.ev.name) + ' ' + (V.evIndex+1) + '/' + (V.ev.songs||[]).length : '') +
        '</small></div>' +
        '<button class="iconbtn" id="menu">&#8942;</button>' +
      '</header>' +

      '<div class="tools">' +
        '<button class="tool" id="tMinus">&#9660; Tom</button>' +
        '<button class="tool on" id="tKey">' + (keyOf(s) || '—') +
          (s.transpose ? ' <small>' + (s.transpose > 0 ? '+' : '') + s.transpose + '</small>' : '') + '</button>' +
        '<button class="tool" id="tPlus">&#9650; Tom</button>' +
        '<button class="tool' + (fit ? ' on' : '') + '" id="tFit">&#9635; Caber na tela</button>' +
        '<button class="tool" id="tFsMinus">A&minus;</button>' +
        '<button class="tool" id="tFsPlus">A+</button>' +
        '<button class="tool" id="tEdit">&#9998; Editar acordes</button>' +
        '<button class="tool" id="tAudio">&#9835; Áudio</button>' +
        '<button class="tool" id="tZen">&#9744; Palco</button>' +
      '</div>' +

      '<div id="playerSlot"></div>' +

      '<div class="stage" id="stage"><div class="cifra" id="cifra"></div></div>' +

      '<div class="dock" id="dock">' +
        (V.ev ? '<button class="iconbtn" id="prevSong">&#8249;</button>' : '') +
        '<button class="iconbtn" id="btnScroll">&#9654;</button>' +
        '<div class="spd" id="dockMid"></div>' +
        '<button class="iconbtn" id="btnScrollCfg">&#9201;</button>' +
        (V.ev ? '<button class="iconbtn" id="nextSong">&#8250;</button>' : '') +
      '</div>' +
    '</div>';

  $('#back').onclick = () => {
    if(V.ev) go('#/event/' + V.ev.id); else go('#/');
  };
  $('#menu').onclick  = () => songViewMenu();
  $('#tMinus').onclick = () => setTranspose((V.song.transpose||0) - 1);
  $('#tPlus').onclick  = () => setTranspose((V.song.transpose||0) + 1);
  $('#tKey').onclick   = () => keySheet();
  $('#tFit').onclick   = () => toggleFit();
  $('#tFsMinus').onclick = () => bumpFont(-1);
  $('#tFsPlus').onclick  = () => bumpFont(1);
  $('#tEdit').onclick  = () => toggleEdit();
  $('#tAudio').onclick = () => audioSheet();
  $('#tZen').onclick   = () => toggleZen();

  $('#btnScroll').onclick = () => toggleScroll();
  $('#btnScrollCfg').onclick = () => scrollSheet();
  renderDock();

  if(V.ev){
    $('#prevSong').onclick = () => navEvent(-1);
    $('#nextSong').onclick = () => navEvent(1);
  }

  // fora do modo edição: toque no acorde mostra o desenho, toque na cifra vira modo palco
  $('#stage').addEventListener('click', (e) => {
    if(V.edit) return;
    const ch = e.target.closest('.ch');
    if(ch){ diagramSheet(ch.textContent); return; }
    toggleZen();
  });

  renderCifra();
  if(s.audio) mountPlayer();
  requestWakeLock();
  window.addEventListener('resize', onResize);
}

function onResize(){ if($('#viewer') && $('#viewer').classList.contains('fit')) autoFit(); }

function teardownViewer(){
  stopScroll();
  window.removeEventListener('resize', onResize);
  if(V.audioEl){ try{ V.audioEl.pause(); }catch(e){} }
  if(V.audioURL){ URL.revokeObjectURL(V.audioURL); V.audioURL = null; }
  V.audioEl = null;
  releaseWakeLock();
}

/* ---------- render da cifra ---------- */
function renderCifra(){
  const s = V.song, out = [];
  (s.lines || []).forEach((l, li) => {
    if(l.t === 'b'){ out.push('<div class="ln blank"></div>'); return; }
    if(l.t === 's'){ out.push('<div class="ln sec">' + esc(l.text) + '</div>'); return; }
    if(l.t === 'tab'){ out.push('<div class="ln tab">' + esc(l.text) + '</div>'); return; }
    const chs = (l.ch || []).map((c, ci) =>
      '<span class="ch" data-l="' + li + '" data-c="' + ci + '" style="left:' + c.p + 'ch">' +
      esc(dispChord(c.c, s)) + '</span>').join('');
    out.push('<div class="ln" data-l="' + li + '">' +
      ((l.ch && l.ch.length) ? '<div class="chrow">' + chs + '</div>' : '') +
      '<div class="lyr" data-l="' + li + '">' + (l.text ? esc(l.text) : '&nbsp;') + '</div></div>');
  });
  const cif = $('#cifra');
  cif.innerHTML = out.join('');

  const v = $('#viewer');
  if(v.classList.contains('fit')) autoFit();
  else {
    cif.style.columnCount = 1;
    cif.style.fontSize = (V.song.fontSize || S.fontSize) + 'px';
  }
  if(V.edit) bindEditHandlers();
}

/* ---------- caber na tela ---------- */
/** Área realmente utilizável do palco (clientHeight inclui o padding) */
function stageBox(){
  const stage = $('#stage');
  const cs = getComputedStyle(stage);
  return {
    H: stage.clientHeight - parseFloat(cs.paddingTop)  - parseFloat(cs.paddingBottom),
    W: stage.clientWidth  - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  };
}

function fitsAt(cif, H, W, fs, cols){
  cif.style.columnCount = cols;
  cif.style.fontSize = fs + 'px';
  return cif.scrollHeight <= H && cif.scrollWidth <= W;
}

function autoFit(){
  const stage = $('#stage'), cif = $('#cifra');
  if(!stage || !cif) return;
  const box = stageBox();
  const maxCols = window.innerWidth >= 700 ? 4 : 3;
  cif.style.columnGap = '22px';
  cif.style.columnRule = '1px solid var(--line)';

  // 1) maior fonte que cabe de verdade, testando de 1 a maxCols colunas
  let best = { fs: 0, cols: 1 };
  for(let cols = 1; cols <= maxCols; cols++){
    let lo = 5, hi = 52, ok = 0;
    for(let it = 0; it < 10; it++){
      const mid = (lo + hi) / 2;
      if(fitsAt(cif, box.H, box.W, mid, cols)){ ok = mid; lo = mid; }
      else hi = mid;
    }
    if(ok > best.fs + 0.15) best = { fs: ok, cols: cols };
  }
  V.fitMax = best.fs || 5;

  // 2) aplica o ajuste manual (A- / A+) por cima, sem sair do "cabe na tela"
  const scale = Math.min(1, Math.max(0.3, V.song.fitScale || 1));
  const target = Math.max(5, V.fitMax * scale);

  // com a fonte menor, usa a menor quantidade de colunas que ainda cabe
  let cols = best.cols || 1;
  for(let c = 1; c <= maxCols; c++){
    if(fitsAt(cif, box.H, box.W, target, c)){ cols = c; break; }
  }

  cif.style.columnCount = cols;
  cif.style.fontSize = target.toFixed(2) + 'px';
  V.fitCols = cols;
  V.fitScaleApplied = scale;
}

function toggleFit(){
  const v = $('#viewer');
  const on = !v.classList.contains('fit');
  v.classList.toggle('fit', on);
  $('#tFit').classList.toggle('on', on);
  V.song.fitMode = on;
  Store.upsertSong(V.song);
  if(on) stopScroll();
  renderCifra();
}

function bumpFont(d){
  const v = $('#viewer');

  // no modo "caber na tela" o A-/A+ ajusta o tamanho SEM sair do modo:
  // a fonte encolhe e as colunas são recalculadas pra continuar cabendo
  if(v.classList.contains('fit')){
    const cur = V.song.fitScale || 1;
    let next = cur + d * 0.08;
    if(next >= 1){
      if(cur >= 1){ toast('Já é o maior tamanho que cabe na tela'); return; }
      next = 1;
    }
    if(next < 0.3) next = 0.3;
    V.song.fitScale = next;
    Store.upsertSong(V.song);
    autoFit();
    toast(Math.round(next * 100) + '% · ' + V.fitCols + (V.fitCols > 1 ? ' colunas' : ' coluna'));
    return;
  }

  const cur = V.song.fontSize || S.fontSize;
  V.song.fontSize = Math.max(8, Math.min(48, cur + d));
  Store.upsertSong(V.song);
  $('#cifra').style.fontSize = V.song.fontSize + 'px';
}

function toggleZen(){
  V.zen = !V.zen;
  $('#viewer').classList.toggle('zen', V.zen);
  if($('#viewer').classList.contains('fit')) setTimeout(autoFit, 30);
}

/* ---------- transposição ---------- */
function setTranspose(n){
  n = ((n % 12) + 12) % 12;
  if(n > 6) n -= 12;
  V.song.transpose = n;
  Store.upsertSong(V.song);
  refreshKeyBtn();
  renderCifra();
}
function refreshKeyBtn(){
  const s = V.song;
  $('#tKey').innerHTML = (keyOf(s) || '—') +
    (s.transpose ? ' <small>' + (s.transpose > 0 ? '+' : '') + s.transpose + '</small>' : '');
  const sm = $('#viewer .topbar .ttl small');
  if(sm) sm.innerHTML = esc(s.artist || '') + (s.artist ? ' · ' : '') +
    'Tom ' + (keyOf(s) || '?') + (s.capo ? ' · capo ' + s.capo : '') +
    (V.ev ? ' · ' + esc(V.ev.name) + ' ' + (V.evIndex+1) + '/' + (V.ev.songs||[]).length : '');
}

function keySheet(){
  const s = V.song;
  const base = s.key || 'C';
  const opts = [];
  for(let i = -6; i <= 6; i++){
    const k = transposeKey(base, i);
    opts.push('<button data-t="' + i + '" style="' +
      (i === (s.transpose||0) ? 'background:var(--acc);color:#fff;border-color:var(--acc)' : '') + '">' +
      esc(k) + (i ? ' <span style="opacity:.6;font-size:11px">' + (i>0?'+':'') + i + '</span>' : '') +
      '</button>');
  }
  sheet('<h3>Tom da música</h3>' +
    '<div class="hint" style="margin-bottom:4px">Original: <b>' + esc(s.key || '—') + '</b></div>' +
    '<div class="chordgrid">' + opts.join('') + '</div>' +
    '<div class="sep"></div>' +
    '<div class="field"><label>Capotraste (casa)</label>' +
      '<input id="capoIn" type="number" min="0" max="11" value="' + (s.capo||0) + '"></div>' +
    '<div class="row">' +
      '<button class="btn" id="kOrig">Voltar ao original</button>' +
      '<button class="btn primary" id="kOk">Pronto</button>' +
    '</div>',
    (el) => {
      $$('[data-t]', el).forEach(b => b.onclick = () => {
        setTranspose(parseInt(b.dataset.t, 10));
        $$('[data-t]', el).forEach(x => x.setAttribute('style',''));
        b.setAttribute('style','background:var(--acc);color:#fff;border-color:var(--acc)');
      });
      $('#kOrig', el).onclick = () => { setTranspose(0); closeSheet(); };
      $('#kOk', el).onclick = () => {
        V.song.capo = parseInt($('#capoIn', el).value, 10) || 0;
        Store.upsertSong(V.song); refreshKeyBtn(); closeSheet();
      };
    });
}

/* ---------- autoscroll ---------- */
function fmtDur(sec){
  sec = Math.max(0, Math.round(sec || 0));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/** Distância a percorrer: até a última linha encostar embaixo (ignora o espaço vazio do fim) */
function scrollTarget(){
  const stage = $('#stage'), cif = $('#cifra');
  if(!stage || !cif) return 0;
  const fim = cif.offsetTop + cif.offsetHeight + 16;
  return Math.max(0, Math.min(fim - stage.clientHeight, stage.scrollHeight - stage.clientHeight));
}

/** px/s conforme o modo escolhido pra música */
function scrollPxPerSec(){
  const s = V.song;
  if(s.scrollMode === 'duration'){
    const d = s.scrollDuration || 0;
    if(d <= 0) return 0;
    const dist = scrollTarget() - $('#stage').scrollTop;
    const resta = Math.max(1, d * (1 - $('#stage').scrollTop / Math.max(1, scrollTarget())));
    return dist > 0 ? dist / resta : 0;
  }
  return (s.scrollSpeed == null ? S.scrollSpeed : s.scrollSpeed) * 0.9;
}

function toggleScroll(){ V.scrolling ? stopScroll() : startScroll(); }

function startScroll(){
  const v = $('#viewer');
  if(!v) return;
  if(v.classList.contains('fit')){ toast('Desative "Caber na tela" para rolar'); return; }
  if(V.song.scrollMode === 'duration' && !(V.song.scrollDuration > 0)){
    scrollSheet(); return;
  }
  V.scrolling = true; V.lastTs = 0; V.acc = 0;
  V.pps = scrollPxPerSec();
  V.limit = V.song.scrollMode === 'duration' ? scrollTarget() : Infinity;
  if(V.song.scrollMode === 'duration' && V.pps <= 0){ V.scrolling = false; toast('A música já cabe na tela'); return; }
  const b = $('#btnScroll'); if(b){ b.innerHTML = '&#9208;'; b.classList.add('on'); }
  V.raf = requestAnimationFrame(scrollTick);
}
function stopScroll(){
  V.scrolling = false;
  if(V.raf) cancelAnimationFrame(V.raf);
  V.raf = null;
  const b = $('#btnScroll'); if(b){ b.innerHTML = '&#9654;'; b.classList.remove('on'); }
}
function scrollTick(ts){
  if(!V.scrolling) return;
  const stage = $('#stage');
  if(!stage){ stopScroll(); return; }
  if(!V.lastTs) V.lastTs = ts;
  const dt = Math.min(0.1, (ts - V.lastTs) / 1000);
  V.lastTs = ts;
  V.acc += V.pps * dt;
  const px = Math.floor(V.acc);
  if(px > 0){ stage.scrollTop += px; V.acc -= px; }
  if(stage.scrollTop >= V.limit - 1){ stopScroll(); return; }
  if(stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2){ stopScroll(); return; }
  V.raf = requestAnimationFrame(scrollTick);
}

function renderDock(){
  const mid = $('#dockMid');
  if(!mid) return;
  const s = V.song;

  if(s.scrollMode === 'duration'){
    mid.innerHTML = '<button class="tool" id="durBtn" style="width:100%;justify-content:center">&#9201; ' +
      (s.scrollDuration > 0 ? fmtDur(s.scrollDuration) : 'definir duração') + '</button>';
    $('#durBtn').onclick = () => scrollSheet();
    return;
  }
  const spd = s.scrollSpeed == null ? S.scrollSpeed : s.scrollSpeed;
  mid.innerHTML = '<input type="range" id="spd" min="0" max="100" value="' + spd + '">' +
                  '<span class="val" id="spdv">' + spd + '</span>';
  const sp = $('#spd');
  sp.oninput = () => {
    $('#spdv').textContent = sp.value;
    V.song.scrollSpeed = parseInt(sp.value, 10);
    Store.upsertSong(V.song);
    if(V.scrolling) V.pps = scrollPxPerSec();
  };
}

function scrollSheet(){
  const s = V.song;
  const audioDur = (V.audioEl && isFinite(V.audioEl.duration) && V.audioEl.duration > 0)
    ? V.audioEl.duration : 0;

  sheet('<h3>Rolagem automática</h3>' +
    '<div class="row" style="margin-bottom:16px">' +
      '<button class="btn" data-m="speed">Velocidade</button>' +
      '<button class="btn" data-m="duration">Duração</button>' +
    '</div><div id="modeBox"></div>',
    (el) => {
      const paint = () => {
        const dur = V.song.scrollMode === 'duration';
        $$('[data-m]', el).forEach(b => b.classList.toggle('primary', (b.dataset.m === 'duration') === dur));
        const box = $('#modeBox', el);

        if(dur){
          const d = V.song.scrollDuration || 0;
          box.innerHTML =
            '<div class="field"><label>A música inteira deve rolar em</label>' +
              '<div class="row">' +
                '<input id="dMin" type="number" min="0" max="59" inputmode="numeric" value="' + Math.floor(d / 60) + '">' +
                '<input id="dSec" type="number" min="0" max="59" inputmode="numeric" value="' + (d % 60) + '">' +
              '</div><div class="hint">minutos &nbsp;:&nbsp; segundos</div>' +
            '</div>' +
            (audioDur ? '<button class="btn" id="fromAudio" style="margin-bottom:9px">&#9835; Usar a duração do áudio (' + fmtDur(audioDur) + ')</button>' : '') +
            '<button class="btn primary" id="dOk">Salvar</button>';

          const save = () => {
            const m = parseInt($('#dMin', el).value, 10) || 0;
            const sec = parseInt($('#dSec', el).value, 10) || 0;
            V.song.scrollDuration = m * 60 + sec;
            Store.upsertSong(V.song);
            renderDock();
            if(V.scrolling) V.pps = scrollPxPerSec();
          };
          const fa = $('#fromAudio', el);
          if(fa) fa.onclick = () => {
            const t = Math.round(audioDur);
            $('#dMin', el).value = Math.floor(t / 60);
            $('#dSec', el).value = t % 60;
            save(); toast('Duração do áudio: ' + fmtDur(t));
          };
          $('#dOk', el).onclick = () => { save(); closeSheet(); };

        } else {
          const spd = V.song.scrollSpeed == null ? S.scrollSpeed : V.song.scrollSpeed;
          box.innerHTML =
            '<div class="field"><label>Velocidade: <span id="sv">' + spd + '</span></label>' +
              '<input type="range" id="sIn" min="0" max="100" value="' + spd + '"></div>' +
            '<div class="hint">A rolagem anda sempre no mesmo ritmo, independente do tamanho da música.</div>';
          const inp = $('#sIn', el);
          inp.oninput = () => {
            $('#sv', el).textContent = inp.value;
            V.song.scrollSpeed = parseInt(inp.value, 10);
            Store.upsertSong(V.song);
            renderDock();
            if(V.scrolling) V.pps = scrollPxPerSec();
          };
        }
      };

      $$('[data-m]', el).forEach(b => b.onclick = () => {
        V.song.scrollMode = b.dataset.m;
        Store.upsertSong(V.song);
        renderDock(); paint();
      });
      paint();
    });
}

/* ---------- desenhos de acorde ---------- */
function diagramSheet(tok){
  const t = String(tok || '').trim();
  if(!isChordToken(t)) return;
  const vs = findVoicings(t, 3);
  sheet('<h3>' + esc(t) + '</h3>' +
    (vs.length
      ? '<div class="dgrid">' + vs.map(v => '<div class="dg">' + voicingSVG(v, '') + '</div>').join('') + '</div>' +
        '<div class="hint" style="margin-bottom:14px">A primeira é a posição mais fácil. ' +
        '&times; = corda que não soa, &#9675; = corda solta, o número à esquerda indica a casa.</div>'
      : '<p style="color:var(--fg2)">Não achei uma forma pra esse acorde.</p>') +
    '<button class="btn" id="dgAll">Ver todos os acordes da música</button>',
    (el) => { $('#dgAll', el).onclick = () => allChordsSheet(); });
}

function allChordsSheet(){
  const s = V.song;
  const list = songChords(s, c => dispChord(c, s));
  sheet('<h3>Acordes de ' + esc(s.title) + '</h3>' +
    (list.length
      ? '<div class="dgall">' + list.map(c => {
          const v = findVoicings(c, 1)[0];
          return '<div class="dg">' + (v ? voicingSVG(v, c)
            : '<div style="width:106px;height:134px;display:grid;place-items:center;font-weight:700">' + esc(c) + '</div>') + '</div>';
        }).join('') + '</div>'
      : '<p style="color:var(--fg2)">Essa música não tem acordes marcados.</p>'));
}

/* ---------- modo edição de acordes ---------- */
function toggleEdit(){
  V.edit = !V.edit;
  const v = $('#viewer');
  v.classList.toggle('edit', V.edit);
  $('#tEdit').classList.toggle('on', V.edit);
  if(V.edit){
    stopScroll();
    if(v.classList.contains('fit')) toggleFit();
    if(!$('#editbar')){
      const bar = document.createElement('div');
      bar.className = 'editbar'; bar.id = 'editbar';
      bar.innerHTML = '<span style="flex:1">Arraste os acordes ↔ · toque para editar · toque na letra para inserir</span>' +
                      '<button class="tool on" id="editDone">Concluir</button>';
      v.insertBefore(bar, $('#dock'));
      $('#editDone').onclick = () => toggleEdit();
    }
    bindEditHandlers();
  } else {
    const bar = $('#editbar'); if(bar) bar.remove();
  }
}

function charWidth(){
  const cif = $('#cifra'), m = $('#measure');
  const cs = getComputedStyle(cif);
  m.style.fontFamily = cs.fontFamily;
  m.style.fontSize   = cs.fontSize;
  m.style.fontWeight = '700';
  m.textContent = '0'.repeat(40);
  return m.getBoundingClientRect().width / 40 || 8;
}

function bindEditHandlers(){
  const cw = charWidth();

  $$('#cifra .ch').forEach(sp => {
    let sx = 0, sp0 = 0, moved = false, id = null;
    sp.onpointerdown = (e) => {
      e.stopPropagation();
      const li = +sp.dataset.l, ci = +sp.dataset.c;
      sp0 = V.song.lines[li].ch[ci].p;
      sx = e.clientX; moved = false; id = e.pointerId;
      try{ sp.setPointerCapture(id); }catch(err){}
      sp.classList.add('drag');
    };
    sp.onpointermove = (e) => {
      if(id === null) return;
      const d = Math.round((e.clientX - sx) / cw);
      if(Math.abs(e.clientX - sx) > 4) moved = true;
      const np = Math.max(0, sp0 + d);
      sp.style.left = np + 'ch';
      sp.dataset.np = np;
    };
    sp.onpointerup = (e) => {
      if(id === null) return;
      sp.classList.remove('drag');
      try{ sp.releasePointerCapture(id); }catch(err){}
      id = null;
      const li = +sp.dataset.l, ci = +sp.dataset.c;
      if(moved){
        V.song.lines[li].ch[ci].p = parseInt(sp.dataset.np, 10) || 0;
        Store.upsertSong(V.song);
      } else {
        chordSheet(li, ci);
      }
    };
    sp.onpointercancel = () => { sp.classList.remove('drag'); id = null; };
  });

  $$('#cifra .lyr').forEach(ly => {
    ly.onclick = (e) => {
      if(!V.edit) return;
      const li = +ly.dataset.l;
      const r = ly.getBoundingClientRect();
      const p = Math.max(0, Math.round((e.clientX - r.left) / cw));
      addChordAt(li, p);
    };
  });
}

function addChordAt(li, p){
  const line = V.song.lines[li];
  if(!line.ch) line.ch = [];
  line.ch.push({ p: p, c: 'C' });
  line.ch.sort((a,b) => a.p - b.p);
  const ci = line.ch.findIndex(c => c.p === p && c.c === 'C');
  Store.upsertSong(V.song);
  renderCifra();
  chordSheet(li, ci < 0 ? line.ch.length - 1 : ci, true);
}

const COMMON = ['C','D','E','F','G','A','B','Am','Bm','Cm','Dm','Em','Fm','Gm','C7','D7','E7','G7','A7','B7','F#m','C#m','G#m','Bb','Eb','Ab','C/E','G/B','D/F#','Cmaj7','Dsus4','Asus4','Em7','Am7','Dm7'];

function chordSheet(li, ci, isNew){
  const line = V.song.lines[li];
  const c = line.ch[ci];
  if(!c) return;
  const shown = dispChord(c.c, V.song);

  sheet('<h3>Acorde</h3>' +
    '<div class="field"><input id="chIn" value="' + esc(shown) + '" autocapitalize="off" ' +
      'autocorrect="off" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:18px;font-weight:700"></div>' +
    '<div class="chordgrid">' + COMMON.map(x => '<button data-q="' + x + '">' + x + '</button>').join('') + '</div>' +
    '<div class="row" style="margin:12px 0">' +
      '<button class="btn" id="chL">&#9664; 1</button>' +
      '<button class="btn" id="chR">1 &#9654;</button>' +
    '</div>' +
    '<div class="row">' +
      '<button class="btn danger" id="chDel">Remover</button>' +
      '<button class="btn primary" id="chOk">Salvar</button>' +
    '</div>',
    (el) => {
      const inp = $('#chIn', el);
      if(isNew) setTimeout(() => { inp.focus(); inp.select(); }, 60);
      $$('[data-q]', el).forEach(b => b.onclick = () => { inp.value = b.dataset.q; });
      $('#chL', el).onclick = () => { c.p = Math.max(0, c.p - 1); Store.upsertSong(V.song); renderCifra(); };
      $('#chR', el).onclick = () => { c.p = c.p + 1; Store.upsertSong(V.song); renderCifra(); };
      $('#chDel', el).onclick = () => {
        line.ch.splice(ci, 1);
        Store.upsertSong(V.song); closeSheet(); renderCifra(); toast('Removido');
      };
      $('#chOk', el).onclick = () => {
        const val = inp.value.trim();
        if(val) c.c = toStored(val, V.song);
        Store.upsertSong(V.song); closeSheet(); renderCifra();
      };
      inp.onkeydown = (e) => { if(e.key === 'Enter') $('#chOk', el).click(); };
    });
}

/* ---------- áudio ---------- */
function audioSheet(){
  const s = V.song;
  sheet('<h3>Áudio de referência</h3>' +
    (s.audio
      ? '<div class="card" style="margin:0 0 14px"><div class="info"><b>' + esc(s.audio.name) + '</b>' +
        '<small>' + humanSize(s.audio.size) + '</small></div></div>'
      : '<p style="color:var(--fg2)">Nenhum áudio. Escolha um MP3/M4A do celular — fica salvo offline.</p>') +
    '<button class="btn primary" id="aPick" style="margin-bottom:9px">' + (s.audio ? 'Trocar áudio' : 'Escolher áudio') + '</button>' +
    (s.audio ? '<button class="btn danger" id="aDel">Remover áudio</button>' : ''),
    (el) => {
      $('#aPick', el).onclick = () => {
        const f = $('#fileAudio');
        f.value = '';
        f.onchange = async () => {
          const file = f.files[0];
          if(!file) return;
          if(file.size > 25 * 1024 * 1024 && !confirm('Arquivo de ' + humanSize(file.size) + '. Continuar?')) return;
          await Audio_DB.put(s.id, file);
          s.audio = { name: file.name, type: file.type, size: file.size };
          Store.upsertSong(s);
          closeSheet(); mountPlayer(); toast('Áudio salvo');
        };
        f.click();
      };
      const d = $('#aDel', el);
      if(d) d.onclick = async () => {
        await Audio_DB.del(s.id);
        s.audio = null; Store.upsertSong(s);
        const p = $('#playerSlot'); if(p) p.innerHTML = '';
        closeSheet(); toast('Áudio removido');
      };
    });
}

async function mountPlayer(){
  const s = V.song;
  const slot = $('#playerSlot');
  if(!slot || !s.audio) return;
  const blob = await Audio_DB.get(s.id);
  if(!blob){ slot.innerHTML = ''; return; }
  if(V.audioURL) URL.revokeObjectURL(V.audioURL);
  V.audioURL = URL.createObjectURL(blob);

  slot.innerHTML =
    '<div class="player">' +
      '<button class="iconbtn" id="aPlay">&#9654;</button>' +
      '<span class="t" id="aCur">0:00</span>' +
      '<input type="range" id="aSeek" min="0" max="1000" value="0">' +
      '<span class="t" id="aDur">0:00</span>' +
      '<button class="iconbtn" id="aSync" title="Rolagem junto com o áudio">&#8635;</button>' +
    '</div>';

  const a = new Audio(V.audioURL);
  V.audioEl = a;
  const play = $('#aPlay'), seek = $('#aSeek'), cur = $('#aCur'), dur = $('#aDur');
  const fmt = (t) => (isFinite(t) ? Math.floor(t/60) + ':' + String(Math.floor(t%60)).padStart(2,'0') : '0:00');

  a.onloadedmetadata = () => { dur.textContent = fmt(a.duration); };
  a.ontimeupdate = () => {
    if(a.duration) seek.value = Math.round((a.currentTime / a.duration) * 1000);
    cur.textContent = fmt(a.currentTime);
  };
  a.onended = () => { play.innerHTML = '&#9654;'; play.classList.remove('on'); if(V.followAudio) stopScroll(); };

  play.onclick = () => {
    if(a.paused){
      a.play(); play.innerHTML = '&#9208;'; play.classList.add('on');
      if(V.followAudio && !V.scrolling) startScroll();
    } else {
      a.pause(); play.innerHTML = '&#9654;'; play.classList.remove('on');
      if(V.followAudio) stopScroll();
    }
  };
  seek.oninput = () => { if(a.duration) a.currentTime = (seek.value/1000) * a.duration; };
  $('#aSync').onclick = () => {
    V.followAudio = !V.followAudio;
    $('#aSync').classList.toggle('on', V.followAudio);
    toast(V.followAudio ? 'Rolagem segue o áudio' : 'Rolagem independente');
  };
}

/* ---------- navegação de evento ---------- */
function navEvent(d){
  if(!V.ev) return;
  const list = V.ev.songs || [];
  const i = V.evIndex + d;
  if(i < 0 || i >= list.length){ toast(d > 0 ? 'Última música' : 'Primeira música'); return; }
  go('#/song/' + list[i] + '?ev=' + V.ev.id);
}

/* ---------- menu do visualizador ---------- */
function songViewMenu(){
  const s = V.song;
  sheet('<h3>' + esc(s.title) + '</h3>' +
    '<button class="opt" data-a="edit"><i>&#9998;</i> Editar texto da cifra</button>' +
    '<button class="opt" data-a="dg"><i>&#9648;</i> Acordes da música (desenhos)</button>' +
    '<button class="opt" data-a="chords"><i>&#9834;</i> ' + (S.showChords ? 'Esconder acordes (só letra)' : 'Mostrar acordes') + '</button>' +
    '<button class="opt" data-a="simplify"><i>&#8722;</i> Simplificar acordes</button>' +
    '<button class="opt" data-a="ev"><i>&#43;</i> Adicionar a um evento</button>' +
    '<button class="opt" data-a="audio"><i>&#9835;</i> Áudio de referência</button>' +
    '<div class="sep"></div>' +
    '<button class="opt" data-a="reset"><i>&#8635;</i> Resetar tom e zoom</button>',
    (el) => {
      $('[data-a=edit]', el).onclick = () => { closeSheet(); go('#/edit/' + s.id); };
      $('[data-a=dg]', el).onclick = () => allChordsSheet();
      $('[data-a=chords]', el).onclick = () => {
        S.showChords = !S.showChords; Store.saveSettings(S);
        $('#viewer').classList.toggle('nochords', !S.showChords);
        closeSheet();
        if($('#viewer').classList.contains('fit')) autoFit();
      };
      $('[data-a=simplify]', el).onclick = () => {
        closeSheet();
        confirmSheet('Simplificar acordes', 'C7M(9)/E vira C, Am7 vira Am. Altera a cifra salva.', 'Simplificar', () => {
          s.lines.forEach(l => (l.ch || []).forEach(c => { c.c = simplifyChord(c.c); }));
          Store.upsertSong(s); renderCifra(); toast('Simplificado');
        });
      };
      $('[data-a=ev]', el).onclick = () => { closeSheet(); addToEventSheet(s.id); };
      $('[data-a=audio]', el).onclick = () => { closeSheet(); audioSheet(); };
      $('[data-a=reset]', el).onclick = () => {
        s.transpose = 0; s.fontSize = null; s.fitMode = null; s.fitScale = null;
        Store.upsertSong(s); closeSheet(); viewSong(s.id, V.ev ? {ev: V.ev.id} : {});
      };
    });
}

function addToEventSheet(songId){
  const evs = Store.events();
  sheet('<h3>Adicionar ao evento</h3>' +
    (evs.length
      ? evs.map(e => '<button class="opt" data-e="' + e.id + '"><i>&#9776;</i> ' + esc(e.name) +
          ' <span style="color:var(--fg3);font-size:12px">(' + (e.songs||[]).length + ')</span></button>').join('')
      : '<p style="color:var(--fg2)">Nenhum evento criado ainda.</p>') +
    '<div class="sep"></div>' +
    '<button class="opt" data-new="1"><i>+</i> Criar novo evento</button>',
    (el) => {
      $$('[data-e]', el).forEach(b => b.onclick = () => {
        const e = Store.getEvent(b.dataset.e);
        e.songs = e.songs || [];
        if(!e.songs.includes(songId)) e.songs.push(songId);
        Store.upsertEvent(e); closeSheet(); toast('Adicionada a ' + e.name);
      });
      $('[data-new]', el).onclick = () => { closeSheet(); newEventSheet(songId); };
    });
}

/* ---------- wake lock ---------- */
async function requestWakeLock(){
  if(!S.keepAwake || !('wakeLock' in navigator)) return;
  try{ V.wake = await navigator.wakeLock.request('screen'); }catch(e){}
}
function releaseWakeLock(){ if(V.wake){ try{ V.wake.release(); }catch(e){} V.wake = null; } }
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState === 'visible' && $('#viewer')) requestWakeLock();
});

/* =========================================================
   EVENTOS (setlists)
   ========================================================= */
function viewEvents(){
  const evs = Store.events();
  evs.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  APP.innerHTML =
    '<header class="topbar"><div class="ttl"><b>Eventos</b>' +
      '<small>Ordem das músicas pra tocar</small></div></header>' +
    '<div class="content">' +
      (evs.length ? evs.map(e =>
        '<div class="card" data-ev="' + e.id + '"><div class="info"><b>' + esc(e.name) + '</b>' +
        '<small>' + (e.date ? fmtDate(e.date) : 'sem data') + '</small></div>' +
        '<span class="badge num">' + (e.songs||[]).length + '</span></div>').join('')
        : '<div class="empty"><div style="font-size:44px">&#9776;</div><h3>Nenhum evento</h3>' +
          '<p>Crie um evento e monte a ordem do repertório.</p></div>') +
    '</div>' +
    '<button class="fab" id="btnNewEv">+</button>' +
    tabbar('events');
  bindNav(APP);
  $$('[data-ev]').forEach(c => c.onclick = () => go('#/event/' + c.dataset.ev));
  $('#btnNewEv').onclick = () => newEventSheet();
}

function fmtDate(d){
  try{
    const [y,m,dd] = d.split('-');
    return dd + '/' + m + '/' + y;
  }catch(e){ return d; }
}

function newEventSheet(addSongId){
  const today = new Date().toISOString().slice(0,10);
  sheet('<h3>Novo evento</h3>' +
    '<div class="field"><label>Nome</label><input id="evName" placeholder="Culto de domingo, Show no bar..."></div>' +
    '<div class="field"><label>Data</label><input id="evDate" type="date" value="' + today + '"></div>' +
    '<button class="btn primary" id="evOk">Criar</button>',
    (el) => {
      setTimeout(() => $('#evName', el).focus(), 80);
      $('#evOk', el).onclick = () => {
        const name = $('#evName', el).value.trim() || 'Evento';
        const ev = { id: uid(), name: name, date: $('#evDate', el).value, songs: addSongId ? [addSongId] : [], notes: '' };
        Store.upsertEvent(ev);
        closeSheet();
        if(addSongId) toast('Criado e adicionada');
        else go('#/event/' + ev.id);
      };
    });
}

function viewEvent(id){
  const ev = Store.getEvent(id);
  if(!ev){ go('#/events'); return; }
  const songs = (ev.songs || []).map(sid => Store.getSong(sid)).filter(Boolean);
  if(songs.length !== (ev.songs||[]).length){
    ev.songs = songs.map(s => s.id); Store.upsertEvent(ev);
  }

  APP.innerHTML =
    '<header class="topbar">' +
      '<button class="iconbtn" id="back">&#8249;</button>' +
      '<div class="ttl"><b>' + esc(ev.name) + '</b><small>' +
        (ev.date ? fmtDate(ev.date) : '') + ' · ' + songs.length + ' música' + (songs.length===1?'':'s') + '</small></div>' +
      '<button class="iconbtn" id="evMenu">&#8942;</button>' +
    '</header>' +
    '<div class="content">' +
      (songs.length
        ? '<button class="btn primary" id="startEv" style="margin-bottom:14px">&#9654; Começar pela 1ª</button>'
        : '') +
      '<div id="sortlist">' + songs.map((s, i) =>
        '<div class="sortitem" data-i="' + i + '" data-id="' + s.id + '">' +
          '<span class="grip" aria-label="Arraste para reordenar">&#8801;</span>' +
          '<span class="badge num">' + (i+1) + '</span>' +
          '<div class="info" data-open="' + s.id + '"><b>' + esc(s.title) + '</b>' +
          '<small>' + esc(s.artist || '—') + ' · Tom ' + (keyOf(s) || '?') + '</small></div>' +
          '<button class="iconbtn" data-up="' + i + '" style="width:32px;height:32px">&#9650;</button>' +
          '<button class="iconbtn" data-dn="' + i + '" style="width:32px;height:32px">&#9660;</button>' +
          '<button class="iconbtn" data-rm="' + i + '" style="width:32px;height:32px">&#10005;</button>' +
        '</div>').join('') +
      '</div>' +
      (songs.length ? '' : '<div class="empty"><h3>Repertório vazio</h3><p>Adicione músicas abaixo.</p></div>') +
      '<button class="btn" id="addSongs" style="margin-top:8px">+ Adicionar músicas</button>' +
    '</div>' +
    tabbar('events');

  bindNav(APP);
  $('#back').onclick = () => go('#/events');
  $('#evMenu').onclick = () => eventMenu(ev);
  const st = $('#startEv');
  if(st) st.onclick = () => go('#/song/' + ev.songs[0] + '?ev=' + ev.id);
  $('#addSongs').onclick = () => pickSongsSheet(ev);

  $$('[data-open]').forEach(b => b.onclick = () => go('#/song/' + b.dataset.open + '?ev=' + ev.id));
  $$('[data-up]').forEach(b => b.onclick = () => moveIn(ev, +b.dataset.up, -1));
  $$('[data-dn]').forEach(b => b.onclick = () => moveIn(ev, +b.dataset.dn, 1));
  $$('[data-rm]').forEach(b => b.onclick = () => {
    ev.songs.splice(+b.dataset.rm, 1); Store.upsertEvent(ev); viewEvent(ev.id);
  });

  enableDragSort($('#sortlist'), (ordem) => {
    if(ordem.join(',') === (ev.songs || []).join(',')) return;
    ev.songs = ordem;
    Store.upsertEvent(ev);
    viewEvent(ev.id);          // redesenha pra renumerar e recolocar os índices
    toast('Ordem salva');
  });
}

/* ---------- arrastar pra reordenar (mouse e toque) ---------- */
function enableDragSort(listEl, onCommit){
  if(!listEl) return;
  let dragEl = null, startY = 0, lastY = 0, raf = null;

  const draw = () => { if(dragEl) dragEl.style.transform = 'translateY(' + (lastY - startY) + 'px)'; };

  // move no DOM e compensa o deslocamento pra peça continuar embaixo do dedo.
  // o draw() no fim é essencial: sem ele a medição do laço fica velha e o item
  // "escorrega" até o fim da lista.
  const moveTo = (ref) => {
    const antes = dragEl.getBoundingClientRect().top;
    listEl.insertBefore(dragEl, ref);
    startY += dragEl.getBoundingClientRect().top - antes;
    draw();
  };

  const reorder = () => {
    for(let guarda = 0; guarda < 30; guarda++){
      const dr = dragEl.getBoundingClientRect();
      const centro = dr.top + dr.height / 2;
      const prev = dragEl.previousElementSibling;
      const next = dragEl.nextElementSibling;
      if(prev){
        const r = prev.getBoundingClientRect();
        if(centro < r.top + r.height / 2){ moveTo(prev); continue; }
      }
      if(next){
        const r = next.getBoundingClientRect();
        if(centro > r.top + r.height / 2){ moveTo(next.nextElementSibling); continue; }
      }
      break;
    }
  };

  // rola a página sozinho quando o dedo chega perto da borda
  const edgeTick = () => {
    if(!dragEl){ raf = null; return; }
    const margem = 80;
    let d = 0;
    if(lastY < margem) d = -Math.ceil((margem - lastY) / 5);
    else if(lastY > innerHeight - margem) d = Math.ceil((lastY - (innerHeight - margem)) / 5);
    if(d){
      const antes = window.scrollY;
      window.scrollBy(0, d);
      startY -= (window.scrollY - antes);
      draw(); reorder();
    }
    raf = requestAnimationFrame(edgeTick);
  };

  const end = (g) => (e) => {
    if(!dragEl) return;
    try{ g.releasePointerCapture(e.pointerId); }catch(err){}
    dragEl.classList.remove('dragging');
    dragEl.style.transform = '';
    dragEl = null;
    if(raf){ cancelAnimationFrame(raf); raf = null; }
    onCommit($$('.sortitem', listEl).map(x => x.dataset.id));
  };

  $$('.grip', listEl).forEach(g => {
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const item = g.closest('.sortitem');
      if(!item) return;
      dragEl = item;
      startY = lastY = e.clientY;
      dragEl.classList.add('dragging');
      dragEl.style.transform = 'translateY(0px)';
      try{ g.setPointerCapture(e.pointerId); }catch(err){}
      if(!raf) raf = requestAnimationFrame(edgeTick);
    });
    g.addEventListener('pointermove', (e) => {
      if(!dragEl) return;
      lastY = e.clientY;
      draw(); reorder();
    });
    g.addEventListener('pointerup', end(g));
    g.addEventListener('pointercancel', end(g));
  });
}

function moveIn(ev, i, d){
  const j = i + d;
  if(j < 0 || j >= ev.songs.length) return;
  const t = ev.songs[i]; ev.songs[i] = ev.songs[j]; ev.songs[j] = t;
  Store.upsertEvent(ev); viewEvent(ev.id);
}

function pickSongsSheet(ev){
  const all = Store.songs().slice().sort((a,b) => a.title.localeCompare(b.title,'pt'));
  sheet('<h3>Adicionar músicas</h3>' +
    '<div class="field"><input id="pq" placeholder="Buscar"></div>' +
    '<div id="plist" style="max-height:48vh;overflow:auto">' + all.map(pickRow).join('') + '</div>' +
    '<button class="btn primary" id="pOk" style="margin-top:12px">Pronto</button>',
    (el) => {
      const paint = (v) => {
        const f = v.trim().toLowerCase();
        const r = f ? all.filter(s => (s.title+' '+s.artist).toLowerCase().includes(f)) : all;
        $('#plist', el).innerHTML = r.map(pickRow).join('');
        bindPick();
      };
      const bindPick = () => {
        $$('[data-pick]', el).forEach(b => b.onclick = () => {
          const sid = b.dataset.pick;
          ev.songs = ev.songs || [];
          const i = ev.songs.indexOf(sid);
          if(i >= 0) ev.songs.splice(i, 1); else ev.songs.push(sid);
          Store.upsertEvent(ev);
          b.classList.toggle('on', ev.songs.includes(sid));
          b.textContent = ev.songs.includes(sid) ? '✓' : '+';
        });
      };
      $('#pq', el).oninput = (e) => paint(e.target.value);
      bindPick();
      $('#pOk', el).onclick = () => { closeSheet(); viewEvent(ev.id); };
    });

  function pickRow(s){
    const on = (ev.songs || []).includes(s.id);
    return '<div class="card" style="margin-bottom:7px;padding:10px 12px"><div class="info">' +
      '<b>' + esc(s.title) + '</b><small>' + esc(s.artist || '—') + '</small></div>' +
      '<button class="iconbtn' + (on ? ' on' : '') + '" data-pick="' + s.id + '" ' +
      'style="width:32px;height:32px">' + (on ? '✓' : '+') + '</button></div>';
  }
}

function eventMenu(ev){
  sheet('<h3>' + esc(ev.name) + '</h3>' +
    '<div class="field"><label>Nome</label><input id="enName" value="' + esc(ev.name) + '"></div>' +
    '<div class="field"><label>Data</label><input id="enDate" type="date" value="' + esc(ev.date || '') + '"></div>' +
    '<div class="field"><label>Observações</label><input id="enNotes" value="' + esc(ev.notes || '') + '" placeholder="Ex.: começar acústico"></div>' +
    '<button class="btn primary" id="enOk" style="margin-bottom:9px">Salvar</button>' +
    '<button class="btn danger" id="enDel">Excluir evento</button>',
    (el) => {
      $('#enOk', el).onclick = () => {
        ev.name = $('#enName', el).value.trim() || ev.name;
        ev.date = $('#enDate', el).value;
        ev.notes = $('#enNotes', el).value;
        Store.upsertEvent(ev); closeSheet(); viewEvent(ev.id);
      };
      $('#enDel', el).onclick = () => {
        closeSheet();
        confirmSheet('Excluir evento', 'As músicas continuam salvas.', 'Excluir',
          () => { Store.deleteEvent(ev.id); go('#/events'); });
      };
    });
}

/* =========================================================
   AJUSTES / EXPORT / IMPORT
   ========================================================= */
function viewSettings(){
  const nSongs = Store.songs().length, nEv = Store.events().length;
  const comAudio = Store.songs().filter(s => s.audio);
  const nAudio = comAudio.length;
  const audioBytes = comAudio.reduce((a, s) => a + (s.audio.size || 0), 0);
  APP.innerHTML =
    '<header class="topbar"><div class="ttl"><b>Ajustes</b>' +
      '<small>' + nSongs + (nSongs===1?' música':' músicas') + ' · ' + nEv + (nEv===1?' evento':' eventos') + '</small></div></header>' +
    '<div class="content">' +
      '<div class="switch"><span>Tema claro</span><input type="checkbox" id="cfgTheme"' + (S.theme==='light'?' checked':'') + '></div>' +
      '<div class="switch"><span>Manter tela ligada tocando</span><input type="checkbox" id="cfgWake"' + (S.keepAwake?' checked':'') + '></div>' +
      '<div class="switch"><span>Abrir cifras em "caber na tela"</span><input type="checkbox" id="cfgFit"' + (S.fitMode?' checked':'') + '></div>' +
      '<div class="field" style="margin-top:14px"><label>Tamanho de letra padrão: <span id="fsv">' + S.fontSize + 'px</span></label>' +
        '<input type="range" id="cfgFs" min="10" max="34" value="' + S.fontSize + '" style="padding:0"></div>' +
      '<div class="field"><label>Velocidade padrão da rolagem: <span id="spv">' + S.scrollSpeed + '</span></label>' +
        '<input type="range" id="cfgSpd" min="0" max="100" value="' + S.scrollSpeed + '" style="padding:0"></div>' +

      '<div class="sep" style="margin:20px 0"></div>' +
      '<h3 style="font-size:15px;margin:0 0 10px">Backup</h3>' +
      '<button class="btn" id="expJson" style="margin-bottom:9px">&#8681; Exportar cifras (.json)</button>' +
      '<button class="btn" id="expFull"' + (nAudio ? '' : ' disabled') +
        ' style="margin-bottom:9px' + (nAudio ? '' : ';opacity:.45') + '">' +
        '&#8681; Exportar com áudios' +
        (nAudio ? ' <small style="opacity:.7;font-weight:500">~' + humanSize(Math.round(audioBytes * 1.34)) + '</small>'
                : ' <small style="opacity:.7;font-weight:500">nenhum áudio</small>') + '</button>' +
      '<button class="btn" id="impJson" style="margin-bottom:9px">&#8679; Importar backup</button>' +
      '<div class="hint">O JSON guarda cifras, eventos e ajustes — leve, dá pra mandar por WhatsApp. ' +
        'Os <b>áudios não vão junto</b> nesse arquivo: pra levá-los, use a segunda opção, ' +
        'que embute os arquivos e fica bem maior.</div>' +

      '<div class="sep" style="margin:20px 0"></div>' +
      '<h3 style="font-size:15px;margin:0 0 10px">Versão</h3>' +
      '<button class="btn" id="chkUpd" style="margin-bottom:9px">&#8635; Procurar atualização</button>' +
      '<div class="hint">Atualiza sozinho quando você abre o app com internet. ' +
        'Se estiver com uma cifra aberta, o aviso espera você sair dela.</div>' +

      '<div class="sep" style="margin:20px 0"></div>' +
      '<button class="btn danger" id="wipe">Apagar tudo</button>' +
      '<div class="hint" style="text-align:center;margin-top:18px">Cifras <span id="verNum"></span> · funciona offline</div>' +
    '</div>' +
    tabbar('cfg');
  bindNav(APP);

  $('#cfgTheme').onchange = e => { S.theme = e.target.checked ? 'light' : 'dark'; Store.saveSettings(S); applyTheme(); };
  $('#cfgWake').onchange  = e => { S.keepAwake = e.target.checked; Store.saveSettings(S); };
  $('#cfgFit').onchange   = e => { S.fitMode = e.target.checked; Store.saveSettings(S); };
  $('#cfgFs').oninput     = e => { S.fontSize = +e.target.value; $('#fsv').textContent = S.fontSize + 'px'; Store.saveSettings(S); };
  $('#cfgSpd').oninput    = e => { S.scrollSpeed = +e.target.value; $('#spv').textContent = S.scrollSpeed; Store.saveSettings(S); };

  $('#chkUpd').onclick = () => procurarAtualizacao();
  versaoInstalada().then(v => { const el = $('#verNum'); if(el) el.textContent = v; });

  $('#expJson').onclick = () => doExport(false);
  $('#expFull').onclick = () => doExport(true);
  $('#impJson').onclick = () => doImport();
  $('#wipe').onclick = () => confirmSheet('Apagar tudo', 'Remove todas as músicas, eventos e áudios deste aparelho.', 'Apagar tudo', async () => {
    for(const k of await Audio_DB.keys()) await Audio_DB.del(k);
    localStorage.removeItem(LS.songs); localStorage.removeItem(LS.events);
    toast('Tudo apagado'); go('#/'); render();
  });
}

async function doExport(withAudio){
  const data = {
    app: 'cifras', version: 1, exportedAt: new Date().toISOString(),
    settings: Store.settings(), songs: Store.songs(), events: Store.events(), audios: {}
  };
  if(withAudio){
    toast('Preparando áudios...');
    for(const s of data.songs){
      if(!s.audio) continue;
      const b = await Audio_DB.get(s.id);
      if(b) data.audios[s.id] = await blobToDataURL(b);
    }
  }
  const name = 'cifras-backup-' + new Date().toISOString().slice(0,10) + (withAudio ? '-com-audio' : '') + '.json';
  downloadFile(name, JSON.stringify(data));
  toast('Exportado');
}

function doImport(){
  const f = $('#fileJson');
  f.value = '';
  f.onchange = () => {
    const file = f.files[0];
    if(!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      let data;
      try{ data = JSON.parse(fr.result); }
      catch(e){ toast('Arquivo inválido'); return; }
      if(!data || !Array.isArray(data.songs)){ toast('Não parece um backup de cifras'); return; }
      importSheet(data);
    };
    fr.readAsText(file);
  };
  f.click();
}

function importSheet(data){
  const n = data.songs.length, ne = (data.events || []).length;
  sheet('<h3>Importar backup</h3>' +
    '<p style="color:var(--fg2)">' + n + ' música(s) e ' + ne + ' evento(s) no arquivo.</p>' +
    '<button class="btn primary" id="imMerge" style="margin-bottom:9px">Mesclar com o que já tenho</button>' +
    '<button class="btn danger" id="imRepl">Substituir tudo</button>',
    (el) => {
      $('#imMerge', el).onclick = () => applyImport(data, false);
      $('#imRepl',  el).onclick = () => applyImport(data, true);
    });
}

async function applyImport(data, replace){
  closeSheet();
  let songs = replace ? [] : Store.songs();
  let events = replace ? [] : Store.events();
  const idMap = {};

  for(const s of data.songs){
    const clash = songs.find(x => x.id === s.id);
    let ns = Object.assign(newSong(), s);
    if(clash){
      // mesmo id: se título igual, sobrescreve; senão gera novo id
      if(clash.title === s.title){ Object.assign(clash, ns); idMap[s.id] = clash.id; continue; }
      const old = ns.id; ns.id = uid(); idMap[old] = ns.id;
    } else idMap[s.id] = ns.id;
    songs.push(ns);
  }
  for(const e of (data.events || [])){
    const ne = Object.assign({ id: uid(), name: 'Evento', date: '', songs: [], notes: '' }, e);
    ne.songs = (ne.songs || []).map(x => idMap[x] || x).filter(x => songs.some(s => s.id === x));
    if(!events.some(x => x.id === ne.id)) events.push(ne);
  }
  Store.saveEvents(events);

  if(data.audios){
    for(const oldId of Object.keys(data.audios)){
      const nid = idMap[oldId] || oldId;
      try{ await Audio_DB.put(nid, await dataURLToBlob(data.audios[oldId])); }catch(e){}
    }
  }

  // backup exportado sem os áudios: não deixa a música fingir que tem um.
  // (checa o arquivo de verdade, então reimportar no mesmo aparelho preserva)
  let semArquivo = 0;
  for(const s of songs){
    if(s.audio && !(await Audio_DB.get(s.id))){ s.audio = null; semArquivo++; }
  }
  Store.saveSongs(songs);

  if(semArquivo) toast(semArquivo + ' música(s) sem o áudio — o backup era o sem áudio', 3500);
  go('#/'); render();
}

/* =========================================================
   BOOT
   ========================================================= */
applyTheme();
render();

/* ---------------- atualização do app ---------------- */
let regSW = null;
let temAtualizacao = false;

/** Só avisa fora da cifra: ninguém quer esse banner no meio de um culto. */
function avisarAtualizacaoSePuder(){
  if(!temAtualizacao) return;
  if($('#viewer')) return;              // tocando: deixa pra depois
  if($('#updBar')) return;
  const d = document.createElement('div');
  d.id = 'updBar';
  d.innerHTML = '<span>Nova versão disponível</span>' +
    '<button class="upd-yes" id="updGo">Atualizar</button>' +
    '<button class="upd-no" id="updNo">Depois</button>';
  document.body.appendChild(d);
  $('#updGo').onclick = () => location.reload();
  $('#updNo').onclick = () => { temAtualizacao = false; d.remove(); };
}

async function procurarAtualizacao(){
  if(!regSW){ toast('Atualização automática indisponível aqui'); return; }
  toast('Procurando...');
  try{
    await regSW.update();
    setTimeout(() => {
      if(temAtualizacao) avisarAtualizacaoSePuder();
      else toast('Já está na versão mais recente');
    }, 1600);
  }catch(e){ toast('Sem internet agora'); }
}

async function versaoInstalada(){
  try{
    const k = (await caches.keys()).find(x => x.indexOf('cifras-') === 0);
    return k ? k.replace('cifras-', '') : '—';
  }catch(e){ return '—'; }
}

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  // precisa ser mutável: numa aba que abriu sem service worker, a primeira troca
  // é a instalação (não avisa) e as seguintes são atualizações de verdade (avisa)
  let tinhaControlador = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(r => { regSW = r; }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(tinhaControlador){
      temAtualizacao = true;
      avisarAtualizacaoSePuder();
    }
    tinhaControlador = true;
  });
  window.addEventListener('hashchange', () => setTimeout(avisarAtualizacaoSePuder, 60));
}
