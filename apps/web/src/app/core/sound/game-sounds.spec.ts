import { afterEach, describe, expect, it, vi } from 'vitest';
import { callSounds, GameSounds } from './game-sounds';

afterEach(() => vi.unstubAllGlobals());
describe('game sounds', () => {
  function setup(saved: string | null = null) {
    const store = { getItem: vi.fn(() => saved), setItem: vi.fn() };
    const voice = { lang: 'ja-JP', localService: true };
    const speech = { getVoices: vi.fn(() => [voice]), speak: vi.fn(), cancel: vi.fn() };
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('speechSynthesis', speech);
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    vi.stubGlobal('AudioContext', undefined);
    return { service: new GameSounds(), store, speech, voice };
  }
  it('speaks each declaration using a local Japanese voice', () => {
    const { service, speech, voice } = setup();
    for (const call of service.previews) {
      service.play(call);
      expect(speech.speak).toHaveBeenLastCalledWith(
        expect.objectContaining({ text: callSounds[call], lang: 'ja-JP', voice }),
      );
    }
  });
  it('persists mute, cancels speech and skips playback', () => {
    const { service, store, speech } = setup();
    service.setEnabled(false);
    service.play('ron');
    expect(store.setItem).toHaveBeenCalledWith('riichi-sound', 'off');
    expect(speech.cancel).toHaveBeenCalledOnce();
    expect(speech.speak).not.toHaveBeenCalled();
    expect(setup('off').service.enabled()).toBe(false);
  });
  it('does not require speech support, an audio device or available storage', () => {
    const { service, speech } = setup();
    speech.getVoices.mockReturnValue([]);
    expect(() => service.play('pon')).not.toThrow();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => new GameSounds().setEnabled(false)).not.toThrow();
    speech.getVoices.mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(() => service.play('chi')).not.toThrow();
  });
});
