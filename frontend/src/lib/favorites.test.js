import { describe, it, expect, beforeEach } from 'vitest';
import {
  getFavorites,
  isFavorite,
  toggleFavorite,
  clearFavorites,
} from './favorites.js';

beforeEach(() => clearFavorites());

describe('favorites', () => {
  it('adds and removes a favorite by name (case-insensitive)', () => {
    toggleFavorite({ name: 'Bananas, raw', fdcId: '1' });
    expect(getFavorites()).toHaveLength(1);
    expect(isFavorite('bananas, raw')).toBe(true);
    toggleFavorite({ name: 'BANANAS, RAW', fdcId: '1' }); // same food, different case
    expect(getFavorites()).toHaveLength(0);
    expect(isFavorite('Bananas, raw')).toBe(false);
  });

  it('ignores foods without a name', () => {
    toggleFavorite({ name: '', fdcId: 'x' });
    toggleFavorite(null);
    expect(getFavorites()).toHaveLength(0);
  });

  it('isFavorite works against a provided list (pure)', () => {
    const favs = [{ name: 'Apple', fdcId: '2' }];
    expect(isFavorite('apple', favs)).toBe(true);
    expect(isFavorite('pear', favs)).toBe(false);
  });
});
