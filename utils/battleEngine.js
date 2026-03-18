import { getEffectiveness, getEffectivenessLabel } from '../data/typeChart';

/**
 * Calculate damage for a move
 * Uses a simplified Pokémon damage formula
 */
export function calculateDamage(attacker, move, defender, typingPercentage = 1, isDefense = false) {
  // Base damage formula (simplified Pokémon formula)
  const level = 50;
  const baseDamage = ((2 * level / 5 + 2) * move.power * (attacker.attack / defender.defense)) / 50 + 2;

  // Type effectiveness
  const effectiveness = getEffectiveness(move.type, defender.types);

  // STAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  // Exact deterministic math with a small logical variance (90-110%) to avoid rigid HP chunks
  const randomFactor = (Math.random() * 20 + 90) / 100;
  let totalDamage = baseDamage * effectiveness * stab * randomFactor;
  
  if (isDefense) {
    // Enemy is attacking, player is defending. 
    // typingPercentage of 1 means 100% blocked -> 0 damage.
    // typingPercentage of 0 means 0% blocked -> full damage.
    totalDamage = totalDamage * (1 - typingPercentage);
  } else {
    // Player is attacking. 
    // typingPercentage of 1 means 100% damage.
    // typingPercentage of 0.5 means 50% damage.
    totalDamage = totalDamage * typingPercentage;
  }

  // Round down. If damage > 0 but floor is 0, make it at least 1 (unless it was explicitly reduced to 0 by 100% typing defense or 0% typing attack)
  const finalDamage = Math.max(0, Math.floor(totalDamage));

  return {
    damage: finalDamage,
    missed: finalDamage === 0 && typingPercentage === 0, // completely missed
    effectiveness,
    effectivenessLabel: getEffectivenessLabel(effectiveness),
    critical: false, // Removed critical RNG to ensure pure skill
  };
}


/**
 * AI move selection – picks the best move against the current opponent
 */
export function getAIMove(enemyPokemon, playerPokemon) {
  let bestMove = null;
  let bestScore = -Infinity;

  for (const move of enemyPokemon.moves) {
    if (move.currentPp <= 0) continue;

    const effectiveness = getEffectiveness(move.type, playerPokemon.types);
    const stab = enemyPokemon.types.includes(move.type) ? 1.5 : 1;
    const expectedDamage = move.power * effectiveness * stab * (move.accuracy / 100);

    // Add some randomness to AI decisions
    const score = expectedDamage * (0.85 + Math.random() * 0.3);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  // Fallback: pick first available move
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
