// ============================================================
//  MAIN  — app entry point, wires menu ↔ game
// ============================================================

(function () {
  'use strict';

  // ---- element refs ----
  const mainMenu    = document.getElementById('main-menu');
  const gameScreen  = document.getElementById('game-screen');
  const loadDialog  = document.getElementById('load-dialog');
  const btnNewGame  = document.getElementById('btn-new-game');
  const btnLoad     = document.getElementById('btn-load');
  const btnBackMenu = document.getElementById('btn-back-menu');
  const btnLoadCancel = document.getElementById('btn-load-cancel');
  const saveSlots   = document.getElementById('save-slots');

  // ---- show menu on start ----
  Menu.show();

  // ---- NEW GAME ----
  btnNewGame.addEventListener('click', () => {
    Menu.hide();
    gameScreen.classList.remove('hidden');
    Game.start(null);
  });

  // ---- LOAD GAME ----
  btnLoad.addEventListener('click', () => {
    populateSaveSlots();
    loadDialog.classList.remove('hidden');
  });

  btnLoadCancel.addEventListener('click', () => {
    loadDialog.classList.add('hidden');
  });

  function populateSaveSlots() {
    const saves = Game.getSaves();
    saveSlots.innerHTML = '';
    saves.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'save-slot' + (s ? '' : ' empty');
      btn.textContent = s
        ? `SLOT ${i + 1}  —  ${formatDate(s.timestamp)}`
        : `SLOT ${i + 1}  —  EMPTY`;
      btn.addEventListener('click', () => {
        if (!s) return;
        loadDialog.classList.add('hidden');
        Menu.hide();
        gameScreen.classList.remove('hidden');
        Game.start(s);
      });
      saveSlots.appendChild(btn);
    });
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return [
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
      String(d.getFullYear()).slice(-2),
    ].join('/') + ' ' +
    [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
    ].join(':');
  }

  // ---- BACK TO MENU ----
  btnBackMenu.addEventListener('click', () => {
    // Auto-save to slot 0
    Game.save(0);
    Game.stop();
    gameScreen.classList.add('hidden');
    Menu.show();
  });

  // ---- VERSION / CHANGELOG ----
  const versionLabel    = document.getElementById('version-label');
  const changelogPopup  = document.getElementById('changelog-popup');
  const btnChangelogClose = document.getElementById('btn-changelog-close');

  versionLabel.addEventListener('click', () => {
    changelogPopup.classList.remove('hidden');
  });
  btnChangelogClose.addEventListener('click', () => {
    changelogPopup.classList.add('hidden');
  });

  // ---- ESC key ----
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!changelogPopup.classList.contains('hidden')) {
        changelogPopup.classList.add('hidden');
        return;
      }
      if (!loadDialog.classList.contains('hidden')) {
        loadDialog.classList.add('hidden');
        return;
      }
      if (!gameScreen.classList.contains('hidden')) {
        btnBackMenu.click();
      }
    }
  });
})();
