import { useLayoutEffect, useRef, useState } from "react";
import { formatDuration, specTitle, trValue } from "./data.js";
import { tr } from "./i18n.js";

// 图表按容器的实际宽度建立坐标系：1 用户单位 = 1 CSS 像素。
// 于是 viewBox 不需要非等比拉伸，轴标签永远是真实字号，
// 窄屏上也不会被压扁或缩成一团。
const H = 236;
const PAD = { top: 16, right: 14, bottom: 26, left: 42 };

function useChartWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(680);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setWidth(Math.max(240, Math.round(node.getBoundingClientRect().width)));
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}


// 全站图表统一的上色规则：
//   有选中的某一天 -> 只有那一天是主色
//   没有选中       -> 只有今天是主色
//   其余           -> 一律中性灰
// 翻页到过去的窗口时 todayIndex 是 -1，那一屏就整屏是灰的，符合“今日才是紫”。
// 折线系列名：spec.series 上带一份英文说法。
function seriesLabel(line, lang) {
  return lang === "en" && line.labelEn ? line.labelEn : line.label;
}

function toneOf(index, data) {
  const picked = data.pickedIndex;
  if (picked !== undefined && picked !== null && picked >= 0) {
    return index === picked ? "lead" : "mute";
  }
  return index === data.todayIndex ? "lead" : "mute";
}

function plotBox(width) {
  return { w: Math.max(60, width - PAD.left - PAD.right), h: H - PAD.top - PAD.bottom };
}

function niceMax(value) {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const step = value / mag;
  const nice = step <= 1 ? 1 : step <= 2 ? 2 : step <= 2.5 ? 2.5 : step <= 5 ? 5 : 10;
  return nice * mag;
}

// 窄屏放不下 30 个日期标签，按可用宽度决定隔几个画一个。
const WEEK_ZH = "日一二三四五六";
const WEEK_EN = ["S", "M", "T", "W", "T", "F", "S"];

function dayTicks(days, rangeId, width, lang = "zh") {
  if (rangeId === "day") return [];
  const slot = plotBox(width).w / days.length;
  if (rangeId === "week") {
    return days.map((d, i) => ({
      i,
      label: lang === "en" ? WEEK_EN[d.getDay()] : WEEK_ZH[d.getDay()],
    }));
  }
  const every = slot >= 26 ? 5 : slot >= 16 ? 7 : 10;
  return days
    .map((d, i) => ({ i, label: d.getDate() }))
    .filter((t) => t.i % every === 0 || t.i === days.length - 1);
}

function barWidth(step, rangeId) {
  const ratio = rangeId === "month" ? 0.66 : rangeId === "week" ? 0.46 : 0.3;
  return Math.max(2.5, Math.min(28, step * ratio));
}

function Frame({ children, label, innerRef, width }) {
  return (
    <div className="plotbox" ref={innerRef}>
      <svg className="plot" viewBox={`0 0 ${width} ${H}`} width={width} height={H} role="img" aria-label={label}>
        {children}
      </svg>
    </div>
  );
}

function Grid({ max, unit, width, lines = 3 }) {
  const box = plotBox(width);
  const rows = [];
  for (let i = 0; i <= lines; i += 1) {
    const y = PAD.top + (box.h / lines) * i;
    const value = max - (max / lines) * i;
    rows.push(
      <g key={i}>
        <line className="axisline" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
        <text className="axistext" x={PAD.left - 8} y={y + 3.5} textAnchor="end">
          {Math.round(value * 10) / 10}
        </text>
      </g>,
    );
  }
  return (
    <g>
      {rows}
      {unit ? (
        <text className="axisunit" x={PAD.left - 8} y={PAD.top - 6} textAnchor="end">
          {unit}
        </text>
      ) : null}
    </g>
  );
}

function HourGrid({ width, hours }) {
  const box = plotBox(width);
  return (
    <g>
      {hours.map((h) => {
        const y = PAD.top + (box.h * h) / 24;
        return (
          <g key={h}>
            <line className="axisline" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
            <text className="axistext" x={PAD.left - 8} y={y + 3.5} textAnchor="end">
              {String(h).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DayAxis({ days, rangeId, width, lang }) {
  const box = plotBox(width);
  const step = box.w / days.length;
  return (
    <g>
      {dayTicks(days, rangeId, width, lang).map((tick) => (
        <text
          key={tick.i}
          className="axistext"
          x={PAD.left + step * (tick.i + 0.5)}
          y={H - PAD.bottom + 16}
          textAnchor="middle"
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
}

/* 睡眠：每段睡眠画在 24 小时轴上，一天一列 */
export function SessionChart({ data, onPick }) {
  const [ref, width] = useChartWidth();
  const { days, segments, rangeId, spec } = data;
  const box = plotBox(width);
  const step = box.w / days.length;
  const barW = barWidth(step, rangeId);
  return (
    <Frame innerRef={ref} width={width} label={`${specTitle(spec, data.lang)} · ${tr(data.lang).a11y.chartSessions}`}>
      <HourGrid width={width} hours={[0, 6, 12, 18, 24]} />
      {segments.map((list, i) =>
        list.map((seg, j) => {
          const y = PAD.top + (box.h * seg.from) / 1440;
          const h = Math.max(2, (box.h * (seg.to - seg.from)) / 1440);
          return (
            <rect
              key={`${i}-${j}`}
              className={`session tone-${toneOf(i, data)}${onPick ? " tappable" : ""}`}
              x={PAD.left + step * (i + 0.5) - barW / 2}
              y={y}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              onClick={onPick ? () => onPick([seg.id], i) : undefined}
            >
              {onPick ? <title>{specTitle(spec, data.lang)}</title> : null}
            </rect>
          );
        }),
      )}
      <DayAxis days={days} rangeId={rangeId} width={width} lang={data.lang} />
    </Frame>
  );
}

/* 每日合计 / 次数柱 */
export function BarChart({ data, onPick }) {
  const [ref, width] = useChartWidth();
  const { days, values, dayRows, rangeId, spec } = data;
  const box = plotBox(width);
  const max = niceMax(Math.max(...values, 1));
  const step = box.w / days.length;
  const barW = barWidth(step, rangeId);
  return (
    <Frame innerRef={ref} width={width} label={`${specTitle(spec, data.lang)} · ${tr(data.lang).a11y.chartDaily}`}>
      <Grid max={max} unit={trValue(spec.unit, data.lang)} width={width} />
      {values.map((value, i) => {
        const h = value > 0 ? Math.max(2, (box.h * value) / max) : 0;
        if (!h) return null;
        const ids = dayRows ? dayRows[i] : [];
        return (
          <rect
            key={i}
            className={`barcol tone-${toneOf(i, data)}${onPick && ids.length ? " tappable" : ""}`}
            x={PAD.left + step * (i + 0.5) - barW / 2}
            y={PAD.top + box.h - h}
            width={barW}
            height={h}
            rx={Math.min(4, barW / 2)}
            onClick={onPick && ids.length ? () => onPick(ids, i) : undefined}
          />
        );
      })}
      <DayAxis days={days} rangeId={rangeId} width={width} lang={data.lang} />
    </Frame>
  );
}

/* 分类堆叠柱 */
export function StackChart({ data, onPick }) {
  const [ref, width] = useChartWidth();
  const { days, stacks, dayTotals, dayRows, rangeId, spec } = data;
  const box = plotBox(width);
  const max = niceMax(Math.max(...dayTotals, 1));
  const step = box.w / days.length;
  const barW = barWidth(step, rangeId);
  return (
    <Frame innerRef={ref} width={width} label={`${specTitle(spec, data.lang)} · ${tr(data.lang).a11y.chartStack}`}>
      <Grid max={max} unit={trValue(spec.unit, data.lang)} width={width} />
      {days.map((_, i) => {
        let acc = 0;
        return stacks.map((stack, si) => {
          const value = stack.values[i];
          if (!value) return null;
          const h = Math.max(2, (box.h * value) / max);
          const y = PAD.top + box.h - acc - h;
          acc += h;
          const ids = dayRows ? dayRows[i] : [];
          return (
            <rect
              key={`${i}-${si}`}
              className={`stackcol tone-${toneOf(i, data)} layer-${si % 4}${onPick && ids.length ? " tappable" : ""}`}
              x={PAD.left + step * (i + 0.5) - barW / 2}
              y={y}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              onClick={onPick && ids.length ? () => onPick(ids, i) : undefined}
            />
          );
        });
      })}
      <DayAxis days={days} rangeId={rangeId} width={width} lang={data.lang} />
    </Frame>
  );
}

/* 折线：连续测量 */
export function LineChart({ data, onPick }) {
  const [ref, width] = useChartWidth();
  const [active, setActive] = useState(0);
  const { days, series, rangeId, spec } = data;
  const box = plotBox(width);
  const line = series[active] || series[0];
  const values = line.points.map((p) => p.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  const pad = Math.max((rawMax - rawMin) * 0.25, rawMax * 0.04, 0.5);
  const min = spec.band ? Math.min(rawMin - pad, spec.band[0] - 0.3) : rawMin - pad;
  const max = spec.band ? Math.max(rawMax + pad, spec.band[1] + 0.3) : rawMax + pad;
  const span = max - min || 1;
  const step = box.w / days.length;
  const px = (i) => PAD.left + step * (i + 0.5);
  const py = (v) => PAD.top + box.h - (box.h * (v - min)) / span;
  const path = line.points.map((p, i) => `${i ? "L" : "M"}${px(p.index).toFixed(1)} ${py(p.value).toFixed(1)}`).join(" ");

  return (
    <div className="linewrap">
      {series.length > 1 ? (
        <div className="serieskeys">
          {series.map((s, i) => (
            <button type="button" key={s.key} className={`seriespill${i === active ? " on" : ""}`} onClick={() => setActive(i)}>
              {seriesLabel(s, data.lang)}
            </button>
          ))}
        </div>
      ) : null}
    <Frame innerRef={ref} width={width} label={`${specTitle(spec, data.lang)} · ${seriesLabel(line, data.lang)} ${tr(data.lang).a11y.chartLine}`}>
        {[0, 1, 2, 3].map((i) => {
          const y = PAD.top + (box.h / 3) * i;
          const value = max - (span / 3) * i;
          return (
            <g key={i}>
              <line className="axisline" x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} />
              <text className="axistext" x={PAD.left - 8} y={y + 3.5} textAnchor="end">
                {Math.round(value * 10) / 10}
              </text>
            </g>
          );
        })}
        {spec.band ? (
          <rect
            className="band"
            x={PAD.left}
            y={py(spec.band[1])}
            width={box.w}
            height={Math.max(2, py(spec.band[0]) - py(spec.band[1]))}
          />
        ) : null}
        {line.points.length > 1 ? <path className="trend" d={path} /> : null}
        {line.points.map((p) => (
          <circle
            key={p.id}
            className={`dot tone-${toneOf(p.index, data)}${onPick ? " tappable" : ""}`}
            cx={px(p.index)}
            cy={py(p.value)}
            r={onPick ? 5.2 : 3.6}
            onClick={onPick ? () => onPick([p.id], p.index) : undefined}
          />
        ))}
        <text className="axisunit" x={PAD.left - 8} y={PAD.top - 6} textAnchor="end">
          {trValue(line.unit, data.lang)}
        </text>
        <DayAxis days={days} rangeId={rangeId} width={width} lang={data.lang} />
      </Frame>
    </div>
  );
}

/* 稀疏事件标记 */
export function MarkerChart({ data, onPick }) {
  const [ref, width] = useChartWidth();
  const { days, marks, rangeId, spec } = data;
  const box = plotBox(width);
  const step = box.w / days.length;
  return (
    <Frame innerRef={ref} width={width} label={`${specTitle(spec, data.lang)} · ${tr(data.lang).a11y.chartEvents}`}>
      <HourGrid width={width} hours={[0, 12, 24]} />
      {marks.map((mark) => {
        const x = PAD.left + step * (mark.index + 0.5);
        const y = PAD.top + (box.h * mark.minute) / 1440;
        return (
          <g key={mark.id}>
            <line className="stem" x1={x} x2={x} y1={y} y2={PAD.top + box.h} />
            <circle
              className={`mark tone-${toneOf(mark.index, data)}${onPick ? " tappable" : ""}`}
              cx={x}
              cy={y}
              r={onPick ? 6 : 4.4}
              onClick={onPick ? () => onPick([mark.id], mark.index) : undefined}
            />
          </g>
        );
      })}
      <DayAxis days={days} rangeId={rangeId} width={width} lang={data.lang} />
    </Frame>
  );
}

export function formatHeadline(data, lang = "zh") {
  if (!data) return { value: "—", unit: "" };
  if (data.valueKind === "duration") {
    const minutes = Math.round(data.headline);
    if (!minutes) return { value: "0", unit: "m" };
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? { value: `${h}`, unit: `h ${m} m` } : { value: `${m}`, unit: "m" };
  }
  const rounded = Math.round(data.headline * 10) / 10;
  return { value: `${rounded}`, unit: trValue(data.headlineUnit || "", lang) };
}

export { formatDuration };
