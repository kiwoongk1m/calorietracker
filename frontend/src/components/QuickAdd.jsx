// Quick-add chips: one-tap re-add of your custom foods, favorites, and recently
// logged foods into the current meal. Custom chips add the saved food and can be
// deleted; favorite/recent chips add by name and can be starred. Presentational.

import { isFavorite } from '../lib/favorites.js';

export default function QuickAdd({
  favorites,
  recents,
  customFoods = [],
  onAdd,
  onAddCustom,
  onToggleFavorite,
  onRemoveCustom,
}) {
  // Favorites first, then recents that aren't already favorited.
  const favKeys = new Set(favorites.map((f) => (f.name || '').toLowerCase()));
  const extras = recents.filter((r) => !favKeys.has((r.name || '').toLowerCase()));
  const dbItems = [...favorites, ...extras];

  if (dbItems.length === 0 && customFoods.length === 0) return null;

  return (
    <section className="quick-add" aria-label="Quick add">
      {customFoods.length > 0 && (
        <>
          <span className="quick-add-label">Your custom foods</span>
          <div className="quick-add-chips">
            {customFoods.map((food) => (
              <div key={food.id} className="qa-chip qa-chip-custom">
                <button
                  className="qa-add"
                  onClick={() => onAddCustom(food)}
                  title={`Add ${food.name} (≈${food.kcal} kcal)`}
                >
                  {food.name}
                </button>
                <button
                  className="qa-remove"
                  onClick={() => onRemoveCustom(food.id)}
                  aria-label={`Delete custom food ${food.name}`}
                  title="Delete custom food"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {dbItems.length > 0 && (
        <>
          <span className="quick-add-label">Quick add</span>
          <div className="quick-add-chips">
            {dbItems.map((food) => {
              const fav = isFavorite(food.name, favorites);
              return (
                <div key={food.name} className="qa-chip">
                  <button
                    className={`qa-star ${fav ? 'qa-star-on' : ''}`}
                    onClick={() => onToggleFavorite(food)}
                    aria-label={
                      fav ? `Unfavorite ${food.name}` : `Favorite ${food.name}`
                    }
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
        </>
      )}
    </section>
  );
}
