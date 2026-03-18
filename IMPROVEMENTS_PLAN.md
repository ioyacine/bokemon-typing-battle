# Bokemon Competitive Redesign Plan

## New Core Gameplay: Real-Time Racing Combat ⚡

### Current Problem
- Turn-based system feels slow and passive
- Increasing timer reduces tension instead of increasing it
- Outcome is predetermined before battle starts
- Lacking excitement and dynamic gameplay

### New Solution: Simultaneous Real-Time Typing Races

**How It Works:**
1. **Same word for both**: A single word appears on screen
2. **Both race to type it**: Player and AI type the SAME word simultaneously  
3. **Speed + Accuracy matter**: Whoever types it correctly FIRST wins the exchange
4. **Damage based on margin**: How much faster you complete = power multiplier
5. **8-Strike System**: Lose 8 exchanges (exchanges, not just battles) → Game Over

### Key Differences from Current
- ✅ **Real-time competition** (not turn-based, not boring wait times)
- ✅ **Speed IS important** (not just "be accurate and wait")
- ✅ **Dynamic outcomes** (you don't know who will win each round)
- ✅ **Tense time windows** (short, exciting races)
- ✅ **Better pacing** (quick exchanges, multiple rounds per level)
- ✅ **More engaging** (feeling of direct competition)

### 8-Strike System
- Start with 8 lives/strikes
- Each typing exchange you LOSE = 1 strike
- 0 strikes remaining = Battle Over (You Lost)
- Win 5 exchanges before losing 8 = Victory

### Button Placement & Controls
- **Pause Button**: Top-right (already there)
- **Pause Menu**: Resume + Quit to Main Menu + Exit Game
- **Result Screen**: Victory/Defeat with clear action buttons
- **Main Menu**: Settings + About + Quit Game
- **Battle Screen**: Clear "Forfeit" option during battle

### Confirmation Dialogs
- Quit to Menu: "Are you sure? You'll lose this battle"
- Exit Game: "Are you sure you want to exit?"
- Forfeit: "Forfeit this battle? You will lose a strike"

## Implementation Steps

1. ✅ Create competitive QTE overlay (both players visible)
2. ✅ Implement real-time race logic
3. ✅ Add 8-strike tracking system
4. ✅ Better button placement
5. ✅ Confirmation dialogs
6. ✅ Simplify word selection (no multiple words per turn)
7. ✅ Speed-based damage multiplier
8. ✅ GitHub improvements check

## Gameplay Flow

**Battle Start:**
- Player sees strike counter: 8/8 strikes remaining
- Both player and AI visible on screen
- Word appears at top: "CHAMPION"

**Simultaneous Typing:**
- Player thinks: "C-H-A-M-P-I-O-N"
- AI is attempting simultaneously
- Player types: C, H, A (3/8 correct)
- AI types: (simulated delay based on difficulty)
- If player finishes first AND accurately: PLAYER WINS THIS EXCHANGE
- Damage dealt: Based on speed advantage

**Exchange Result:**
- Show who won
- Show damage dealt
- Update HP bars
- Move to next exchange
- Counter: "Strike 1/8 remaining" or "Victory! 6/8 strikes remaining"

**Victory Condition:**
- Player wins 5 exchanges before losing 8 → Level Complete
- Show final stats

**Defeat Condition:**
- Player loses 8 exchanges → Game Over
- Show how many exchanges won
