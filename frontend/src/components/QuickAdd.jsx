// Quick-add chips: one-tap re-add of favorite and recently-logged foods into
// the current meal. Each chip adds the food (taps the name) and can be starred
// to favorite/unfavorite it. Presentational — data + actions come from App.

import { isFavorite } from '../lib/favorites.js';

export default function QuickAdd({ favorites, recents, onAdd, onToggleFavorite }) {
  // Favorites first, then recents that aren't already favorited.
  const favKeys = new Set(favorites.map((f) => (f.name || '').toLowerCase()));
  const extras = recents.filter((r) => !favKeys.has((r.name || '').toLowerCase()));
  const items = [...favorites, ...extras];
  if (items.length === 0) return null;

  return (
    <section className="quick-add" aria-label="Quick add">
      <span className="quick-add-label">Quick add</span>
      <div className="quick-add-chips">
        {items.map((food) => {
          const fav = isFavorite(food.name, favorites);
          return (
            <div key={food.name} className="qa-chip">
              <button
                className={`qa-star ${fav ? 'qa-star-on' : ''}`}
                onClick={() => onToggleFavorite(food)}
                aria-label={fav ? `Unfavorite ${food.name}` : `Favorite ${food.name}`}
                aria-pressed={fav}
                title={fav ? 'Remove from favorites' : 'Save to favorites'}
              >
                {fav ? '★' : '☆'}
              </button>
              <button
                className="qa-add"
                onClick={() => onAdd(food.name)}
                title={`Add ${food.name}`}
              >
                {food.name}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
