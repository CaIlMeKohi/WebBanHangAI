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
  const progressStyle = (currentValue: number) =>
    ({
      "--slider-progress": `${((currentValue - min) / (max - min)) * 100}%`,
    }) as CSSProperties;

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
        aria-label="Giá tối thiểu"
        style={progressStyle(start)}
        onChange={(event) => updateStart(Number(event.target.value))}
        className="price-range-slider w-full"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={end}
        aria-label="Giá tối đa"
        style={progressStyle(end)}
        onChange={(event) => updateEnd(Number(event.target.value))}
        className="price-range-slider w-full"
      />
    </div>
  );
}
import type { CSSProperties } from "react";
