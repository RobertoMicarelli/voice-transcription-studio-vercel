# Voice Transcription Studio Vercel

Versione ottimizzata per Vercel del Voice Transcription Studio - App completa per trascrizione vocale automatica e generazione di mappe mentali con intelligenza artificiale.

## 🚀 Caratteristiche

- **Registrazione Audio**: Registrazione vocale in tempo reale
- **Trascrizione AI**: Trascrizione automatica con OpenAI Whisper
- **Mappe Mentali**: Generazione automatica di mappe mentali
- **Interfaccia Moderna**: Design responsive e intuitivo
- **Storage Locale**: Salvataggio automatico delle registrazioni
- **Esportazione**: Download in vari formati (TXT, OPML, PNG)

## 🛠️ Tecnologie

- React 18
- Lucide React (icone)
- IndexedDB (storage locale)
- OpenAI API
- Tailwind CSS

## 📦 Installazione

```bash
npm install
```

## 🏃‍♂️ Sviluppo Locale

```bash
npm start
```

## 🏗️ Build per Produzione

```bash
npm run build
```

## 🌐 Deploy su Vercel

Questo progetto è configurato per il deploy automatico su Vercel:

1. **Connettere il repository** a Vercel
2. **Deploy automatico** ad ogni push su main
3. **HTTPS automatico** per l'accesso al microfono
4. **Edge Network** per performance ottimali

## 🔧 Configurazione

### Variabili d'Ambiente

Crea un file `.env.local` con:

```env
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

### API Key OpenAI

L'app richiede una chiave API di OpenAI per:
- Trascrizione audio (Whisper)
- Generazione mappe mentali (GPT)

## 📱 Funzionalità

### Registrazione
- Clicca su 🎤 per iniziare la registrazione
- Clicca su ⏹️ per fermare
- Visualizzazione tempo di registrazione

### Trascrizione
- Trascrizione automatica con Whisper
- Editor di testo per modifiche
- Salvataggio automatico

### Mappe Mentali
- Generazione automatica da trascrizione
- Visualizzazione interattiva
- Esportazione in OPML

### Storage
- Salvataggio automatico in IndexedDB
- Gestione locale delle registrazioni
- Backup e ripristino

## 🎨 Interfaccia

- **Design Responsive**: Ottimizzato per desktop e mobile
- **Tema Scuro/Chiaro**: Adattamento automatico
- **Accessibilità**: Supporto per screen reader
- **Performance**: Caricamento ottimizzato

## 🔒 Sicurezza

- **HTTPS Richiesto**: Per accesso al microfono
- **Storage Locale**: Dati salvati solo sul dispositivo
- **API Key Sicura**: Gestione sicura delle chiavi API

## 📊 Performance

- **Build Ottimizzato**: Bundle ridotto e compresso
- **Lazy Loading**: Caricamento on-demand
- **Caching**: Cache intelligente per risorse statiche
- **CDN**: Distribuzione globale con Vercel Edge

## 🐛 Troubleshooting

### Schermo Bianco
- Verifica che HTTPS sia abilitato
- Controlla i permessi del microfono
- Verifica la console per errori JavaScript

### Registrazione Non Funziona
- Controlla i permessi del browser
- Verifica che il microfono sia connesso
- Prova a ricaricare la pagina

### Trascrizione Fallisce
- Verifica la chiave API OpenAI
- Controlla la connessione internet
- Verifica che l'audio sia registrato correttamente

## 📄 Licenza

Questo progetto è open source e disponibile sotto licenza MIT.

## 🤝 Contributi

I contributi sono benvenuti! Per favore:

1. Fork il progetto
2. Crea un branch per la feature
3. Committa le modifiche
4. Push al branch
5. Apri una Pull Request

## 📞 Supporto

Per supporto o domande:
- Apri una issue su GitHub
- Contatta il team di sviluppo

---

**Versione**: 1.0.0  
**Ultimo Aggiornamento**: Gennaio 2025  
**Piattaforma**: Vercel