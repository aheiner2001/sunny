// Client-side sound controller for authentic Nintendo Switch UI audio effects

type SwitchSoundName = 'klick' | 'popup' | 'user' | 'news' | 'home';

const SOUND_PATHS: Record<SwitchSoundName, string> = {
  klick: '/sounds/Klick.wav',
  popup: '/sounds/Popup.wav',
  user: '/sounds/User.wav',
  news: '/sounds/News.wav',
  home: '/sounds/Home.wav',
};

const audioCache: Partial<Record<SwitchSoundName, HTMLAudioElement>> = {};

export function playSwitchSound(name: SwitchSoundName, volume = 0.45) {
  if (typeof window === 'undefined') return;

  try {
    let audio = audioCache[name];
    if (!audio) {
      audio = new Audio(SOUND_PATHS[name]);
      audioCache[name] = audio;
    }

    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, volume));
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Ignore autoplay or user-gesture restrictions silently
      });
    }
  } catch {
    // Non-blocking fallback
  }
}
