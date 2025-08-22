// src/App.js - SISTEMA IFRAME FULLSCREEN + SCREENSHOT (auto-download) + cleanup menu
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, FileText, Map, Download, Mail, Volume2, Loader, Calendar, Clock, MessageSquare, Settings, Camera } from 'lucide-react';
import { AudioService } from './services/audioService';
import { TranscriptionService } from './services/transcriptionService';
import { MindmapService } from './services/mindmapService';
import { StorageService } from './utils/storage';
import { OpmlService } from './services/OpmlService';
import './App.css';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState(null);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMindmapModal, setShowMindmapModal] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [currentMindmap, setCurrentMindmap] = useState(null);
  const [isCreatingPng, setIsCreatingPng] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  
  // Servizi
  const audioService = useRef(new AudioService());
  const transcriptionService = useRef(new TranscriptionService());
  const mindmapService = useRef(new MindmapService());
  const storageService = useRef(new StorageService());
const opmlService = useRef(new OpmlService());   // ⬅️ aggiungi questa riga
  const mapTitle = 'Voice Transcription Studio';
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const initApp = async () => {
      try {
        await storageService.current.initDB();
        const savedRecordings = await storageService.current.getAllRecordings();
        const updatedRecordings = savedRecordings.map(recording => ({
          ...recording,
          rawTranscript: recording.rawTranscript || recording.transcript
        }));
        setRecordings(updatedRecordings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      } catch (error) {
        console.error('Errore inizializzazione:', error);
        setRecordings([]);
      }
      const savedEmail = storageService.current.getFromLocalStorage('userEmail');
      const savedApiKey = storageService.current.getFromLocalStorage('apiKey');
      if (savedEmail) setUserEmail(savedEmail);
      if (savedApiKey) {
          setApiKey(savedApiKey);
          transcriptionService.current = new TranscriptionService(savedApiKey);
  // ⬇️ proteggi sempre la call con l'optional chaining
          opmlService.current?.setApiKey(savedApiKey);
          console.log('🔑 API Key caricata:', savedApiKey.substring(0, 10) + '...');
       }
      
    };
    initApp();
  }, []);

  useEffect(() => {
    if (isRecording && intervalRef.current === null) {
      intervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else if (!isRecording && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      await audioService.current.startRecording();
      setIsRecording(true);
      setRecordingTime(0);
      console.log('🎤 Registrazione iniziata');
    } catch (error) {
      alert('Errore nell\'accesso al microfono: ' + error.message);
    }
  };

  const stopRecording = async () => {
    try {
      const audioBlob = await audioService.current.stopRecording();
      setIsRecording(false);
      console.log('🛑 Registrazione fermata, dimensione file:', audioBlob?.size, 'bytes');
      if (audioBlob) await processRecording(audioBlob);
    } catch (error) {
      console.error('Errore stop registrazione:', error);
      setIsRecording(false);
    }
  };

  const processRecording = async (audioBlob) => {
    console.log('🔄 Iniziando processamento registrazione...');
    console.log('🔑 API Key presente:', apiKey ? 'SI' : 'NO');
    
    if (!apiKey) {
      alert('⚠️ API Key OpenAI richiesta!\n\nPer usare la trascrizione automatica, inserisci la tua API Key OpenAI nelle Impostazioni.\n\nOttienila su: platform.openai.com/api-keys');
      setShowSettingsModal(true);
      return;
    }
    if (!apiKey.startsWith('sk-')) {
      alert('⚠️ API Key non valida!\n\nL\'API Key deve iniziare con "sk-"');
      setShowSettingsModal(true);
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Inizializzando servizi...');
    
    try {
      transcriptionService.current = new TranscriptionService(apiKey);
      setProcessingStep('🎤 Trascrizione audio in corso...');
      console.log('1️⃣ STEP 1: Trascrizione');
      const transcriptionResult = await transcriptionService.current.transcribeAudio(audioBlob);
      
      setProcessingStep('🏷️ Generazione caption...');
      console.log('2️⃣ STEP 2: Caption');
      const caption = await transcriptionService.current.generateCaption(transcriptionResult.structured);

      setProcessingStep('🗺️ Generazione mappa mentale HTML...');
      console.log('3️⃣ STEP 3: Mappa mentale HTML');
      const mindmap = await mindmapService.current.generateMindmap(transcriptionResult.structured);
      
      const newRecording = {
        id: Date.now(),
        title: `Registrazione ${new Date().toLocaleDateString('it-IT')}`,
        caption: caption || "Registrazione processata con AI",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        duration: formatTime(recordingTime),
        timestamp: Date.now(),
        rawTranscript: transcriptionResult.raw,
        transcript: transcriptionResult.structured,
        mindmapHtml: mindmap.html,
        mindmapSvg: null,
        mindmapPng: null
      };
      
      setProcessingStep('💾 Salvataggio...');
      try {
        await storageService.current.saveRecording(newRecording);
        await storageService.current.saveAudioFile(newRecording.id, audioBlob);
      } catch (error) {
        console.log('Storage database non disponibile, usando fallback locale');
      }
      
      setRecordings(prev => [newRecording, ...prev]);
      alert('✅ Registrazione elaborata con successo!\n\n🎤 Trascrizione completata\n🗺️ Mappa mentale HTML generata\n💾 File salvati');
    } catch (error) {
      console.error('❌ Errore durante processamento:', error);
      let errorMessage = '❌ Errore durante l\'elaborazione:\n\n';
      if (error.message.includes('API key')) {
        errorMessage += '🔑 Problema con API Key:\n' + error.message;
      } else if (error.message.includes('quota')) {
        errorMessage += '💳 Quota API esaurita:\n' + error.message;
      } else if (error.message.includes('Whisper')) {
        errorMessage += '🎤 Errore trascrizione audio:\n' + error.message;
      } else if (error.message.includes('GPT')) {
        errorMessage += '🧠 Errore strutturazione testo:\n' + error.message;
      } else {
        errorMessage += '📞 Errore generico:\n' + error.message + '\n\nApri la Console del browser (F12) per dettagli.';
      }
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setRecordingTime(0);
    }
  };

  const playAudio = async (recording) => {
    try {
      let audioBlob = null;
      try {
        audioBlob = await storageService.current.getAudioFile(recording.id);
      } catch (error) {
        console.log('Audio non trovato in storage');
      }
      if (audioBlob) {
        if (playingRecordingId === recording.id && isPlaying) { stopAudio(); return; }
        stopAudio();
        const audioUrl = URL.createObjectURL(audioBlob);
        setCurrentAudio(audioUrl);
        setIsPlaying(true);
        setPlayingRecordingId(recording.id);
      } else {
        alert('File audio non disponibile per questa registrazione');
      }
    } catch (error) {
      console.error('Errore riproduzione audio:', error);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setCurrentAudio(null);
    setIsPlaying(false);
    setPlayingRecordingId(null);
  };

  const deleteRecording = async (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questa registrazione?')) {
      try {
        await storageService.current.deleteRecording(id);
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (selectedRecording?.id === id) setSelectedRecording(null);
      } catch (error) {
        console.error('Errore eliminazione:', error);
        setRecordings(prev => prev.filter(r => r.id !== id));
        if (selectedRecording?.id === id) setSelectedRecording(null);
      }
    }
  };

  const downloadFile = (content, filename, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadImage = (dataUrl, filename) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Visualizza mappa in iframe fullscreen (rimane SOLO nella lista principale)
const viewMindmap = (recording) => {
    if (!recording.mindmapHtml) {
      alert('🗺️ Mappa mentale non disponibile.');
      return;
    }
    setCurrentMindmap(recording);
    setShowMindmapModal(true);
  };
  
  // Crea PNG (auto-download) dalla mappa
  const createPngFromMindmap = async (recording) => {
    if (!recording.mindmapHtml) {
      alert('🗺️ Mappa mentale non disponibile per creare PNG.');
      return;
    }

    setIsCreatingPng(true);
    console.log('📸 Creando PNG da mappa mentale...');

    try {
      const pngDataUrl = await mindmapService.current.generatePngFromHtml(
        recording.mindmapHtml, 
        recording.title
      );

      if (pngDataUrl) {
        const updatedRecording = { ...recording, mindmapPng: pngDataUrl };
        try { await storageService.current.saveRecording(updatedRecording); } catch (_) {}
        setRecordings(prev => prev.map(r => (r.id === recording.id ? updatedRecording : r)));
        if (selectedRecording?.id === recording.id) setSelectedRecording(updatedRecording);

        // ⬇️ Auto-download immediato
        downloadImage(pngDataUrl, `${recording.title}_mindmap.png`);
        alert('✅ PNG creato e scaricato.');
      } else {
        alert('❌ Errore durante la creazione del PNG.\n\nProva di nuovo o usa il download SVG nella vista mappa.');
      }
    } catch (error) {
      console.error('❌ Errore creazione PNG:', error);
      alert('❌ Errore durante la creazione del PNG:\n' + error.message);
    } finally {
      setIsCreatingPng(false);
    }
  };
  
 const convertMdToOpml = async (recording) => {
  if (!apiKey) { setShowSettingsModal(true); return; }
  if (!recording?.transcript) { alert('⚠️ Nessun markdown disponibile.'); return; }

  try {
    const title = recording.title || 'Mappa';
    const md = recording.transcript;
    const xml = await opmlService.current.mdToOpml(md, title);

    // opzionale: persist
    const updated = { ...recording, mindmapOpml: xml };
    try { await storageService.current.saveRecording(updated); } catch (_) {}
    setRecordings(prev => prev.map(r => (r.id === recording.id ? updated : r)));
    if (selectedRecording?.id === recording.id) setSelectedRecording(updated);

    downloadFile(xml, `${title}.opml`, 'text/xml;charset=utf-8');
    alert('✅ OPML generato e scaricato.');
  } catch (e) {
    console.error('OPML error:', e);
    alert('❌ Errore generazione OPML: ' + e.message);
  }
};



  const sendEmail = (recording) => {
    if (!userEmail) { setShowEmailModal(true); return; }
    const subject = encodeURIComponent(`Registrazione: ${recording.title}`);
    const body = encodeURIComponent(`
Ciao,

In allegato trovi i file della registrazione "${recording.title}" del ${recording.date} alle ${recording.time}.

Durata: ${recording.duration}
Contenuto: ${recording.caption}

Cordiali saluti
    `);
    window.location.href = `mailto:${userEmail}?subject=${subject}&body=${body}`;
  };

  const saveSettings = () => {
    console.log('💾 Salvando impostazioni...');
    console.log('🔑 API Key da salvare:', apiKey ? apiKey.substring(0, 10) + '...' : 'VUOTA');
    if (apiKey && !apiKey.startsWith('sk-')) {
      alert('⚠️ API Key OpenAI non valida!\n\nDeve iniziare con "sk-"');
      return;
    }
    storageService.current.saveToLocalStorage('userEmail', userEmail);
    storageService.current.saveToLocalStorage('apiKey', apiKey);
    
    transcriptionService.current = new TranscriptionService(apiKey);
    
    opmlService.current?.setApiKey(apiKey);

    setShowSettingsModal(false);
    if (apiKey) alert('✅ Impostazioni salvate!\n\nOra puoi usare la trascrizione automatica con OpenAI.');
    else alert('⚠️ Impostazioni salvate senza API Key.\n\nInserisci una API Key per usare la trascrizione automatica.');
  };

  // Vista Dettagliata (menu ripulito)
 const DetailView = ({ recording }) => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* header e info invariati */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{recording.title}</h2>
          <button onClick={() => setSelectedRecording(null)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        {/* cards info invariati */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Data</p>
            <p className="font-semibold">{recording.date}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Clock className="w-6 h-6 mx-auto mb-2 text-green-600" />
            <p className="text-sm text-gray-600">Ora</p>
            <p className="font-semibold">{recording.time}</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Volume2 className="w-6 h-6 mx-auto mb-2 text-purple-600" />
            <p className="text-sm text-gray-600">Durata</p>
            <p className="font-semibold">{recording.duration}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
            <p className="text-sm text-gray-600">Caption</p>
            <p className="font-semibold text-xs">{recording.caption.substring(0, 20)}...</p>
          </div>
        </div>

        {/* SOLO le azioni che restano: Raw / Markdown / HTML / Email / Elimina */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Raw */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold flex items-center mb-3"><FileText className="w-4 h-4 mr-2" />Trascrizione Raw</h3>
            <button
              onClick={() => downloadFile(recording.rawTranscript || recording.transcript, `${recording.title}_trascrizione_completa.txt`, 'text/plain')}
              className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" /> Scarica Completa
            </button>
          </div>

          {/* Markdown */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold flex items-center mb-3"><FileText className="w-4 h-4 mr-2" />Markdown</h3>
            <button
              onClick={() => downloadFile(recording.transcript, `${recording.title}_markdown.md`)}
              className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" /> Download MD
            </button>
          </div>
{/* OPML (XMind) */}
<div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-lg p-4 text-white">
  <h3 className="font-semibold flex items-center mb-3">
    <Map className="w-4 h-4 mr-2" /> OPML (XMind)
  </h3>
  <button
    onClick={() => convertMdToOpml(recording)}
    className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center justify-center"
  >
    <Download className="w-5 h-5 mr-2" /> Genera OPML
  </button>
</div>

          {/* HTML mappa */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold flex items-center mb-3"><Map className="w-4 h-4 mr-2" />Mappa HTML</h3>
            <button
              onClick={() => downloadFile(recording.mindmapHtml, `${recording.title}_mindmap.html`, 'text/html')}
              disabled={!recording.mindmapHtml}
              className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 rounded-lg p-3 flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" /> Download HTML
            </button>
          </div>

          {/* Email */}
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold flex items-center mb-3"><Mail className="w-4 h-4 mr-2" />Invia Email</h3>
            <button onClick={() => sendEmail(recording)} className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center justify-center">
              <Mail className="w-5 h-5 mr-2" /> Invia
            </button>
          </div>

          {/* Delete */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-4 text-white">
            <h3 className="font-semibold flex items-center mb-3"><Trash2 className="w-4 h-4 mr-2" />Elimina</h3>
            <button onClick={() => deleteRecording(recording.id)} className="w-full bg-white/20 hover:bg-white/30 rounded-lg p-3 flex items-center justify-center">
              <Trash2 className="w-5 h-5 mr-2" /> Cancella
            </button>
          </div>
        </div>

        {/* preview raw/markdown invariati */}
        <div className="mt-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3 text-gray-800 flex items-center"><FileText className="w-5 h-5 mr-2 text-emerald-600" />Anteprima Trascrizione Completa (Raw)</h3>
            <div className="bg-white rounded border p-4 max-h-48 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {recording.rawTranscript || recording.transcript}
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-3 text-gray-800 flex items-center"><Map className="w-5 h-5 mr-2 text-green-600" />Anteprima Markdown Strutturato</h3>
            <div className="bg-white rounded border p-4 max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{recording.transcript}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Se è selezionata una registrazione, mostra la vista dettagliata
  if (selectedRecording) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
        <div className="max-w-6xl mx-auto">
          <DetailView recording={selectedRecording} />
        </div>
      </div>
    );
  }

  // Vista principale
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header con pulsante Settings */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
      <div className="flex items-center justify-center mb-4">
  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
    Voice Transcription Studio
  </h1>
  <img
    src={`${process.env.PUBLIC_URL || ''}/logo192.png`}
    alt="Logo"
    className="ml-3"
    style={{ height: '40px', width: 'auto' }}
  />
</div>

            <p className="text-gray-600 text-lg">Registra, trascrivi e crea mappe mentali con AI</p>
            {!apiKey ? (
              <p className="text-red-600 text-sm mt-2 bg-red-50 p-2 rounded">⚠️ Configura API OpenAI nelle Impostazioni per la trascrizione automatica</p>
            ) : (
              <p className="text-green-600 text-sm mt-2 bg-green-50 p-2 rounded">✅ API OpenAI configurata - Ready per trascrizioni automatiche!</p>
            )}
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className={`rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow ${apiKey ? 'bg-green-100' : 'bg-red-100'}`}
          >
            <Settings className={`w-6 h-6 ${apiKey ? 'text-green-600' : 'text-red-600'}`} />
          </button>
        </div>

        {/* Recording Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center">
            <div className="mb-6">
              <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'} shadow-lg mb-4`}>
                {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
              </div>
              {isRecording && <div className="text-2xl font-mono font-bold text-red-600 mb-2">{formatTime(recordingTime)}</div>}
            </div>

            <div className="space-y-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <Mic className="w-5 h-5 mr-2 inline" /> Inizia Registrazione
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <Square className="w-5 h-5 mr-2 inline" /> Ferma Registrazione
                </button>
              )}
            </div>

            {isProcessing && (
              <div className="mt-6 flex flex-col items-center justify-center text-blue-600">
                <Loader className="w-8 h-8 animate-spin mb-3" />
                <span className="text-lg font-semibold">{processingStep}</span>
                <p className="text-sm text-gray-500 mt-1">Le API OpenAI stanno elaborando...</p>
              </div>
            )}
          </div>
        </div>

        {/* Storico Registrazioni */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-600" /> Storico Registrazioni
          </h2>
          
          {recordings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mic className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl">Nessuna registrazione presente</p>
              <p>Inizia una nuova registrazione per vedere lo storico</p>
              {!apiKey && <p className="text-red-500 text-sm mt-4 bg-red-50 p-3 rounded">💡 Ricorda di configurare l'API OpenAI nelle Impostazioni per la trascrizione automatica!</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div key={recording.id} className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">{recording.title}</h3>
                      <p className="text-gray-600 mb-3 leading-relaxed">{recording.caption}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" />{recording.date}</span>
                        <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{recording.time}</span>
                        <span className="flex items-center"><Volume2 className="w-4 h-4 mr-1" />{recording.duration}</span>
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0 md:ml-6 flex space-x-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); playAudio(recording); }}
                        className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                          playingRecordingId === recording.id && isPlaying
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {playingRecordingId === recording.id && isPlaying ? (<><Square className="w-4 h-4 mr-2" />Interrompi</>) : (<><Play className="w-4 h-4 mr-2" />Riproduci</>)}
                      </button>
                      {recording.mindmapHtml && (
                        <button
                          onClick={() => viewMindmap(recording)}
                          className="flex items-center px-4 py-2 rounded-lg font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                        >
                          <Map className="w-4 h-4 mr-2" /> Mappa
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedRecording(recording)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Dettagli →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Mappa Fullscreen (da lista principale) */}
        {showMindmapModal && currentMindmap && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
            <div className="w-full h-full max-w-7xl max-h-full bg-white rounded-lg overflow-hidden relative">
              <button
                onClick={() => setShowMindmapModal(false)}
                className="absolute top-4 right-4 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl"
                style={{ zIndex: 100001 }}
              >
                ×
              </button>
              <iframe
                srcDoc={currentMindmap.mindmapHtml}
                className="w-full h-full border-none"
                title={`Mappa Mentale - ${currentMindmap.title}`}
              />
            </div>
          </div>
        )}

        {/* Modal Impostazioni */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 50 }}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">⚙️ Impostazioni</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">📧 Email predefinita</label>
                  <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="tua-email@example.com" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">🔑 OpenAI API Key</label>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p>🔗 <strong>Ottieni su:</strong> platform.openai.com/api-keys</p>
                    <p>💳 <strong>Costo:</strong> ~$0.06 per registrazione 10 min</p>
                    <p>⚠️ <strong>Formato:</strong> Deve iniziare con "sk-"</p>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button onClick={() => setShowSettingsModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold">Annulla</button>
                <button onClick={saveSettings} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold">Salva</button>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 50 }}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">📧 Inserisci Email</h3>
              <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="tua-email@example.com" className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <div className="flex space-x-3">
                <button onClick={() => setShowEmailModal(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold">Annulla</button>
                <button
                  onClick={() => { setShowEmailModal(false); if (userEmail) sendEmail(selectedRecording); }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player */}
        {currentAudio && (
          <audio
            ref={audioRef}
            src={currentAudio}
            autoPlay
            onEnded={() => { console.log('🎵 Audio terminato'); setIsPlaying(false); setCurrentAudio(null); setPlayingRecordingId(null); }}
            onError={(e) => { console.error('🎵 Errore audio player:', e); setIsPlaying(false); setCurrentAudio(null); setPlayingRecordingId(null); }}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
};

export default App;
