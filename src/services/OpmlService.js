// src/services/OpmlService.js
export class OpmlService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.REACT_APP_OPENAI_API_KEY || '';
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey || '';
  }

  /* =========================
     Estrazione & Normalizzazione
  ========================== */

  // Estrae l'H1 (# ...) dal markdown. Restituisce null se assente.
  extractH1(md = '') {
    const m = String(md).match(/^\s*#\s+(.+?)\s*$/m);
    return m ? m[1].trim() : null;
  }

  // Escape SOLO per testo di <title> (nodo testuale, NON attributo)
  // Mantiene l'apostrofo semplice `'` così com'è (richiesta MindMeister/XMind).
  xmlTextEscapeForTitle(s = '') {
    return String(s)
      .replace(/&/g, '&amp;')  // necessario in XML
      .replace(/</g, '&lt;')   // necessario in XML
      .replace(/>/g, '&gt;');  // necessario in XML
    // Niente sostituzione di ' o " dentro <title>...</title>
  }

  // Escape per attributi XML (usato per text="...")
  xmlAttrEscape(s = '') {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Rimuove code-fence e normalizza prolog XML (una sola dichiarazione)
  stripFencesAndDedupProlog(opmlXml) {
    if (typeof opmlXml !== 'string') return opmlXml;
    let xml = opmlXml
      .replace(/```xml[\s\S]*?```/gi, (m) => m.replace(/```xml|```/gi, ''))
      .replace(/```[\s\S]*?```/g, '')
      .trim();

    const prologs = xml.match(/<\?xml[^>]*\?>/gi) || [];
    if (prologs.length > 1) {
      xml = xml.replace(/<\?xml[^>]*\?>/gi, '').trim();
      xml = `${prologs[0]}\n${xml}`;
    }
    if (!/^<\?xml/i.test(xml)) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
    }
    return xml;
  }

  // Forza <head><title> al titolo desiderato (con escape minimo necessario)
  enforceHeadTitleExact(opmlXml, desiredTitle) {
    if (typeof opmlXml !== 'string') return opmlXml;
    // Normalizza eventuali apostrofi codificati nel titolo sorgente
    const exact = String(desiredTitle).replace(/&apos;|&#39;|’/g, "'");
    const safe = this.xmlTextEscapeForTitle(exact);

    if (/<head>[\s\S]*?<title>[\s\S]*?<\/title>[\s\S]*?<\/head>/i.test(opmlXml)) {
      return opmlXml.replace(
        /<head>[\s\S]*?<title>[\s\S]*?<\/title>[\s\S]*?<\/head>/i,
        `<head>\n  <title>${safe}</title>\n</head>`
      );
    }
    return opmlXml.replace(/<opml[^>]*>/i, (m) => `${m}\n<head>\n  <title>${safe}</title>\n</head>`);
  }

  // Rimuove root <outline text="Titolo"> nel <body> se duplica il title
  removeDuplicatedRootOutline(opmlXml) {
    if (typeof opmlXml !== 'string') return opmlXml;
    let xml = opmlXml.trim();

    const tMatch = xml.match(/<head>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/head>/i);
    const title = tMatch ? tMatch[1] : '';

    const titleForAttr = String(title)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');

    const variants = new Set([
      titleForAttr,
      titleForAttr.replace(/'/g, '&apos;'),
      titleForAttr.replace(/'/g, '&#39;'),
      titleForAttr.replace(/'/g, '’'),
    ]);

    const bodyMatch = xml.match(/<body>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) return xml;

    let bodyInner = bodyMatch[1];

    const rootRegex = /^\s*<outline\s+[^>]*text="([^"]+)"[^>]*>([\s\S]*?)<\/outline>\s*$/i;
    const m = bodyInner.match(rootRegex);
    if (m) {
      const rootText = m[1];
      const rootChildren = m[2];
      if (variants.has(rootText)) {
        bodyInner = `\n${rootChildren}\n`;
        xml = xml.replace(/<body>[\s\S]*?<\/body>/i, `<body>${bodyInner}</body>`);
      }
    }
    return xml;
  }

  // Garantisce struttura OPML base
  ensureMinimalStructure(opmlXml, fallbackTitle = 'Mappa Mentale') {
    let xml = opmlXml;
    if (!/<opml[^>]*version="2\.0"[^>]*>/i.test(xml)) {
      xml = xml.replace(/^<opml/i, '<opml version="2.0"');
    }
    if (!/<head>[\s\S]*?<title>[\s\S]*?<\/title>[\s\S]*?<\/head>/i.test(xml)) {
      const head = `<head>\n  <title>${this.xmlTextEscapeForTitle(fallbackTitle)}</title>\n</head>`;
      if (/<head>[\s\S]*?<\/head>/i.test(xml)) {
        xml = xml.replace(/<head>[\s\S]*?<\/head>/i, head);
      } else {
        xml = xml.replace(/<opml[^>]*>/i, (m) => `${m}\n${head}`);
      }
    }
    if (!/<body>[\s\S]*?<\/body>/i.test(xml)) {
      xml = xml.replace(/<\/head>/i, `</head>\n<body>\n</body>`);
    }
    return xml;
  }

  // Pipeline completa: fence/prolog → struttura → title esatto → no root duplicato → struttura
  fullNormalize(opmlXml, exactTitle = 'Mappa Mentale') {
    let xml = this.stripFencesAndDedupProlog(opmlXml);
    xml = this.ensureMinimalStructure(xml, exactTitle);
    xml = this.enforceHeadTitleExact(xml, exactTitle);
    xml = this.removeDuplicatedRootOutline(xml);
    xml = this.ensureMinimalStructure(xml, exactTitle);
    return xml.trim();
  }

  /* =========================
        MD → OPML via API
  ========================== */

  async mdToOpml(markdown, _titleOverride = null) {
    if (!this.apiKey) throw new Error('API Key mancante per conversione OPML');
    if (!markdown || markdown.trim().length < 3) throw new Error('Markdown non valido');

    // Titolo = H1 del Markdown ESATTO (come Markmap)
    const h1 = this.extractH1(markdown);
    const exactTitle = h1 || 'Mappa Mentale';

    // Prompt: no fence, un solo prolog, niente outline del titolo nel body, testo identico
    const system = `
Agisci come convertitore Markdown → OPML (v2.0) compatibile con MindMeister e XMind.

REGOLE FERREE:
- Output solo XML OPML in UTF-8, senza blocchi di codice e senza testo extra.
- Un solo prolog: <?xml version="1.0" encoding="UTF-8"?>
- <head><title> = H1 del Markdown ESATTO (non usare &apos;: mantieni l'apostrofo ').
- Nel <body> NON aggiungere un <outline text="titolo">: i nodi di primo livello sono i ## del Markdown, con position alternata left/right.
- Livelli successivi (###, ####, …) come outline annidati, senza position.
- Mantieni i testi IDENTICI al Markdown (emoji, punteggiatura, label: descrizione, maiuscole/minuscole) e l’ordine originale.
`.trim();

    const user = `
Titolo da usare in <head><title> (ESATTO come H1):
${exactTitle}

Markdown:
---
${markdown}
---

Genera l'OPML 2.0 corrispondente (niente code fence, niente testo extra).
`.trim();

    // Call API (deterministica)
    const rsp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!rsp.ok) {
      const errText = await rsp.text();
      throw new Error(`OpenAI error ${rsp.status}: ${errText}`);
    }

    const data = await rsp.json();
    let opml = data?.choices?.[0]?.message?.content || '';
    if (!opml || !opml.includes('<opml')) {
      throw new Error('Risposta API non valida: OPML mancante');
    }

    // Normalizzazione finale: title ESATTO e niente root duplicato
    opml = this.fullNormalize(opml, exactTitle);

    // Fallback: se body vuoto, ricostruisci dai ## ### #### del Markdown
    if (/<body>\s*<\/body>/i.test(opml)) {
      const nodes = this.buildTreeFromMarkdown(markdown);
      const bodyInner = this.renderOpmlBody(nodes);
      opml = opml.replace(/<body>\s*<\/body>/i, `<body>\n${bodyInner}\n</body>`);
    }

    return opml;
  }

  /* =========================
     Fallback parser/render minimal
  ========================== */

  // Costruisce un albero minimale da ##/###/#### e liste
  buildTreeFromMarkdown(md = '') {
    const lines = String(md).split('\n');
    const root = { level: 0, children: [] };
    const stack = [root];

    const push = (level, text) => {
      const node = { level, text: text.trim(), children: [] };
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    };

    for (const line of lines) {
      const h2 = line.match(/^\s*##\s+(.+)/);
      const h3 = line.match(/^\s*###\s+(.+)/);
      const h4 = line.match(/^\s*####\s+(.+)/);
      const li = line.match(/^\s*[-*+]\s+(.+)/);

      if (h2) push(2, h2[1]);
      else if (h3) push(3, h3[1]);
      else if (h4) push(4, h4[1]);
      else if (li) {
        // attacca la foglia al livello corrente
        if (stack.length) {
          stack[stack.length - 1].children.push({ level: stack[stack.length - 1].level + 1, text: li[1].trim(), children: [] });
        }
      }
    }

    // Se non ci sono H2, usa il livello minimo trovato
    let top = root.children.filter(n => n.level === 2);
    if (top.length === 0 && root.children.length > 0) {
      const minLevel = Math.min(...root.children.map(n => n.level));
      top = root.children.filter(n => n.level === minLevel);
    }
    return top;
  }

  // Render OPML del body con alternanza position ai top-level
  renderOpmlBody(topLevelNodes = []) {
    let side = 'left';
    const render = (node, isTop = false) => {
      const posAttr = isTop ? ` position="${(side = side === 'left' ? 'right' : 'left')}"` : '';
      const textAttr = this.xmlAttrEscape(node.text);
      const kids = (node.children || []).map(k => render(k, false)).join('\n');
      return node.children?.length
        ? `<outline text="${textAttr}"${posAttr}>\n${kids}\n</outline>`
        : `<outline text="${textAttr}"${isTop ? posAttr : ''}/>`;
    };
    return topLevelNodes.map(n => render(n, true)).join('\n');
  }
}

export default OpmlService;
