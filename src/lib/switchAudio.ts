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

const SOUND_STORAGE_KEY = 'sunny_switch_sound_enabled';

/** Check if Nintendo Switch UI sounds are enabled (defaults to true) */
export function isSwitchSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SOUND_STORAGE_KEY);
  return stored !== 'false';
}

/** Enable or disable Nintendo Switch UI sounds */
export function setSwitchSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('sunny_sound_setting_changed'));
}

export function playSwitchSound(name: SwitchSoundName, volume = 0.45) {
  if (typeof window === 'undefined') return;
  if (!isSwitchSoundEnabled()) return;

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

