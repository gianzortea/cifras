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
  return t;
}
function applyTheme(){
  document.documentElement.dataset.theme = S.theme;
  document.documentElement.dataset.esp = S.spacing || 'compacto';
  const m = document.querySelector('meta[name=theme-color]');
  if(m) m.content = S.theme === 'light' ? '#fbfbfd' : '#0f1115';
}

/* ---------------- modal / bottom sheet ---------------- */
function sheet(html, onMount){
  closeSheet();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="sheet">' + html + '</div>';
  ov.addEventListener('click', e => { if(e.target === ov && !ov.dataset.preso) closeSheet(); });
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
  desenharRota();
  aposTrocarDeTela();
}
function desenharRota(){
  const { parts, q } = parseRoute();
  const [a, b] = parts;
  if(!a)                     return viewList();
  if(a === 'new')            return viewEditor(null);
  if(a === 'edit'  && b)     return viewEditor(b);
  if(a === 'song'  && b)     return viewSong(b, q);
  if(a === 'events')         return viewEvents(b === 'arquivados');
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
      '<small>' + all.length + ' música' + (all.length===1?'':'s') + '<span id="syncEstado">' + esc(syncEstadoTxt()) + '</span></small></div>' +
      '<button class="iconbtn" id="btnSort">&#8645;</button></header>' +
    '<div class="content">' +
      barraOfflineHTML() +
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
  if($('#offEntrar')) $('#offEntrar').onclick = () => avisoEntrar();
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
    '<small>' + esc(s.artist || '—') + ((s.tracks && s.tracks.length) ? ' &nbsp;&#9835;' + (s.tracks.length > 1 ? s.tracks.length : '') : '') + '</small></div>' +
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
        c.id = uid(); c.title = s.title + ' (cópia)'; c.tracks = []; c.trackAtiva = null;
        Store.upsertSong(c); closeSheet(); render(); toast('Duplicada');
      };
      $('[data-a=txt]',  el).onclick = () => {
        downloadFile(slug(s.title) + '.json', JSON.stringify({ version:1, songs:[s] }, null, 2));
        closeSheet();
      };
      $('[data-a=del]',  el).onclick = () => {
        closeSheet();
        confirmSheet('Excluir música', 'Isso remove "' + s.title + '" e o áudio dela' +
            (onlineConectado() ? ' — do repertório da banda inteira, não só deste aparelho' : '') + '. Não dá pra desfazer.', 'Excluir',
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
        else list.sort((a,c) => (c.updatedAt||c.editadoEm||0) - (a.updatedAt||a.editadoEm||0));
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
        '<div class="hint">Cole exatamente como está no site: os acordes acima da letra são detectados e alinhados automaticamente. ' +
          'Linha em branco vira só um respiro pequeno; pra abrir um <b>espaço de verdade</b>, escreva <b>---</b> sozinho numa linha.</div>' +
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
  zoom: 1,
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
  V.song = s; V.edit = false; V.zen = false; V.zoom = 1;
  // mesma música e mesma cifra de quando saiu: a história de desfazer continua valendo
  if(U.id !== s.id || U.linhas !== JSON.stringify(s.lines)) zerarDesfazer();

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
        '<button class="tool" id="tCols">' + rotuloColunas(s) + '</button>' +
        '<button class="tool" id="tFsMinus">A&minus;</button>' +
        '<button class="tool" id="tFsPlus">A+</button>' +
        '<button class="tool" id="tEdit">&#9998; Editar acordes</button>' +
        '<button class="tool" id="tAudio">&#9835; Áudio</button>' +
        '<button class="tool" id="tRec">&#9679; Gravar</button>' +
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
  $('#tCols').onclick  = () => ciclarColunas();
  $('#tFsMinus').onclick = () => bumpFont(-1);
  $('#tFsPlus').onclick  = () => bumpFont(1);
  $('#tEdit').onclick  = () => toggleEdit();
  $('#tAudio').onclick = () => audioSheet();
  $('#tRec').onclick   = () => { if(V.grav) pararGravacao(false); else pedirGravacao(); };
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
    if(V.arrastou) return;                 // foi deslize de página, não toque
    const ch = e.target.closest('.ch');
    if(ch){ diagramSheet(ch.textContent); return; }
    toggleZen();
  });

  // deslizar de lado troca de página; ao soltar, encaixa na página inteira
  $('#stage').addEventListener('scroll', () => {
    if(V.edit) return;
    V.arrastou = true;
    clearTimeout(V.snapT);
    V.snapT = setTimeout(() => { encaixarNaPagina(); setTimeout(() => { V.arrastou = false; }, 120); }, 140);
  });

  renderCifra();
  enableEditGestures();
  enableViewZoom();
  if(faixaAtiva(s)) mountPlayer();
  requestWakeLock();
  window.addEventListener('resize', onResize);
}

function onResize(){ if($('#viewer') && $('#viewer').classList.contains('fit')) autoFit(); }

function teardownViewer(){
  if(V.grav) pararGravacao(false);          // saiu no meio: salva em vez de perder a tomada
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
    if(l.t === 'gap'){ out.push('<div class="ln gap"></div>'); return; }
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
    cif.style.columnWidth = '';
    cif.style.columnFill = '';
    cif.style.height = '';
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

const GAP = 22;

/** Layout de UMA tela: divide o conteúdo igualmente entre as colunas.
    Devolve true se coube inteiro (altura e largura).
    Precisa ser 'balance' com column-count: com column-width + fill:auto o
    conteúdo enche a primeira coluna e as outras ficam vazias — foi o que fazia
    "2 colunas" virar uma coluna espremida com meia tela em branco. */
function layoutUmaTela(fs, cols){
  const cif = $('#cifra'), box = stageBox();
  cif.style.fontSize = fs + 'px';
  cif.style.columnWidth = 'auto';
  cif.style.columnCount = cols;
  cif.style.columnFill = 'balance';
  cif.style.columnGap = GAP + 'px';
  cif.style.columnRule = '1px solid var(--line)';
  cif.style.height = '';
  return cif.scrollHeight <= box.H && cif.scrollWidth <= box.W;
}

/** Monta o layout em páginas e devolve quantas páginas ficaram.
    Cada página é uma tela cheia; dentro dela cabem `cols` colunas. */
function fitLayout(fs, cols){
  const cif = $('#cifra'), box = stageBox();
  const colW = Math.max(40, box.W / cols - GAP);
  cif.style.fontSize = fs + 'px';
  cif.style.columnCount = '';
  cif.style.columnWidth = colW + 'px';
  cif.style.columnGap = GAP + 'px';
  cif.style.columnRule = '1px solid var(--line)';
  cif.style.columnFill = 'auto';
  cif.style.height = box.H + 'px';
  // conta pelas COLUNAS, não pela largura: a largura carrega um vão sobrando
  // no fim e arredondava pra cima, inventando uma página a mais
  const nCols = Math.max(1, Math.round((cif.scrollWidth + GAP) / (colW + GAP)));
  return Math.max(1, Math.ceil(nCols / cols));
}

/** Largura de um caractere na fonte monoespaçada, para uma dada altura */
function charWidthAt(fs){
  const cif = $('#cifra'), m = $('#measure'), cs = getComputedStyle(cif);
  m.style.fontFamily = cs.fontFamily;
  m.style.fontWeight = '700';
  m.style.fontSize = fs + 'px';
  m.textContent = '0'.repeat(40);
  return m.getBoundingClientRect().width / 40 || fs * 0.6;
}

/** Maior linha da música, em caracteres */
function maiorLinha(){
  return (V.song.lines || []).reduce((max, l) => {
    const t = (l.text || '').length;
    const c = (l.ch || []).reduce((a, x) => Math.max(a, x.p + String(x.c).length), 0);
    return Math.max(max, t, c);
  }, 1);
}

/** Rótulo do botão de colunas: auto / 1 col / 2 col */
function rotuloColunas(s){
  const p = s.fitColsPref || 0;
  return '&#9707; ' + (p ? p + (p > 1 ? ' colunas' : ' coluna') : 'colunas auto');
}

/** Alterna auto -> 1 -> 2 -> auto. Fixar em 2 é sempre possível. */
function ciclarColunas(){
  const max = window.innerWidth >= 700 ? 3 : 2;
  const atual = V.song.fitColsPref || 0;
  V.song.fitColsPref = atual === 0 ? 1 : (atual >= max ? 0 : atual + 1);
  V.song.fitScale = null;                 // recomeça do maior tamanho que cabe
  Store.upsertSong(V.song);

  const v = $('#viewer');
  if(v && !v.classList.contains('fit')) toggleFit();   // faz sentido só no "caber na tela"
  else autoFit();

  const b = $('#tCols');
  if(b) b.innerHTML = rotuloColunas(V.song);

  // mostra o resultado junto com o do automático: fixar coluna quase sempre
  // ENCOLHE a letra, e isso tem que ficar visível na hora da escolha
  const p = V.song.fitColsPref;
  const agora = parseFloat($('#cifra').style.fontSize);
  let comparacao = '';
  if(p){
    V.song.fitColsPref = 0; V.song.fitScale = null; autoFit();
    const auto = parseFloat($('#cifra').style.fontSize);
    V.song.fitColsPref = p; V.song.fitScale = null; autoFit();
    if(Math.abs(auto - agora) > 0.5) comparacao = '  (automático: ' + auto.toFixed(0) + 'px)';
  }
  toast((p ? p + (p > 1 ? ' colunas' : ' coluna') : 'colunas automáticas') +
        ' · ' + agora.toFixed(0) + 'px' + comparacao +
        (V.fitPages > 1 ? ' · ' + V.fitPages + ' páginas' : ''), 3200);
}

function autoFit(){
  const stage = $('#stage'), cif = $('#cifra');
  if(!stage || !cif) return;
  // mede sempre em 100%: o zoom é uma lupa por cima do layout, não muda a conta
  const zSalvo = V.zoom || 1;
  if(zSalvo !== 1) cif.style.zoom = '';
  const box = stageBox();
  // Nunca 3 colunas numa tela de celular: coluna estreita demais não comporta
  // uma linha de cifra. O que passar de 2 colunas vira página.
  const maxCols = window.innerWidth >= 700 ? 3 : 2;

  // largura de uma linha inteira, para qualquer tamanho de fonte (monoespaçada = linear).
  // Sem isso o layout aceita colunas estreitas demais e as linhas transbordam.
  const razao = charWidthAt(100) / 100;
  const chars = maiorLinha();
  const linhaCabe = (fs, cols) => chars * fs * razao <= (box.W / cols - GAP) + 1;

  // 1) maior fonte que cabe numa ÚNICA página.
  // Se o usuário fixou a quantidade de colunas, respeita a escolha dele.
  const pref = V.song.fitColsPref || 0;
  let best = { fs: 0, cols: 1 };
  for(let cols = 1; cols <= maxCols; cols++){
    if(pref && cols !== pref) continue;
    let lo = 5, hi = 52, ok = 0;
    for(let it = 0; it < 10; it++){
      const mid = (lo + hi) / 2;
      if(linhaCabe(mid, cols) && layoutUmaTela(mid, cols)){ ok = mid; lo = mid; }
      else hi = mid;
    }
    if(ok > best.fs + 0.15) best = { fs: ok, cols: cols };
  }
  if(!best.fs && pref) best = { fs: 6, cols: pref };
  V.fitMax = best.fs || 6;

  // 2) ajuste manual: abaixo de 1 continua numa página; acima de 1 vira páginas.
  // Teto absoluto: a linha mais longa tem que caber na largura da tela, senão
  // "caber na tela" deixaria de ser verdade e o texto sairia cortado.
  const colsTeto = pref || 1;
  const fsTeto = (box.W / colsTeto - GAP) / (chars * razao);
  let scale = Math.max(0.3, Math.min(3, V.song.fitScale || 1));
  if(V.fitMax * scale > fsTeto){
    scale = fsTeto / V.fitMax;
    V.song.fitScale = scale;          // trava o ajuste, não só a exibição
  }
  const target = Math.max(5, V.fitMax * scale);

  let cols = pref || best.cols || 1;
  if(!pref){
    if(scale <= 1){
      // menor número de colunas que ainda cabe: colunas mais largas, menos apertadas
      for(let c = 1; c <= maxCols; c++){
        if(linhaCabe(target, c) && layoutUmaTela(target, c)){ cols = c; break; }
      }
    } else {
      // aumentando: quantas colunas ainda comportarem a linha mais longa
      cols = 1;
      for(let c = maxCols; c >= 1; c--){ if(linhaCabe(target, c)){ cols = c; break; } }
    }
  }

  V.fitPages = layoutUmaTela(target, cols) ? 1 : fitLayout(target, cols);
  V.fitCols = cols;
  V.fitScaleApplied = scale;
  if(V.fitPage > V.fitPages) V.fitPage = V.fitPages;
  if(zSalvo !== 1) cif.style.zoom = zSalvo;
  else irParaPagina(V.fitPage || 1, false);
  renderDock();
}

/* ---------- navegação por páginas ---------- */
function irParaPagina(n, suave){
  const stage = $('#stage');
  if(!stage) return;
  V.fitPage = Math.max(1, Math.min(V.fitPages || 1, n));
  const alvo = (V.fitPage - 1) * stageBox().W;
  if(Math.abs(stage.scrollLeft - alvo) > 2){
    // trava o encaixe durante a animação, senão ele lê a posição no meio do
    // caminho, conclui que é outra página e cancela a rolagem
    V.scrollProg = true;
    clearTimeout(V.progT);
    V.progT = setTimeout(() => { V.scrollProg = false; }, 500);
    stage.scrollTo({ left: alvo, behavior: suave === false ? 'auto' : 'smooth' });
  }
  renderDock();
}

function encaixarNaPagina(){
  const v = $('#viewer'), stage = $('#stage');
  if(!v || !stage || !v.classList.contains('fit')) return;
  if(V.scrollProg) return;
  if((V.zoom || 1) !== 1) return;          // ampliado: o deslize é pra olhar, não pra virar página
  const W = stageBox().W;
  irParaPagina(Math.round(stage.scrollLeft / W) + 1);
}

function toggleFit(){
  if((V.zoom || 1) !== 1) resetZoom();
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

  // no modo "caber na tela" o A-/A+ ajusta o tamanho SEM sair do modo.
  // Passando do que cabe numa tela, a música vira páginas que você desliza —
  // nunca volta pra rolagem manual.
  if(v.classList.contains('fit')){
    const antes = V.song.fitScale || 1;
    V.song.fitScale = Math.max(0.3, Math.min(3, antes + d * 0.08));
    autoFit();                                   // pode travar no teto de largura
    const depois = V.song.fitScale || 1;
    Store.upsertSong(V.song);

    if(Math.abs(depois - antes) < 0.005){
      toast(d > 0 ? 'No máximo: a linha mais longa já ocupa a largura da tela'
                  : 'No tamanho mínimo', 2600);
      return;
    }
    const p = V.fitPages > 1 ? V.fitPages + ' páginas' :
              (V.fitCols > 1 ? V.fitCols + ' colunas' : '1 tela');
    toast(Math.round(depois * 100) + '% · ' + p);
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
  // retângulo visível (já considera o zoom); offsetHeight não considera
  const fim = cif.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + stage.scrollTop + 16;
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
  const v = $('#viewer');

  // em "caber na tela" a rolagem não se aplica; o que importa são as páginas
  if(v && v.classList.contains('fit')){
    const btn = $('#btnScroll'), cfg = $('#btnScrollCfg');
    if(btn) btn.style.display = 'none';
    if(cfg) cfg.style.display = 'none';
    if((V.fitPages || 1) > 1){
      mid.innerHTML =
        '<button class="iconbtn" id="pgPrev">&#8249;</button>' +
        '<span class="val" id="pgLbl" style="flex:1;text-align:center;width:auto;font-size:13px;font-weight:600">' +
          (V.fitPage || 1) + ' / ' + V.fitPages + '</span>' +
        '<button class="iconbtn" id="pgNext">&#8250;</button>';
      $('#pgPrev').onclick = () => irParaPagina((V.fitPage || 1) - 1);
      $('#pgNext').onclick = () => irParaPagina((V.fitPage || 1) + 1);
    } else {
      mid.innerHTML = '<span class="val" style="flex:1;text-align:center;width:auto">tela única</span>';
    }
    return;
  }
  const btn = $('#btnScroll'), cfg = $('#btnScrollCfg');
  if(btn) btn.style.display = '';
  if(cfg) cfg.style.display = '';

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
  // duração do TRECHO que toca (com o recorte), não do arquivo inteiro
  const audioDur = (V.audioEl && isFinite(V.audioEl.duration) && V.audioEl.duration > 0)
    ? trechoAudio().len : 0;

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

/* ---------- desfazer / refazer ----------
   Vale pro que muda a cifra dentro da visualização: mover, trocar, inserir e remover
   acorde, simplificar e fixar o tom. Zoom, colunas e tom da tela ficam de fora — são
   ajustes que se desfazem no próprio botão e só gastariam os passos.
   Fica só na memória (nada vai pro armazenamento nem pro GitHub) e vale enquanto a
   música for a mesma: abrir outra cifra recomeça a história. */
const DESFAZER_MAX = 20;
const U = { id: null, linhas: '', atras: [], frente: [] };

function fotoCifra(){
  const s = V.song;
  return JSON.stringify({ lines: s.lines, key: s.key || '', transpose: s.transpose || 0 });
}
function zerarDesfazer(){
  U.id = V.song ? V.song.id : null;
  U.linhas = V.song ? JSON.stringify(V.song.lines) : '';
  U.atras = []; U.frente = [];
  pintarDesfazer();
}
/** Abre um passo ANTES de alterar V.song. Vários ajustes seguidos na mesma folha usam o mesmo passo. */
function novoPasso(oQue){ return { oQue: oQue, foto: fotoCifra() }; }
/** Fecha o passo DEPOIS de alterar: grava a música e guarda o passo na história */
function fecharPasso(p){
  Store.upsertSong(V.song);
  const i = U.atras.indexOf(p);
  if(fotoCifra() === p.foto){ if(i >= 0) U.atras.splice(i, 1); }        // voltou ao que era: nada a desfazer
  else {
    if(i < 0){ U.atras.push(p); if(U.atras.length > DESFAZER_MAX) U.atras.shift(); }
    U.frente = [];
  }
  U.linhas = JSON.stringify(V.song.lines);
  pintarDesfazer();
}
function aplicarFoto(foto){
  const d = JSON.parse(foto), s = V.song;
  s.lines = d.lines;
  // o tom da tela é do aparelho e fica como está — menos ao desfazer um "fixar o tom",
  // que reescreveu os acordes: aí a música volta inteira ao que era
  if(d.key !== (s.key || '')){ s.key = d.key; s.transpose = d.transpose; }
  Store.upsertSong(s);
  U.linhas = JSON.stringify(s.lines);
  closeSheet();
  refreshKeyBtn(); renderCifra();
  pintarDesfazer();
}
// um aviso por vez: tocar no desfazer várias vezes seguidas não empilha avisos na tela
let avisoDoDesfazer = null;
function avisarDesfazer(msg){
  if(avisoDoDesfazer) avisoDoDesfazer.remove();
  avisoDoDesfazer = toast(msg, 1500);
}
function desfazer(){
  if(!$('#viewer') || V.grav) return;
  const p = U.atras.pop();
  if(!p){ avisarDesfazer('Nada pra desfazer'); return; }
  U.frente.push({ oQue: p.oQue, foto: fotoCifra() });
  aplicarFoto(p.foto);
  avisarDesfazer('Desfeito: ' + p.oQue);
}
function refazer(){
  if(!$('#viewer') || V.grav) return;
  const p = U.frente.pop();
  if(!p){ avisarDesfazer('Nada pra refazer'); return; }
  U.atras.push({ oQue: p.oQue, foto: fotoCifra() });
  aplicarFoto(p.foto);
  avisarDesfazer('Refeito: ' + p.oQue);
}
function pintarDesfazer(){
  const d = $('#uDes'), r = $('#uRef');
  if(d) d.disabled = !U.atras.length;
  if(r) r.disabled = !U.frente.length;
}
// teclado (computador): Ctrl+Z desfaz, Ctrl+Shift+Z ou Ctrl+Y refaz
document.addEventListener('keydown', (e) => {
  if(!(e.ctrlKey || e.metaKey) || e.altKey || !$('#viewer') || $('#modal-root').firstChild) return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
  const k = e.key.toLowerCase();
  if(k === 'z' && !e.shiftKey){ e.preventDefault(); desfazer(); }
  else if(k === 'y' || (k === 'z' && e.shiftKey)){ e.preventDefault(); refazer(); }
});

/* ---------- modo edição de acordes ---------- */
function toggleEdit(){
  V.edit = !V.edit;
  const v = $('#viewer');
  v.classList.toggle('edit', V.edit);
  $('#tEdit').classList.toggle('on', V.edit);
  if(V.edit){
    stopScroll();
    if((V.zoom || 1) !== 1) resetZoom();      // a edição tem o zoom dela (por fonte)
    V.fitAntesDeEditar = v.classList.contains('fit');
    if(V.fitAntesDeEditar) toggleFit();
    if(!$('#editbar')){
      const bar = document.createElement('div');
      bar.className = 'editbar'; bar.id = 'editbar';
      bar.innerHTML = '<span style="flex:1">Arraste os acordes ↔ · toque para editar · toque na letra para inserir</span>' +
                      '<button class="tool" id="uDes" aria-label="Desfazer">&#8630;</button>' +
                      '<button class="tool" id="uRef" aria-label="Refazer">&#8631;</button>' +
                      '<button class="tool on" id="editDone">Concluir</button>';
      v.insertBefore(bar, $('#dock'));
      $('#editDone').onclick = () => toggleEdit();
      $('#uDes').onclick = () => desfazer();
      $('#uRef').onclick = () => refazer();
      pintarDesfazer();
    }
    bindEditHandlers();
  } else {
    const bar = $('#editbar'); if(bar) bar.remove();
    // devolve o "caber na tela" se era assim que a música estava antes de editar
    if(V.fitAntesDeEditar && !v.classList.contains('fit')) toggleFit();
    V.fitAntesDeEditar = false;
  }
}

/* ---------- zoom de visualização (qualquer modo, inclusive "caber na tela") ----------
   É uma lupa: amplia o que está na tela sem refazer o layout. Por isso não
   bagunça o "caber na tela" — soltou no 100%, volta exatamente como estava. */
const ZOOM_MIN = 0.5, ZOOM_MAX = 4;

function aplicarZoom(z, cx, cy){
  const stage = $('#stage'), cif = $('#cifra'), v = $('#viewer');
  if(!stage || !cif || !v) return;
  z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  if(Math.abs(z - 1) < 0.04) z = 1;               // encaixa no 100%
  const z0 = V.zoom || 1;

  // mantém parado o ponto que está entre os dedos
  const r = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
  const padL = parseFloat(cs.paddingLeft), padT = parseFloat(cs.paddingTop);
  const ax = (cx == null ? r.left + r.width / 2 : cx) - r.left;
  const ay = (cy == null ? r.top + r.height / 3 : cy) - r.top;
  const px = (stage.scrollLeft + ax - padL) / z0;
  const py = (stage.scrollTop  + ay - padT) / z0;

  V.zoom = z;
  v.classList.toggle('zoomed', z !== 1);
  cif.style.zoom = z === 1 ? '' : String(z);
  stage.scrollLeft = px * z + padL - ax;
  stage.scrollTop  = py * z + padT - ay;
  atualizarChipZoom();
}

/** Arremates depois que o gesto termina */
function aposZoom(){
  const v = $('#viewer'), stage = $('#stage');
  if(!v || !stage) return;
  if((V.zoom || 1) === 1 && v.classList.contains('fit')){
    stage.scrollTop = 0;
    irParaPagina(Math.round(stage.scrollLeft / stageBox().W) + 1, false);
  }
  if(V.scrolling){
    V.pps = scrollPxPerSec();
    if(V.song.scrollMode === 'duration') V.limit = scrollTarget();
  }
}

function resetZoom(){ aplicarZoom(1); aposZoom(); }

function atualizarChipZoom(){
  let c = $('#zoomChip');
  const z = V.zoom || 1;
  if(z === 1){ if(c) c.remove(); return; }
  if(!c){
    c = document.createElement('button');
    c.id = 'zoomChip';
    c.className = 'zoomchip';
    c.onclick = (e) => { e.stopPropagation(); resetZoom(); };
    $('#viewer').appendChild(c);
  }
  c.innerHTML = Math.round(z * 100) + '% &nbsp;&#10005;';
}

function enableViewZoom(){
  const stage = $('#stage');
  if(!stage) return;
  let pinca = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
  const meio = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

  // toque: dois dedos = zoom; um dedo continua rolando/virando página normalmente
  stage.addEventListener('touchstart', (e) => {
    if(V.edit || e.touches.length !== 2) return;
    e.preventDefault();
    pinca = { d0: dist(e.touches), z0: V.zoom || 1 };
  }, { passive: false });

  stage.addEventListener('touchmove', (e) => {
    if(V.edit || !pinca || e.touches.length !== 2) return;
    if(e.cancelable) e.preventDefault();
    const m = meio(e.touches);
    aplicarZoom(pinca.z0 * dist(e.touches) / pinca.d0, m.x, m.y);
  }, { passive: false });

  const fim = (e) => {
    if(!pinca || e.touches.length >= 2) return;
    pinca = null;
    V.arrastou = true;                         // não deixa o soltar virar "toque" (modo palco)
    setTimeout(() => { V.arrastou = false; }, 350);
    aposZoom();
  };
  stage.addEventListener('touchend', fim);
  stage.addEventListener('touchcancel', fim);

  // computador: pinça no trackpad e Ctrl + roda chegam como 'wheel' com ctrlKey
  stage.addEventListener('wheel', (e) => {
    if(V.edit || !e.ctrlKey) return;
    e.preventDefault();
    aplicarZoom((V.zoom || 1) * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    clearTimeout(V.wheelT);
    V.wheelT = setTimeout(aposZoom, 200);
  }, { passive: false });
}

/* ---------- gestos do modo edição: arrastar livre + pinça pra zoom ---------- */
function enableEditGestures(){
  const stage = $('#stage');
  if(!stage) return;
  const pts = new Map();
  let modo = null, x0 = 0, y0 = 0, sl0 = 0, st0 = 0, d0 = 0, fs0 = 0, moveu = false, zoomou = false;

  const dist = () => {
    const a = Array.from(pts.values());
    return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
  };
  const iniciarPan = (x, y) => { modo = 'pan'; x0 = x; y0 = y; sl0 = stage.scrollLeft; st0 = stage.scrollTop; };

  stage.addEventListener('pointerdown', (e) => {
    if(!V.edit) return;
    if(e.target.closest('.ch')) return;            // acorde tem arrasto próprio
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moveu = false;
    if(pts.size === 1) iniciarPan(e.clientX, e.clientY);
    else if(pts.size === 2){ modo = 'zoom'; d0 = dist(); fs0 = parseFloat(getComputedStyle($('#cifra')).fontSize); }
    try{ stage.setPointerCapture(e.pointerId); }catch(err){}
  });

  stage.addEventListener('pointermove', (e) => {
    if(!V.edit || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if(modo === 'pan' && pts.size === 1){
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if(Math.abs(dx) > 4 || Math.abs(dy) > 4) moveu = true;
      stage.scrollLeft = sl0 - dx;
      stage.scrollTop  = st0 - dy;
    } else if(modo === 'zoom' && pts.size === 2){
      moveu = true;
      const fs = Math.max(7, Math.min(72, fs0 * (dist() / d0)));
      $('#cifra').style.fontSize = fs.toFixed(2) + 'px';
      V.song.fontSize = Math.round(fs);
    }
  });

  const fim = (e) => {
    if(!pts.has(e.pointerId)) return;
    if(modo === 'zoom') zoomou = true;   // ao soltar o 1º dedo o modo vira 'pan';
    pts.delete(e.pointerId);             // sem essa marca o zoom nunca seria salvo
    if(pts.size === 0){
      if(zoomou){ Store.upsertSong(V.song); bindEditHandlers(); zoomou = false; }
      modo = null;
      V.arrastou = moveu;
      setTimeout(() => { V.arrastou = false; }, 80);
    } else if(pts.size === 1){
      const p = Array.from(pts.values())[0];
      iniciarPan(p.x, p.y);
    }
  };
  stage.addEventListener('pointerup', fim);
  stage.addEventListener('pointercancel', fim);
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
        const passo = novoPasso('acorde movido');
        V.song.lines[li].ch[ci].p = parseInt(sp.dataset.np, 10) || 0;
        fecharPasso(passo);
      } else {
        chordSheet(li, ci);
      }
    };
    sp.onpointercancel = () => { sp.classList.remove('drag'); id = null; };
  });

  $$('#cifra .lyr').forEach(ly => {
    ly.onclick = (e) => {
      if(!V.edit || V.arrastou) return;
      const li = +ly.dataset.l;
      const r = ly.getBoundingClientRect();
      const p = Math.max(0, Math.round((e.clientX - r.left) / cw));
      addChordAt(li, p);
    };
  });
}

function addChordAt(li, p){
  const passo = novoPasso('acorde novo');
  const line = V.song.lines[li];
  if(!line.ch) line.ch = [];
  line.ch.push({ p: p, c: 'C' });
  line.ch.sort((a,b) => a.p - b.p);
  const ci = line.ch.findIndex(c => c.p === p && c.c === 'C');
  fecharPasso(passo);
  renderCifra();
  // escolher o nome do acorde novo faz parte do mesmo passo: um "desfazer" tira o acorde inteiro
  chordSheet(li, ci < 0 ? line.ch.length - 1 : ci, true, passo);
}

const COMMON = ['C','D','E','F','G','A','B','Am','Bm','Cm','Dm','Em','Fm','Gm','C7','D7','E7','G7','A7','B7','F#m','C#m','G#m','Bb','Eb','Ab','C/E','G/B','D/F#','Cmaj7','Dsus4','Asus4','Em7','Am7','Dm7'];

function chordSheet(li, ci, isNew, passoDoNovo){
  const line = V.song.lines[li];
  const c = line.ch[ci];
  if(!c) return;
  const shown = dispChord(c.c, V.song);
  // tudo que for feito nesta folha (empurrar, renomear, remover) é um passo só
  const passo = passoDoNovo || novoPasso('acorde alterado');
  const fechar = (oQue) => { if(!passoDoNovo) passo.oQue = oQue; fecharPasso(passo); };

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
      $('#chL', el).onclick = () => { c.p = Math.max(0, c.p - 1); fechar('acorde movido'); renderCifra(); };
      $('#chR', el).onclick = () => { c.p = c.p + 1; fechar('acorde movido'); renderCifra(); };
      $('#chDel', el).onclick = () => {
        line.ch.splice(ci, 1);
        fechar('acorde removido'); closeSheet(); renderCifra(); toast('Removido');
      };
      $('#chOk', el).onclick = () => {
        const val = inp.value.trim();
        if(val) c.c = toStored(val, V.song);
        fechar('acorde alterado'); closeSheet(); renderCifra();
      };
      inp.onkeydown = (e) => { if(e.key === 'Enter') $('#chOk', el).click(); };
    });
}

/* ---------- áudio ---------- */

/** "10", "0:10", "1:05.5", "1,5" -> segundos. Vazio -> 0. Inválido -> NaN */
function parseTempo(str){
  const t = String(str == null ? '' : str).trim().replace(',', '.');
  if(!t) return 0;
  const partes = t.split(':');
  if(partes.length > 3) return NaN;
  let seg = 0;
  for(const x of partes){
    if(x === '' || isNaN(+x) || +x < 0) return NaN;
    seg = seg * 60 + parseFloat(x);
  }
  return seg;
}

/** segundos -> "0:10" ou "1:05.5" (décimo só quando existe) */
function fmtTempo(sec){
  sec = Math.round(Math.max(0, +sec || 0) * 10) / 10;
  const m = Math.floor(sec / 60);
  const r = Math.round((sec - m * 60) * 10) / 10;
  const ss = Number.isInteger(r) ? String(r).padStart(2, '0') : r.toFixed(1).padStart(4, '0');
  return m + ':' + ss;
}

/** Trecho que realmente toca, em segundos do arquivo: {ini, fim, dur, len} */
function trechoAudio(){
  const a = V.audioEl, fx = faixaAtiva(V.song) || {};
  // gravação em WebM sai sem a duração no arquivo: vale a que o app mediu ao gravar
  const dur = a && isFinite(a.duration) && a.duration > 0 ? a.duration
            : (+fx.dur > 0 ? +fx.dur : 0);
  let ini = Math.max(0, +fx.start || 0);
  let fim = +fx.end > 0 ? +fx.end : (dur || Infinity);
  if(dur){ fim = Math.min(fim, dur); ini = Math.min(ini, dur); }
  if(fim <= ini){ ini = 0; fim = dur || Infinity; }      // recorte inválido: toca tudo
  return { ini: ini, fim: fim, dur: dur, len: isFinite(fim) ? fim - ini : 0 };
}

/* ---------- gravador ----------
   Grava pelo microfone sem sair da cifra: a barra de gravação fica no lugar do
   player e a letra continua na tela, pra tocar lendo. */

/** MP4/AAC primeiro: toca em qualquer aparelho (iPhone inclusive) e já vem com a
    duração no arquivo. WebM é o plano B — funciona, mas sai sem duração. */
function tipoDeGravacao(){
  const ordem = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for(const t of ordem){ try{ if(MediaRecorder.isTypeSupported(t)) return t; }catch(e){} }
  return '';
}

function pedirGravacao(){
  const s = V.song;
  if(V.grav) return;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined'){
    const seguro = location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    toast(seguro ? 'Este navegador não consegue gravar áudio'
                 : 'Gravar exige HTTPS — abra pelo endereço do GitHub Pages', 3800);
    return;
  }
  closeSheet();
  iniciarGravacao();          // vira uma faixa nova: nada é substituído
}

async function iniciarGravacao(){
  const s = V.song;
  let stream;
  try{
    // sem os filtros de chamada de voz: eles "limpam" violão e canto como se fosse ruído
    stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  }catch(e){
    const n = e && e.name;
    toast(n === 'NotAllowedError' || n === 'SecurityError' ? 'Microfone bloqueado — libere nas permissões do site'
        : n === 'NotFoundError' ? 'Nenhum microfone encontrado'
        : 'Não consegui abrir o microfone', 3800);
    return;
  }
  // saiu da música enquanto o navegador pedia permissão
  if(!$('#viewer') || V.song !== s || V.grav){ stream.getTracks().forEach(t => t.stop()); return; }
  if(V.audioEl){ try{ V.audioEl.pause(); }catch(e){} }

  const tipo = tipoDeGravacao();
  let rec;
  try{ rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 128000 } : { audioBitsPerSecond: 128000 }); }
  catch(e){ rec = new MediaRecorder(stream); }

  const g = V.grav = { rec: rec, stream: stream, partes: [], songId: s.id, t0: performance.now(),
                       descartar: false, pico: 0, avisouMudo: false };
  rec.ondataavailable = (e) => { if(e.data && e.data.size) g.partes.push(e.data); };
  rec.onstart = () => { g.t0 = performance.now(); };
  rec.onstop  = () => finalizarGravacao(g);
  rec.onerror = () => { toast('A gravação falhou'); pararGravacao(true); };
  rec.start(1000);

  // medidor de volume: confirma na hora que o microfone está captando
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    g.ctx = new AC();
    g.an = g.ctx.createAnalyser();
    g.an.fftSize = 512;
    g.ctx.createMediaStreamSource(stream).connect(g.an);
    g.buf = new Uint8Array(g.an.fftSize);
  }catch(e){}

  $('#playerSlot').innerHTML =
    '<div class="player rec">' +
      '<span class="rec-dot"></span>' +
      '<span class="t rec-t" id="rT">0:00</span>' +
      '<div class="rec-meter"><i id="rLvl"></i></div>' +
      '<button class="iconbtn" id="rX" title="Descartar">&#10005;</button>' +
      '<button class="tool rec-stop" id="rStop">&#9632; Parar e salvar</button>' +
    '</div>';
  $('#rStop').onclick = () => pararGravacao(false);
  $('#rX').onclick = () => confirmSheet('Descartar gravação?', 'O que foi gravado até aqui será perdido.',
                                       'Descartar', () => pararGravacao(true));
  const b = $('#tRec');
  if(b){ b.innerHTML = '&#9632; Parar'; b.classList.add('gravando'); }
  ajustarAposPlayer();

  g.relogio = setInterval(() => {
    const seg = (performance.now() - g.t0) / 1000;
    const t = $('#rT'); if(t) t.textContent = fmtDur(Math.floor(seg));
    if(g.an){
      g.an.getByteTimeDomainData(g.buf);
      let pico = 0;
      for(let i = 0; i < g.buf.length; i++){ const d = Math.abs(g.buf[i] - 128); if(d > pico) pico = d; }
      g.pico = Math.max(g.pico, pico);
      const l = $('#rLvl'); if(l) l.style.width = Math.min(100, Math.round(pico / 128 * 160)) + '%';
      if(seg > 4 && g.pico < 2 && !g.avisouMudo){
        g.avisouMudo = true;
        toast('O microfone não está captando som', 3500);
      }
    }
  }, 100);
  toast('Gravando — toque em "Parar e salvar" quando terminar', 2600);
}

function pararGravacao(descartar){
  const g = V.grav;
  if(!g || g.parando) return;
  g.parando = true;
  g.descartar = !!descartar;
  g.dur = (performance.now() - g.t0) / 1000;
  try{
    if(g.rec.state !== 'inactive') g.rec.stop();      // dispara onstop -> finalizarGravacao
    else finalizarGravacao(g);
  }catch(e){ finalizarGravacao(g); }
}

async function finalizarGravacao(g){
  if(g.fechada) return;
  g.fechada = true;
  clearInterval(g.relogio);
  try{ g.stream.getTracks().forEach(t => t.stop()); }catch(e){}     // apaga a luz do microfone
  try{ if(g.ctx) g.ctx.close(); }catch(e){}
  if(V.grav === g) V.grav = null;
  if(g.dur == null) g.dur = (performance.now() - g.t0) / 1000;

  const naTela = () => !!($('#viewer') && V.song && V.song.id === g.songId);
  if(naTela()){
    const b = $('#tRec');
    if(b){ b.innerHTML = '&#9679; Gravar'; b.classList.remove('gravando'); }
  }
  const restaurarPlayer = async () => {
    if(!naTela()) return;
    if(faixaAtiva(V.song)) await mountPlayer();
    else { $('#playerSlot').innerHTML = ''; ajustarAposPlayer(); }
  };

  const blob = new Blob(g.partes, { type: g.rec.mimeType || (g.partes[0] && g.partes[0].type) || 'audio/webm' });
  if(g.descartar){ await restaurarPlayer(); toast('Gravação descartada'); return; }
  if(!blob.size || g.dur < 0.5){ await restaurarPlayer(); toast('Gravação curta demais — nada foi salvo'); return; }

  const s = naTela() ? V.song : Store.getSong(g.songId);
  if(!s) return;
  const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const fx = {
    id: uid(),
    name: 'Gravação ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + 'h' + p2(d.getMinutes()),
    type: blob.type, size: blob.size,
    dur: Math.round(g.dur * 10) / 10,      // medida pelo app: WebM gravado não traz a duração
    gravado: true, start: 0, end: 0
  };
  await Audio_DB.put(fx.id, blob);         // o arquivo fica sob o id da faixa
  s.tracks.push(fx);
  s.trackAtiva = fx.id;                    // a faixa recém-gravada já fica selecionada
  Store.upsertSong(s);

  if(naTela()){
    await mountPlayer();
    toast('Gravação salva — ajuste o início e o fim se quiser', 3000);
    audioSheet();                          // já abre no recorte
  } else {
    toast('Gravação salva em "' + s.title + '"', 3000);
  }
}

/** O player (ou a barra de gravação) aparecer/sumir muda a altura do palco */
function ajustarAposPlayer(){
  const v = $('#viewer');
  if(v && v.classList.contains('fit') && !V.edit) autoFit();
}

/** "#01", "#02"... pela ordem da lista. No player cabe o número, não o nome. */
function numFaixa(s, fx){
  const i = (s.tracks || []).findIndex(t => t.id === fx.id);
  return '#' + String(i + 1).padStart(2, '0');
}

function audioSheet(){
  const s = V.song;
  if(V.grav){ toast('Gravando — pare a gravação primeiro'); return; }
  const fx = faixaAtiva(s);
  const temAudio = !!(fx && V.audioEl);            // faixa selecionada e arquivo carregado
  const totalBytes = s.tracks.reduce((a, t) => a + (t.size || 0), 0);

  const lista = s.tracks.length
    ? '<div class="fxlist">' + s.tracks.map(t =>
        '<button class="fxrow' + (fx && t.id === fx.id ? ' on' : '') + '" data-fx="' + t.id + '">' +
          '<i>' + (fx && t.id === fx.id ? '&#9679;' : '&#9675;') + '</i>' +
          '<b class="fxnum">' + numFaixa(s, t) + '</b>' +
          '<span class="fxname">' + esc(t.name) + '</span>' +
          '<small>' + (t.dur ? fmtDur(t.dur) : humanSize(t.size)) + '</small>' +
        '</button>').join('') + '</div>'
    : '<p style="color:var(--fg2)">Nenhum áudio ainda. Grave pelo microfone ou escolha um MP3/M4A do celular — ' +
      'fica salvo offline. Dá pra ter várias faixas por música (original, sua gravação, playback...).</p>';

  sheet('<h3>Áudios da música</h3>' + lista +

    (fx && !temAudio
      ? '<p class="hint" style="margin:0 0 12px">O arquivo desta faixa não está neste aparelho ' +
        '(veio de um backup sem áudios). Remova a faixa ou adicione o arquivo de novo.</p>'
      : '') +

    (temAudio
      ? '<div class="trim">' +
          '<div class="trim-head"><b>Faixa selecionada</b><small id="tTotal"></small></div>' +
          '<div class="trim-row"><label for="fxNome">Nome</label>' +
            '<input id="fxNome" autocomplete="off" style="font-family:inherit" value="' + esc(fx.name) + '"></div>' +
          '<div class="trim-head" style="margin-top:12px"><b>Recorte</b><small id="tLen"></small></div>' +
          '<div class="trim-row"><label for="tIni">Começa em</label>' +
            '<input id="tIni" inputmode="decimal" autocomplete="off" placeholder="0:00" value="' +
              (fx.start > 0 ? fmtTempo(fx.start) : '') + '">' +
            '<button class="tool" id="tIniAqui">&#9673; aqui</button></div>' +
          '<div class="trim-row"><label for="tFim">Termina em</label>' +
            '<input id="tFim" inputmode="decimal" autocomplete="off" placeholder="fim" value="' +
              (fx.end > 0 ? fmtTempo(fx.end) : '') + '">' +
            '<button class="tool" id="tFimAqui">&#9673; aqui</button></div>' +
          '<div class="trim-prev">' +
            '<button class="iconbtn" id="tPlay">&#9654;</button>' +
            '<span class="trim-now" id="tNow">0:00</span>' +
            '<button class="tool" id="tBack">&minus;1s</button>' +
            '<button class="tool" id="tFwd">+1s</button>' +
          '</div>' +
          '<div class="row" style="margin-bottom:6px">' +
            '<button class="tool" id="tTestIni" style="justify-content:center">&#9655; testar início</button>' +
            '<button class="tool" id="tTestFim" style="justify-content:center">&#9655; testar fim</button>' +
          '</div>' +
          '<div class="trim-err" id="tErr"></div>' +
          '<div class="hint">Toque &#9654;, pause no ponto certo e use <b>&#9673; aqui</b>. ' +
            'Ou digite: <b>10</b>, <b>0:10</b>, <b>1:05.5</b>. Fim em branco = até o final. ' +
            'Cada faixa tem o seu recorte.</div>' +
        '</div>'
      : '') +

    (temAudio ? '<button class="btn primary" id="aOk" style="margin-bottom:9px">Pronto</button>' : '') +
    '<div class="row" style="margin-bottom:9px">' +
      '<button class="btn' + (s.tracks.length ? '' : ' primary') + '" id="aRec">&#9679; Gravar faixa</button>' +
      '<button class="btn" id="aPick">+ Adicionar arquivo</button>' +
    '</div>' +
    (fx ? '<button class="btn danger" id="aDel">Remover esta faixa</button>' : '') +
    (s.tracks.length > 1
      ? '<div class="hint" style="text-align:center;margin-top:10px">' + s.tracks.length + ' faixas · ' +
        humanSize(totalBytes) + ' neste aparelho</div>' : ''),

    (el) => {
      // trocar de faixa: carrega o arquivo dela e reabre a folha já com o recorte dela
      $$('[data-fx]', el).forEach(b => b.onclick = async () => {
        if(fx && b.dataset.fx === fx.id) return;
        s.trackAtiva = b.dataset.fx;
        Store.upsertSong(s);
        await mountPlayer();
        audioSheet();
      });

      $('#aRec', el).onclick = () => pedirGravacao();
      $('#aPick', el).onclick = () => {
        const f = $('#fileAudio');
        f.value = '';
        f.onchange = async () => {
          const file = f.files[0];
          if(!file) return;
          if(file.size > 25 * 1024 * 1024 && !confirm('Arquivo de ' + humanSize(file.size) + '. Continuar?')) return;
          const nova = { id: uid(), name: file.name.replace(/\.[a-z0-9]{2,5}$/i, ''), type: file.type,
                         size: file.size, dur: 0, gravado: false, start: 0, end: 0 };
          await Audio_DB.put(nova.id, file);             // o arquivo fica sob o id da faixa
          s.tracks.push(nova);
          s.trackAtiva = nova.id;
          Store.upsertSong(s);
          await mountPlayer();
          toast('Faixa adicionada — ajuste o início e o fim se precisar');
          audioSheet();                                  // já abre no recorte da faixa nova
        };
        f.click();
      };
      const d = $('#aDel', el);
      if(d) d.onclick = () => confirmSheet('Remover faixa?',
        '"' + fx.name + '" será apagada deste aparelho. As outras faixas ficam.', 'Remover', async () => {
          if(V.audioEl){ try{ V.audioEl.pause(); }catch(e){} }
          await Audio_DB.del(fx.id);
          Store.marcarApagado([fx.id]);                // senão a faixa volta na próxima sincronia
          s.tracks = s.tracks.filter(t => t.id !== fx.id);
          s.trackAtiva = s.tracks.length ? s.tracks[0].id : null;
          Store.upsertSong(s);
          V.audioEl = null;
          if(faixaAtiva(s)) await mountPlayer();
          else { const p = $('#playerSlot'); if(p) p.innerHTML = ''; ajustarAposPlayer(); }
          toast('Faixa removida');
          if(s.tracks.length) audioSheet();
        });
      if(!temAudio) return;

      // renomear: vale na hora, na lista e no botão do player
      const iNome = $('#fxNome', el);
      iNome.oninput = () => {
        const n = iNome.value.trim();
        if(!n) return;
        fx.name = n;
        Store.upsertSong(s);
        const linha = $('.fxrow.on .fxname', el); if(linha) linha.textContent = n;
        const bt = $('#aFx'); if(bt) bt.title = n;
      };

      const a = V.audioEl;
      const iIni = $('#tIni', el), iFim = $('#tFim', el), err = $('#tErr', el);
      $('#aOk', el).onclick = () => { if(aplicar()) closeSheet(); };

      // grava assim que o valor fica válido — como os outros ajustes do app
      function aplicar(){
        const ini = parseTempo(iIni.value), fim = parseTempo(iFim.value);
        const dur = trechoAudio().dur;
        let msg = '', ruimIni = false, ruimFim = false;
        if(isNaN(ini)){ ruimIni = true; msg = 'Use segundos (10) ou minutos:segundos (0:10).'; }
        if(isNaN(fim)){ ruimFim = true; msg = 'Use segundos (10) ou minutos:segundos (0:10).'; }
        if(!msg && dur && ini >= dur){ ruimIni = true; msg = 'O áudio tem só ' + fmtTempo(dur) + '.'; }
        if(!msg && dur && fim > dur + 0.05){ ruimFim = true; msg = 'O áudio tem só ' + fmtTempo(dur) + ' — deixe o fim em branco pra ir até o final.'; }
        if(!msg && fim > 0 && fim <= ini + 0.3){ ruimIni = ruimFim = true; msg = 'O fim precisa vir depois do início.'; }
        err.textContent = msg;
        iIni.classList.toggle('bad', ruimIni);
        iFim.classList.toggle('bad', ruimFim);
        if(msg) return false;
        fx.start = Math.round(ini * 10) / 10;
        fx.end = fim > 0 ? Math.round(fim * 10) / 10 : 0;
        Store.upsertSong(s);
        if(V.audioPintar) V.audioPintar();
        pintar();
        return true;
      }
      iIni.oninput = aplicar;
      iFim.oninput = aplicar;
      iIni.onblur = () => { if(aplicar() && iIni.value) iIni.value = fmtTempo(fx.start); };
      iFim.onblur = () => { if(aplicar() && iFim.value) iFim.value = fmtTempo(fx.end); };

      $('#tIniAqui', el).onclick = () => { iIni.value = fmtTempo(a.currentTime); aplicar(); };
      $('#tFimAqui', el).onclick = () => { iFim.value = fmtTempo(a.currentTime); aplicar(); };

      // prévia: passeia pelo arquivo INTEIRO (pra achar o ponto), sem mexer na rolagem;
      // os botões de teste, ao contrário, respeitam o recorte
      $('#tPlay', el).onclick = () => {
        V.audioLivre = true;
        if(a.paused) V.audioTocarEm(a.currentTime); else { V.audioQuerTocar = false; a.pause(); }
      };
      $('#tBack', el).onclick = () => { a.currentTime = Math.max(0, a.currentTime - 1); pintar(); };
      $('#tFwd', el).onclick  = () => { a.currentTime = Math.min(a.duration || 1e9, a.currentTime + 1); pintar(); };
      $('#tTestIni', el).onclick = () => { V.audioLivre = false; V.audioTocarEm(trechoAudio().ini); };
      $('#tTestFim', el).onclick = () => {
        const t = trechoAudio();
        V.audioLivre = false;
        V.audioTocarEm(Math.max(t.ini, t.fim - 4));       // 4s antes do corte
      };

      function pintar(){
        const t = trechoAudio();
        $('#tNow', el).textContent = fmtTempo(a.currentTime);
        $('#tPlay', el).innerHTML = a.paused ? '&#9654;' : '&#9208;';
        $('#tTotal', el).textContent = t.dur ? 'duração ' + fmtTempo(t.dur) : '—';
        iFim.placeholder = t.dur ? 'fim (' + fmtTempo(t.dur) + ')' : 'fim';
        $('#tLen', el).textContent = t.dur ? 'toca ' + fmtTempo(t.len) : '';
      }
      pintar();
      const relogio = setInterval(() => {
        if(!document.body.contains(el)){                 // folha fechou
          clearInterval(relogio);
          V.audioLivre = false;
          return;
        }
        pintar();
      }, 100);
    });
}

async function mountPlayer(){
  const s = V.song;
  const slot = $('#playerSlot');
  const fx = faixaAtiva(s);
  if(!slot || !fx) return;
  const vez = V.mountSeq = (V.mountSeq || 0) + 1;
  const blob = await Audio_DB.get(fx.id);
  // trocaram de faixa (ou de música) enquanto o arquivo carregava: vale só o pedido mais novo
  if(vez !== V.mountSeq || V.song !== s || !$('#playerSlot')) return;
  if(V.audioEl){ try{ V.audioEl.pause(); }catch(e){} }   // trocou a faixa: cala a anterior
  if(V.audioURL){ URL.revokeObjectURL(V.audioURL); V.audioURL = null; }
  if(!blob){ slot.innerHTML = ''; V.audioEl = null; ajustarAposPlayer(); return; }
  V.audioURL = URL.createObjectURL(blob);

  slot.innerHTML =
    '<div class="player">' +
      '<button class="iconbtn" id="aPlay">&#9654;</button>' +
      // com mais de uma faixa, o nome da que está tocando vira o botão de troca
      (s.tracks.length > 1 ? '<button class="tool fxbtn" id="aFx" title="' + esc(fx.name) + '">' + numFaixa(s, fx) + '</button>' : '') +
      '<span class="t" id="aCur">0:00</span>' +
      '<input type="range" id="aSeek" min="0" max="1000" value="0">' +
      '<span class="t" id="aDur">0:00</span>' +
      '<button class="iconbtn volta5" id="aBack5" title="Voltar 5 segundos">&minus;5s</button>' +
      '<button class="iconbtn" id="aSync" title="Rolagem junto com o áudio">&#8635;</button>' +
    '</div>';

  const a = new Audio(V.audioURL);
  a.preload = 'auto';
  V.audioEl = a;
  V.audioLivre = false;
  const play = $('#aPlay'), seek = $('#aSeek'), cur = $('#aCur'), dur = $('#aDur');

  // o player mostra o TRECHO: começa em 0:00 mesmo que o arquivo comece no 0:10
  const pintar = () => {
    if(!document.body.contains(play)) return;
    const t = trechoAudio();
    const rel = Math.max(0, a.currentTime - t.ini);
    if(t.len > 0) seek.value = Math.round(Math.min(1, rel / t.len) * 1000);
    cur.textContent = fmtDur(Math.min(rel, t.len || rel));
    dur.textContent = fmtDur(t.len);
  };
  V.audioPintar = pintar;

  const terminar = () => {
    V.audioQuerTocar = false;
    a.pause();
    a.currentTime = trechoAudio().ini;
    if(V.followAudio) stopScroll();
    pintar();
  };

  // timeupdate só chega a cada ~250ms; pra cortar no segundo certo, vigia mais de perto
  let vigia = null;
  const vigiar = () => {
    clearInterval(vigia);
    vigia = setInterval(() => {
      if(a.paused || V.audioEl !== a){ clearInterval(vigia); return; }
      if(!V.audioLivre && a.currentTime >= trechoAudio().fim - 0.03) terminar();
    }, 40);
  };

  // WebM gravado pelo navegador abre com duration = Infinity. Pedir uma posição
  // absurda obriga o navegador a varrer o arquivo e descobrir a duração de verdade.
  let consertando = false;
  const anotarDuracao = () => {              // a lista de faixas mostra a duração de cada uma
    if(!isFinite(a.duration) || a.duration <= 0) return;
    const d = Math.round(a.duration * 10) / 10;
    if(Math.abs((+fx.dur || 0) - d) > 0.05){ fx.dur = d; Store.upsertSong(s); }
  };
  a.onloadedmetadata = () => {
    if(isFinite(a.duration)){ anotarDuracao(); a.currentTime = trechoAudio().ini; pintar(); return; }
    consertando = true;
    const pronto = () => {
      if(!consertando) return;
      consertando = false;
      anotarDuracao();
      a.currentTime = trechoAudio().ini;
      pintar();
    };
    a.ondurationchange = () => { if(isFinite(a.duration)) pronto(); };
    setTimeout(pronto, 3000);                // não achou: segue com a duração medida pelo app
    try{ a.currentTime = 1e101; }catch(e){ pronto(); }
  };
  a.ontimeupdate = () => { if(!consertando) pintar(); };
  a.onplay  = () => { play.innerHTML = '&#9208;'; play.classList.add('on'); vigiar(); };
  a.onpause = () => { play.innerHTML = '&#9654;'; play.classList.remove('on'); pintar(); };
  a.onended = () => { V.audioLivre = false; terminar(); };

  play.onclick = () => {
    if(a.paused){
      V.audioLivre = false;
      const t = trechoAudio();
      const fora = a.currentTime < t.ini - 0.05 || a.currentTime >= t.fim - 0.05;
      V.audioTocarEm(fora ? t.ini : a.currentTime);
      if(V.followAudio && !V.scrolling) startScroll();
    } else {
      V.audioQuerTocar = false;
      a.pause();
      if(V.followAudio) stopScroll();
    }
  };
  // Mudar de posição não pode parar a música: há navegador que pausa sozinho
  // durante a busca. Se estava tocando, volta a tocar assim que a busca termina.
  // V.audioQuerTocar separa "o navegador pausou sozinho na busca" (retoma) de
  // "o usuário pausou" ou "chegou ao fim do recorte" (não retoma)
  const tocar = () => { V.audioQuerTocar = true; const p = a.play(); if(p && p.catch) p.catch(() => {}); };
  const retomarAposBusca = () => a.addEventListener('seeked', () => {
    if(a.paused && V.audioEl === a && V.audioQuerTocar) tocar();
  }, { once: true });
  const irPara = (pos) => {
    const tocava = !a.paused;
    a.currentTime = pos;
    if(tocava) retomarAposBusca();
  };
  /** Toca a partir de uma posição (o play do recorte e os botões de teste usam isso) */
  V.audioTocarEm = (pos) => {
    if(Math.abs(a.currentTime - pos) > 0.05){ a.currentTime = pos; retomarAposBusca(); }
    tocar();
  };
  seek.oninput = () => {
    const t = trechoAudio();
    if(t.len > 0) irPara(t.ini + (seek.value / 1000) * t.len);
  };
  // volta 5s sem sair do trecho; se a rolagem está seguindo o áudio, ela volta junto
  $('#aBack5').onclick = () => {
    const t = trechoAudio();
    const antes = a.currentTime;
    const alvo = Math.max(t.ini, antes - 5);
    irPara(alvo);
    const voltou = antes - alvo;
    if(V.followAudio && V.scrolling && voltou > 0){
      const st = $('#stage');
      if(st) st.scrollTop = Math.max(0, st.scrollTop - V.pps * voltou);
    }
    pintar();
  };
  const bFx = $('#aFx');
  if(bFx) bFx.onclick = () => audioSheet();
  $('#aSync').classList.toggle('on', !!V.followAudio);
  $('#aSync').onclick = () => {
    V.followAudio = !V.followAudio;
    $('#aSync').classList.toggle('on', V.followAudio);
    toast(V.followAudio ? 'Rolagem segue o áudio' : 'Rolagem independente');
  };
  ajustarAposPlayer();
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
  const ultimo = U.atras[U.atras.length - 1], proximo = U.frente[U.frente.length - 1];
  sheet('<h3>' + esc(s.title) + '</h3>' +
    (ultimo ? '<button class="opt" data-a="desfazer"><i>&#8630;</i> Desfazer: ' + esc(ultimo.oQue) + '</button>' : '') +
    (proximo ? '<button class="opt" data-a="refazer"><i>&#8631;</i> Refazer: ' + esc(proximo.oQue) + '</button>' : '') +
    (ultimo || proximo ? '<div class="sep"></div>' : '') +
    '<button class="opt" data-a="edit"><i>&#9998;</i> Editar texto da cifra</button>' +
    '<button class="opt" data-a="dg"><i>&#9648;</i> Acordes da música (desenhos)</button>' +
    '<button class="opt" data-a="chords"><i>&#9834;</i> ' + (S.showChords ? 'Esconder acordes (só letra)' : 'Mostrar acordes') + '</button>' +
    (s.transpose ? '<button class="opt" data-a="fixar"><i>&#9835;</i> Fixar o tom ' + esc(keyOf(s)) + ' como o tom da música</button>' : '') +
    '<button class="opt" data-a="simplify"><i>&#8722;</i> Simplificar acordes</button>' +
    '<button class="opt" data-a="ev"><i>&#43;</i> Adicionar a um evento</button>' +
    '<button class="opt" data-a="audio"><i>&#9835;</i> Áudio de referência</button>' +
    '<div class="sep"></div>' +
    '<button class="opt" data-a="reset"><i>&#8635;</i> Resetar tom e zoom</button>',
    (el) => {
      if(ultimo) $('[data-a=desfazer]', el).onclick = () => desfazer();
      if(proximo) $('[data-a=refazer]', el).onclick = () => refazer();
      $('[data-a=edit]', el).onclick = () => { closeSheet(); go('#/edit/' + s.id); };
      $('[data-a=dg]', el).onclick = () => allChordsSheet();
      $('[data-a=chords]', el).onclick = () => {
        S.showChords = !S.showChords; Store.saveSettings(S);
        $('#viewer').classList.toggle('nochords', !S.showChords);
        closeSheet();
        if($('#viewer').classList.contains('fit')) autoFit();
      };
      const bFixar = $('[data-a=fixar]', el);
      if(bFixar) bFixar.onclick = () => {
        // reescreve os acordes no tom que está na tela e zera o deslocamento.
        // O tom mostrado é de cada aparelho; fixando, ele passa a ser da música — e é
        // assim que chega nos outros ao sincronizar.
        const t = s.transpose || 0, novoTom = keyOf(s), bemol = preferFlatFor(novoTom);
        const passo = novoPasso('tom fixado');
        s.lines.forEach(l => (l.ch || []).forEach(c => { c.c = transposeChord(c.c, t, bemol); }));
        s.key = novoTom; s.transpose = 0;
        fecharPasso(passo);
        closeSheet(); refreshKeyBtn(); renderCifra();
        toast('Tom ' + novoTom + ' fixado');
      };
      $('[data-a=simplify]', el).onclick = () => {
        closeSheet();
        confirmSheet('Simplificar acordes', 'C7M(9)/E vira C, Am7 vira Am. Altera a cifra salva (dá pra desfazer no menu).', 'Simplificar', () => {
          const passo = novoPasso('acordes simplificados');
          s.lines.forEach(l => (l.ch || []).forEach(c => { c.c = simplifyChord(c.c); }));
          fecharPasso(passo); renderCifra(); toast('Simplificado');
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
  const evs = Store.events().filter(e => !e.arquivado);
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
/** A lista de eventos; com `arquivados`, a dos que foram tirados dela (#/events/arquivados) */
function viewEvents(arquivados){
  const todos = Store.events();
  const nArq = todos.filter(e => e.arquivado).length;
  if(arquivados && !nArq){ go('#/events'); return; }          // desarquivou o último: volta pra lista
  const evs = todos.filter(e => !!e.arquivado === !!arquivados);
  evs.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  APP.innerHTML =
    (arquivados
      ? '<header class="topbar"><button class="iconbtn" id="back">&#8249;</button><div class="ttl"><b>Eventos arquivados</b>' +
          '<small>' + nArq + (nArq === 1 ? ' evento' : ' eventos') + ' fora da lista</small></div></header>'
      : '<header class="topbar"><div class="ttl"><b>Eventos</b>' +
          '<small>Ordem das músicas pra tocar</small></div></header>') +
    '<div class="content">' +
      (evs.length ? evs.map(e =>
        '<div class="card" data-ev="' + e.id + '"><div class="info"><b>' + esc(e.name) + '</b>' +
        '<small>' + (e.date ? fmtDate(e.date) : 'sem data') + '</small></div>' +
        (e.privado ? '<span class="badge priv">particular</span>' : '') +
        (arquivados ? '<button class="tool" data-des="' + e.id + '">Desarquivar</button>'
                    : '<span class="badge num">' + (e.songs||[]).length + '</span>') + '</div>').join('')
        : '<div class="empty"><div style="font-size:44px">&#9776;</div><h3>Nenhum evento</h3>' +
          '<p>Crie um evento e monte a ordem do repertório.</p></div>') +
      (!arquivados && nArq ? '<button class="btn quieto" id="verArq">Arquivados (' + nArq + ') &#8250;</button>' : '') +
    '</div>' +
    (arquivados ? '' : '<button class="fab" id="btnNewEv">+</button>') +
    tabbar('events');
  bindNav(APP);
  $$('[data-ev]').forEach(c => c.onclick = () => go('#/event/' + c.dataset.ev));
  if(arquivados){
    $('#back').onclick = () => { go('#/events'); };
    $$('[data-des]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      arquivarEvento(Store.getEvent(b.dataset.des), false);
      viewEvents(true);
    });
    return;
  }
  $('#btnNewEv').onclick = () => newEventSheet();
  if($('#verArq')) $('#verArq').onclick = () => go('#/events/arquivados');
}

/** Arquivar tira o evento da lista sem apagar nada; é um dado do evento, então sincroniza como o resto */
function arquivarEvento(ev, sim){
  if(!ev) return;
  if(sim) ev.arquivado = true; else delete ev.arquivado;
  Store.upsertEvent(ev);
  toast(sim ? 'Evento arquivado' : 'Evento desarquivado');
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
    '<label class="switch" style="padding-top:2px"><span>Evento particular</span><input type="checkbox" id="evPriv"></label>' +
    '<div class="hint" style="margin:-6px 0 14px">Fica só neste aparelho: não vai pro repertório online e os outros membros não veem.</div>' +
    '<button class="btn primary" id="evOk">Criar</button>',
    (el) => {
      setTimeout(() => $('#evName', el).focus(), 80);
      $('#evOk', el).onclick = () => {
        const name = $('#evName', el).value.trim() || 'Evento';
        const ev = { id: uid(), name: name, date: $('#evDate', el).value, songs: addSongId ? [addSongId] : [], notes: '' };
        if($('#evPriv', el).checked) ev.privado = true;
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
        (ev.date ? fmtDate(ev.date) : '') + ' · ' + songs.length + ' música' + (songs.length===1?'':'s') +
        (ev.privado ? ' · particular' : '') + (ev.arquivado ? ' · arquivado' : '') + '</small></div>' +
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
  $('#back').onclick = () => go(ev.arquivado ? '#/events/arquivados' : '#/events');
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
    '<label class="switch" style="padding-top:2px"><span>Evento particular</span><input type="checkbox" id="enPriv"' + (ev.privado ? ' checked' : '') + '></label>' +
    '<div class="hint" style="margin:-6px 0 14px">Fica só neste aparelho: não vai pro repertório online e os outros membros não veem.</div>' +
    '<button class="btn primary" id="enOk" style="margin-bottom:9px">Salvar</button>' +
    '<button class="btn" id="enArq" style="margin-bottom:9px">' + (ev.arquivado ? 'Desarquivar evento' : 'Arquivar evento') + '</button>' +
    '<button class="btn danger" id="enDel">Excluir evento</button>' +
    (ev.arquivado ? '' : '<div class="hint" style="margin-top:10px">Arquivar tira o evento da lista sem apagar nada: ele fica em Eventos → Arquivados' +
      (onlineConectado() && !ev.privado ? ', pra banda toda.' : '.') + '</div>'),
    (el) => {
      $('#enOk', el).onclick = () => {
        ev.name = $('#enName', el).value.trim() || ev.name;
        ev.date = $('#enDate', el).value;
        ev.notes = $('#enNotes', el).value;
        const priv = $('#enPriv', el).checked;
        // virou particular depois de já ter sido publicado: registra a exclusão, que é o que
        // tira a cópia do GitHub e dos outros aparelhos. Aqui ele continua, como particular.
        if(priv && !ev.privado) Store.marcarApagado([ev.id]);
        if(priv) ev.privado = true; else delete ev.privado;
        Store.upsertEvent(ev); closeSheet(); viewEvent(ev.id);
      };
      $('#enArq', el).onclick = () => {
        closeSheet();
        if(ev.arquivado){ arquivarEvento(ev, false); viewEvent(ev.id); }
        else { arquivarEvento(ev, true); go('#/events'); }
      };
      $('#enDel', el).onclick = () => {
        closeSheet();
        confirmSheet('Excluir evento', (onlineConectado() && !ev.privado ? 'O evento some pra banda toda. ' : '') + 'As músicas continuam salvas.', 'Excluir',
          () => { Store.deleteEvent(ev.id); go('#/events'); });
      };
    });
}

/* =========================================================
   AJUSTES / EXPORT / IMPORT
   ========================================================= */
function viewSettings(){
  const nSongs = Store.songs().length, nEv = Store.events().length;
  const todasFaixas = Store.songs().reduce((l, s) => l.concat(s.tracks || []), []);
  const nAudio = todasFaixas.length;
  const audioBytes = todasFaixas.reduce((a, t) => a + (t.size || 0), 0);
  APP.innerHTML =
    '<header class="topbar"><div class="ttl"><b>Ajustes</b>' +
      '<small>' + nSongs + (nSongs===1?' música':' músicas') + ' · ' + nEv + (nEv===1?' evento':' eventos') + '</small></div></header>' +
    '<div class="content">' +
      '<div class="switch"><span>Tema claro</span><input type="checkbox" id="cfgTheme"' + (S.theme==='light'?' checked':'') + '></div>' +
      '<div class="switch"><span>Manter tela ligada tocando</span><input type="checkbox" id="cfgWake"' + (S.keepAwake?' checked':'') + '></div>' +
      '<div class="switch"><span>Abrir cifras em "caber na tela"</span><input type="checkbox" id="cfgFit"' + (S.fitMode?' checked':'') + '></div>' +
      '<div class="field" style="margin-top:14px"><label>Espaçamento entre as linhas</label>' +
        '<select id="cfgEsp">' +
          '<option value="normal">Normal — mais respiro</option>' +
          '<option value="compacto">Compacto — cabe mais na tela</option>' +
          '<option value="minimo">Mínimo — fonte maior possível</option>' +
        '</select>' +
        '<div class="hint">Quanto mais apertado, maior a fonte que cabe numa tela só.</div></div>' +
      '<div class="field"><label>Tamanho de letra padrão: <span id="fsv">' + S.fontSize + 'px</span></label>' +
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

      onlineSecaoHTML() +

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
  $('#cfgEsp').value = S.spacing || 'compacto';
  $('#cfgEsp').onchange = e => { S.spacing = e.target.value; Store.saveSettings(S); applyTheme(); };
  $('#cfgFs').oninput     = e => { S.fontSize = +e.target.value; $('#fsv').textContent = S.fontSize + 'px'; Store.saveSettings(S); };
  $('#cfgSpd').oninput    = e => { S.scrollSpeed = +e.target.value; $('#spv').textContent = S.scrollSpeed; Store.saveSettings(S); };

  $('#chkUpd').onclick = () => procurarAtualizacao();
  versaoInstalada().then(v => { const el = $('#verNum'); if(el) el.textContent = v; });

  onlineLigar();
  $('#expJson').onclick = () => doExport(false);
  $('#expFull').onclick = () => doExport(true);
  $('#impJson').onclick = () => doImport();
  $('#wipe').onclick = () => confirmSheet('Apagar tudo', 'Remove todas as músicas, eventos e áudios deste aparelho.' +
      (onlineConectado() ? ' O repertório da banda não é apagado: ele volta na próxima sincronização.' : ''), 'Apagar tudo', async () => {
    for(const k of await Audio_DB.keys()) await Audio_DB.del(k);
    localStorage.removeItem(LS.songs); localStorage.removeItem(LS.events);
    toast('Tudo apagado'); go('#/'); render();
  });
}

function dadosParaExportar(){
  return {
    app: 'cifras', version: 1, exportedAt: new Date().toISOString(),
    settings: settingsParaExportar(), songs: Store.songs(), events: Store.events(),
    apagadas: Store.apagadas(), audios: {}
  };
}

async function doExport(withAudio){
  const data = dadosParaExportar();
  if(withAudio){
    toast('Preparando áudios...');
    for(const s of data.songs){
      for(const t of (s.tracks || [])){
        const b = await Audio_DB.get(t.id);
        if(b) data.audios[t.id] = await blobToDataURL(b);
      }
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
  const idMap = {};        // id de música no arquivo -> id aqui
  const blobMap = {};      // id de faixa no arquivo  -> id aqui (só quando precisou trocar)

  for(const s0 of data.songs){
    // aceita backup antigo (um áudio em s.audio) e novo (lista de faixas)
    const ns = migrarAudio(Object.assign(newSong(), s0));
    const clash = songs.find(x => x.id === ns.id);
    if(clash){
      if(clash.title === ns.title){
        // mesma música: o backup manda, mas faixas que só existem aqui não se perdem
        const soAqui = (clash.tracks || []).filter(t => !ns.tracks.some(n => n.id === t.id));
        ns.tracks = ns.tracks.concat(soAqui);
        Object.assign(clash, ns);
        idMap[s0.id] = clash.id;
        continue;
      }
      // id igual, música diferente: entra como outra música, com faixas de ids novos
      // (senão as duas músicas passariam a dividir o mesmo arquivo de áudio)
      ns.id = uid();
      ns.tracks.forEach(t => {
        const novo = uid();
        blobMap[t.id] = novo;
        if(ns.trackAtiva === t.id) ns.trackAtiva = novo;
        t.id = novo;
      });
    }
    idMap[s0.id] = ns.id;
    songs.push(ns);
  }
  for(const e of (data.events || [])){
    const ne = Object.assign({ id: uid(), name: 'Evento', date: '', songs: [], notes: '' }, e);
    ne.songs = (ne.songs || []).map(x => idMap[x] || x).filter(x => songs.some(s => s.id === x));
    const i = events.findIndex(x => x.id === ne.id);
    if(i >= 0) events[i] = ne; else events.push(ne);       // evento que já existe é atualizado (ordem das músicas)
  }
  Store.saveEvents(events);

  if(data.audios){
    for(const chave of Object.keys(data.audios)){
      try{ await Audio_DB.put(blobMap[chave] || chave, await dataURLToBlob(data.audios[chave])); }catch(e){}
    }
  }

  // backup exportado sem os áudios: a faixa não pode fingir que tem arquivo.
  // (checa o arquivo de verdade, então reimportar no mesmo aparelho preserva)
  let semArquivo = 0;
  for(const s of songs){
    const ficam = [];
    for(const t of (s.tracks || [])){
      if(await Audio_DB.get(t.id)) ficam.push(t); else semArquivo++;
    }
    s.tracks = ficam;
    migrarAudio(s);                         // acerta a faixa ativa
  }
  const gravou = Store.saveSongs(songs);

  // "substituir tudo" deixa pra trás os arquivos das músicas que saíram: libera o espaço.
  // Só depois de gravar com sucesso — se não gravou, os arquivos ainda têm dono.
  if(gravou){
    const emUso = new Set();
    songs.forEach(s => (s.tracks || []).forEach(t => emUso.add(t.id)));
    for(const k of await Audio_DB.keys()){ if(!emUso.has(k)) await Audio_DB.del(k); }
  }

  toast(semArquivo ? semArquivo + ' faixa(s) ficaram sem o áudio (o arquivo não veio)' : 'Importado', semArquivo ? 3500 : 2000);
  go('#/'); render();
}

/* =========================================================
   BOOT
   ========================================================= */
// Safari (iPhone) ignora o maximum-scale do viewport e daria zoom na página
// inteira por cima do nosso. Com a cifra aberta, a pinça é só nossa.
['gesturestart', 'gesturechange'].forEach(ev =>
  document.addEventListener(ev, (e) => { if($('#viewer')) e.preventDefault(); }, { passive: false }));

/* =========================================================
   ONLINE — repertório num repositório do GitHub (ver js/online.js)

   Ligado por padrão. Quem entrou com a senha da banda sincroniza sozinho:
   baixa as novidades ao abrir o app e publica o que alterar. Quem não entrou
   vê um aviso ao abrir e pode continuar offline com o que já tem no aparelho.
   ========================================================= */

/** No GitHub Pages dá pra adivinhar o repositório de dados: mesmo dono, "cifras-dados" */
function repoPadrao(){
  const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  return m ? m[1] + '/cifras-dados' : '';
}
function onlineRepo(){ return String(S.ghRepo || repoPadrao()).trim(); }
/** O modo online está ligado (e há um repositório pra falar)? */
function onlineAtivo(){ return S.usarOnline !== false && ghRepoValido(onlineRepo()); }
/** ...e este aparelho já entrou com a senha? */
function onlineConectado(){ return onlineAtivo() && !!String(S.ghToken || '').trim(); }
function onlineCfg(){
  if(!ghRepoValido(onlineRepo())){ toast('Informe o repositório no formato dono/repositorio', 3000); return null; }
  return { repo: onlineRepo(), token: String(S.ghToken || '').trim() };
}

function fmtDataHora(v){
  const d = new Date(v);
  if(isNaN(d)) return '';
  const p2 = (n) => String(n).padStart(2, '0');
  return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' às ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}

/** Folha de "aguarde" que não fecha com toque fora: fechar no meio não cancela nada, só confunde */
function ocupado(titulo){
  closeSheet();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = '<div class="sheet"><h3>' + esc(titulo) + '</h3>' +
    '<p id="ocTxt" style="color:var(--fg2);margin:0 0 8px">Começando...</p>' +
    '<div class="hint">Deixe o app aberto até terminar.</div></div>';
  $('#modal-root').appendChild(ov);
  return { diga: (t) => { const e = $('#ocTxt'); if(e) e.textContent = t; }, fechar: closeSheet };
}

function avisoSheet(titulo, html){
  sheet('<h3>' + esc(titulo) + '</h3><div style="color:var(--fg2);margin:0 0 16px;line-height:1.5">' + html + '</div>' +
        '<button class="btn primary" id="avOk">Ok</button>',
        (el) => { $('#avOk', el).onclick = closeSheet; });
}
function erroOnline(e){
  avisoSheet('Não deu certo', esc(e && e.message ? e.message : 'Erro inesperado.'));
}

/** Este aparelho já tem o arquivo desta faixa? (confere o tamanho, não só o id) */
async function jaTemFaixa(t){
  const b = await Audio_DB.get(t.id);
  return !!b && (!t.size || b.size === t.size);
}

/** Ponte entre o js/online.js (que não conhece a tela nem o armazenamento) e o app */
function onlineIO(diga){
  let foto = null;                      // como o aparelho estava quando o plano foi feito
  const agora = () => JSON.stringify([Store.songs(), Store.events(), Store.apagadas()]);
  return {
    // evento particular não entra na conversa com o GitHub: fica fora da mescla e do que sobe
    local: () => { foto = agora(); return { songs: Store.songs(), events: Store.events().filter(e => !e.privado), apagadas: Store.apagadas() }; },
    jaTem: jaTemFaixa,
    guardarBlob: (id, blob) => Audio_DB.put(id, blob),
    blobDaFaixa: (id) => Audio_DB.get(id),
    progresso: diga,
    empacotar: (res) => Object.assign(dadosParaExportar(), { songs: res.songs, events: res.events, apagadas: res.apagadas }),
    salvar: async (res) => {
      // Alguém mexeu no aparelho enquanto a sincronia falava com o GitHub? Então o
      // plano já nasceu velho: gravar agora apagaria essa alteração. Refaz do começo.
      if(foto !== null && agora() !== foto){
        const e = new GHErro('O aparelho mudou durante a sincronia.', 409);
        e.refazer = true;
        throw e;
      }
      res.songs.forEach(migrarAudio);
      // devolve os eventos particulares ao lugar onde estavam (a mescla só viu os públicos)
      const ids = new Set(res.songs.map(s => s.id)), publicos = new Map(res.events.map(e => [e.id, e]));
      const eventos = [];
      Store.events().forEach(e => {
        if(e.privado){
          const ficam = (e.songs || []).filter(id => ids.has(id));       // música removida do repertório sai do evento
          eventos.push(ficam.length === (e.songs || []).length ? e : Object.assign({}, e, { songs: ficam }));
          publicos.delete(e.id);       // alguém reviveu a versão pública antiga: aqui vale a particular
        }
        else if(publicos.has(e.id)){ eventos.push(publicos.get(e.id)); publicos.delete(e.id); }
      });
      publicos.forEach(e => eventos.push(e));
      if(JSON.stringify([res.songs, eventos, res.apagadas]) === foto) return false;      // nada novo: não toca em nada
      Store.silencio = true;                 // gravar o que baixou não é "alteração do usuário"
      let gravou;
      try{
        gravou = Store.saveSongs(res.songs);
        Store.saveEvents(eventos);
        Store.saveApagadas(res.apagadas);
      }finally{ Store.silencio = false; }
      // libera os arquivos de áudio que deixaram de ter dono — só se a lista gravou
      if(gravou){
        const emUso = new Set();
        res.songs.forEach(s => (s.tracks || []).forEach(t => emUso.add(t.id)));
        for(const k of await Audio_DB.keys()){ if(!emUso.has(k)) await Audio_DB.del(k); }
      }
      return true;
    }
  };
}

/* ---------- motor da sincronia automática ---------- */
const Sync = { rodando: false, denovo: false, pendente: false, timer: null, estado: '', msg: '' };

const SYNC_TXT = { sinc: 'sincronizando…', ok: '✓ sincronizado', offline: 'sem internet', erro: '⚠ não sincronizou', aviso: '⚠ faltam áudios' };

/** O que aparece ao lado do número de músicas, no topo da lista */
function syncEstadoTxt(){
  if(!onlineAtivo()) return '';
  if(!onlineConectado()) return ' · offline';
  if(!Sync.estado) return '';
  if(Sync.estado === 'sinc' && Sync.msg) return ' · ' + Sync.msg.replace(/\.+$/, '') + '…';
  return ' · ' + (SYNC_TXT[Sync.estado] || '');
}
function estadoSync(estado, msg){
  Sync.estado = estado; Sync.msg = msg || '';
  const el = $('#syncEstado');
  if(el) el.textContent = syncEstadoTxt();
  const st = $('#ghStatus');
  if(st) st.textContent = textoStatusSync();
}
function textoStatusSync(){
  let t = S.ghSinc ? 'Última sincronização: ' + fmtDataHora(S.ghSinc) + '.' : 'Ainda não sincronizou neste aparelho.';
  if(Sync.estado === 'sinc') t = 'Sincronizando agora…';
  else if(Sync.estado === 'offline') t += ' Sem internet: sincroniza quando voltar.';
  else if(Sync.estado === 'erro') t += ' Última tentativa falhou: ' + Sync.msg;
  else if(Sync.estado === 'aviso') t += ' ' + Sync.msg + '.';
  return t;
}

/** Pede uma sincronia daqui a pouco. Pedidos seguidos viram um só. */
function agendarSync(ms){
  if(!onlineConectado()) return;
  clearTimeout(Sync.timer);
  Sync.timer = setTimeout(() => { sincronizar(); }, ms == null ? 4000 : ms);
}

/**
 * Recebe o que os outros publicaram, junta com o que há aqui e publica o que mudou.
 * Devolve o resumo, ou null se não rodou. Com opt.lancar, erros sobem pra quem chamou.
 */
async function sincronizar(opt){
  opt = opt || {};
  if(!onlineConectado()) return null;
  if(Sync.rodando){ Sync.denovo = true; return null; }
  clearTimeout(Sync.timer);
  // Com uma cifra aberta não sincroniza: ninguém quer a tela mudando (nem a rede
  // sendo usada) no meio de uma música. Fica anotado e roda ao sair da cifra.
  if($('#viewer') && !opt.forcar){ Sync.pendente = true; return null; }
  if(navigator.onLine === false){ Sync.pendente = true; estadoSync('offline'); if(opt.lancar) throw new GHErro('Sem internet.', 0); return null; }

  Sync.rodando = true; Sync.pendente = false;
  estadoSync('sinc');
  const cfg = onlineCfg();
  let saida = null;
  try{
    for(let tentativa = 1; ; tentativa++){
      try{
        // abriu uma cifra enquanto esperava: não mexe em nada agora, fica pra saída
        if(tentativa > 1 && $('#viewer') && !opt.forcar){ Sync.pendente = true; estadoSync(''); return null; }
        const io = onlineIO(opt.progresso || ((t) => estadoSync('sinc', /áudio/.test(t) ? t : '')));
        const plano = await ghPlanejar(cfg, io, { manter: GH_DO_APARELHO, substituir: !!opt.substituir });
        saida = await ghExecutar(plano, io, { enviar: opt.substituir ? false : 'auto' });
        saida.resumo = plano.resultado.resumo;
        break;
      }catch(e){
        // outra pessoa publicou no meio, ou o aparelho mudou: junta de novo com o estado atual
        if(e.status === 409 && tentativa < 4) continue;
        throw e;
      }
    }
    S.ghSinc = Date.now(); Store.saveSettings(S);
    estadoSync(saida.falharam ? 'aviso' : 'ok', saida.falharam ? saida.falharam + ' áudio(s) não baixaram' : '');
    if(saida.mudouAqui) aposReceberNovidades();
  }catch(e){
    if(e.status === 401){
      // token cancelado ou vencido: este aparelho volta a ser "offline" e é convidado a entrar de novo
      S.ghToken = ''; Store.saveSettings(S);
      estadoSync('');
      if(!opt.lancar) avisoEntrar('O acesso deste aparelho venceu. Entre de novo com a senha da banda.');
    }
    else if(e.status === 0 && /Sem conexão/.test(e.message)){ Sync.pendente = true; estadoSync('offline'); }
    else estadoSync('erro', e.message);
    if(opt.lancar) throw e;
  }finally{
    Sync.rodando = false;
    if(Sync.denovo){ Sync.denovo = false; agendarSync(1500); }
  }
  return saida;
}

/** A sincronia trouxe mudanças: mostra, sem atropelar o que a pessoa está fazendo */
function aposReceberNovidades(){
  if($('#viewer') && V.song){
    const nova = Store.getSong(V.song.id);
    if(!nova){ toast('Esta música foi removida do repertório', 3000); go(V.ev ? '#/event/' + V.ev.id : '#/'); return; }
    if(!V.edit && !V.grav && assinaturaConteudo(nova) !== assinaturaConteudo(V.song)){
      V.song = nova;
      zerarDesfazer();
      renderCifra(); refreshKeyBtn();
    }
    return;
  }
  // só redesenha telas de lista, e só se a pessoa não estiver digitando nem com uma folha aberta
  const rota = parseRoute().parts[0] || '';
  const digitando = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if((rota === '' || rota === 'events' || rota === 'event') && !digitando && !$('#modal-root').firstChild && !$('.dragging')) render();
}

/* ---------- entrar com a senha ---------- */

/** Troca a senha pelo acesso e faz a primeira sincronia. Erros sobem com mensagem pronta. */
async function entrarComSenha(senha, diga){
  const cfg = onlineCfg();
  if(!cfg) throw new Error('Repositório não configurado.');
  if(!ghSenhaLimpa(senha)) throw new Error('Digite a senha da banda.');
  diga('Conferindo a senha...');
  const token = await ghEntrarComSenha(cfg.repo, senha);
  diga('Conferindo o acesso...');
  let info;
  try{ info = await ghPodeEscrever({ repo: cfg.repo, token: token }); }
  catch(e){
    if(e.status === 401) throw new Error('A senha está certa, mas esse acesso foi cancelado. Peça a senha nova pra quem cuida do repertório.');
    throw e;
  }
  if(!info.escreve) throw new Error('A senha está certa, mas o acesso não permite publicar.');
  S.usarOnline = true; S.ghToken = token; Store.saveSettings(S);
  await primeiraSincronia(diga);
}

async function primeiraSincronia(diga){
  diga('Baixando o repertório...');
  try{
    const r = await sincronizar({ forcar: true, lancar: true, progresso: diga });
    if(r && r.falharam) toast('Entrou. ' + r.falharam + ' áudio(s) não baixaram agora — o app tenta de novo sozinho.', 4500);
    else toast('Pronto: repertório atualizado', 2600);
  }catch(e){
    // a senha valeu; só a sincronia que não completou. Ela tenta de novo sozinha.
    toast('Entrou, mas não deu pra baixar agora: ' + e.message, 4500);
  }
}

/* Campo de senha com o olho pra mostrar/esconder o que foi digitado */
const OLHO_ABERTO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_FECHADO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 5.1A10.5 10.5 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.5 6.6A17.3 17.3 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.2-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
function campoSenha(id, dica){
  return '<div class="senha"><input id="' + id + '" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(dica) + '">' +
         '<button type="button" class="olho" data-olho="' + id + '" aria-label="Mostrar senha" aria-pressed="false">' + OLHO_ABERTO + '</button></div>';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest ? e.target.closest('[data-olho]') : null;
  if(!b) return;
  const inp = document.getElementById(b.dataset.olho);
  if(!inp) return;
  const mostrar = inp.type === 'password';
  inp.type = mostrar ? 'text' : 'password';
  b.innerHTML = mostrar ? OLHO_FECHADO : OLHO_ABERTO;
  b.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
  b.setAttribute('aria-pressed', String(mostrar));
  if(!inp.disabled) inp.focus();           // o teclado do celular não fecha ao tocar no olho
});

/** O aviso de quem está offline: entrar ou continuar com o que já tem */
function avisoEntrar(motivo){
  if(!onlineAtivo() || onlineConectado()) return;
  const temMusicas = Store.songs().length > 0;
  sheet('<h3>Repertório da banda</h3>' +
    '<p style="color:var(--fg2);line-height:1.5;margin:0 0 14px">' +
      (motivo ? '<b>' + esc(motivo) + '</b><br>' : '') +
      'Entre com a senha da banda pra receber as músicas e os áudios atualizados. É uma vez só: ' +
      'depois o app se atualiza sozinho e continua funcionando sem internet.</p>' +
    '<div class="field" style="margin-bottom:8px">' +
      campoSenha('lgSenha', 'Senha da banda') + '</div>' +
    '<div class="trim-err" id="lgErr" style="margin-bottom:8px"></div>' +
    '<div class="hint" id="lgProg" style="margin-bottom:8px;display:none"></div>' +
    '<button class="btn primary" id="lgEntrar" style="margin-bottom:9px">Entrar</button>' +
    '<button class="btn" id="lgOff">Continuar offline</button>' +
    '<div class="hint" style="margin-top:10px">Offline você usa ' +
      (temMusicas ? 'as músicas que já estão neste aparelho' : 'o app normalmente') +
      ', mas não recebe as novidades. Dá pra entrar depois em Ajustes.</div>',
    (el, ov) => {
      const inp = $('#lgSenha', el), err = $('#lgErr', el), bt = $('#lgEntrar', el), prog = $('#lgProg', el);
      const travar = (sim) => {
        bt.disabled = sim; $('#lgOff', el).disabled = sim; inp.disabled = sim;
        bt.textContent = sim ? 'Entrando…' : 'Entrar';
        prog.style.display = sim ? '' : 'none';
        if(sim) ov.dataset.preso = '1'; else delete ov.dataset.preso;      // no meio do download, tocar fora não fecha
      };
      const entrar = async () => {
        if(bt.disabled) return;
        err.textContent = '';
        travar(true);
        try{
          await entrarComSenha(inp.value, (t) => { prog.textContent = t; });
          closeSheet();
          render();
        }catch(e){
          travar(false);
          err.textContent = e.message || 'Não deu certo.';
        }
      };
      bt.onclick = entrar;
      inp.onkeydown = (e) => { if(e.key === 'Enter') entrar(); };
      $('#lgOff', el).onclick = () => { closeSheet(); };
    });
}

/** Roda a cada troca de tela (ver render): o aviso de entrada e a sincronia que ficou esperando */
let avisoConferido = false;
function aposTrocarDeTela(){
  if($('#viewer')) return;                    // com cifra aberta, nada disso
  // uma vez a cada abertura do app; fechar a folha vale como "continuar offline"
  if(!avisoConferido){ avisoConferido = true; avisoEntrar(); }
  if(onlineConectado() && (Sync.pendente || Date.now() - (S.ghSinc || 0) > 120000)) agendarSync(Sync.pendente ? 1200 : 500);
}

/** Faixa no topo da lista pra quem está offline */
function barraOfflineHTML(){
  if(!onlineAtivo() || onlineConectado()) return '';
  return '<div class="offbar"><span>Offline: você não está recebendo as músicas atualizadas.</span>' +
         '<button id="offEntrar">Entrar</button></div>';
}

/** Quem já tem acesso define (ou troca, ou remove) a senha da banda */
function senhaDaBandaSheet(){
  const cfg = onlineCfg();
  if(!cfg || !cfg.token) return;
  sheet('<h3>Senha da banda</h3>' +
    '<p style="color:var(--fg2);line-height:1.5;margin:0 0 12px">Quem tiver essa senha digita uma vez no app e passa a receber ' +
      'e publicar o repertório, sem criar conta nem token. <span id="sbEstado"></span></p>' +
    '<div class="field"><label>Nova senha</label>' +
      '<input id="sbSenha" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ex.: uma frase de 3 ou 4 palavras">' +
      '<div class="hint" id="sbForca">Mínimo de 8 caracteres. Uma frase curta é o mais fácil de passar pra banda.</div></div>' +
    '<button class="btn primary" id="sbOk" style="margin-bottom:9px">Publicar senha</button>' +
    '<button class="btn danger" id="sbDel" style="margin-bottom:12px;display:none">Remover a senha</button>' +
    '<div class="hint">A senha precisa ser longa porque o arquivo de acesso fica num repositório público e pode ser testado ' +
      'sem limite de tentativas. <b>Pra tirar o acesso de alguém</b> não basta trocar a senha: gere um token novo no GitHub, ' +
      'apague o antigo lá, cole o novo aqui e publique outra senha.</div>',
    (el) => {
      const inp = $('#sbSenha', el), forca = $('#sbForca', el);
      ghTemAcesso(cfg).then(tem => {
        if(!document.body.contains(el)) return;
        $('#sbEstado', el).innerHTML = tem ? '<b>Já existe uma senha publicada</b> — publicar outra substitui.' : 'Ainda não há senha publicada.';
        $('#sbDel', el).style.display = tem ? '' : 'none';
      }).catch(() => {});
      inp.oninput = () => {
        const f = ghSenhaForte(inp.value);
        forca.textContent = !ghSenhaLimpa(inp.value) ? 'Mínimo de 8 caracteres. Uma frase curta é o mais fácil de passar pra banda.'
                          : f.ok ? 'Boa senha.' : f.motivo;
        forca.style.color = !ghSenhaLimpa(inp.value) ? '' : (f.ok ? 'var(--acc2)' : 'var(--danger)');
      };
      $('#sbOk', el).onclick = async () => {
        const f = ghSenhaForte(inp.value);
        if(!f.ok){ inp.oninput(); inp.focus(); return; }
        const senha = inp.value;
        const oc = ocupado('Publicando a senha');
        try{
          oc.diga('Protegendo o acesso...');
          await ghPublicarAcesso(cfg, senha);
          oc.fechar();
          avisoSheet('Senha publicada', 'Passe a senha pra banda. Ao abrir o app, cada pessoa vê o aviso pra entrar: ' +
            'digita a senha uma vez e pronto.');
        }catch(e){ oc.fechar(); erroOnline(e); }
      };
      $('#sbDel', el).onclick = () => confirmSheet('Remover a senha?',
        'Ninguém mais entra com a senha. Quem já entrou continua com acesso até você apagar o token no GitHub.', 'Remover',
        async () => {
          const oc = ocupado('Removendo a senha');
          try{ await ghRemoverAcesso(cfg); oc.fechar(); toast('Senha removida'); }
          catch(e){ oc.fechar(); erroOnline(e); }
        });
    });
}

/** HTML da seção Online em Ajustes */
function onlineSecaoHTML(){
  const ligado = S.usarOnline !== false;
  const conectado = onlineConectado();
  const avancado = (extra) =>
    '<details class="avancado" style="margin-top:12px"><summary>Avançado</summary>' +
      '<div class="field" style="margin-top:10px"><label>Repositório</label>' +
        '<input id="ghRepo" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="dono/repositorio" value="' + esc(onlineRepo()) + '"></div>' +
      extra + '</details>';

  return '<div class="sep" style="margin:20px 0"></div>' +
    '<h3 style="font-size:15px;margin:0 0 4px">Online (GitHub)</h3>' +
    '<div class="switch"><span>Usar repertório online</span><input type="checkbox" id="cfgOnline"' + (ligado ? ' checked' : '') + '></div>' +
    '<div id="onlineBox"' + (ligado ? '' : ' style="display:none"') + '>' +
      (conectado
        ? '<div class="okbox">&#10003; Conectado. O app baixa as novidades ao abrir e publica o que você altera.</div>' +
          '<div class="hint" id="ghStatus" style="margin-bottom:10px">' + esc(textoStatusSync()) + '</div>' +
          '<button class="btn" id="ghAgora" style="margin-bottom:9px">&#8635; Sincronizar agora</button>' +
          '<div class="row"><button class="btn" id="ghSenhaBtn">Senha da banda…</button>' +
            '<button class="btn" id="ghSair">Sair deste aparelho</button></div>' +
          avancado('<button class="btn danger" id="ghEspelhar">Substituir tudo pelo que está no GitHub</button>' +
            '<div class="hint">Descarta o que só existe neste aparelho e copia o repertório do GitHub.</div>')
        : '<div class="field"><label>Senha da banda</label>' +
            campoSenha('ghSenha', 'a senha que te passaram') +
            '<div class="hint">Digita uma vez e fica salva neste aparelho. Depois o app se atualiza sozinho.</div></div>' +
          '<button class="btn primary" id="ghEntrar">Entrar</button>' +
          avancado('<div class="field"><label>Token do GitHub — só pra quem cuida do repertório</label>' +
              campoSenha('ghToken', 'github_pat_...') +
              '<div class="hint">Crie em <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">' +
                'GitHub → Fine-grained tokens</a>: acesso <b>só a este repositório</b>, permissão <b>Contents: Read and write</b>. ' +
                'Depois de colar, defina a senha da banda.</div></div>' +
            '<button class="btn" id="ghUsarToken">Usar este token</button>')) +
    '</div>' +
    (ligado ? '' : '<div class="hint">Desligado: o app usa só o que está neste aparelho e não avisa pra entrar.</div>');
}

function onlineLigar(){
  $('#cfgOnline').onchange = (e) => {
    S.usarOnline = e.target.checked;
    Store.saveSettings(S);
    viewSettings();
    if(S.usarOnline) agendarSync(300);
  };
  const rp = $('#ghRepo');
  if(rp) rp.oninput = (e) => { S.ghRepo = e.target.value.trim(); Store.saveSettings(S); };

  if($('#ghAgora')){
    $('#ghAgora').onclick = async () => {
      const oc = ocupado('Sincronizando');
      try{
        const r = await sincronizar({ forcar: true, lancar: true, progresso: oc.diga });
        oc.fechar();
        if(!r){ toast('Já havia uma sincronia em andamento'); return; }
        const chegou = resumoChegou(r.resumo);
        const publicou = r.envio && !r.envio.semMudanca;
        avisoSheet('Sincronizado',
          (chegou ? 'Recebido: ' + chegou + '.' : 'Nenhuma novidade pra receber.') + '<br>' +
          (publicou ? 'Suas alterações foram publicadas.' : 'Nada seu pra publicar.') +
          (r.baixadas ? '<br>' + r.baixadas + ' áudio(s) baixado(s).' : '') +
          (r.falharam ? '<br>' + r.falharam + ' áudio(s) não baixaram — tente de novo depois.' : ''));
        if($('#ghStatus')) $('#ghStatus').textContent = textoStatusSync();
      }catch(e){ oc.fechar(); erroOnline(e); }
    };
    $('#ghSenhaBtn').onclick = () => senhaDaBandaSheet();
    $('#ghSair').onclick = () => confirmSheet('Sair deste aparelho?',
      'Este aparelho deixa de receber e publicar o repertório. Suas músicas continuam aqui, e dá pra entrar de novo com a senha.', 'Sair',
      () => { S.ghToken = ''; Store.saveSettings(S); estadoSync(''); viewSettings(); });
    $('#ghEspelhar').onclick = () => confirmSheet('Substituir tudo?',
      'Este aparelho fica idêntico ao GitHub. O que só existe aqui (e ainda não foi publicado) é apagado.', 'Substituir',
      async () => {
        const oc = ocupado('Copiando do GitHub');
        try{ await sincronizar({ forcar: true, lancar: true, substituir: true, progresso: oc.diga }); oc.fechar(); toast('Pronto'); viewSettings(); }
        catch(e){ oc.fechar(); erroOnline(e); }
      });
  } else if($('#ghEntrar')){
    const entrar = async () => {
      const oc = ocupado('Entrando');
      try{ await entrarComSenha($('#ghSenha').value, oc.diga); oc.fechar(); viewSettings(); }
      catch(e){ oc.fechar(); erroOnline(e); }
    };
    $('#ghEntrar').onclick = entrar;
    $('#ghSenha').onkeydown = (e) => { if(e.key === 'Enter') entrar(); };
    $('#ghUsarToken').onclick = async () => {
      const cfg = onlineCfg();
      const token = $('#ghToken').value.trim();
      if(!cfg || !token){ toast('Cole o token'); return; }
      const oc = ocupado('Conferindo o token');
      try{
        const info = await ghPodeEscrever({ repo: cfg.repo, token: token });
        if(!info.escreve) throw new Error('Esse token consegue ler, mas não escrever. Ele precisa da permissão "Contents: Read and write".');
        S.usarOnline = true; S.ghToken = token; Store.saveSettings(S);
        await primeiraSincronia(oc.diga);
        oc.fechar(); viewSettings();
      }catch(e){ oc.fechar(); erroOnline(e); }
    };
  }
}

function resumoChegou(r){
  const p = [];
  if(r.novas) p.push(r.novas + (r.novas === 1 ? ' música nova' : ' músicas novas'));
  if(r.atualizadas) p.push(r.atualizadas + (r.atualizadas === 1 ? ' atualizada' : ' atualizadas'));
  if(r.removidas) p.push(r.removidas + (r.removidas === 1 ? ' removida' : ' removidas'));
  return p.join(', ');
}

/* ---------- gatilhos da sincronia ---------- */
// qualquer alteração nos dados (fora da própria sincronia) pede publicação
Store.aoMudar = () => {
  if(!onlineConectado()) return;
  if($('#viewer')) Sync.pendente = true;      // dentro da cifra: publica ao sair
  else { if(!Sync.rodando) estadoSync('sinc'); agendarSync(4000); }
};
window.addEventListener('online', () => agendarSync(800));
document.addEventListener('visibilitychange', () => {
  // voltou pro app depois de um tempo: confere se há novidades
  if(document.visibilityState === 'visible' && !$('#viewer') && Date.now() - (S.ghSinc || 0) > 120000) agendarSync(600);
});

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
