// Presentation only: character files and secondary views live in a disclosure.
(() => {
  const menu = document.getElementById('characterMenu');
  const summary = menu.querySelector('summary');
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      summary.focus();
      event.preventDefault();
    }
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('#viewNav button')) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener('click', event => {
    // Download links click programmatically; they should not dismiss the menu.
    if (event.isTrusted && menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.getElementById('editCharacterDetails').addEventListener('click', () => {
    document.getElementById('charName').focus();
  });
})();
