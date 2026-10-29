import { afterEach, describe, expect, it, vi } from 'vitest';
import { callSounds, GameSounds } from './game-sounds';

afterEach(() => vi.unstubAllGlobals());
describe('game sounds', () => {
  it('plays the bundled dice recording, restarts it and stops on mute', () => {
    const { service, speech } = setup();
    const pause = vi.fn();
    const play = vi.fn(() => Promise.resolve());
    const sources: string[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        pause = pause;
        play = play;
        constructor(src: string) {
          sources.push(src);
        }
      },
    );
    service.playDice();
    service.playDice();
    expect(sources).toEqual(Array(2).fill('https://example.com/app/sounds/rolling-dice.mp3'));
    expect(play).toHaveBeenCalledTimes(2);
    service.setEnabled(false);
    service.playDice();
    expect(play).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(2);
    expect(speech.speak).not.toHaveBeenCalled();
  });
  it('handles dice playback rejection without interrupting the game', async () => {
    const { service } = setup();
    vi.stubGlobal(
      'Audio',
      class {
        pause() {}
        play() {
          return Promise.reject(new Error('unavailable'));
        }
      },
    );
    expect(() => service.playDice()).not.toThrow();
    await Promise.resolve();
  });
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
    vi.stubGlobal('Audio', undefined);
    vi.stubGlobal('document', { baseURI: 'https://example.com/app/' });
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
  it('prefers recordings and stops playback when muted', () => {
    const { service, speech } = setup();
    const pause = vi.fn();
    const play = vi.fn(() => Promise.resolve());
    const sources: string[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        pause = pause;
        play = play;
        constructor(src: string) {
          sources.push(src);
        }
      },
    );
    service.play('pon');
    service.play('ankan');
    service.play('doubleRiichi');
    expect(sources).toEqual([
      'https://example.com/app/sounds/ichihime/pon.mp3',
      'https://example.com/app/sounds/ichihime/kan.mp3',
      'https://example.com/app/sounds/ichihime/riichi.mp3',
    ]);
    expect(speech.speak).not.toHaveBeenCalled();
    service.setEnabled(false);
    expect(pause).toHaveBeenCalledTimes(3);
  });
  it('falls back when a recording cannot play, but skips stale rejected playback', async () => {
    const { service, speech } = setup();
    let reject!: (reason: Error) => void;
    vi.stubGlobal(
      'Audio',
      class {
        pause() {}
        play() {
          return new Promise<void>((_, fail) => {
            reject = fail;
          });
        }
      },
    );
    service.play('ron');
    reject(new Error('unsupported'));
    await Promise.resolve();
    expect(speech.speak).toHaveBeenCalledOnce();
    service.play('pon');
    service.setEnabled(false);
    reject(new Error('canceled'));
    await Promise.resolve();
    expect(speech.speak).toHaveBeenCalledOnce();
  });
});
