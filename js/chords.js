/* =========================================================
   chords.js — reconhecimento, transposição e formatação
   ========================================================= */

const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

// grafia usual dos tons (evita coisas como "Abm" ou "A#" no lugar de "G#m"/"Bb")
const MAJOR_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const MINOR_NAMES = ['Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','G#m','Am','Bbm','Bm'];

// tons que "pedem" bemol na escrita dos acordes
const FLAT_KEYS = new Set(['F','Bb','Eb','Ab','Db','Gb','Dm','Gm','Cm','Fm','Bbm','Ebm']);

const PT2EN = {
  'DO':'C','DÓ':'C','RE':'D','RÉ':'D','MI':'E','FA':'F','FÁ':'F',
  'SOL':'G','LA':'A','LÁ':'A','SI':'B'
};
const EN2PT = {'C':'Dó','D':'Ré','E':'Mi','F':'Fá','G':'Sol','A':'Lá','B':'Si'};

const NOTE_SRC = '(?:[A-G]|D[oó]|R[eé]|Mi|F[aá]|Sol|L[aá]|Si)';
const ACC_SRC  = '(?:##|bb|#|b|♯|♭)?';
// sufixos válidos — restrito de propósito, pra não confundir palavra com acorde
// (classe de caracteres evita problemas de escape: + ( ) são literais dentro dela)
const QUAL_SRC = '(?:maj|min|sus|add|aug|aum|dim|alt|[mM0-9()#b+°º/-])*';

const CHORD_RE = new RegExp(
  '^(' + NOTE_SRC + ')(' + ACC_SRC + ')(' + QUAL_SRC + ')$'
);
const BASS_RE = new RegExp(
  '^(' + NOTE_SRC + ')(' + ACC_SRC + ')$'
);

// tokens que aparecem em linha de acorde mas não são acorde
const MOD_RE = /^(?:\||\|\||:\||\|:|%|-+|~|\(?\d+ ?[xX]\)?|\(?[xX] ?\d+\)?|\.\.\.|\*)$/;

function normNote(n){
  const up = n.toUpperCase();
  if(PT2EN[up]) return PT2EN[up];
  return up;
}
function normAcc(a){
  if(!a) return '';
  return a.replace('♯','#').replace('♭','b');
}
function noteIndex(note, acc){
  let i = SHARP.indexOf(normNote(note));
  if(i < 0) return -1;
  const a = normAcc(acc);
  if(a === '#')  i += 1;
  if(a === '##') i += 2;
  if(a === 'b')  i -= 1;
  if(a === 'bb') i -= 2;
  return ((i % 12) + 12) % 12;
}

/** Separa "G/B" em corpo + baixo, se o que vem depois da barra for nota */
function splitBass(tok){
  const i = tok.lastIndexOf('/');
  if(i <= 0) return [tok, null];
  const tail = tok.slice(i + 1);
  if(BASS_RE.test(tail)) return [tok.slice(0, i), tail];
  return [tok, null];
}

/** Retorna objeto do acorde ou null */
function parseChord(tok){
  if(!tok) return null;
  const [body, bass] = splitBass(tok);
  const m = body.match(CHORD_RE);
  if(!m) return null;
  const note = m[1], acc = m[2], qual = m[3] || '';
  let bassIdx = null, bassPt = false;
  if(bass){
    const bm = bass.match(BASS_RE);
    if(!bm) return null;
    bassIdx = noteIndex(bm[1], bm[2]);
    bassPt = !!PT2EN[bm[1].toUpperCase()];
  }
  return {
    root: noteIndex(note, acc),
    acc: normAcc(acc),
    qual: qual,
    bass: bassIdx,
    bassPt: bassPt,
    pt: !!PT2EN[note.toUpperCase()]   // notação latina (Dó, Ré...)
  };
}

function isChordToken(tok){ return parseChord(tok) !== null; }
function isModToken(tok){ return MOD_RE.test(tok); }

function noteName(idx, preferFlat, pt){
  const n = (preferFlat ? FLAT : SHARP)[((idx % 12) + 12) % 12];
  if(!pt) return n;
  return EN2PT[n[0]] + n.slice(1);
}

/** Transpõe um token de acorde. Se não for acorde, devolve igual. */
function transposeChord(tok, steps, preferFlat){
  const c = parseChord(tok);
  if(!c) return tok;
  const s = ((steps % 12) + 12) % 12;
  let out = noteName(c.root + s, preferFlat, c.pt) + c.qual;
  if(c.bass !== null) out += '/' + noteName(c.bass + s, preferFlat, c.bassPt);
  return out;
}

/** Decide se o tom de destino se escreve com bemol */
function preferFlatFor(keyStr){
  if(!keyStr) return false;
  return FLAT_KEYS.has(String(keyStr).replace(/\s/g, ''));
}

function isMinorQual(q){
  return /^m(?!aj)/.test(q) || /^min/.test(q) || /^dim/.test(q) || /^[°º]/.test(q);
}

/** Nome do tom deslocado, na grafia usual (ex.: "F#m" +2 => "G#m") */
function transposeKey(key, steps){
  if(!key) return '';
  const k = String(key).trim();
  const minor = /m$/.test(k) && !/maj$/i.test(k);
  const base = minor ? k.slice(0, -1) : k;
  const c = parseChord(base);
  if(!c) return k;
  const idx = (c.root + (((steps % 12) + 12) % 12)) % 12;
  return (minor ? MINOR_NAMES : MAJOR_NAMES)[idx];
}

/** Simplifica acordes complexos (C7M(9)/E -> C ; Am7 -> Am), mantendo # ou b */
function simplifyChord(tok){
  const c = parseChord(tok);
  if(!c) return tok;
  return noteName(c.root, c.acc === 'b' || c.acc === 'bb', c.pt) + (isMinorQual(c.qual) ? 'm' : '');
}
