const BAR_COUNT = 72;

function barStyle(i: number): React.CSSProperties {
  const duration = 0.5 + (i % 9) * 0.11 + ((i * 7) % 5) * 0.07;
  const delay = -((i * 0.19) % duration);
  const eqMin = 0.06 + (i % 6) * 0.025;
  const eqMax = 0.4 + (i % 13) * 0.045;

  return {
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    ['--eq-min' as string]: String(eqMin),
    ['--eq-max' as string]: String(eqMax),
    opacity: 0.12 + (i % 5) * 0.04,
  };
}

export default function EqualizerBackground() {
  return (
    <div className="eq-bg" aria-hidden="true">
      <div className="eq-bg__bars">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div key={i} className="eq-bg__bar" style={barStyle(i)} />
        ))}
      </div>
    </div>
  );
}
