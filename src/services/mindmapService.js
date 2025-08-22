// src/services/mindmapService.js
export class MindmapService {
  constructor() {
    console.log('🗺️ MindmapService inizializzato');
  }

  async generateMindmap(structuredTranscript) {
    if (!structuredTranscript || structuredTranscript.length < 10) {
      throw new Error('Trascrizione non valida per generare mappa mentale');
    }
    const markdownContent = this.generateMarkdownFromTranscript(structuredTranscript);
    const html = this.generateFullHTML(markdownContent);
    return { html, markdown: markdownContent };
  }

  generateMarkdownFromTranscript(transcript) {
    if (transcript.includes('#')) {
      if (!transcript.trim().startsWith('#')) return `# 🎙️ Trascrizione Audio\n\n${transcript}`;
      return transcript;
    }
    const paragraphs = transcript.split(/\n\n+/).filter(p => p.trim());
    if (paragraphs.length === 0) paragraphs.push(transcript);

    let markdown = '# 🎙️ Trascrizione Audio\n\n';
    let sectionCount = 0;
    let currentSection = '';

    for (const paragraph of paragraphs) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      if (paragraph.length < 100 && !paragraph.includes('.')) {
        sectionCount++;
        currentSection = paragraph.trim();
        markdown += `## ${sectionCount}. ${currentSection}\n\n`;
      } else {
        if (!currentSection) {
          sectionCount++;
          currentSection = `Sezione ${sectionCount}`;
          markdown += `## ${currentSection}\n\n`;
        }
        for (const s of sentences) {
          const t = s.trim();
          if (t.length > 10) {
            if (t.length < 150) markdown += `- ${t}\n`;
            else {
              const chunks = this.splitIntoChunks(t, 100);
              markdown += `### 📌 Punto Chiave\n`;
              chunks.forEach(c => (markdown += `- ${c}\n`));
            }
          }
        }
        markdown += '\n';
      }
    }
    if (markdown.length < 500 && transcript.length > 100) return this.enhanceMarkdown(transcript);
    return markdown;
  }

  splitIntoChunks(text, maxLength) {
    const words = text.split(' ');
    const chunks = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).length > maxLength && cur) {
        chunks.push(cur.trim());
        cur = w;
      } else cur += (cur ? ' ' : '') + w;
    }
    if (cur) chunks.push(cur.trim());
    return chunks;
  }

  enhanceMarkdown(transcript) {
    const words = transcript.split(/\s+/);
    let md = '# 🎙️ Registrazione Audio\n\n';
    md += '## 📊 Riepilogo\n\n';
    md += `- **Lunghezza**: ${words.length} parole\n`;
    md += `- **Caratteri**: ${transcript.length}\n`;
    md += `- **Data**: ${new Date().toLocaleDateString('it-IT')}\n\n`;
    md += '## 📝 Contenuto Completo\n\n';

    const per = 50;
    let part = 1;
    for (let i = 0; i < words.length; i += per) {
      md += `### Parte ${part}\n- ${words.slice(i, i + per).join(' ')}\n\n`;
      part++;
    }
    md += '## 🔍 Analisi\n\n';
    const keywords = [...new Set(words.filter(w => w.length > 6))].slice(0, 10);
    if (keywords.length) {
      md += '### Parole Chiave\n';
      keywords.forEach(k => (md += `- ${k}\n`));
    }
    return md;
  }

  // src/services/mindmapService.js
generateFullHTML(markdownContent) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mappa Mentale</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      overflow: hidden;
      height: 100vh;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      background: rgba(255,255,255,.95);
      padding: 14px 18px;
      text-align: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0,0,0,.1);
      z-index: 1;
    }
    .header h1 {
      margin: 0;
      color: #4F46E5;
      font-size: 1.6rem;
      font-weight: 700;
    }
    .mindmap-container {
      flex: 1;
      position: relative;
      background: #fff;
      margin: 0 16px 16px;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,.2);
      overflow: hidden;
    }
    #markmap {
      width: 100%;
      height: 100%;
    }
    #markmap svg {
      width: 100%!important;
      height: 100%!important;
      display: block;
    }
    .controls-left {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      align-items: center;
      z-index: 2;
    }
    .controls-right {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      z-index: 2;
    }
    .btn {
      background: #4F46E5;
      color: #fff;
      border: none;
      padding: 10px 14px;
      border-radius: 999px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 6px 18px rgba(79,70,229,.25);
    }
    .btn:hover {
      filter: brightness(0.95);
      transform: translateY(-1px);
    }
    .logo {
      height: 38px;
      width: auto;
      opacity: .95;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/markmap-autoloader@latest"></script>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🗺️ Mappa Mentale 🗺 Voice Transcription Studio️ 🗺 By Roberto Micarelli🗺</h1></div>
    <div class="mindmap-container">
      <div id="markmap" class="markmap">
        <script type="text/template">
${markdownContent}
        </script>
      </div>

      <div class="controls-left">
        <button class="btn" onclick="downloadSVG()">⬇️ Scarica SVG</button>
      </div>
      <div class="controls-right">
        <img id="brand-logo" class="logo" alt="Logo" />
      </div>
    </div>
  </div>

  <script>
    // Imposta il logo anche in srcDoc
    (function setLogoSrc(){
      try {
        const baseHref = (window.parent && window.parent.location)
          ? window.parent.location.href
          : window.location.href;
        const logoUrl = new URL('logo192.png', baseHref).href;
        document.getElementById('brand-logo').src = logoUrl;
      } catch {
        document.getElementById('brand-logo').src = '/logo192.png';
      }
    })();

    // Fit mappa
    let attempts = 0;
    const maxAttempts = 12;
    function ensureFit() {
      const inst = window.markmap?.getGlobalInstance?.();
      if (inst) {
        setTimeout(()=>inst.fit(), 100);
        setTimeout(()=>inst.fit(), 500);
        setTimeout(()=>inst.fit(), 1000);
        window.mmInstance = inst;
      } else if (++attempts < maxAttempts) {
        setTimeout(ensureFit, 250);
      }
    }
    ensureFit();

    window.addEventListener('resize', () => {
      if (window.mmInstance) setTimeout(()=>window.mmInstance.fit(), 150);
    });

    const obs = new MutationObserver(() => {
      const g = document.querySelector('#markmap svg g');
      if (g && g.children.length) {
        if (window.mmInstance) setTimeout(()=>window.mmInstance.fit(), 120);
        obs.disconnect();
      }
    });
    obs.observe(document.getElementById('markmap'), { childList: true, subtree: true });

    // Download SVG
    function downloadSVG() {
      const svg = document.querySelector('#markmap svg');
      if (!svg) { alert('Mappa non ancora pronta.'); return; }
      if (window.mmInstance) window.mmInstance.fit();

      const rect = svg.getBoundingClientRect();
      const width = Math.max(800, rect.width || svg.clientWidth || 1200);
      const height = Math.max(600, rect.height || svg.clientHeight || 800);

      let data = new XMLSerializer().serializeToString(svg);
      if (!/xmlns=/.test(data)) {
        data = data.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!/viewBox=/.test(data)) {
        data = data.replace(/<svg([^>]*)>/, '<svg$1 viewBox="0 0 ' + width + ' ' + height + '">');
      }

      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mappa-mentale.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    window.downloadSVG = downloadSVG;
  </script>
</body>
</html>`;
}



  // Metodi di supporto (mantenuti per compatibilità)
  async convertSvgToPng(svgContent, width = 1920, height = 1080) {
    console.log('🎨 Conversione SVG→PNG (metodo di supporto)');
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width; 
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const safeSvg = svgContent
          .replace('<svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`)
          .replace(/url\(["']?http[^)"']+["']?\)/g,'none');
          
        const blob = new Blob([safeSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
          ctx.fillStyle = '#fff'; 
          ctx.fillRect(0,0,width,height);
          ctx.drawImage(img,0,0,width,height);
          const png = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(png);
        };
        
        img.onerror = function(){ 
          URL.revokeObjectURL(url); 
          resolve(null); 
        };
        
        img.src = url;
      } catch (e) { 
        resolve(null); 
      }
    });
  }

  async extractAndConvertSvg(htmlContent) {
    console.log('🔸 Estrazione SVG (metodo di supporto)');
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { 
      position:'fixed', 
      width:'1600px', 
      height:'900px', 
      left:'-9999px', 
      top:'-9999px', 
      border:'none' 
    });
    
    document.body.appendChild(iframe);
    iframe.contentDocument.open(); 
    iframe.contentDocument.write(htmlContent); 
    iframe.contentDocument.close();
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const svg = iframe.contentDocument.querySelector('#markmap svg');
          if (!svg) { 
            document.body.removeChild(iframe); 
            resolve(null); 
            return; 
          }
          
          const data = new XMLSerializer().serializeToString(svg);
          const pngDataUrl = await this.convertSvgToPng(data);
          document.body.removeChild(iframe);
          resolve(pngDataUrl);
        } catch { 
          document.body.removeChild(iframe); 
          resolve(null); 
        }
      }, 2500);
    });
  }

  async generatePngFromHtml(htmlContent) {
    const dataUrl = await this.extractAndConvertSvg(htmlContent);
    return dataUrl;
  }
}