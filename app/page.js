'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import POKEMON_DATA from '../data/pokemon';
import { getEffectiveness } from '../data/typeChart';
import { getTypeColor } from '../utils/typeColors';
import { LEVELS, generateTypingPrompt } from '../data/levels';
import {
  calculateDamage,
  getAIMove,
  calculateScore,
  getStarRating,
  preparePokemonForBattle,
  isTeamDefeated,
  evaluateTypingPerformance
} from '../utils/battleEngine';
import useSound from '../hooks/useSound';

const TYPE_ICONS = {
  fire: '🔥', water: '💧', grass: '🍃', electric: '⚡', ice: '❄️', 
  fighting: '🥊', poison: '☠️', ground: '🏜️', flying: '💨', 
  psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', 
  dark: '🌑', steel: '⚙️', fairy: '✨', normal: '⭐'
};

// ==========================================
// CONFIRMATION DIALOG COMPONENT
// ==========================================
function ConfirmationDialog({ title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', isDangerous = false }) {
  return (
    <div className="confirmationOverlay" style={{ zIndex: 300 }}>
      <div className="confirmationDialog">
        <h2 className="confirmationTitle">{title}</h2>
        <p className="confirmationMessage">{message}</p>
        <div className="confirmationButtons">
          <button 
            className="confirmationBtn cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button 
            className={`confirmationBtn confirm ${isDangerous ? 'dangerous' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const getTypeAnimArgs = (type) => {
  switch (type) {
    case 'fire': return 'burn-flash';
    case 'electric': return 'zap-shake';
    case 'water': case 'ice': return 'splash-wave';
    case 'ghost': case 'dark': case 'poison': return 'stagger-miss'; // generic cool wavy hit
    default: return 'hit';
  }
};

// ==========================================
// COMPETITIVE TYPING RACE OVERLAY
// ==========================================
function CompetitiveRaceOverlay({ target, totalTime, onComplete, sound, aiSimulatedTyping }) {
  const [playerTyped, setPlayerTyped] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(totalTime);
  const [hasError, setHasError] = useState(false);
  const [playerFinished, setPlayerFinished] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (playerFinished) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;
      if (e.key === ' ') e.preventDefault();

      const nextChar = target[playerTyped.length];
      if (e.key === nextChar) {
        sound.playTypeKey();
        const newTyped = playerTyped + e.key;
        setPlayerTyped(newTyped);
        setHasError(false);

        if (newTyped.length === target.length) {
          // Player finished!
          setPlayerFinished(true);
          const elapsedTime = Date.now() - startTimeRef.current;
          sound.playTypeSuccess();
          setTimeout(() => {
            onComplete(newTyped.length, target.length, elapsedTime);
          }, 500);
        }
      } else {
        sound.playTypeError();
        setHasError(true);
        setTimeout(() => setHasError(false), 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerTyped, target, onComplete, sound, playerFinished]);

  useEffect(() => {
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalTime - elapsed);
      setTimeRemaining(remaining);
      
      if (remaining <= 0 && !playerFinished) {
        clearInterval(timerRef.current);
        sound.playTypeMiss();
        onComplete(playerTyped.length, target.length, totalTime);
      }
    }, 16);

    return () => clearInterval(timerRef.current);
  }, [totalTime, onComplete, sound, playerTyped.length, playerFinished]);

  const timePct = (timeRemaining / totalTime) * 100;
  const progressPct = (playerTyped.length / target.length) * 100;

  return (
    <div className="qteOverlay">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '900px', margin: '0 auto', alignItems: 'center' }}>
        {/* Player Side */}
        <div style={{
          background: 'rgba(46, 204, 113, 0.1)',
          border: '3px solid #2ecc71',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: playerFinished ? '0 0 30px rgba(46, 204, 113, 0.5)' : 'none'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem', color: '#2ecc71' }}>
            👤 YOU
          </div>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: '700',
            marginBottom: '1.5rem',
            minHeight: '40px',
            color: playerFinished ? '#51cf66' : 'white'
          }}>
            {playerTyped.length} / {target.length}
            {playerFinished && ' ✓'}
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '800',
            fontFamily: 'monospace',
            marginBottom: '1.5rem',
            letterSpacing: '6px',
            color: hasError ? '#ff6b6b' : playerFinished ? '#51cf66' : '#ffffff'
          }}>
            {playerTyped}
            {playerTyped.length < target.length && (
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.8rem' }}>
                {target[playerTyped.length]}
              </span>
            )}
          </div>
          <div style={{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: '#51cf66',
              transition: 'width 0.05s ease-out'
            }} />
          </div>
        </div>

        {/* AI Side */}
        <div style={{
          background: 'rgba(231, 76, 60, 0.1)',
          border: '3px solid #e74c3c',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '1rem', color: '#e74c3c' }}>
            👾 OPPONENT
          </div>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: '700',
            marginBottom: '1.5rem',
            minHeight: '40px',
            color: aiSimulatedTyping.finished ? '#ff8787' : 'white'
          }}>
            {aiSimulatedTyping.progress} / {target.length}
            {aiSimulatedTyping.finished && ' ✓'}
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '800',
            fontFamily: 'monospace',
            marginBottom: '1.5rem',
            letterSpacing: '6px',
            color: aiSimulatedTyping.finished ? '#ff8787' : 'rgba(255,255,255,0.6)',
            opacity: 0.7
          }}>
            {target.substring(0, aiSimulatedTyping.progress)}
            {aiSimulatedTyping.progress < target.length && (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.8rem' }}>
                {target[aiSimulatedTyping.progress]}
              </span>
            )}
          </div>
          <div style={{
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(aiSimulatedTyping.progress / target.length) * 100}%`,
              height: '100%',
              background: '#ef5350',
              transition: 'width 0.1s ease-out'
            }} />
          </div>
        </div>
      </div>

      {/* Timer at bottom */}
      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <div style={{
          height: '8px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <div style={{
            width: `${timePct}%`,
            height: '100%',
            background: timePct > 50 ? '#3498db' : timePct > 20 ? '#f39c12' : '#e74c3c',
            transition: 'width 0.05s linear'
          }} />
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: '700', color: timePct > 20 ? '#ffffff' : '#e74c3c' }}>
          ⏱️ {(timeRemaining / 1000).toFixed(2)}s
        </div>
      </div>
    </div>
  );
}

// ==========================================
// OLD QTE TYPING OVERLAY (kept for compatibility)
// ==========================================
function QteOverlay({ target, totalTime, isAttack, onComplete, sound }) {
  const [typed, setTyped] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(totalTime);
  const [hasError, setHasError] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore meta keys, allow letters/numbers/spaces/symbols
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;
      if (e.key === ' ') e.preventDefault(); // stop page scroll

      const nextChar = target[typed.length];
      if (e.key === nextChar) {
        sound.playTypeKey();
        const newTyped = typed + e.key;
        setTyped(newTyped);
        setHasError(false);

        if (newTyped.length === target.length) {
          // Finished!
          clearInterval(timerRef.current);
          sound.playTypeSuccess();
          onComplete(newTyped.length, target.length);
        }
      } else {
        // Wrong key
        sound.playTypeError();
        setHasError(true);
        setTimeout(() => setHasError(false), 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [typed, target, onComplete, sound]);

  // Timer loop
  useEffect(() => {
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalTime - elapsed);
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        sound.playTypeMiss();
        // Time ran out! Return just what was typed so far.
        onComplete(typed.length, target.length); 
      }
    }, 16); // ~60fps updates

    return () => clearInterval(timerRef.current);
  }, [totalTime, onComplete, sound, typed.length, target.length]);

  const timePct = (timeRemaining / totalTime) * 100;
  const timerClass = timePct > 50 ? '' : timePct > 20 ? 'warning' : 'danger';
  const boxClass = hasError ? 'error' : typed === target ? 'success' : '';
  const progressPct = (typed.length / target.length) * 100;

  return (
    <div className="qteOverlay">
      <div className={`qteBox ${boxClass}`}>
        {/* Header with mode indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div className={`qteLabel ${isAttack ? '' : 'defense'}`} style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '1px' }}>
            {isAttack ? '⚔️ TYPE TO ATTACK!' : '🛡️ TYPE TO DEFEND!'}
          </div>
          <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: '600' }}>
            {typed.length} / {target.length}
          </div>
        </div>
        
        {/* Progress bar */}
        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${isAttack ? '#e74c3c' : '#3498db'}, ${isAttack ? '#f39c12' : '#2ecc71'})`,
            transition: 'width 0.1s ease-out'
          }} />
        </div>

        {/* Typing prompt with enhanced styling */}
        <div className="qtePrompt" style={{ marginBottom: '2rem' }}>
          {target.split('').map((char, i) => {
            const isTyped = i < typed.length;
            const isCurrent = i === typed.length;
            let className = 'qteChar';
            if (isTyped) className += ' typed';
            if (isCurrent && !hasError) className += ' current';
            if (isCurrent && hasError) className += ' error';
            
            return (
              <span key={i} className={className} style={{
                fontSize: '1.8rem',
                fontWeight: isCurrent ? '800' : isTyped ? '700' : '500',
                color: isTyped ? '#51cf66' : isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                transition: 'all 0.1s ease-out',
                textShadow: isCurrent && !hasError ? '0 0 10px rgba(255, 255, 255, 0.5)' : 'none',
                transform: isTyped ? 'scale(0.95) translateY(2px)' : 'scale(1)',
                marginRight: char === ' ' ? '0.5rem' : '0.15rem'
              }}>
                {char === ' ' ? '⎵' : char}
              </span>
            );
          })}
        </div>

        {/* Timer with enhanced visuals */}
        <div style={{ marginBottom: '1rem' }}>
          <div className={`qteTimerContainer`} style={{ height: '12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
            <div 
              className={`qteTimerFill ${timerClass}`}
              style={{
                width: `${timePct}%`,
                height: '100%',
                background: timePct > 50 ? 'linear-gradient(90deg, #3498db, #2ecc71)' : timePct > 20 ? 'linear-gradient(90deg, #f39c12, #e67e22)' : 'linear-gradient(90deg, #e74c3c, #c0392b)',
                transition: 'width 0.1s linear',
                boxShadow: `0 0 10px ${timePct > 50 ? '#3498db' : timePct > 20 ? '#f39c12' : '#e74c3c'}80`
              }}
            />
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.5rem', textAlign: 'center', fontWeight: '600' }}>
            {(timeRemaining / 1000).toFixed(2)}s remaining
          </div>
        </div>

        {/* Feedback indicator */}
        {hasError && (
          <div style={{ fontSize: '0.9rem', color: '#e74c3c', fontWeight: '700', textAlign: 'center', marginTop: '1rem', animation: 'pulse 0.3s' }}>
            ✗ Wrong key! Keep typing...
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// TITLE SCREEN
// ==========================================
function TitleScreen({ onStart, sound }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pokeballs = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 90 + 5}%`,
      top: `${Math.random() * 90 + 5}%`,
      delay: `${Math.random() * 6}s`,
      size: `${Math.random() * 25 + 20}px`,
      duration: `${Math.random() * 4 + 6}s`,
    })),
    []
  );

  return (
    <div className="titleScreen screenTransition">
      {mounted && (
        <div className="titleBg">
          {pokeballs.map((pb) => (
            <div
              key={pb.id}
              className="pokeball"
              style={{ left: pb.left, top: pb.top, width: pb.size, height: pb.size, animationDelay: pb.delay, animationDuration: pb.duration }}
            />
          ))}
        </div>
      )}
      <div className="titleContent">
        <h1 className="titleLogo">Pokémon Typing Battle</h1>
        <p className="titleSubtitle">A fast-paced keyboard combat experience</p>
        <button className="startBtn" onClick={() => { sound.playSelect(); onStart(); }}>
          Start Campaign
        </button>
      </div>
    </div>
  );
}

// ==========================================
// TEAM SELECT SCREEN
// ==========================================
function TeamSelectScreen({ onTeamSelected, sound }) {
  const [selected, setSelected] = useState([]);

  const toggleSelect = (pokemon) => {
    if (selected.find((p) => p.id === pokemon.id)) {
      setSelected(selected.filter((p) => p.id !== pokemon.id));
      sound.playClick();
    } else if (selected.length < 3) {
      setSelected([...selected, pokemon]);
      sound.playSelect();
    }
  };

  const proceed = () => {
    if (selected.length === 3) {
      sound.playLevelUp();
      onTeamSelected(selected);
    }
  };

  return (
    <div className="teamSelectScreen screenTransition">
      <h2 className="teamSelectTitle">Draft Your Team</h2>
      <p className="teamSelectSubtitle">Select 3 Pokémon to bring to battle</p>
      <p className="selectedCount">
        {selected.length} / 3 Selected
        {selected.length === 3 && ' ✓'}
      </p>
      <div className="pokemonGrid">
        {POKEMON_DATA.map((pokemon, idx) => {
          const isSelected = selected.find((p) => p.id === pokemon.id);
          const isDisabled = !isSelected && selected.length >= 3;
          return (
            <div
              key={pokemon.id}
              className={`pokemonCard ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && toggleSelect(pokemon)}
              style={{ animationDelay: `${idx * 0.03}s` }}
            >
              <img src={pokemon.spriteUrl} alt={pokemon.name} className="cardSprite" loading="lazy" />
              <div className="cardName">{pokemon.name}</div>
              <div className="cardTypes">
                {pokemon.types.map((t) => (
                  <span key={t} className="typeBadge" style={{ backgroundColor: getTypeColor(t) }}>{t}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button className="beginBattleBtn" disabled={selected.length < 3} onClick={proceed}>
        Proceed to Level Select
      </button>
    </div>
  );
}

// ==========================================
// LEVEL SELECT SCREEN
// ==========================================
// LEVEL SELECT SCREEN
// ==========================================
function LevelSelectScreen({ onLevelSelected, sound, onBack }) {
  return (
    <div className="levelSelectScreen screenTransition">
      <div className="levelSelectHeader">
        <h1 className="levelSelectTitle">🎮 Select Your Challenge</h1>
        <p className="levelSelectSubtitle">Test your typing speed across 10 progressive levels</p>
      </div>
      
      <div className="levelGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '95%', maxWidth: '1200px', margin: '2rem auto' }}>
        {LEVELS.map((level, idx) => {
          const difficulty = idx < 3 ? 'Easy' : idx < 6 ? 'Medium' : idx < 9 ? 'Hard' : 'Extreme';
          const diffColor = idx < 3 ? '#2ecc71' : idx < 6 ? '#f39c12' : idx < 9 ? '#e74c3c' : '#c0392b';
          
          return (
            <button 
              key={level.level} 
              className="levelCard"
              style={{ 
                background: 'linear-gradient(135deg, rgba(25, 25, 40, 0.95), rgba(50, 40, 80, 0.7))',
                border: '2px solid var(--border)', 
                borderRadius: '12px', 
                padding: '1.8rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => { sound.playSelect(); onLevelSelected(idx); }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = 'var(--accent-cyan)'; 
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 206, 201, 0.2)';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = 'var(--border)'; 
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Background accent */}
              <div style={{ position: 'absolute', top: 0, right: 0, width: '70px', height: '70px', background: diffColor, opacity: 0.1, borderRadius: '50%', pointerEvents: 'none' }} />
              
              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <div style={{ fontSize: '1.1rem', color: diffColor, fontWeight: 700, padding: '0.3rem 0.8rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                    {difficulty}
                  </div>
                  <div style={{ fontSize: '2rem' }}>Lv.{level.level}</div>
                </div>
                
                <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-bright)' }}>
                  {level.title}
                </h3>
                
                {level.subtitle && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem', fontStyle: 'italic' }}>
                    {level.subtitle}
                  </p>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Time Limit</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{level.qteConfig.baseTimeMs / 1000}s</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📝</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Words</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{level.qteConfig.wordCount} word{level.qteConfig.wordCount > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>👾</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Opponents</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>{level.enemyCount}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🎯</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Difficulty</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                        {idx < 3 ? 'Warm-up' : idx < 6 ? 'Balanced' : idx < 9 ? 'Intense' : 'Peak'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Back button */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button 
          onClick={() => { sound.playClick(); onBack && onBack(); }}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            padding: '0.8rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.95rem',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
            e.currentTarget.style.color = 'var(--text-bright)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          ← Back to Team Select
        </button>
      </div>
    </div>
  );
}

// ==========================================
// BATTLE SCREEN
// ==========================================
function BattleScreen({
  playerTeam: initialPlayerTeam,
  levelIndex,
  onBattleEnd,
  sound,
}) {
  const levelConfig = LEVELS[levelIndex];
  
  // Generate enemy team for this level
  const initialEnemyTeam = useMemo(() => {
    let pool = [...POKEMON_DATA];
    // Remove player pokemon if possible
    pool = pool.filter(p => !initialPlayerTeam.find(pp => pp.id === p.id));
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, levelConfig.enemyCount).map(preparePokemonForBattle);
  }, [levelConfig.enemyCount, initialPlayerTeam]);

  // Battle state
  const [playerTeam, setPlayerTeam] = useState(() => initialPlayerTeam.map(preparePokemonForBattle));
  const [enemyTeam, setEnemyTeam] = useState(initialEnemyTeam);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeEnemyIdx, setActiveEnemyIdx] = useState(0);
  const [message, setMessage] = useState(`Level ${levelConfig.level}: ${levelConfig.title}! What will you do?`);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showQuitConfirmation, setShowQuitConfirmation] = useState(false);
  const [actionMode, setActionMode] = useState('fight');
  const [timer, setTimer] = useState(0);
  const [score, setScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [playerSpriteClass, setPlayerSpriteClass] = useState('');
  const [enemySpriteClass, setEnemySpriteClass] = useState('');
  const [damagePopup, setDamagePopup] = useState(null);
  
  // QTE State
  const [qte, setQte] = useState({
    active: false,
    target: '',
    time: 0,
    isAttack: true,
    move: null 
  });
  
  // Floating feedback state
  const [feedback, setFeedback] = useState(null);

  const timerRef = useRef(null);
  const battleEndedRef = useRef(false);

  const activePlayer = playerTeam[activePlayerIdx];
  const activeEnemy = enemyTeam[activeEnemyIdx];

  // Global Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!isPaused && !qte.active && !isAnimating) setTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isPaused, qte.active, isAnimating]);

  const formatTime = (sec) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  const getHpClass = (current, max) => (current / max > 0.5 ? 'high' : current / max > 0.2 ? 'medium' : 'low');
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Visuals function
  const showDamage = (amount, type, isEnemy) => {
    setDamagePopup({ amount, type, isEnemy });
    setTimeout(() => setDamagePopup(null), 1000);
  };
  const showFeedback = (text, color) => {
    setFeedback({ text, color });
    setTimeout(() => setFeedback(null), 1200);
  };

  // Phase 1: Player selects move
  const handlePlayerMoveInitiate = (move) => {
    if (!isPlayerTurn || isAnimating || battleEndedRef.current) return;
    setIsAnimating(true);
    setIsPlayerTurn(false);
    
    // Deduct PP
    const moveRef = activePlayer.moves.find((m) => m.name === move.name);
    if (moveRef) moveRef.currentPp = Math.max(0, moveRef.currentPp - 1);

    setMessage(`${activePlayer.name} is preparing ${move.name}... Type to boost attack!`);
    
    setQte({
      active: true,
      target: generateTypingPrompt(levelConfig),
      time: levelConfig.qteConfig.baseTimeMs,
      isAttack: true,
      move: move
    });
  };

  // Phase 2: QTE Completes
  const handleQteComplete = async (typedLength, targetLength) => {
    if (battleEndedRef.current) return;
    
    const currentQte = { ...qte }; // snapshot
    setQte({ ...qte, active: false });
    
    const evalResult = evaluateTypingPerformance(typedLength, targetLength, currentQte.isAttack);
    
    if (currentQte.isAttack) {
      // Calculate exact damage payload to show the numeric "Power"
      const dummyRes = calculateDamage(activePlayer, currentQte.move, activeEnemy, evalResult.multiplier, false);
      const outputText = evalResult.multiplier === 0 
        ? `${evalResult.label}` 
        : `${evalResult.label} – POWER: ${dummyRes.damage}!`;
      showFeedback(outputText, evalResult.color);
      await delay(1200);
      await processAttack(activePlayer, currentQte.move, activeEnemy, true, evalResult.multiplier);
    } else {
      showFeedback(evalResult.label, evalResult.color);
      await delay(1200);
      await processAttack(activeEnemy, currentQte.move, activePlayer, false, evalResult.multiplier);
    }
  };

  // Phase 3: Execute Damage
  const processAttack = async (attacker, move, defender, isPlayer, typingPercentage) => {
    setMessage(`${attacker.name} used ${move.name}!`);

    if (isPlayer) {
      setPlayerSpriteClass('attacking');
      sound.playAttack();
    } else {
      setEnemySpriteClass('enemyAttacking');
      sound.playAttack();
    }
    await delay(400);
    setPlayerSpriteClass('');
    setEnemySpriteClass('');

    const result = calculateDamage(attacker, move, defender, typingPercentage, !isPlayer);

    if (result.missed) {
      if (isPlayer) {
         setMessage(`${attacker.name}'s attack failed completely!`);
         setPlayerSpriteClass('stagger-miss');
      } else {
         setMessage(`You completely blocked the attack!`);
         setEnemySpriteClass('stagger-miss');
      }
      showDamage('BLOCK', 'missed', !isPlayer);
      sound.playNotEffective();
      await delay(800);
      setPlayerSpriteClass('');
      setEnemySpriteClass('');
    } else {
      const animClass = getTypeAnimArgs(move.type);
      if (isPlayer) {
        setEnemySpriteClass(animClass);
        sound.playHit();
      } else {
        setPlayerSpriteClass(animClass);
        sound.playHit();
      }

      showDamage(result.damage, result.effectiveness > 1 ? 'superEffective' : result.effectiveness < 1 ? 'notEffective' : 'normal', !isPlayer);
      await delay(300);
      setPlayerSpriteClass('');
      setEnemySpriteClass('');

      // Apply damage
      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      if (isPlayer) setEnemyTeam((prev) => [...prev]);
      else setPlayerTeam((prev) => [...prev]);

      if (result.effectiveness > 1) {
        setMessage("It's super effective!");
        sound.playSuperEffective();
        await delay(800);
      } else if (result.effectiveness < 1 && result.effectiveness > 0) {
        setMessage("It's not very effective...");
        sound.playNotEffective();
        await delay(800);
      }
    }

    // Check Faint
    if (defender.currentHp <= 0) {
      defender.isFainted = true;
      if (isPlayer) {
        setEnemySpriteClass('fainted');
        setEnemyTeam((prev) => [...prev]);
        setScore((s) => s + 500); // More points per kill
      } else {
        setPlayerSpriteClass('fainted');
        setPlayerTeam((prev) => [...prev]);
      }
      sound.playFaint();
      setMessage(`${defender.name} fainted!`);
      await delay(1000);
      setPlayerSpriteClass('');
      setEnemySpriteClass('');
      
      // Handle post-faint
      if (isPlayer) {
        const aliveEnemies = enemyTeam.filter((p) => !p.isFainted);
        if (aliveEnemies.length === 0) {
          // Level Cleared
          battleEndedRef.current = true;
          await delay(500);
          onBattleEnd({ won: true, score: score + 1000 + timer, levelIndex });
          return;
        }
        // Switch enemy
        const nextIdx = enemyTeam.findIndex((p) => !p.isFainted);
        setActiveEnemyIdx(nextIdx);
        setMessage(`Opponent sent out ${enemyTeam[nextIdx].name}!`);
        await delay(800);
        setIsAnimating(false);
        setIsPlayerTurn(true);
        setMessage(`Level ${levelConfig.level}: What will you do?`);
        return;
      } else {
        const alivePlayers = playerTeam.filter((p) => !p.isFainted);
        if (alivePlayers.length === 0) {
          // Game Over
          battleEndedRef.current = true;
          await delay(500);
          onBattleEnd({ won: false, score: score, levelIndex });
          return;
        }
        setMessage('Choose your next Pokémon!');
        setActionMode('switch');
        setIsAnimating(false);
        setIsPlayerTurn(true);
        return;
      }
    }

    // Continue turn
    if (isPlayer) {
      // Initiate Enemy Turn -> Defense QTE
      await delay(500);
      const enemyMove = getAIMove(activeEnemy, activePlayer);
      setMessage(`Opponent is using ${enemyMove.name}! Type to Defend!`);
      
      // Defense gets slightly more time to be fair
      const defenseTime = levelConfig.qteConfig.baseTimeMs * 1.1; // 10% bonus for defense reaction
      setQte({
        active: true,
        target: generateTypingPrompt(levelConfig),
        time: defenseTime,
        isAttack: false,
        move: enemyMove
      });
    } else {
      setIsAnimating(false);
      setIsPlayerTurn(true);
      setMessage(`Level ${levelConfig.level}: What will you do?`);
    }
  };

  // Turn logic for switching
  const handleSwitch = async (idx) => {
    if (!isPlayerTurn || isAnimating || battleEndedRef.current) return;
    setIsAnimating(true);
    sound.playSelect();
    setActivePlayerIdx(idx);
    setMessage(`Go, ${playerTeam[idx].name}!`);
    setActionMode('fight');
    await delay(600);

    if (activePlayer.isFainted) {
      setIsAnimating(false);
      setIsPlayerTurn(true);
      setMessage(`Level ${levelConfig.level}: What will you do?`);
      return;
    }

    // Enemy gets free attack if player switches while active is still alive
    const enemyMove = getAIMove(activeEnemy, playerTeam[idx]);
    setMessage(`Opponent is using ${enemyMove.name}! Type to Defend!`);
    
    setQte({
      active: true,
      target: generateTypingPrompt(levelConfig),
      time: levelConfig.qteConfig.baseTimeMs * 1.1,
      isAttack: false,
      move: enemyMove
    });
  };

  if (!activePlayer || !activeEnemy) return null;

  return (
    <div className="battleScreen screenTransition">
      {/* QTE Overlay */}
      {qte.active && (
        <QteOverlay 
          target={qte.target} 
          totalTime={qte.time} 
          isAttack={qte.isAttack} 
          onComplete={handleQteComplete} 
          sound={sound} 
        />
      )}

      {/* Floating feedback */}
      {feedback && (
        <div className="qteFeedback" style={{ color: feedback.color }}>
          {feedback.text}
        </div>
      )}

      {/* Top bar */}
      <div className="battleTopBar">
        <div className="timerDisplay">Lv. {levelConfig.level} | ⏱ {formatTime(timer)}</div>
        <div className="scoreDisplay">SCORE {score}</div>
        <div className="battleControls">
          <button className="controlBtn" onClick={() => { setIsPaused(true); sound.playClick(); }} title="Pause">⏸</button>
        </div>
      </div>

      {/* Battle field */}
      <div className="battleField">
        <div className="battleFieldGround" />
        {/* Enemy */}
        <div className="enemyArea">
          <div className="pokemonBattleUnit enemy">
            <div className="pokemonInfoBox enemy">
              <div className="infoBoxHeader">
                <span className="pokemonNameBattle">{activeEnemy.name}</span>
              </div>
              <div className="hpBarContainer">
                <div className="hpBarLabel">
                  <span>HP</span>
                  <span>{activeEnemy.currentHp}/{activeEnemy.maxHp}</span>
                </div>
                <div className="hpBarTrack">
                  <div className={`hpBarFill ${getHpClass(activeEnemy.currentHp, activeEnemy.maxHp)}`} style={{ width: `${(activeEnemy.currentHp / activeEnemy.maxHp) * 100}%` }} />
                </div>
              </div>
              <div className="teamIndicators">
                {enemyTeam.map((p, i) => <div key={i} className={`teamBall ${p.isFainted ? 'fainted' : i === activeEnemyIdx ? 'active' : 'ready'}`} /> )}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <img src={activeEnemy.spriteUrl} alt={activeEnemy.name} className={`battleSprite ${enemySpriteClass}`} />
              {damagePopup && damagePopup.isEnemy && <div className={`damageNumber ${damagePopup.type}`}>{damagePopup.amount}</div>}
            </div>
          </div>
        </div>

        {/* Player */}
        <div className="playerArea">
          <div className="pokemonBattleUnit">
            <div style={{ position: 'relative' }}>
              <img src={activePlayer.spriteUrl} alt={activePlayer.name} className={`battleSprite ${playerSpriteClass}`} />
              {damagePopup && !damagePopup.isEnemy && <div className={`damageNumber ${damagePopup.type}`}>{damagePopup.amount}</div>}
            </div>
            <div className="pokemonInfoBox">
              <div className="infoBoxHeader">
                <span className="pokemonNameBattle">{activePlayer.name}</span>
              </div>
              <div className="hpBarContainer">
                <div className="hpBarLabel">
                  <span>HP</span>
                  <span>{activePlayer.currentHp}/{activePlayer.maxHp}</span>
                </div>
                <div className="hpBarTrack">
                  <div className={`hpBarFill ${getHpClass(activePlayer.currentHp, activePlayer.maxHp)}`} style={{ width: `${(activePlayer.currentHp / activePlayer.maxHp) * 100}%` }} />
                </div>
              </div>
              <div className="teamIndicators">
                {playerTeam.map((p, i) => <div key={i} className={`teamBall ${p.isFainted ? 'fainted' : i === activePlayerIdx ? 'active' : 'ready'}`} /> )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="battleMessageBox">{message}</div>

      <div className="actionToggle">
        <button className={`actionToggleBtn ${actionMode === 'fight' ? 'active' : ''}`} onClick={() => { setActionMode('fight'); sound.playClick(); }}>⚔️ Fight</button>
        <button className={`actionToggleBtn ${actionMode === 'switch' ? 'active' : ''}`} onClick={() => { setActionMode('switch'); sound.playClick(); }}>🔄 Switch</button>
      </div>

      {actionMode === 'fight' ? (
        <div className="movePanel">
          {activePlayer.moves.map((move, moveIdx) => {
            const isDisabled = !isPlayerTurn || isAnimating || move.currentPp <= 0 || activePlayer.isFainted;
            const moveColor = move.currentPp > 0 ? getTypeColor(move.type) : '#2a2a3a';
            const hasUsedMove = move.currentPp <= 0;
            
            return (
              <button
                key={move.name}
                className={`moveBtn${isDisabled ? ' disabled' : ''}`}
                style={{
                  backgroundColor: moveColor,
                  opacity: isDisabled ? 0.4 : 1,
                  border: `3px solid ${move.currentPp > 0 ? moveColor : 'rgba(255,255,255,0.2)'}`,
                  color: 'white',
                  padding: '1rem',
                  borderRadius: '10px',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  minHeight: '100px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: move.currentPp > 0 && !isDisabled ? `0 0 20px ${moveColor}80` : 'none'
                }}
                disabled={isDisabled}
                onClick={() => !isDisabled && handlePlayerMoveInitiate(move)}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    e.currentTarget.style.transform = 'scale(1.05) translateY(-3px)';
                    e.currentTarget.style.boxShadow = `0 8px 28px ${moveColor}A0, inset 0 0 20px ${moveColor}40`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = move.currentPp > 0 && !isDisabled ? `0 0 20px ${moveColor}80` : 'none';
                }}
              >
                {/* Type background accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />
                
                {/* Move info */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{TYPE_ICONS[move.type]}</span>
                    <span>{move.name}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {move.type.charAt(0).toUpperCase() + move.type.slice(1)}
                  </div>
                </div>
                
                {/* Stats row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.2)', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontWeight: '700' }}>⚡ {move.power}</span>
                  <span style={{ fontWeight: '700', color: hasUsedMove ? '#ff6b6b' : '#51cf66' }}>
                    {hasUsedMove ? '✗ USED' : '✓ READY'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="switchPanel">
          {playerTeam.map((p, i) => (
            <button
              key={p.id}
              className="switchBtn"
              disabled={i === activePlayerIdx || p.isFainted || !isPlayerTurn || isAnimating}
              onClick={() => handleSwitch(i)}
            >
              <img src={p.spriteUrl} alt={p.name} className="switchSprite" />
              <div className="switchBtnInfo">
                <div className="switchBtnName">{p.name}</div>
                <div className="switchBtnHp">HP {p.currentHp}/{p.maxHp} {p.isFainted && ' (Fainted)'}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && (
        <div className="pauseOverlay" style={{zIndex: 200}}>
          <h2 className="pauseTitle">Paused</h2>
          <div className="pauseButtons">
            <button className="pauseBtn resume" onClick={() => { setIsPaused(false); sound.playClick(); }}>▶ Resume</button>
            <button className="pauseBtn quit" onClick={() => { sound.playClick(); setShowQuitConfirmation(true); }}>✕ Quit to Menu</button>
          </div>
        </div>
      )}

      {showQuitConfirmation && (
        <ConfirmationDialog
          title="Quit Battle?"
          message="You will lose all progress in this level. Are you sure?"
          onConfirm={() => { sound.playClick(); setShowQuitConfirmation(false); onBattleEnd(null); }}
          onCancel={() => { sound.playClick(); setShowQuitConfirmation(false); }}
          confirmText="Quit"
          cancelText="Cancel"
          isDangerous={true}
        />
      )}
    </div>
  );
}

// ==========================================
// RESULT CAMPAIGN SCREEN
// ==========================================
function ResultScreen({ result, onContinue, onReplayLevel, onRestart, sound }) {
  const isGameClear = result.won && result.levelIndex === LEVELS.length - 1;
  const isLevelClear = result.won && !isGameClear;
  const levelConfig = LEVELS[result.levelIndex];

  useEffect(() => {
    if (result.won) sound.playVictory();
    else sound.playDefeat();
  }, [result.won, sound]);

  const getPerformanceRating = () => {
    const score = result.score || 0;
    if (score >= 3000) return { stars: 3, label: 'Legendary', color: '#f39c12' };
    if (score >= 1500) return { stars: 2, label: 'Excellent', color: '#e74c3c' };
    return { stars: 1, label: 'Good', color: '#3498db' };
  };

  const performance = getPerformanceRating();

  return (
    <div className="resultScreen screenTransition">
      <div className="resultContent" style={{
        maxWidth: '600px',
        margin: '0 auto',
        animation: 'slideInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {/* Header Banner */}
        <div style={{
          marginBottom: '2rem',
          textAlign: 'center',
          animation: result.won ? 'bounce 0.6s 0.2s both' : 'shake 0.4s 0.2s both'
        }}>
          <h1 className={`resultBanner ${result.won ? 'victory' : 'defeat'}`} style={{
            fontSize: '3rem',
            fontWeight: '900',
            marginBottom: '0.5rem',
            background: result.won ? 'linear-gradient(135deg, #2ecc71, #f39c12)' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {isGameClear ? '👑 CAMPAIGN COMPLETE!' : isLevelClear ? '⭐ VICTORY!' : '❌ DEFEATED'}
          </h1>
          <p className="resultSubtext" style={{
            fontSize: '1.2rem',
            marginBottom: '0',
            color: result.won ? '#2ecc71' : '#e74c3c',
            fontWeight: '600'
          }}>
            {isGameClear ? '🔥 You are a Typing Legend! 🔥' 
              : isLevelClear ? `💪 Well done! Ready for Level ${result.levelIndex + 2}?` 
              : '🎮 Better luck next time!'}
          </p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1), rgba(255, 193, 7, 0.02))',
            border: '2px solid rgba(255, 193, 7, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '1px' }}>
              Final Score
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#f39c12' }}>
              {result.score || 0}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.02))',
            border: '2px solid rgba(52, 152, 219, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '1px' }}>
              Level Reached
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#3498db' }}>
              {result.levelIndex + 1} / 10
            </div>
          </div>
        </div>

        {/* Performance Rating */}
        {result.won && (
          <div style={{
            background: `rgba(${performance.color.slice(1).match(/.{1,2}/g).join(',')}, 0.15)`,
            border: `2px solid ${performance.color}`,
            borderRadius: '12px',
            padding: '1.5rem',
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {Array(performance.stars).fill('⭐').join('')}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: performance.color, marginBottom: '0.3rem' }}>
              {performance.label} Performance
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {performance.stars === 3 ? 'Outstanding! You are a true typing master!' : 
               performance.stars === 2 ? 'Excellent work! Keep pushing your limits!' : 
               'Good effort! Practice makes perfect!'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Primary action button */}
          {isLevelClear && (
            <button 
              onClick={() => { sound.playSelect(); onContinue(); }}
              style={{
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                border: 'none',
                color: 'white',
                padding: '1.2rem 2rem',
                borderRadius: '8px',
                fontSize: '1.1rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 8px 16px rgba(46, 204, 113, 0.3)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(46, 204, 113, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(46, 204, 113, 0.3)';
              }}
            >
              ➜ Continue to Level {result.levelIndex + 2}
            </button>
          )}

          {/* Replay button */}
          <button 
            onClick={() => { sound.playSelect(); onReplayLevel(); }}
            style={{
              background: 'rgba(243, 156, 18, 0.15)',
              border: '2px solid #f39c12',
              color: '#f39c12',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(243, 156, 18, 0.25)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(243, 156, 18, 0.15)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            🔄 Replay Level {result.levelIndex + 1}
          </button>

          {/* New Campaign button */}
          <button 
            onClick={() => { sound.playSelect(); onRestart(false); }}
            style={{
              background: 'rgba(52, 152, 219, 0.15)',
              border: '2px solid #3498db',
              color: '#3498db',
              padding: '1rem 2rem',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(52, 152, 219, 0.25)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(52, 152, 219, 0.15)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            🎮 New Campaign
          </button>

          {/* Exit to menu button */}
          <button 
            onClick={() => { sound.playClick(); onRestart(true); }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-secondary)',
              padding: '0.8rem 2rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
              e.currentTarget.style.color = 'var(--text-bright)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ✕ Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN GAME APP
// ==========================================
export default function PokemonGame() {
  const [screen, setScreen] = useState('title'); 
  const [playerTeam, setPlayerTeam] = useState([]);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [globalScore, setGlobalScore] = useState(0);
  const [battleResult, setBattleResult] = useState(null);
  
  const sound = useSound();

  const handleStart = () => setScreen('teamSelect');

  const handleTeamSelected = (pTeam) => {
    setPlayerTeam(pTeam);
    setScreen('levelSelect');
  };

  const handleLevelSelected = (lvlIdx) => {
    setCurrentLevelIdx(lvlIdx);
    setGlobalScore(0);
    setScreen('battle');
  };

  const handleBattleEnd = (result) => {
    if (result === null) {
      setScreen('title'); // Quit
      return;
    }
    
    setBattleResult(result);
    setScreen('result');
  };

  const handleLevelSelectBack = () => {
    setScreen('teamSelect');
  };

  const handleContinue = () => {
    setGlobalScore(globalScore + battleResult.score);
    setCurrentLevelIdx(currentLevelIdx + 1);
    
    // Heal player team 50% between levels
    const healedTeam = playerTeam.map(p => ({
      ...p,
      currentHp: p.isFainted ? Math.floor(p.maxHp * 0.5) : Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * 0.5)),
      isFainted: false,
    }));
    setPlayerTeam(healedTeam);
    setScreen('battle');
  };

  const handleReplayLevel = () => {
    // Keep current setup and just reset
    // Heal player team fully
    const fullyHealed = playerTeam.map(p => ({
      ...p,
      currentHp: p.maxHp,
      isFainted: false,
    }));
    setPlayerTeam(fullyHealed);
    setScreen('battle');
  };

  const handleRestart = (toMenu = false) => {
    if (toMenu) {
      setScreen('title');
      return;
    }
    setGlobalScore(0);
    setScreen('teamSelect');
  };

  return (
    <>
      <button className="soundToggle" onClick={sound.toggleMute} title={sound.isMuted ? 'Unmute' : 'Mute'}>
        {sound.isMuted ? '🔇' : '🔊'}
      </button>

      {screen === 'title' && <TitleScreen onStart={handleStart} sound={sound} />}
      
      {screen === 'teamSelect' && <TeamSelectScreen onTeamSelected={handleTeamSelected} sound={sound} />}
      
      {screen === 'levelSelect' && <LevelSelectScreen onLevelSelected={handleLevelSelected} onBack={handleLevelSelectBack} sound={sound} />}
      
      {screen === 'battle' && (
        <BattleScreen
          key={`battle-lv${currentLevelIdx}`}
          playerTeam={playerTeam}
          levelIndex={currentLevelIdx}
          onBattleEnd={handleBattleEnd}
          sound={sound}
        />
      )}
      
      {screen === 'result' && battleResult && (
        <ResultScreen
          result={battleResult}
          onContinue={handleContinue}
          onReplayLevel={handleReplayLevel}
          onRestart={handleRestart}
          sound={sound}
        />
      )}
    </>
  );
}
