// src/services/transcriptionService.js - ERRORE JSON RISOLTO
export class TranscriptionService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.REACT_APP_OPENAI_API_KEY;
    console.log('🔑 TranscriptionService inizializzato con API key:', this.apiKey ? 'SI (lunghezza: ' + this.apiKey.length + ')' : 'NO');
  }

  async transcribeAudio(audioBlob) {
    console.log('🎤 Iniziando trascrizione con API key:', this.apiKey ? 'PRESENTE' : 'MANCANTE');
    
    if (!this.apiKey) {
      throw new Error('❌ API Key OpenAI richiesta. Configurala nelle Impostazioni.');
    }

    if (!this.apiKey.startsWith('sk-')) {
      throw new Error('❌ API Key non valida. Deve iniziare con "sk-"');
    }

    try {
      console.log('📡 Chiamando Whisper API...');
      
      // STEP 1: Trascrizione RAW con Whisper
      const rawTranscript = await this.whisperTranscription(audioBlob);
      console.log('✅ Whisper RAW completato, lunghezza:', rawTranscript.length);
      console.log('📝 Testo RAW ricevuto:', rawTranscript.substring(0, 100) + '...');
      
      // STEP 2: Strutturazione con GPT-3.5
      console.log('🧠 Strutturando con GPT...');
      const structuredMarkdown = await this.structureWithGPT(rawTranscript);
      console.log('✅ GPT completato, markdown generato');
      
      // Restituisci ENTRAMBI i formati
      return {
        raw: rawTranscript,
        structured: structuredMarkdown
      };
    } catch (error) {
      console.error('❌ ERRORE trascrizione:', error);
      throw new Error(`Errore trascrizione: ${error.message}`);
    }
  }

  async whisperTranscription(audioBlob) {
    console.log('🎵 Preparando file audio per Whisper, dimensione:', audioBlob.size, 'bytes');
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'it');
    formData.append('response_format', 'text'); // ← Questo restituisce testo puro, non JSON!
    formData.append('temperature', '0');
    
    // Prompt ottimizzato
    formData.append('prompt', `
Trascrivi questo audio in italiano con massima precisione. 
Mantieni punteggiatura corretta e frasi complete.
Identifica argomenti, punti chiave e decisioni.
Organizza logicamente il contenuto per una mappa mentale.
    `);

    console.log('📡 Inviando richiesta a Whisper API...');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData
    });

    console.log('📨 Risposta Whisper status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore Whisper:', response.status, errorText);
      throw new Error(`Whisper API Error ${response.status}: ${errorText}`);
    }

    // 🔧 CORREZIONE: Con response_format='text', la risposta È GIÀ il testo trascritto!
    const transcript = await response.text(); // ← .text() invece di .json()!
    
    console.log('✅ Trascrizione Whisper ricevuta:', transcript.substring(0, 100) + '...');
    
    if (!transcript || transcript.length < 10) {
      throw new Error('Trascrizione troppo breve o vuota');
    }

    return transcript;
  }

  async structureWithGPT(rawText) {
    console.log('🧠 Strutturando testo con GPT, lunghezza input:', rawText.length);
    
    const messages = [{
      role: 'system',
      content: `Sei un esperto di organizzazione contenuti e mappe mentali. 
Trasforma la trascrizione in markdown strutturato PERFETTO per markmap.js.org.

REGOLE FONDAMENTALI:
1. Usa # per il titolo principale (max 1, riassuntivo del contenuto)
2. Usa ## per argomenti principali (3-8 sezioni logiche)
3. Usa ### per sotto-argomenti se necessario
4. Usa - per elenchi puntati
5. Usa **testo** per evidenziare concetti chiave
6. Mantieni gerarchie logiche e bilanciate
7. Evita sezioni vuote o troppo profonde (max 4 livelli)
8. Ogni sezione deve avere contenuto sostanzioso

ESEMPIO STRUTTURA:
# Titolo Principale del Contenuto
## Argomento 1
- Punto chiave 1
- Punto chiave 2
### Sotto-argomento
- Dettaglio importante
## Argomento 2
- Altro punto chiave

OBIETTIVO: Mappa mentale chiara, bilanciata e professionale dal contenuto reale.`
    }, {
      role: 'user',
      content: `Struttura questa trascrizione REALE in markdown perfetto per mappa mentale:\n\n${rawText}`
    }];

    console.log('📡 Inviando a GPT-3.5...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.3,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      })
    });

    console.log('📨 Risposta GPT status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Errore GPT:', response.status, errorText);
      throw new Error(`GPT API Error ${response.status}: ${errorText}`);
    }

    const gptData = await response.json(); // ← GPT restituisce JSON, quindi .json() è corretto
    const structuredContent = gptData.choices[0]?.message?.content;

    if (!structuredContent) {
      throw new Error('Nessun contenuto ricevuto da GPT');
    }

    console.log('✅ Markdown strutturato ricevuto:', structuredContent.substring(0, 100) + '...');

    return this.cleanMarkdown(structuredContent);
  }

  cleanMarkdown(markdown) {
    console.log('🧹 Pulendo markdown...');
    
    let cleaned = markdown.trim();
    
    // Assicura titolo principale
    if (!cleaned.startsWith('# ')) {
      const lines = cleaned.split('\n');
      const firstLine = lines[0].replace(/^#+\s*/, '');
      cleaned = `# ${firstLine}\n\n${lines.slice(1).join('\n')}`;
    }

    // Rimuovi sezioni vuote e pulisci
    cleaned = cleaned
      .replace(/#+\s*\n+/g, '') // Rimuovi intestazioni vuote
      .replace(/\n{3,}/g, '\n\n') // Max 2 righe vuote
      .replace(/#{5,}/g, '####') // Max 4 livelli
      .trim();
    
    console.log('✅ Markdown pulito, lunghezza finale:', cleaned.length);
    return cleaned;
  }

  async generateCaption(transcript) {
    console.log('🏷️ Generando caption dal markdown...');
    
    // Estrai keywords dal markdown per caption
    const lines = transcript.split('\n');
    const title = lines.find(line => line.startsWith('# '))?.replace('# ', '') || 'Registrazione';
    const sections = lines.filter(line => line.startsWith('## ')).map(line => line.replace('## ', ''));
    
    let caption;
    if (sections.length > 0) {
      caption = sections.slice(0, 4).join(', ').toLowerCase();
    } else {
      // Se non ci sono sezioni markdown, usa keywords dal testo
      const words = transcript.toLowerCase().split(/\s+/);
      const commonWords = new Set(['il', 'la', 'di', 'che', 'e', 'a', 'un', 'per', 'in', 'con', 'su', 'da', 'del', 'dei', 'delle']);
      const keywords = words
        .filter(word => word.length > 3 && !commonWords.has(word))
        .slice(0, 5);
      caption = keywords.join(', ') || title.toLowerCase();
    }
    
    console.log('✅ Caption generata:', caption);
    return caption;
  }
}