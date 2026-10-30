/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { isSwitchUiEnabled, setSwitchUiEnabled, SWITCH_UI_EVENT } from '@/lib/switchUiMode';

describe('switchUiMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  it('defaults to false (Classic Sunny) when no preference is saved', () => {
    expect(isSwitchUiEnabled()).toBe(false);
  });

  it('enables Switch UI mode and sets body class and fires event', () => {
    let eventFired = false;
    window.addEventListener(SWITCH_UI_EVENT, () => {
      eventFired = true;
    }, { once: true });

    setSwitchUiEnabled(true);
    expect(isSwitchUiEnabled()).toBe(true);
    expect(document.body.classList.contains('switch-theme-active')).toBe(true);
    expect(eventFired).toBe(true);
  });

  it('disables Switch UI mode cleanly', () => {
    setSwitchUiEnabled(true);
    expect(isSwitchUiEnabled()).toBe(true);

    setSwitchUiEnabled(false);
    expect(isSwitchUiEnabled()).toBe(false);
    expect(document.body.classList.contains('switch-theme-active')).toBe(false);
  });
});
