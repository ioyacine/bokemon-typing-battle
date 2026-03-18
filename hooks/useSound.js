'use client';
import { useCallback, useRef, useState } from 'react';

/**
 * Web Audio API-based sound effects – no external files needed
 */
export default function useSound() {
  const audioCtxRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback((freq, duration, type = 'square', volume = 0.15) => {
    if (isMuted) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignore audio errors gracefully
    }
  }, [isMuted, getCtx]);

  const playSequence = useCallback((notes, interval = 0.12) => {
    if (isMuted) return;
    try {
      const ctx = getCtx();
      notes.forEach(([freq, dur, type], i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * interval);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * interval);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * interval + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * interval);
        osc.stop(ctx.currentTime + i * interval + dur);
      });
    } catch (e) {}
  }, [isMuted, getCtx]);

  const playClick = useCallback(() => playTone(800, 0.08, 'sine', 0.1), [playTone]);
  
  const playSelect = useCallback(() => {
    playSequence([[600, 0.1, 'sine'], [900, 0.15, 'sine']], 0.08);
  }, [playSequence]);

  const playAttack = useCallback(() => {
    playSequence([
      [200, 0.08, 'sawtooth'],
      [400, 0.08, 'sawtooth'],
      [300, 0.1, 'sawtooth'],
    ], 0.06);
  }, [playSequence]);

  const playHit = useCallback(() => {
    playSequence([
      [150, 0.06, 'square'],
      [100, 0.1, 'square'],
    ], 0.04);
  }, [playSequence]);

  const playSuperEffective = useCallback(() => {
    playSequence([
      [400, 0.1, 'sine'],
      [600, 0.1, 'sine'],
      [800, 0.15, 'sine'],
    ], 0.1);
  }, [playSequence]);

  const playNotEffective = useCallback(() => {
    playSequence([
      [400, 0.15, 'triangle'],
      [300, 0.2, 'triangle'],
    ], 0.12);
  }, [playSequence]);

  const playFaint = useCallback(() => {
    playSequence([
      [500, 0.15, 'sine'],
      [400, 0.15, 'sine'],
      [300, 0.15, 'sine'],
      [200, 0.3, 'sine'],
    ], 0.15);
  }, [playSequence]);

  const playVictory = useCallback(() => {
    playSequence([
      [523, 0.15, 'sine'],
      [659, 0.15, 'sine'],
      [784, 0.15, 'sine'],
      [1047, 0.3, 'sine'],
      [784, 0.1, 'sine'],
      [1047, 0.4, 'sine'],
    ], 0.18);
  }, [playSequence]);

  const playDefeat = useCallback(() => {
    playSequence([
      [400, 0.2, 'sine'],
      [350, 0.2, 'sine'],
      [300, 0.2, 'sine'],
      [250, 0.4, 'sine'],
    ], 0.25);
  }, [playSequence]);

  const playLevelUp = useCallback(() => {
    playSequence([
      [440, 0.08, 'sine'],
      [554, 0.08, 'sine'],
      [659, 0.08, 'sine'],
      [880, 0.2, 'sine'],
    ], 0.1);
  }, [playSequence]);

  const playTypeKey = useCallback(() => {
    playTone(900, 0.03, 'sine', 0.05); // Short, sharp click
  }, [playTone]);

  const playTypeError = useCallback(() => {
    playSequence([
      [150, 0.1, 'sawtooth'],
      [100, 0.2, 'square'],
    ], 0.1);
  }, [playSequence]);

  const playTypeSuccess = useCallback(() => {
    playSequence([
      [600, 0.1, 'triangle'],
      [800, 0.15, 'sine'],
      [1000, 0.2, 'sine'],
    ], 0.1);
  }, [playSequence]);

  const playTypeMiss = useCallback(() => {
    playSequence([
      [300, 0.1, 'sine'],
      [200, 0.15, 'sine'],
      [100, 0.3, 'sine'],
    ], 0.15);
  }, [playSequence]);

  const toggleMute = useCallback(() => setIsMuted(m => !m), []);

  return {
    isMuted,
    toggleMute,
    playClick,
    playSelect,
    playAttack,
    playHit,
    playSuperEffective,
    playNotEffective,
    playFaint,
    playVictory,
    playDefeat,
    playLevelUp,
    playTypeKey,
    playTypeError,
    playTypeSuccess,
    playTypeMiss,
  };
}
