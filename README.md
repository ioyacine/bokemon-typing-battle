# Bokemon: Typing Battle ⌨️🔥💧🍃

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

Bokemon is a modern Pokémon-inspired front-end game built with Next.js, focused on keyboard-based battles, progressive levels, interactive gameplay, smooth animations, sound effects, and a polished responsive UI that makes the experience both fun and skill-driven.

---

## 🎮 Overview

Welcome to the Typing Battle Arena! Instead of selecting attacks from a menu and relying on random chance, **Bokemon** challenges your fast-twitch typing reflexes. Draft a team of three Pokémon, face off against increasingly difficult computer opponents across a 10-level campaign, and type words rapidly and accurately to determine the exact Power of your attacks and blocks.

No randomness. No luck. Just pure keyboard skill!

---

## ✨ Key Features

*   **10-Level Progressive Campaign:** Draft your team and select a difficulty level. As you progress, the timer speeds up and you face harder enemy teams.
*   **1,000+ Word Bank:** Integrated dictionary engine utilizing three tiers of difficulty. Every level prompts you with completely real English words.
*   **Exact Deterministic Math:** Your exact typing accuracy determines your attack power and defense blocking. Type 80% correctly? Deal 80% damage.
*   **1-PP Strategic Movesets:** Every Pokémon is loaded with 4 distinct elemental attacks. Each attack can only be used *once* per battle, forcing strategic rotation.
*   **Elemental Visual FX:** Punchy CSS keyframe animations bring hits to life. Watch out for red burn-flashes, yellow zap-shakes, and splashing waves!
*   **Synthesized Web Audio Engine:** Fully retro-inspired 8-bit sound effects (generated mathematically via the browser) for hits, success, and navigation.
*   **Polished UI/UX:** Smooth transitions, confirmation dialogs for important actions, responsive design, and real-time visual feedback throughout the game.

---

## 🛠️ Technologies Used

-   **Framework:** Next.js (App Router)
-   **Library:** React 18
-   **Styling:** Pure Modern CSS (CSS Modules & Global Variables)
-   **Audio:** Native Web Audio API (Oscillators)
-   **Data:** Local JSON architecture (18 fully statted classic Pokémon)

---

## 🚀 How to Run Locally

You can run this project effortlessly on your local machine using Node.js.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ioyacine/bokemon-typing-battle.git
    ```

2.  **Navigate into the directory:**
    ```bash
    cd bokemon-typing-battle
    ```

3.  **Install the dependencies:**
    ```bash
    npm install
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```

5.  **Play the Game:**
    Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

---

## 📌 Important Notes

-   **Sound Permissions:** The browser may require you to interact with the screen first (clicking "Start") before allowing the Web Audio API to play sounds.
-   **Responsiveness:** While playable on mobile keyboards, the game is heavily optimized for a tactile desktop keyboard experience.

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---

**Tags/Topics:** `nextjs`, `react`, `frontend`, `game`, `typing-game`, `pokemon-inspired`, `responsive`
