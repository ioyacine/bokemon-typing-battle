import { getEffectiveness, getEffectivenessLabel } from '../data/typeChart';

/**
 * Calculate damage for a move - PURE SKILL-BASED (no randomness)
 * Damage is determined entirely by typing accuracy and type effectiveness
 */
export function calculateDamage(attacker, move, defender, typingPercentage = 1, isDefense = false) {
  // Base damage formula (simplified Pokémon formula, level 50)
  const level = 50;
  const baseDamage = ((2 * level / 5 + 2) * move.power * (attacker.attack / defender.defense)) / 50 + 2;

  // Type effectiveness (0.25, 0.5, 1, 2, or 4)
  const effectiveness = getEffectiveness(move.type, defender.types);

  // STAB (Same Type Attack Bonus) - 1.5x if attacker's type matches move type
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // PURE SKILL CALCULATION: No random variance
  let totalDamage = baseDamage * effectiveness * stab;
  
  if (isDefense) {
    // Enemy is attacking, player is defending
    // typingPercentage of 1.0 (perfect typing) -> 100% blocked -> 0 damage
    // typingPercentage of 0.5 (50% correct) -> 50% blocked -> 50% damage gets through
    // typingPercentage of 0.0 (failed) -> 0% blocked -> 100% damage gets through
    totalDamage = totalDamage * (1 - typingPercentage);
  } else {
    // Player is attacking
    // typingPercentage of 1.0 (perfect typing) -> 100% damage
    // typingPercentage of 0.5 (50% correct) -> 50% damage
    // typingPercentage of 0.0 (failed) -> 0 damage
    totalDamage = totalDamage * typingPercentage;
  }

  // Round down but ensure minimum damage of 1 when any damage should occur
  const finalDamage = Math.max(0, Math.floor(totalDamage));
  
  // Only show as "missed" if attack was completely failed (0% typed)
  const missed = finalDamage === 0 && typingPercentage === 0;

  return {
    damage: finalDamage,
    missed,
    effectiveness,
    effectivenessLabel: getEffectivenessLabel(effectiveness),
    critical: false,
  };
}


/**
 * AI move selection – picks the strongest move against the current opponent
 * Deterministic: no randomness. Player skill determines outcome, not AI luck.
 */
export function getAIMove(enemyPokemon, playerPokemon) {
  let bestMove = null;
  let bestScore = -Infinity;

  for (const move of enemyPokemon.moves) {
    if (move.currentPp <= 0) continue;

    // Calculate expected damage based on type effectiveness and STAB
    const effectiveness = getEffectiveness(move.type, playerPokemon.types);
    const stab = enemyPokemon.types.includes(move.type) ? 1.5 : 1;
    const expectedDamage = move.power * effectiveness * stab * (move.accuracy / 100);

    // Pure deterministic scoring - stronger moves chosen always
    if (expectedDamage > bestScore) {
      bestScore = expectedDamage;
      bestMove = move;
    }
  }

  // Fallback: pick first available move with remaining PP
  if (!bestMove) {
    bestMove = enemyPokemon.moves.find(m => m.currentPp > 0) || enemyPokemon.moves[0];
  }

  return bestMove;
}

/**
 * Calculate final score
 */
export function calculateScore(knockouts, superEffectiveHits, remainingHpPercent, timeSeconds) {
  const koPoints = knockouts * 300;
  const sePoints = superEffectiveHits * 50;
  const hpBonus = Math.floor(remainingHpPercent * 500);
  const speedBonus = Math.max(0, 500 - Math.floor(timeSeconds / 2));

  return koPoints + sePoints + hpBonus + speedBonus;
}

/**
 * Evaluate typing performance and return exact percentage and label
 * @param {number} typedLength - Number of characters successfully typed
 * @param {number} targetLength - Total characters required
 * @param {boolean} isAttack - True if attacking, false if defending
 */
export function evaluateTypingPerformance(typedLength, targetLength, isAttack) {
  const percentage = targetLength > 0 ? typedLength / targetLength : 0;
  const labelPct = Math.floor(percentage * 100);
  
  if (percentage === 1) {
    return { multiplier: 1, label: isAttack ? `CRITICAL POWER!` : `PERFECT BLOCK!`, color: '#2ecc71' };
  } else if (percentage >= 0.5) {
    return { multiplier: percentage, label: isAttack ? `SOLID POWER` : `GOOD DEFENSE`, color: '#f1c40f' };
  } else if (percentage > 0) {
    return { multiplier: percentage, label: isAttack ? `WEAK POWER` : `POOR DEFENSE`, color: '#e67e22' };
  } else {
    return { multiplier: 0, label: isAttack ? `ATTACK FAILED!` : `DEFENSE BROKEN!`, color: '#e74c3c' };
  }
}

/**
 * Calculate competitive typing race result
 * NEW SYSTEM: Both players race to type the same word
 * Winner = whoever types it correctly first
 * Damage = based on speed advantage
 */
export function calculateCompetitiveRaceResult(
  playerTypedLength,
  playerTargetLength,
  playerTimeMs,
  aiTimeMs,
  attacker,
  defender,
  move
) {
  const level = 50;
  const baseDamage = ((2 * level / 5 + 2) * move.power * (attacker.attack / defender.defense)) / 50 + 2;
  const effectiveness = getEffectiveness(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Calculate results
  const playerAccuracy = playerTargetLength > 0 ? playerTypedLength / playerTargetLength : 0;
  const playerFinished = playerTypedLength === playerTargetLength;
  
  let winner = null;
  let damage = 0;
  let powerMultiplier = 0;
  let label = '';
  let color = '';

  // Race logic: who finished first?
  if (playerFinished && playerTimeMs < aiTimeMs) {
    // Player won the race
    winner = 'player';
    // Speed advantage multiplier (0.5x to 1.5x based on how much faster)
    const speedRatio = aiTimeMs / Math.max(1, playerTimeMs);
    powerMultiplier = Math.min(1.5, speedRatio * playerAccuracy);
    damage = Math.floor(baseDamage * effectiveness * stab * powerMultiplier);
    label = speedRatio > 1.5 ? '🔥 CRUSHING SPEED!' : '⚡ DECISIVE WIN!';
    color = '#2ecc71';
  } else if (!playerFinished) {
    // Player didn't finish
    damage = 0;
    label = '❌ TIME\'S UP!';
    color = '#e74c3c';
  } else {
    // AI finished first (for defender calculation)
    winner = 'ai';
    damage = Math.floor(baseDamage * effectiveness * stab * 0.8);
    label = '🛡️ NARROWLY BLOCKED!';
    color = '#f39c12';
  }

  return {
    winner,
    damage,
    powerMultiplier,
    label,
    color,
    playerTime: playerTimeMs,
    aiTime: aiTimeMs,
    playerAccuracy
  };
}

/**
 * Get star rating based on score
 */
export function getStarRating(score) {
  if (score >= 2000) return 3;
  if (score >= 1200) return 2;
  return 1;
}

/**
 * Prepare a Pokémon for battle (deep clone with current stats)
 */
export function preparePokemonForBattle(pokemon) {
  return {
    ...pokemon,
    currentHp: pokemon.baseHp,
    maxHp: pokemon.baseHp,
    isFainted: false,
    moves: pokemon.moves.map(move => ({
      ...move,
      currentPp: 1, // Enforce single-use per battle
      pp: 1,
    })),
  };
}

/**
 * Check if all Pokémon on a team are fainted
 */
export function isTeamDefeated(team) {
  return team.every(p => p.isFainted);
}
