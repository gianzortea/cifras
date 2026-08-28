/* =========================================================
   parser.js — converte texto colado (Cifra Club etc.) no modelo interno
   Modelo de linha:
     {t:'b'}                              linha em branco
     {t:'s', text:'Intro'}                cabeçalho de seção
     {t:'tab', text:'E|--3--'}            tablatura (preserva bruto)
     {t:'l', text:'letra', ch:[{p,c}]}    letra + acordes posicionados
   ========================================================= */

const SECTION_WORDS = /^(intro|introdu[cç][aã]o|primeira parte|segunda parte|terceira parte|parte \d+|verso|estrofe|pr[eé][- ]?refr[aã]o|refr[aã]o|ponte|solo|final|coda|interl[uú]dio|instrumental|riff|base|dedilhado|passagem|repeti[cç][aã]o|chorus|bridge|verse|outro|ending)\s*\d*\s*:?$/i;

const AMBIG_WORDS = /^(Sim|Mim|Fam|Mim7|Sim7)$/;

function isTabLine(s){
  if(/^\s*[eEADGBbdag]\s*\|/.test(s)) return true;
  return /-{4,}/.test(s) && /\|/.test(s);
}

function isSectionLine(s){
  const t = s.trim();
  if(/^\[.+\]$/.test(t)) return true;
  if(SECTION_WORDS.test(t)) return true;
  return false;
}

function sectionText(s){
  return s.trim().replace(/^\[|\]$/g,'').replace(/:$/,'').trim();
}

/** tokens com posição: [{p, s}] */
function tokensWithPos(line){
  const out = [];
  const re = /\S+/g;
  let m;
  while((m = re.exec(line)) !== null) out.push({ p: m.index, s: m[0] });
  return out;
}

/** É linha só de acordes? */
function isChordLine(line){
  if(!line.trim()) return false;
  if(isTabLine(line)) return false;
  const toks = tokensWithPos(line);
  if(!toks.length) return false;
  let real = 0;
  for(const t of toks){
    if(isChordToken(t.s)) { real++; continue; }
    if(isModToken(t.s))   continue;
    return false;
  }
  if(real === 0) return false;
  // heurística: linha longa com 1 token só de 1 letra provavelmente é letra
  if(toks.length === 1 && toks[0].s.length === 1 && line.length > 40) return false;
  // palavras portuguesas que a regex confunde com acorde quando estão sozinhas
  if(toks.length === 1 && AMBIG_WORDS.test(toks[0].s)) return false;
  return true;
}

/**
 * parseCifra(texto) -> { lines, meta:{key, capo, title, artist} }
 */
function parseCifra(raw){
  const meta = { key:'', capo:0, title:'', artist:'' };
  let src = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, '    ');

  let src_lines = src.split('\n');

  // --- limpeza de cabeçalho do Cifra Club ---
  const kept = [];
  for(let i = 0; i < src_lines.length; i++){
    const L = src_lines[i];
    const t = L.trim();

    let m;
    if((m = t.match(/^tom:\s*([A-G][#b]?m?(?:\s*\(.*\))?)/i))){
      meta.key = m[1].split('(')[0].trim();
      continue;
    }
    if((m = t.match(/^capo?(?:traste)?[^0-9]*(\d+)/i))){
      meta.capo = parseInt(m[1], 10) || 0;
      continue;
    }
    if(/^(afina[cç][aã]o|cifra club|imprimir|tocar no|ver v[ií]deo|acordes|dificuldade|escrita por|enviada por)/i.test(t)) continue;
    kept.push(L);
  }
  src_lines = kept;

  // remove linhas em branco no começo/fim
  while(src_lines.length && !src_lines[0].trim()) src_lines.shift();
  while(src_lines.length && !src_lines[src_lines.length-1].trim()) src_lines.pop();

  const lines = [];
  for(let i = 0; i < src_lines.length; i++){
    const cur = src_lines[i];

    if(!cur.trim()){
      if(lines.length && lines[lines.length-1].t !== 'b') lines.push({t:'b'});
      continue;
    }
    if(isTabLine(cur)){ lines.push({t:'tab', text: cur.replace(/\s+$/,'')}); continue; }

    // seção pode vir junto com acordes: "[Intro] G  D  Em"
    const secInline = cur.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if(secInline){
      lines.push({t:'s', text: secInline[1].trim()});
      const rest = secInline[2];
      if(rest.trim()){
        if(isChordLine(rest)){
          lines.push({ t:'l', text:'', ch: tokensWithPos(rest).map(x => ({ p: x.p, c: x.s })) });
        } else {
          lines.push({ t:'l', text: rest, ch: [] });
        }
      }
      continue;
    }
    if(isSectionLine(cur)){ lines.push({t:'s', text: sectionText(cur)}); continue; }

    if(isChordLine(cur)){
      const chords = tokensWithPos(cur).map(x => ({ p: x.p, c: x.s }));
      const next = src_lines[i+1];
      const nextIsLyric = next !== undefined && next.trim() && !isChordLine(next) &&
                          !isTabLine(next) && !isSectionLine(next);
      if(nextIsLyric){
        lines.push({ t:'l', text: next.replace(/\s+$/,''), ch: chords });
        i++;
      } else {
        lines.push({ t:'l', text:'', ch: chords });
      }
      continue;
    }

    lines.push({ t:'l', text: cur.replace(/\s+$/,''), ch: [] });
  }

  // tom sugerido: primeiro acorde encontrado
  if(!meta.key){
    outer: for(const l of lines){
      if(l.t === 'l' && l.ch && l.ch.length){
        for(const c of l.ch){
          if(isChordToken(c.c)){
            const p = parseChord(c.c);
            meta.key = (isMinorQual(p.qual) ? MINOR_NAMES : MAJOR_NAMES)[p.root];
            break outer;
          }
        }
      }
    }
  }
  return { lines, meta };
}

/** Modelo -> texto (pra editar em modo bruto e reexportar) */
function serializeCifra(lines){
  const out = [];
  for(const l of (lines || [])){
    if(l.t === 'b'){ out.push(''); continue; }
    if(l.t === 's'){ out.push('[' + l.text + ']'); continue; }
    if(l.t === 'tab'){ out.push(l.text); continue; }
    if(l.ch && l.ch.length){
      let row = '';
      const sorted = l.ch.slice().sort((a,b) => a.p - b.p);
      for(const c of sorted){
        if(row.length > c.p) row += ' ';
        else row += ' '.repeat(c.p - row.length);
        row += c.c;
      }
      out.push(row);
    }
    if(l.text || !(l.ch && l.ch.length)) out.push(l.text);
  }
  return out.join('\n');
}
