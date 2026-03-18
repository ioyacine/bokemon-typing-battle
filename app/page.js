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
// QTE TYPING OVERLAY
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

  return (
    <div className="qteOverlay">
      <div className={`qteBox ${boxClass}`}>
        <div className={`qteLabel ${isAttack ? '' : 'defense'}`}>
          {isAttack ? 'Type to Attack!' : 'Type to Block!'}
        </div>
        <div className="qtePrompt">
          {target.split('').map((char, i) => {
            const isTyped = i < typed.length;
            const isCurrent = i === typed.length;
            let className = 'qteChar';
            if (isTyped) className += ' typed';
            if (isCurrent && !hasError) className += ' current';
            if (isCurrent && hasError) className += ' error';
            
            return (
              <span key={i} className={className}>
                {char === ' ' ? '⎵' : char}
              </span>
            );
          })}
        </div>
        <div className="qteTimerContainer">
          <div 
            className={`qteTimerFill ${timerClass}`} 
            style={{ width: `${timePct}%` }}
          />
        </div>
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
function LevelSelectScreen({ onLevelSelected, sound }) {
  return (
    <div className="levelSelectScreen screenTransition">
      <h2 className="teamSelectTitle">Choose Campaign Level</h2>
      <p className="teamSelectSubtitle">Higher levels mean faster timers and harder words</p>
      
      <div className="levelGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', width: '90%', maxWidth: '1000px', margin: '2rem auto' }}>
        {LEVELS.map((level, idx) => (
          <button 
            key={level.level} 
            className="levelCard"
            style={{ 
              background: 'rgba(25, 25, 40, 0.8)', 
              border: '2px solid var(--border)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
            onClick={() => { sound.playSelect(); onLevelSelected(idx); }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', marginBottom: '0.5rem', fontWeight: 800 }}>Level {level.level}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{level.title}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>Time: {level.qteConfig.baseTimeMs / 1000}s</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>Format: {level.qteConfig.type.toUpperCase()}</div>
          </button>
        ))}
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
      
      // Slightly more generous time for defense
      const defenseTime = levelConfig.qteConfig.baseTimeMs + 500;
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
      time: levelConfig.qteConfig.baseTimeMs + 1000,
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
          {activePlayer.moves.map((move) => (
            <button
              key={move.name}
              className="moveBtn"
              style={{ backgroundColor: move.currentPp > 0 ? getTypeColor(move.type) : '#333' }}
              disabled={!isPlayerTurn || isAnimating || move.currentPp <= 0 || activePlayer.isFainted}
              onClick={() => handlePlayerMoveInitiate(move)}
            >
              <span className="moveName">{TYPE_ICONS[move.type]} {move.name}</span>
              <span className="moveMeta">
                <span>{move.type.toUpperCase()}</span>
                <span>PWR {move.power} {move.currentPp <= 0 && '(USED)'}</span>
              </span>
            </button>
          ))}
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
            <button className="pauseBtn quit" onClick={() => { sound.playClick(); onBattleEnd(null); }}>✕ Quit to Menu</button>
          </div>
        </div>
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

  useEffect(() => {
    if (result.won) sound.playVictory();
    else sound.playDefeat();
  }, [result.won, sound]);

  return (
    <div className="resultScreen screenTransition">
      <div className="resultContent">
        <h1 className={`resultBanner ${result.won ? 'victory' : 'defeat'}`}>
          {isGameClear ? 'Campaign Completed!' : isLevelClear ? 'Level Cleared!' : 'Game Over'}
        </h1>
        <p className="resultSubtext">
          {isGameClear ? 'You are a Typing Legend!' 
            : isLevelClear ? `Proceed to Level ${result.levelIndex + 2} now or replay for a better total score.` 
            : 'Your team was defeated.'}
        </p>

        <div className="resultStats">
          <div className="statCard">
            <div className="statCardLabel">Total Score</div>
            <div className="statCardValue">{result.score || 0}</div>
          </div>
          <div className="statCard">
            <div className="statCardLabel">Max Level</div>
            <div className="statCardValue">{result.levelIndex + 1}</div>
          </div>
        </div>

        <div className="resultButtons" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isLevelClear && (
             <button className="resultBtn primary" onClick={() => { sound.playSelect(); onContinue(); }}>Continue Campaign</button>
          )}
          
          <button className="resultBtn secondary" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }} onClick={() => { sound.playSelect(); onReplayLevel(); }}>
            Replay Level
          </button>
          
          <button className="resultBtn secondary" onClick={() => { sound.playSelect(); onRestart(false); }}>New Campaign</button>
          
          <button className="resultBtn secondary" style={{ opacity: 0.7 }} onClick={() => { sound.playClick(); onRestart(true); }}>Exit to Menu</button>
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
      
      {screen === 'levelSelect' && <LevelSelectScreen onLevelSelected={handleLevelSelected} sound={sound} />}
      
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
