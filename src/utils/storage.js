// src/utils/storage.js
export class StorageService {
  constructor() {
    this.dbName = 'VoiceTranscriptionDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store per registrazioni
        if (!db.objectStoreNames.contains('recordings')) {
          const recordingStore = db.createObjectStore('recordings', { keyPath: 'id' });
          recordingStore.createIndex('date', 'date', { unique: false });
          recordingStore.createIndex('title', 'title', { unique: false });
        }
        
        // Store per file audio
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'recordingId' });
        }
      };
    });
  }

  async saveRecording(recording) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['recordings'], 'readwrite');
    const store = transaction.objectStore('recordings');
    
    return new Promise((resolve, reject) => {
      const request = store.add(recording);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAudioFile(recordingId, audioBlob) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['audioFiles'], 'readwrite');
    const store = transaction.objectStore('audioFiles');
    
    const audioData = {
      recordingId,
      audioBlob: audioBlob,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(audioData);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllRecordings() {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['recordings'], 'readonly');
    const store = transaction.objectStore('recordings');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAudioFile(recordingId) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['audioFiles'], 'readonly');
    const store = transaction.objectStore('audioFiles');
    
    return new Promise((resolve, reject) => {
      const request = store.get(recordingId);
      request.onsuccess = () => resolve(request.result?.audioBlob);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteRecording(recordingId) {
    if (!this.db) await this.initDB();
    
    const transaction = this.db.transaction(['recordings', 'audioFiles'], 'readwrite');
    const recordingStore = transaction.objectStore('recordings');
    const audioStore = transaction.objectStore('audioFiles');
    
    return Promise.all([
      new Promise((resolve, reject) => {
        const request = recordingStore.delete(recordingId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise((resolve, reject) => {
        const request = audioStore.delete(recordingId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
  }

  // Fallback per localStorage se IndexedDB non disponibile
  saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Errore salvataggio localStorage:', error);
    }
  }

  getFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Errore lettura localStorage:', error);
      return null;
    }
  }
}