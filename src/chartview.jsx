import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";
import { Avatar, AvatarTag, SceneArt, TypeGlyph, sceneForType } from "./components.jsx";
import { buildSeries, chartSpecs, chartTypes, rangeOptions, windowLabel } from "./charts.js";
import {
  BarChart,
  LineChart,
  MarkerChart,
  SessionChart,
  StackChart,
  formatHeadline,
} from "./chartkit.jsx";
import { clock, dayLabel } from "./format.js";
import { displayValues, specTitle, trType, trValue, typeOf } from "./data.js";
import { tr } from "./i18n.js";

// 概览数字下面那行说明，英文版按 valueKind 直接给，不逐句翻中文原文。
function headlineLabelEn(data) {
  if (data.rangeId === "day") return "That day";
  if (data.valueKind === "duration") return "Daily average";
  if (data.valueKind === "count") return "In this window";
  if (data.valueKind === "reading") return "Latest reading";
  return "Daily average";
}

function Plot({ data, onPick }) {
  if (data.spec.kind === "session") return <SessionChart data={data} onPick={onPick} />;
  if (data.spec.kind === "line") return <LineChart data={data} onPick={onPick} />;
  if (data.spec.kind === "stack") return <StackChart data={data} onPick={onPick} />;
  if (data.spec.kind === "marker") return <MarkerChart data={data} onPick={onPick} />;
  return <BarChart data={data} onPick={onPick} />;
}

// 图例只解释「分类」和「坐标轴」；每种图表怎么读，由卡片下方那句说明统一交代。
function Legend({ data, lang }) {
  const t = tr(lang).sheet;
  if (data.spec.kind === "stack") {
    return (
      <div className="legend">
        {data.stacks.map((stack, i) => (
          <span className="legenditem" key={stack.label}>
            <span className={`swatch layer-${i % 4}`} aria-hidden="true" />
            {stack.label}
            <span className="figure legendnum">
              {Math.round(stack.values.reduce((a, b) => a + b, 0) * 10) / 10}
            </span>
          </span>
        ))}
      </div>
    );
  }
  if (data.spec.kind === "session") {
    return (
      <div className="legend">
        <span className="legenditem hushed">{t.sessionAxis}</span>
      </div>
    );
  }
  return null;
}

// 图表下方的明细列表，让每个数据点可核对到具体记录和添加人。
const BREAK_FIRST = 8;
const BREAK_STEP = 10;

function Breakdown({ data, onOpenRecord, lang }) {
  const t = tr(lang).sheet;
  // 一次只铺 8 条，点一次「还有 N 条」再多展开 10 条。记录多的类型
  // （睡眠一个月能有几百条）全铺出来会把图表挤到屏幕外面去。
  const [limit, setLimit] = useState(BREAK_FIRST);

  const sorted = useMemo(
    () => data.rows.slice().sort((a, b) => new Date(b.at) - new Date(a.at)),
    [data.rows],
  );

  // 换类型、换粒度、翻页都要收回去，否则在睡眠展开了 200 条，
  // 切到别的类型还留着那个展开状态，看着像是没刷新。
  useEffect(() => {
    setLimit(BREAK_FIRST);
  }, [data.type.id, data.rangeId, data.offset]);

  const rows = sorted.slice(0, limit);
  const rest = sorted.length - rows.length;
  if (!rows.length) return null;
  const type = typeOf(data.type.id);
  return (
    <div className="breakdown">
      <div className="label breakhead">{t.detail}</div>
      {rows.map((row) => (
        <button
          type="button"
          className="breakrow"
          key={row.id}
          onClick={onOpenRecord ? () => onOpenRecord(row) : undefined}
        >
          <span className="when figure">
            {data.rangeId === "day" ? clock(row.at) : `${dayLabel(row.at, new Date(), lang)} ${clock(row.at)}`}
          </span>
          <span className="what">{trValue(type.summary(displayValues(row, lang), lang), lang) || "—"}</span>
          <AvatarTag memberId={row.memberId} />
        </button>
      ))}
      {rest > 0 ? (
        <button
          type="button"
          className="breakmore"
          onClick={() => setLimit((n) => n + BREAK_STEP)}
          aria-label={`${t.more}${rest}${t.moreSuffix}${lang === "en" ? ", " : "，"}${t.expandMore}`}
        >
          <span className="hushed">
            {t.more} <span className="figure">{rest}</span> {t.moreSuffix}
          </span>
          <span className="breakmore-do">
            {t.expandMore}
            <Icon.caret />
          </span>
        </button>
      ) : null}
    </div>
  );
}

// 点中图表上的柱子或数据点后弹出的浮层：列出这一格背后的记录，可以再点进详情。
function PickedSheet({ rows, onClose, onOpenRecord, lang }) {
  const t = tr(lang).sheet;
  const a = tr(lang).a11y;
  useEffect(() => {
    const esc = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  // 这张浮层必须挂到 body 上。它原来渲染在 .scrollarea 里，而那个容器带着
  // position: relative + z-index: 1，自成一个层叠上下文 —— 浮层的 z-index
  // 再高也只在容器内部排序，翻不过根层级的底部标签栏，于是被压在底栏下面，
  // 高度也被容器裁掉。其余浮层（抽屉、灯箱、确认框）本来就渲染在 .scrollarea
  // 之外，这里用 portal 把它送到同一层，表现才一致。
  return createPortal(
    <>
      <div className="scrim" onClick={onClose} />
      <div className="picksheet" role="dialog" aria-label={a.pickedRecords}>
        <header className="pickhead">
          <div className="grows">
            <h2>{rows.length > 1 ? `${rows.length} ${t.pickedMany}` : t.pickedOne}</h2>
            <div className="hushed pickdate">{dayLabel(rows[0].at, new Date(), lang)}</div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} title={a.close} aria-label={a.closePanel}>
            <Icon.close />
          </button>
        </header>
        <div className="picklist">
          {rows.map((row) => {
            const type = typeOf(row.typeId);
            return (
              <button type="button" className="pickrow" key={row.id} onClick={() => onOpenRecord(row)}>
                <span className="when figure">{clock(row.at)}</span>
                <TypeGlyph typeId={type.id} glyph={type.glyph} />
                <span className="what">
                  <span className="nm">{trType(type, lang)}</span>
                  <span className="dt hushed">{trValue(type.summary(displayValues(row, lang), lang), lang) || "—"}</span>
                </span>
                <AvatarTag memberId={row.memberId} />
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function ChartsView({ records, onOpenRecord, lang }) {
  const t = tr(lang).sheet;
  const c = tr(lang).common;
  const [typeId, setTypeId] = useState("sleep");
  const [rangeId, setRangeId] = useState("week");
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState(null);
  const [pickedIndex, setPickedIndex] = useState(null);
  const stripRef = useRef(null);

  const data = useMemo(
    () => buildSeries(typeId, records, rangeId, new Date(), offset),
    [typeId, records, rangeId, offset],
  );
  const headline = formatHeadline(data, lang);
  const spec = chartSpecs[typeId];

  // 换类型或换粒度都回到最近一段，否则用户会停在一个空窗口里。
  useEffect(() => {
    setOffset(0);
    setPicked(null);
    setPickedIndex(null);
  }, [typeId, rangeId]);

  const pickedRows = useMemo(() => {
    if (!picked) return [];
    const set = new Set(picked);
    return records.filter((r) => set.has(r.id)).sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [picked, records]);

  // 切换类型时把选中的胶囊滚到视野里，手机上尤其需要。
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector(".typetab.on");
    if (active) active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [typeId]);

  const rangeLabel = windowLabel(rangeId, offset, new Date(), lang);

  return (
    <div className="view">
      <div className="typestrip" ref={stripRef}>
        {chartTypes.map((type) => (
          <button
            type="button"
            key={type.id}
            className={`typetab${type.id === typeId ? " on" : ""}`}
            onClick={() => setTypeId(type.id)}
          >
            <TypeGlyph typeId={type.id} glyph={type.glyph} small />
            {trType(type, lang)}
          </button>
        ))}
      </div>

      <section className="card chartcard artcard">
        {/* 成长曲线那幅画铺在图表卡里当背景，数据浮在它上面 */}
        <SceneArt name="bannerChart" className="cardwash" />
        <header className="chartcap">
          <div className="grows">
            <div className="label">{specTitle(spec, lang)}</div>
            <div className="bignum">
              <span className="figure">{headline.value}</span>
              {headline.unit ? <span className="bigunit">{headline.unit}</span> : null}
            </div>
            <div className="hushed chartsub">
              {lang === "en" ? headlineLabelEn(data) : data.headlineLabel} · {rangeLabel}
            </div>
          </div>
          <div className="segtrack" role="tablist" aria-label={t.granularity}>
            {rangeOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                role="tab"
                aria-selected={option.id === rangeId}
                className={`segtab${option.id === rangeId ? " on" : ""}`}
                onClick={() => setRangeId(option.id)}
              >
                {lang === "en" ? option.nameEn : option.name}
              </button>
            ))}
          </div>
        </header>

        <div className="pager">
          <button
            type="button"
            className="pagebtn"
            onClick={() => setOffset((v) => v - 1)}
            aria-label={c.back}
            title={c.back}
          >
            <Icon.back />
          </button>
          <span className="pagelabel">{rangeLabel}</span>
          <button
            type="button"
            className="pagebtn"
            onClick={() => setOffset((v) => Math.min(0, v + 1))}
            disabled={offset >= 0}
            aria-label={c.forward}
            title={c.forward}
          >
            <Icon.forward />
          </button>
        </div>

        <div className="plotwrap">
          {data.empty ? (
            <div className="blank plotblank">
              <SceneArt name={sceneForType(data.type.id)} />
              <span>{t.emptyChart}{trType(data.type, lang)}{t.emptyChartSuffix}</span>
              <span className="hushed">
                {offset < 0 ? t.emptyChartHintBack : t.emptyChartHint}
              </span>
              {offset < 0 ? (
                <button type="button" className="action" onClick={() => setOffset(0)}>
                  {t.backToLatest}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <Plot
                data={{ ...data, lang, pickedIndex }}
                onPick={(ids, index) => {
                  setPicked(ids);
                  setPickedIndex(index ?? null);
                }}
              />
              <Legend data={data} lang={lang} />
            </>
          )}
        </div>

        <div className="chartfoot hushed">
          {lang === "en" && spec.noteEn ? spec.noteEn : spec.note}
        </div>
      </section>

      {picked && pickedRows.length ? (
        <PickedSheet
          rows={pickedRows}
          onClose={() => {
            setPicked(null);
            setPickedIndex(null);
          }}
          lang={lang}
          onOpenRecord={(row) => {
            setPicked(null);
            setPickedIndex(null);
            if (onOpenRecord) onOpenRecord(row);
          }}
        />
      ) : null}

      {!data.empty ? (
        <section className="card spotcard">
          <SceneArt name="barchart" className="cardspot" />
          <div className="card-body">
            <Breakdown data={data} onOpenRecord={onOpenRecord} lang={lang} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
