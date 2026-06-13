// Pure presentational nutrition card. Receives the output of calculateNutrition
// plus the matched entry name, and renders calories + macros with the basis
// (weighed vs typical serving) always visible.

function Macro({ label, value, unit }) {
  return (
    <div className="macro">
      <span className="macro-value">
        {value}
        <span className="macro-unit">{unit}</span>
      </span>
      <span className="macro-label">{label}</span>
    </div>
  );
}

export default function NutritionCard({ name, result }) {
  if (!result) return null;

  const isWeighed = result.basis === 'weighed';

  return (
    <section className="card" aria-label="Nutrition estimate">
      <header className="card-head">
        <h2 className="card-title">{name}</h2>
        <span className={`basis basis-${result.basis}`}>
          {isWeighed
            ? `Weighed · ${result.grams} g`
            : `Typical serving · ${result.grams} g`}
        </span>
      </header>

      <div className="kcal">
        <span className="kcal-value">{result.kcal}</span>
        <span className="kcal-label">kcal</span>
      </div>

      <div className="macros">
        <Macro label="Protein" value={result.protein} unit="g" />
        <Macro label="Carbs" value={result.carbs} unit="g" />
        <Macro label="Fat" value={result.fat} unit="g" />
      </div>

      {!isWeighed && (
        <p className="card-note">
          Estimate based on a typical serving. Enter the weight in grams for an
          accurate number — weigh the food only (tare the plate).
        </p>
      )}
    </section>
  );
}
