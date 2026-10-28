/* Worlds Beyond persistence boundary, browser-independent except injected storage.
 * Character data belongs to a player; game data belongs to a session/DM.
 * The live site still uses the existing v1 localStorage keys and JSON files.
 *
 * A future cloud adapter can implement the same character/game contract without
 * changing combat rules or moving a game's fog/enemies into a character.
 */
(function () {
  'use strict';

  const CHARACTER_KEY = 'worlds-beyond-sheet-v1';
  const GAME_KEY = 'worlds-beyond-game-v1';
  const CHARACTER_FORMAT = 'worlds-beyond-character';
  const CHARACTER_VERSION = 1;

  const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const copy = v => JSON.parse(JSON.stringify(v));

  function parseStoredValue(text) {
    if (text == null || text === '') return null;
    try {
      const value = JSON.parse(text);
      return isRecord(value) ? value : null;
    } catch (err) {
      return null; // Invalid browser data must not prevent app startup.
    }
  }

  // Return the existing character state, not an alternate cloud-only data shape.
  // Full field normalization remains in the character rules code for now.
  function importCharacter(value) {
    if (!isRecord(value)) return null;
    if (value.format === CHARACTER_FORMAT) {
      if (value.version !== CHARACTER_VERSION || !isRecord(value.state)) return null;
      return copy(value.state);
    }
    // Historical single-file drafts were exported as raw character states.
    if (isRecord(value.fields) && isRecord(value.hist) && !('format' in value)) return copy(value);
    return null;
  }

  function parseCharacterFile(text) {
    try { return importCharacter(JSON.parse(text)); }
    catch (err) { return null; }
  }

  function characterEnvelope(state, timestamp) {
    if (!isRecord(state)) throw new TypeError('Character state must be a plain object.');
    return {
      format: CHARACTER_FORMAT,
      version: CHARACTER_VERSION,
      exported: timestamp === undefined ? new Date().toISOString() : timestamp,
      state: copy(state)
    };
  }
  function exportCharacter(state, timestamp) {
    return JSON.stringify(characterEnvelope(state, timestamp));
  }

  function createLocalRepositories(storageProvider) {
    if (typeof storageProvider !== 'function') throw new TypeError('A storage provider is required.');
    const storage = () => {
      const result = storageProvider();
      if (!result || typeof result.getItem !== 'function' ||
          typeof result.setItem !== 'function') throw new Error('Browser storage unavailable.');
      return result;
    };
    const read = key => parseStoredValue(storage().getItem(key));
    const write = (key, value) => {
      if (!isRecord(value)) throw new TypeError('Save value must be an object.');
      storage().setItem(key, JSON.stringify(value));
    };
    const remove = key => storage().removeItem(key);

    return {
      characters: {
        key: CHARACTER_KEY,
        load: () => read(CHARACTER_KEY),
        save: state => write(CHARACTER_KEY, state),
        remove: () => remove(CHARACTER_KEY)
      },
      games: {
        key: GAME_KEY,
        load: () => read(GAME_KEY),
        save: game => write(GAME_KEY, game)
      }
    };
  }

  // Useful for isolated DM prototype/tests. It deliberately cannot access
  // browser storage; no user data is uploaded by this module.
  function createMemoryRepositories() {
    let character = null, game = null;
    return {
      characters: {
        load: () => character == null ? null : copy(character),
        save: state => { if (!isRecord(state)) throw new TypeError('Invalid character'); character = copy(state); },
        remove: () => { character = null; }
      },
      games: {
        load: () => game == null ? null : copy(game),
        save: value => { if (!isRecord(value)) throw new TypeError('Invalid game'); game = copy(value); }
      }
    };
  }

  window.WBPersistence = {
    CHARACTER_KEY, GAME_KEY, CHARACTER_FORMAT, CHARACTER_VERSION,
    isRecord, parseStoredValue, importCharacter, parseCharacterFile,
    characterEnvelope, exportCharacter, createLocalRepositories, createMemoryRepositories
  };
})();
