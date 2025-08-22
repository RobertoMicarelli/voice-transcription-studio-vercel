// src/services/audioService.js
export class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.mimeType = '';
    this.fileExtension = '';
  }

  // Polyfill minimale per vecchi WebKit (per sicurezza)
  ensureGetUserMedia() {
    if (!navigator.mediaDevices) navigator.mediaDevices = {};
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = (constraints) =>
        new Promise((resolve, reject) => {
          const gUM = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
          if (!gUM) return reject(new Error('getUserMedia non supportato'));
          gUM.call(navigator, constraints, resolve, reject);
        });
    }
  }

  // Scelta del miglior MIME supportato (iOS tende ad accettare AAC/MP4)
  pickBestAudioMime() {
    const candidates = [
      { type: 'audio/webm;codecs=opus', ext: 'webm' },
      { type: 'audio/mp4;codecs=aac',   ext: 'm4a'  },
      { type: 'audio/mp4',              ext: 'm4a'  },
      { type: 'audio/aac',              ext: 'aac'  },
      { type: 'audio/ogg;codecs=opus',  ext: 'ogg'  },
      { type: 'audio/mpeg',             ext: 'mp3'  },
      { type: 'audio/wav',              ext: 'wav'  },
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined'
        && MediaRecorder.isTypeSupported
        && MediaRecorder.isTypeSupported(c.type)) {
        return c;
      }
    }
    return { type: '', ext: 'dat' }; // fallback
  }

  async startRecording() {
    // iOS richiede HTTPS o localhost
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(String(window.location.href));
    if (!window.isSecureContext && !isLocalhost) {
      alert('Per usare il microfono su iPhone/iPad serve HTTPS o localhost.');
      throw new Error('Insecure context: microphone blocked on iOS');
    }

    this.ensureGetUserMedia();

    if (!navigator.mediaDevices?.getUserMedia) {
      alert('getUserMedia non disponibile. Aggiorna iOS/Safari o abilita i permessi del microfono.');
      throw new Error('getUserMedia unavailable');
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.warn('Registrazione già attiva');
      return;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 44100, // advisory; iOS usa tipicamente 44100
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      const picked = this.pickBestAudioMime();
      this.mimeType = picked.type;      // es. "audio/mp4;codecs=aac"
      this.fileExtension = picked.ext;  // es. "m4a"

      try {
        this.mediaRecorder = this.mimeType
          ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
          : new MediaRecorder(this.stream);
      } catch (e) {
        console.warn('MimeType non accettato nel costruttore, riprovo senza:', this.mimeType, e);
        this.mediaRecorder = new MediaRecorder(this.stream);
        this.mimeType = this.mediaRecorder.mimeType || '';
      }

      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onerror = (e) => console.error('MediaRecorder error:', e);
      this.mediaRecorder.onstart = () => {
        console.log('🎙️ Recording started with mimeType:', this.mediaRecorder.mimeType || this.mimeType || '(default)');
      };

      // IMPORTANTE su iOS: start deve avvenire in un gesture handler (tap/click)
      this.mediaRecorder.start();
      console.log('Registrazione avviata');
    } catch (err) {
      console.error('Errore accesso microfono:', err);
      alert(
        'Impossibile accedere al microfono.\n\n' +
        'Checklist iOS:\n' +
        '• Usa HTTPS o localhost\n' +
        '• Concedi il permesso in Impostazioni → Safari → Microfono → Consenti\n' +
        '• Avvia la registrazione con un tap (richiesto da iOS)'
      );
      throw err;
    }
  }

  async stopRecording() {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          const finalType = this.mediaRecorder.mimeType || this.mimeType || 'application/octet-stream';
          const audioBlob = new Blob(this.audioChunks, { type: finalType });
          this.cleanup();
          resolve(audioBlob); // API invariata: ritorna il Blob
        };
        this.mediaRecorder.stop();
      } else {
        resolve(null);
      }
    });
  }

  cleanup() {
    if (this.stream) {
      try { this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    // this.mimeType / this.fileExtension: utili per naming file a valle
  }

  // Manteniamo la firma; niente variabili inutilizzate per ESLint
  async convertToWav(audioBlob) {
    // TODO: se vuoi una conversione reale a WAV, implementa qui.
    // Per ora restituiamo il blob originale (evita variabili unused).
    return audioBlob;
  }
}

export default AudioService;
