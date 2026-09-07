/** Lectura en voz alta de la ficha, con la voz del sistema. */

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * En iOS las voces llegan de forma asíncrona y la lista sale vacía en el primer
 * intento, así que se refresca cuando el navegador avisa.
 */
let voices: SpeechSynthesisVoice[] = [];
function refreshVoices() {
  if (!speechSupported) return;
  voices = window.speechSynthesis.getVoices();
}
if (speechSupported) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) refreshVoices();
  const prefix = lang.slice(0, 2).toLowerCase();
  const exact = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase());
  if (exact) return exact;
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!sameLang.length) return null;
  // Las voces locales suenan antes y no necesitan red.
  return sameLang.find((v) => v.localService) ?? sameLang[0];
}

const FULL_LANG: Record<string, string> = { es: 'es-ES', en: 'en-GB' };

export function speak(text: string, lang: string, onEnd: () => void) {
  if (!speechSupported) return;
  stopSpeaking();

  const target = FULL_LANG[lang.slice(0, 2)] ?? lang;
  // Trozos cortos: Safari corta las locuciones largas de golpe.
  const chunks = splitForSpeech(text);
  let index = 0;

  const next = () => {
    if (index >= chunks.length) {
      onEnd();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index++]);
    utterance.lang = target;
    const voice = pickVoice(target);
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = next;
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  };

  next();
}

export function stopSpeaking() {
  if (!speechSupported) return;
  window.speechSynthesis.cancel();
}

function splitForSpeech(text: string, max = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > max && current) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
