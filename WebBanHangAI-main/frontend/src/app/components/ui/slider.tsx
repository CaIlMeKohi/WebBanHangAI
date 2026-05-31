type SliderProps = {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
};

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  className = "",
}: SliderProps) {
  const [start, end] = value;

  function updateStart(nextValue: number) {
    onValueChange([Math.min(nextValue, end), end]);
  }

  function updateEnd(nextValue: number) {
    onValueChange([start, Math.max(nextValue, start)]);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={start}
        onChange={(event) => updateStart(Number(event.target.value))}
        className="w-full accent-neutral-900"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={end}
        onChange={(event) => updateEnd(Number(event.target.value))}
        className="w-full accent-neutral-900"
      />
    </div>
  );
}
