/* =========================================================
   diagrams.js — desenhos de acorde para violão/guitarra

   Estratégia (nessa ordem):
     1. acordes abertos clássicos (o desenho que todo mundo conhece)
     2. formas móveis de pestana (E-form na 6a corda, A-form na 5a)
     3. busca no braço, só pra acorde exótico que não tem forma pronta
   ========================================================= */

// afinação padrão, corda 6 -> corda 1, em nota MIDI
const STRINGS = [40, 45, 50, 55, 59, 64];
const X = null;

/* ---------- intervalos a partir do sufixo ---------- */
function chordIntervals(qual){
  const q = String(qual || '');
  const flat = q.replace(/[()\s]/g, '').replace(/[º°]/g, 'o');

  if(/^5$/.test(flat)) return { tones: [0, 7], third: null, fifth: 7, seventh: null };

  let third = 4, fifth = 7, seventh = null;
  let rest = flat, isDim = false;

  if(/^(dim|o)/.test(rest)){ isDim = true; third = 3; fifth = 6; rest = rest.replace(/^(dim|o)/, ''); }
  else if(/^(min|m)(?!aj)/.test(rest)){ third = 3; rest = rest.replace(/^(min|m)/, ''); }
  else if(/^sus2/.test(rest)){ third = 2; rest = rest.replace(/^sus2/, ''); }
  else if(/^sus/.test(rest)){ third = 5; rest = rest.replace(/^sus4?/, ''); }
  else if(/^(aug|aum|\+)/.test(rest)){ fifth = 8; rest = rest.replace(/^(aug|aum|\+)/, ''); }

  if(/(7M|maj|M7)/.test(rest)) seventh = 11;
  else if(/7/.test(rest)) seventh = isDim ? 9 : 10;

  if(/b5/.test(rest)) fifth = 6;
  if(/(#5|\+5|5\+)/.test(rest)) fifth = 8;
  if(/\(4\)/.test(q) || /sus4/.test(flat)) third = 5;

  const tones = new Set([0, fifth]);
  if(third !== null) tones.add(third);
  if(seventh !== null) tones.add(seventh);

  const hasAdd = /add/.test(flat);
  if(/6/.test(rest) && !/13/.test(rest)) tones.add(9);
  if(/(^|[^b#])9/.test(rest)){
    tones.add(2);
    if(seventh === null && !hasAdd && !/6/.test(rest)){ seventh = 10; tones.add(10); }
  }
  if(/(^|[^#])11/.test(rest)){
    tones.add(5);
    if(seventh === null && !hasAdd){ seventh = 10; tones.add(10); }
  }
  if(/13/.test(rest)){
    tones.add(9);
    if(seventh === null && !hasAdd){ seventh = 10; tones.add(10); }
  }
  if(/b9/.test(rest))  tones.add(1);
  if(/#9/.test(rest))  tones.add(3);
  if(/#11/.test(rest)) tones.add(6);
  if(/b13/.test(rest)) tones.add(8);

  return { tones: Array.from(tones), third: third, fifth: fifth, seventh: seventh };
}

/** Reduz o acorde a uma família com forma conhecida ('', m, 7, m7, maj7, sus4...) */
function qualKey(info){
  const t = info.third, f = info.fifth, s = info.seventh, tones = info.tones;
  if(t === null) return '5';
  const has6 = tones.indexOf(9) >= 0 && s === null;

  let base;
  if(t === 3 && f === 6) base = (s === 9 ? 'dim7' : (s === 10 ? 'm7b5' : 'dim'));
  else if(f === 8)       base = 'aug';
  else if(t === 5)       base = (s === 10 ? '7sus4' : 'sus4');
  else if(t === 2)       base = 'sus2';
  else if(t === 3)       base = (s === 11 ? 'mMaj7' : (s === 10 ? 'm7' : (has6 ? 'm6' : 'm')));
  else                   base = (s === 11 ? 'maj7'  : (s === 10 ? '7'  : (has6 ? '6'  : '')));

  // sobrou alguma nota fora da família? então é acorde estendido (9, 11, 13, add9...)
  const exp = new Set([0, f, t]);
  if(s !== null) exp.add(s);
  if(has6) exp.add(9);
  for(const x of tones) if(!exp.has(x)) return 'ext';
  return base;
}

/* ---------- 1. acordes abertos clássicos ---------- */
/* chave: pitchClass da tônica + '|' + família   (C=0, C#=1, ... B=11) */
const OPEN = {
  '0|':      [X,3,2,0,1,0],   '0|7':   [X,3,2,3,1,0], '0|maj7': [X,3,2,0,0,0], '0|6': [X,3,2,2,1,0],
  '2|':      [X,X,0,2,3,2],   '2|7':   [X,X,0,2,1,2], '2|maj7': [X,X,0,2,2,2],
  '2|m':     [X,X,0,2,3,1],   '2|m7':  [X,X,0,2,1,1], '2|sus4': [X,X,0,2,3,3], '2|sus2': [X,X,0,2,3,0],
  '4|':      [0,2,2,1,0,0],   '4|7':   [0,2,0,1,0,0], '4|maj7': [0,2,1,1,0,0],
  '4|m':     [0,2,2,0,0,0],   '4|m7':  [0,2,0,0,0,0], '4|sus4': [0,2,2,2,0,0],
  '5|maj7':  [X,X,3,2,1,0],
  '7|':      [3,2,0,0,0,3],   '7|7':   [3,2,0,0,0,1], '7|maj7': [3,2,0,0,0,2], '7|sus4': [3,3,0,0,1,3],
  '9|':      [X,0,2,2,2,0],   '9|7':   [X,0,2,0,2,0], '9|maj7': [X,0,2,1,2,0],
  '9|m':     [X,0,2,2,1,0],   '9|m7':  [X,0,2,0,1,0], '9|sus4': [X,0,2,2,3,0], '9|sus2': [X,0,2,2,0,0],
  '11|7':    [X,2,1,2,0,2]
};

/* ---------- 2. formas móveis ---------- */
/* offsets a partir da casa da tônica; a tônica fica na corda indicada */
const FORM_E = {  // tônica na 6a corda (mi grave, pc 4)
  '':     [0,2,2,1,0,0], 'm':    [0,2,2,0,0,0], '7':   [0,2,0,1,0,0],
  'm7':   [0,2,0,0,0,0], 'maj7': [0,2,1,1,0,0], 'sus4':[0,2,2,2,0,0],
  '6':    [0,2,2,1,2,0], 'm6':   [0,2,2,0,2,0], '7sus4':[0,2,0,2,0,0]
};
const FORM_A = {  // tônica na 5a corda (lá, pc 9)
  '':     [X,0,2,2,2,0], 'm':    [X,0,2,2,1,0], '7':   [X,0,2,0,2,0],
  'm7':   [X,0,2,0,1,0], 'maj7': [X,0,2,1,2,0], 'sus4':[X,0,2,2,3,0],
  'sus2': [X,0,2,2,0,0], '6':    [X,0,2,2,2,2], 'm6':  [X,0,2,2,1,2],
  '7sus4':[X,0,2,0,3,0]
};

function shift(shape, n){
  return shape.map(f => (f === X ? X : f + n));
}
function describe(frets){
  const fretted = frets.filter(f => f !== X && f > 0);
  const minFret = fretted.length ? Math.min.apply(null, fretted) : 0;
  const sounding = [];
  for(let i = 0; i < 6; i++) if(frets[i] !== X) sounding.push(i);
  const atMin = sounding.filter(i => frets[i] === minFret).length;
  const barre = (minFret > 0 && atMin >= 2 && frets[sounding[0]] === minFret) ? minFret : 0;
  return { frets: frets, minFret: minFret, barre: barre };
}

/* ---------- 3. busca genérica (fallback) ---------- */
function searchVoicings(rootPc, bassPc, info, max){
  const tonePcs = new Set(info.tones.map(i => (rootPc + i) % 12));
  tonePcs.add(bassPc);                       // baixo invertido (Am/G) entra como nota válida

  // obrigatórias: tudo menos a 5a (que é a primeira a ser omitida na guitarra).
  // Acima de 4 notas obrigatórias vira impossível, então guarda só o essencial.
  const core = [0];
  if(info.third   !== null) core.push(info.third);
  if(info.seventh !== null) core.push(info.seventh);
  const ext = info.tones.filter(i => i !== 0 && i !== info.fifth &&
                                     i !== info.third && i !== info.seventh);
  let musts = core.concat(ext);
  if(musts.length > 4) musts = core.concat(ext.slice(-1));
  const must = musts.map(i => (rootPc + i) % 12);

  const found = new Map();

  for(let base = 0; base <= 11; base++){
    const opts = STRINGS.map(open => {
      const list = [X];
      const lo = base === 0 ? 0 : base;
      for(let f = lo; f <= base + 3; f++) if(tonePcs.has((open + f) % 12)) list.push(f);
      if(base > 0 && base < 5 && tonePcs.has(open % 12)) list.push(0);
      return list;
    });
    const cur = new Array(6);
    (function walk(i){
      if(i === 6){ consider(cur.slice()); return; }
      for(const f of opts[i]){ cur[i] = f; walk(i + 1); }
    })(0);
  }

  function consider(v){
    const sounding = [];
    for(let i = 0; i < 6; i++) if(v[i] !== X) sounding.push(i);
    if(sounding.length < (info.tones.length <= 2 ? 2 : 4)) return;
    for(let i = sounding[0]; i <= sounding[sounding.length - 1]; i++) if(v[i] === X) return;

    const low = STRINGS[sounding[0]] + v[sounding[0]];
    if(low % 12 !== bassPc) return;

    const pcs = new Set(sounding.map(i => (STRINGS[i] + v[i]) % 12));
    for(const p of must) if(!pcs.has(p)) return;

    const fretted = sounding.filter(i => v[i] > 0).map(i => v[i]);
    const minF = fretted.length ? Math.min.apply(null, fretted) : 0;
    const maxF = fretted.length ? Math.max.apply(null, fretted) : 0;
    if(maxF - minF > 3) return;

    const opens = sounding.filter(i => v[i] === 0).length;
    if(opens && minF >= 3) return;                       // solta + casa alta = irreal

    const reach = Math.max(0, v[sounding[0]] - minF);    // esticar o indicador pra trás
    if(reach > 2 || (reach > 1 && minF >= 3)) return;

    const atMin = sounding.filter(i => v[i] === minF).length;
    const barre = minF > 0 && atMin >= 2 && v[sounding[0]] === minF;
    const fingers = barre ? 1 + fretted.filter(f => f > minF).length : fretted.length;
    if(fingers > 4) return;

    const score = sounding.length * 12 + opens * 6 + pcs.size * 4
                - fingers * 5 - minF * 5 - (maxF - minF) * 2 - reach * 5
                - sounding[0] * 5                                  // prefere começar nas graves
                - (barre ? 3 : 0);

    const key = v.map(f => f === X ? 'x' : f).join(',');
    if(!found.has(key) || found.get(key).score < score)
      found.set(key, Object.assign(describe(v), { score: score }));
  }

  const list = Array.from(found.values()).sort((a, b) => b.score - a.score);
  const out = [];
  for(const v of list){
    if(out.some(o => Math.abs(o.minFret - v.minFret) < 2)) continue;
    out.push(v);
    if(out.length >= (max || 3)) break;
  }
  return out;
}

/* ---------- entrada principal ---------- */
function findVoicings(tok, max){
  const c = parseChord(tok);
  if(!c) return [];
  const info = chordIntervals(c.qual);
  const k = qualKey(info);
  const limit = max || 3;

  // com baixo invertido (D/F#) a forma pronta não serve
  if(c.bass !== null && c.bass !== c.root)
    return searchVoicings(c.root, c.bass, info, limit);

  const out = [];
  const seen = new Set();
  const push = (frets) => {
    if(!frets) return;
    if(frets.some(f => f !== X && (f < 0 || f > 15))) return;
    const key = frets.map(f => f === X ? 'x' : f).join(',');
    if(seen.has(key)) return;
    seen.add(key);
    out.push(describe(frets));
  };

  push(OPEN[c.root + '|' + k]);
  if(FORM_E[k]) push(shift(FORM_E[k], ((c.root - 4) % 12 + 12) % 12));
  if(FORM_A[k]) push(shift(FORM_A[k], ((c.root - 9) % 12 + 12) % 12));

  if(!out.length) return searchVoicings(c.root, c.root, info, limit);

  out.sort((a, b) => a.minFret - b.minFret);
  return out.slice(0, limit);
}

/* ---------- SVG (usa currentColor, acompanha o tema) ---------- */
function voicingSVG(v, label){
  const W = 106, H = 134, L = 16, T = 32, SW = 15, FH = 19, NF = 5;
  const start = v.minFret > 1 ? v.minFret : 1;
  const p = [];

  p.push('<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" fill="none" xmlns="http://www.w3.org/2000/svg">');
  if(label)
    p.push('<text x="' + (L + SW * 2.5) + '" y="13" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">' + label + '</text>');

  if(v.minFret > 1)
    p.push('<text x="' + (L - 6) + '" y="' + (T + 14) + '" text-anchor="end" font-size="10" fill="currentColor" opacity=".6">' + start + '</text>');
  else
    p.push('<rect x="' + L + '" y="' + (T - 3) + '" width="' + (SW * 5) + '" height="3" fill="currentColor"/>');

  for(let f = 0; f <= NF; f++)
    p.push('<line x1="' + L + '" y1="' + (T + f * FH) + '" x2="' + (L + SW * 5) + '" y2="' + (T + f * FH) + '" stroke="currentColor" stroke-width="1" opacity=".3"/>');
  for(let s = 0; s < 6; s++)
    p.push('<line x1="' + (L + s * SW) + '" y1="' + T + '" x2="' + (L + s * SW) + '" y2="' + (T + NF * FH) + '" stroke="currentColor" stroke-width="1" opacity=".4"/>');

  if(v.barre){
    const idx = [];
    for(let i = 0; i < 6; i++) if(v.frets[i] === v.barre) idx.push(i);
    const y = T + (v.barre - start + 0.5) * FH;
    p.push('<line x1="' + (L + idx[0] * SW) + '" y1="' + y + '" x2="' + (L + idx[idx.length - 1] * SW) + '" y2="' + y +
           '" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>');
  }

  for(let s = 0; s < 6; s++){
    const f = v.frets[s], x = L + s * SW;
    if(f === X)
      p.push('<text x="' + x + '" y="' + (T - 7) + '" text-anchor="middle" font-size="11" fill="currentColor" opacity=".5">×</text>');
    else if(f === 0)
      p.push('<circle cx="' + x + '" cy="' + (T - 10) + '" r="3.4" stroke="currentColor" stroke-width="1.4"/>');
    else if(!(v.barre && f === v.barre))
      p.push('<circle cx="' + x + '" cy="' + (T + (f - start + 0.5) * FH) + '" r="5.4" fill="currentColor"/>');
  }
  p.push('</svg>');
  return p.join('');
}

/** Acordes distintos usados na música, na ordem em que aparecem */
function songChords(song, mapFn){
  const seen = [];
  (song.lines || []).forEach(l => {
    (l.ch || []).forEach(c => {
      const d = mapFn ? mapFn(c.c) : c.c;
      if(isChordToken(d) && seen.indexOf(d) < 0) seen.push(d);
    });
  });
  return seen;
}
