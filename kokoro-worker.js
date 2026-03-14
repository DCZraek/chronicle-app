// ═══════════════════════════════════════════════════════════════
// THE CHRONICLE — Kokoro Web Worker
// Runs Kokoro TTS entirely off the main thread.
// Hosted as a real file (not a blob URL) to satisfy GitHub Pages CSP.
// ═══════════════════════════════════════════════════════════════

let tts = null;

self.addEventListener('message', async (e) => {
  const { type, id, voice, text, voices } = e.data;

  if (type === 'LOAD') {
    try {
      self.postMessage({ type: 'PROGRESS', text: 'Downloading voice model (~86MB)...' });
      const { KokoroTTS } = await import('https://esm.sh/kokoro-js@1.2.1');
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
      });
      self.postMessage({ type: 'READY' });
    } catch(err) {
      self.postMessage({ type: 'ERROR', text: err.message });
    }
  }

  else if (type === 'GENERATE') {
    try {
      const audio = await tts.generate(text, { voice });
      const wav = audio.toWav ? audio.toWav() : audio;
      self.postMessage({ type: 'AUDIO', id, wav: wav.buffer }, [wav.buffer]);
    } catch(err) {
      self.postMessage({ type: 'GENERATE_ERROR', id, text: err.message });
    }
  }

  else if (type === 'WARM') {
    for (let i = 0; i < voices.length; i++) {
      try {
        await tts.generate('The road ahead is long.', { voice: voices[i].id });
      } catch(e) {}
      self.postMessage({ type: 'WARM_PROGRESS', index: i, total: voices.length, label: voices[i].label });
    }
    self.postMessage({ type: 'WARM_DONE' });
  }
});
