import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import {
  Avatar,
  AvatarTag,
  Measure,
  SceneArt,
  ShotPlaceholder,
  TypeGlyph,
  spotByIndex,
  useNow,
  usePerson,
} from "./components.jsx";
import { ageLabel, animalOf, babyName, dayAge, rosterMembers, zodiacOf } from "./family.js";
import { displayValues, formatDuration, safeValues, typeOf, recordTypes, trGroup, trLabel, trType, trValue } from "./data.js";
import { tr } from "./i18n.js";
import { recordsOnDay } from "./derive.js";
import {
  columnsFor,
  isAllowedCount,
  maxMetrics,
  metricById,
  metricCatalog,
  minMetrics,
} from "./metrics.js";
import {
  clock,
  dayKey,
  dayLabel,
  fullDayLabel,
  monthGrid,
  monthKey,
  monthLabel,
  sameDay,
  sinceLabel,
  startOfDay,
  stopwatch,
} from "./format.js";

/* ── 今日 ─────────────────────────────────────────────────────────────────── */

// 点日期标题弹出的小日历。有记录的那天在数字下面点一个小点，
// 未来的日期和出生之前的日期都不可选。
function DatePicker({ value, byDay, birth, lang, onPick, onClose }) {
  const t = tr(lang).today;
  const [month, setMonth] = useState(() => startOfDay(value));
  const ref = useRef(null);

  useEffect(() => {
    const away = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const esc = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // 有记录的日子直接取分组表的键，和时间线用的是同一份分组。
  const marked = useMemo(() => new Set(byDay.keys()), [byDay]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const today = startOfDay(new Date());
  const birthDay = startOfDay(new Date(birth));
  const shift = (delta) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div className="calpop" ref={ref} role="dialog" aria-label={t.pickDate}>
      <header className="calhead">
        <button type="button" className="calnav" onClick={() => shift(-1)} aria-label={t.prevMonth} title={t.prevMonth}>
          <Icon.back />
        </button>
        <span className="calmonth">
          {lang === "en"
            ? month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
            : `${month.getFullYear()} 年 ${month.getMonth() + 1} 月`}
        </span>
        <button
          type="button"
          className="calnav"
          onClick={() => shift(1)}
          disabled={month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()}
          aria-label={t.nextMonth}
          title={t.nextMonth}
        >
          <Icon.forward />
        </button>
      </header>
      <div className="calweek">
        {t.weekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calgrid">
        {cells.map(({ date, outside }) => {
          const future = startOfDay(date) > today;
          const before = startOfDay(date) < birthDay;
          const disabled = future || before;
          const on = sameDay(date, value);
          return (
            <button
              type="button"
              key={date.toISOString()}
              className={`calcell${outside ? " outside" : ""}${on ? " on" : ""}${sameDay(date, today) ? " istoday" : ""}`}
              disabled={disabled}
              onClick={() => onPick(startOfDay(date))}
              aria-label={date.toLocaleDateString(lang === "en" ? "en-GB" : "zh-CN", { month: "long", day: "numeric" })}
              aria-current={on ? "date" : undefined}
            >
              <span className="figure">{date.getDate()}</span>
              {marked.has(dayKey(date.toISOString())) && !disabled ? <span className="caldot" /> : null}
            </button>
          );
        })}
      </div>
      <footer className="calfoot">
        <button type="button" className="action" onClick={() => onPick(today)}>
          {t.backToToday}
        </button>
      </footer>
    </div>
  );
}

// 今日页顶部的日期条：左右翻一天，中间点开小日历。
function DayBar({ value, byDay, birth, lang, onChange }) {
  const t = tr(lang).today;
  const [open, setOpen] = useState(false);
  const today = startOfDay(new Date());
  const birthDay = startOfDay(new Date(birth));
  const step = (delta) => {
    const next = new Date(startOfDay(value).getTime() + delta * 86400000);
    if (next > today || next < birthDay) return;
    onChange(next);
  };
  const atToday = sameDay(value, today);
  const atBirth = sameDay(value, birthDay);

  return (
    <div className="daybar">
      <button
        type="button"
        className="pagebtn"
        onClick={() => step(-1)}
        disabled={atBirth}
        aria-label={t.prevDay}
        title={t.prevDay}
      >
        <Icon.back />
      </button>

      <div className="daypick">
        <button
          type="button"
          className={`daytitle${open ? " open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className="daytext">{fullDayLabel(value, new Date(), lang)}</span>
          <Icon.caret />
        </button>
        {open ? (
          <DatePicker
            value={value}
            byDay={byDay}
            birth={birth}
            lang={lang}
            onClose={() => setOpen(false)}
            onPick={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        ) : null}
      </div>

      <button
        type="button"
        className="pagebtn"
        onClick={() => step(1)}
        disabled={atToday}
        aria-label={t.nextDay}
        title={t.nextDay}
      >
        <Icon.forward />
      </button>
    </div>
  );
}

function HeroCard({ latest, baby, lang, onEdit }) {
  const t = tr(lang).today;
  // 这几个间隔是要拿来判断该不该喂、该不该换的，页面开着就得自己走时。
  // 半分钟一跳，肉眼看不出延迟，也不至于每秒重渲染整张卡。
  const tick = useNow(true, 30000);
  const now = useMemo(() => new Date(tick), [tick]);

  const age = ageLabel(baby.birth, now, t);
  const days = dayAge(baby.birth, now);
  // 每类的最近一条来自派生层，避免这里再扫一遍数组、而别处扫的是另一份。
  const nursing = latest.get("nursing");
  const bottle = latest.get("bottle");
  const lastFeed =
    nursing && bottle ? (new Date(nursing.at) > new Date(bottle.at) ? nursing : bottle) : nursing || bottle;
  const lastSleep = latest.get("sleep");
  const lastDiaper = latest.get("diaper");
  const growth = latest.get("growth");
  const cells = [
    { k: t.sinceFeed, v: lastFeed ? sinceLabel(lastFeed.at, now, lang) : t.none },
    { k: t.sinceSleep, v: lastSleep ? sinceLabel(lastSleep.at, now, lang) : t.none },
    { k: t.sinceDiaper, v: lastDiaper ? sinceLabel(lastDiaper.at, now, lang) : t.none },
    { k: t.lastWeight, v: growth && safeValues(growth.values).weight ? `${growth.values.weight}` : "—", unit: growth && safeValues(growth.values).weight ? trValue("千克", lang) : "" },
  ];
  return (
    <section className="hero">
      <button type="button" className="heroline" onClick={onEdit} aria-label={`${tr(lang).a11y.editProfile} · ${babyName(baby, lang)}`}>
        <span className="portrait">
          <img src={baby.portrait || "/assets/logo.png"} alt="" />
        </span>
        <span className="grows">
          <span className="heroname">
            {babyName(baby, lang)}
            <Icon.pen />
          </span>
          <span className="herometa">
            {baby.gender !== "不填" ? `${trValue(baby.gender, lang)} · ` : ""}
            {age}
            {(() => {
              const z = zodiacOf(baby.birth, lang);
              const a = animalOf(baby.birth, lang);
              if (!z && !a) return "";
              const parts = [z, lang === "en" ? a : a ? `生肖${a}` : ""].filter(Boolean);
              return ` · ${parts.join(" · ")}`;
            })()}{" "}
            · {t.bornDay} <span className="figure">{days}</span> {t.bornDaySuffix}
          </span>
        </span>
      </button>
      <div className="statrow">
        {cells.map((cell) => (
          <div className="statcell" key={cell.k}>
            <span className="k">{cell.k}</span>
            <span className="v">
              <Measure text={cell.v} />
              {cell.unit ? <small>{cell.unit}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SleepTimer({ timer, dayRecords, isToday, lang, onStart, onPause, onResume, onFinish, onDiscard }) {
  const t = tr(lang).today;
  const now = useNow(Boolean(timer && timer.startedAt && !timer.pausedAt));
  const elapsed = useMemo(() => {
    if (!timer) return 0;
    const base = timer.pausedAt ? timer.pausedAt : now;
    return Math.max(0, base - timer.startedAt - timer.paused);
  }, [timer, now]);
  const running = Boolean(timer && !timer.pausedAt);

  // 面板上的睡眠总时长直接由这一天的睡眠记录算出来，
  // 和概览卡片、图表用的是同一份数据，不会出现两个数对不上。
  const sleepRows = dayRecords.filter((r) => r.typeId === "sleep");
  const sleepMinutes = sleepRows.reduce((total, r) => total + (Number(safeValues(r.values).minutes) || 0), 0);

  return (
    <section className={`timerpanel${timer ? " running" : ""}`}>
      {/* 夜空铺满整张睡眠卡当背景，弯月压在它上面，都在内容之下 */}
      <SceneArt name="sky" className="cardsky" />
      <SceneArt name="sleep" className="timermoon" />
      <header className="timerhead">
        <TypeGlyph typeId="sleep" glyph="sleep" lead={Boolean(timer)} />
        <div className="grows">
          <h2>{timer ? t.sleepTimer : isToday ? t.sleepToday : t.sleepOther}</h2>
          <div className="quiet" style={{ fontSize: 12 }}>
            {timer
              ? running
                ? t.sleepRunning
                : t.sleepPaused
              : `${sleepRows.length} ${t.segments} ${formatDuration(sleepMinutes)}`}
          </div>
        </div>
      </header>
      <div className="clockface">
        <span className="digits">{timer ? stopwatch(elapsed) : formatDuration(sleepMinutes)}</span>
        {/* 「开始于」这行始终占位（样式里留了一行的高度），只有计时时才有字。
            按条件整段拿掉的话，一按开始整张卡就长高一行，下面的日期条和
            概览会跟着往下跳一次，停止时再跳回来。 */}
        <span className="since">{timer ? `${t.startedAt} ${clock(timer.startedAt)}` : ""}</span>
      </div>
      <div className="timeractions">
        {!timer ? (
          <button type="button" className="action lead" onClick={onStart}>
            <Icon.play />
            {isToday ? t.start : t.startToday}
          </button>
        ) : (
          <>
            {running ? (
              <button type="button" className="action" onClick={onPause}>
                <Icon.pause />
                {t.pause}
              </button>
            ) : (
              <button type="button" className="action" onClick={onResume}>
                <Icon.play />
                {t.resume}
              </button>
            )}
            <button type="button" className="action lead" onClick={() => onFinish(elapsed)}>
              <Icon.stop />
              {t.stop}
            </button>
            <button type="button" className="action plain risky" onClick={onDiscard}>
              {t.discard}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// 概览卡片区。双击或长按进入编辑态，像整理桌面小组件那样加减卡片。
function DayTally({ records, metrics, editing, lang, onEnterEdit, onExitEdit, onChange }) {
  const t = tr(lang).today;
  const holdRef = useRef(null);
  const movedRef = useRef(false);

  const shown = metrics.map((id) => metricById[id]).filter(Boolean);
  const columns = columnsFor(shown.length);

  // 长按 500ms 进编辑态；手指划动就不算长按。
  const startHold = () => {
    movedRef.current = false;
    clearTimeout(holdRef.current);
    holdRef.current = setTimeout(() => {
      if (!movedRef.current) onEnterEdit();
    }, 500);
  };
  const cancelHold = () => clearTimeout(holdRef.current);

  useEffect(() => () => clearTimeout(holdRef.current), []);

  const remove = (id) => {
    const next = metrics.filter((m) => m !== id);
    if (next.length < minMetrics) return;
    onChange(next);
  };

  const move = (id, delta) => {
    const index = metrics.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= metrics.length) return;
    const next = [...metrics];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div
      className={`tallywrap${editing ? " editing" : ""}`}
      onDoubleClick={editing ? undefined : onEnterEdit}
      onTouchStart={editing ? undefined : startHold}
      onTouchMove={() => {
        movedRef.current = true;
        cancelHold();
      }}
      onTouchEnd={cancelHold}
      onTouchCancel={cancelHold}
    >
      <div className="tallyrow" style={{ "--cols": columns }}>
        {shown.map((metric, index) => (
          <div className={`tally${editing ? " wobble" : ""}`} key={metric.id}>
            {editing ? (
              <>
                <button
                  type="button"
                  className="tallydrop"
                  onClick={() => remove(metric.id)}
                  disabled={metrics.length <= minMetrics}
                  aria-label={`${t.tallyAdd} ${metric.name}`}
                  title={`${minMetrics}`}
                >
                  <Icon.close />
                </button>
                <span className="tallymove">
                  <button
                    type="button"
                    onClick={() => move(metric.id, -1)}
                    disabled={index === 0}
                    aria-label={metric.name}
                    title={t.prevDay}
                  >
                    <Icon.back />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(metric.id, 1)}
                    disabled={index === shown.length - 1}
                    aria-label={metric.name}
                    title={t.nextDay}
                  >
                    <Icon.forward />
                  </button>
                </span>
              </>
            ) : null}
            <span className="k">{lang === "en" && metric.nameEn ? metric.nameEn : metric.name}</span>
            <span className="v">
              <Measure text={trValue(metric.value(records, lang), lang)} />
            </span>
          </div>
        ))}
      </div>

      {!editing ? (
        <span className="tallyhint">{t.tallyHint}</span>
      ) : null}

      {editing ? (
        <div className="tallyedit">
          <div className="tallyeditbar">
            <span className="label">{t.tallyAdd}</span>
            <span className="grows" />
            <span className="hushed" style={{ fontSize: 11.5 }}>
              {t.tallyPicked} <span className="figure">{metrics.length}</span> / {maxMetrics}
            </span>
            <button type="button" className="action lead" onClick={onExitEdit}>
              <Icon.check />
              {tr(lang).common.done}
            </button>
          </div>
          <div className="pillrow">
            {metricCatalog
              .filter((metric) => !metrics.includes(metric.id))
              .map((metric) => (
                <button
                  type="button"
                  key={metric.id}
                  className="pill"
                  disabled={metrics.length >= maxMetrics}
                  title={metrics.length >= maxMetrics ? `${maxMetrics}` : lang === "en" && metric.hintEn ? metric.hintEn : metric.hint}
                  onClick={() => onChange([...metrics, metric.id])}
                >
                  <Icon.plus />
                  {lang === "en" && metric.nameEn ? metric.nameEn : metric.name}
                </button>
              ))}
          </div>
          {!isAllowedCount(metrics.length) ? (
            <span className="tallywarn">
              <span className="figure">{metrics.length}</span>
              {t.tallyWarn}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// 七天睡眠条。
//
// 这里有两件独立的事，不能合成一个状态：
//   窗口   —— 现在看的是哪七天，由 anchor 决定（它是窗口正中那天）
//   选中日 —— 紫色那根是哪天，就是外面的 day
// 从日期选择器挑一天时两者一起动（那天落到正中）；左右滑动只挪窗口，
// 不碰选中日；点某根柱子只改选中日，窗口原地不动 —— 否则点一下
// 图表就自己跳一格，看着像闪了一下。
function SleepWeek({ byDay, day, birth, lang, onPickDay }) {
  const [anchor, setAnchor] = useState(() => startOfDay(day));

  // 日期选择器换了日子（或翻到别的一天）时，把那天重新放回正中。
  // 点柱子走的是同一个 day，所以这里不能无脑跟着 day 走 ——
  // 用一个 ref 记下「这次 day 变化是不是点柱子引起的」，是就不挪窗口。
  const holdWindow = useRef(false);
  useEffect(() => {
    if (holdWindow.current) {
      holdWindow.current = false;
      return;
    }
    setAnchor(startOfDay(day));
  }, [day]);

  const days = useMemo(() => {
    const out = [];
    const center = startOfDay(anchor);
    const selected = dayKey(startOfDay(day).toISOString());
    const today = startOfDay(new Date());
    const birthDay = startOfDay(new Date(birth));
    for (let i = -3; i <= 3; i += 1) {
      const d = new Date(center.getTime() + i * 86400000);
      const key = dayKey(d.toISOString());
      const minutes = (byDay.get(key) || [])
        .filter((r) => r.typeId === "sleep")
        .reduce((sum, r) => sum + (Number(safeValues(r.values).minutes) || 0), 0);
      out.push({
        key,
        at: d,
        minutes,
        tick: lang === "en" ? ["S", "M", "T", "W", "T", "F", "S"][d.getDay()] : "日一二三四五六"[d.getDay()],
        // 紫色跟着选中日走，而不是跟着窗口正中走。
        now: key === selected,
        // 出生前和未来那几格没有可记的东西，画出来但点不动。
        outside: d > today || d < birthDay,
      });
    }
    return out;
  }, [byDay, anchor, day, birth, lang]);

  // 左右滑动只挪窗口，不改选中日。窗口可以一直往前翻到出生那天，
  // 往后到今天为止 —— 让正中那格停在今天，右边三格是还没到的日子。
  const shiftWindow = useCallback(
    (step) => {
      setAnchor((current) => {
        const next = new Date(startOfDay(current).getTime() + step * 86400000);
        if (next > startOfDay(new Date()) || next < startOfDay(new Date(birth))) return current;
        return next;
      });
    },
    [birth],
  );

  const swipe = useRef(null);
  const onTouchStart = (event) => {
    const touch = event.touches[0];
    swipe.current = { x: touch.clientX, y: touch.clientY, done: false };
  };
  const onTouchMove = (event) => {
    const from = swipe.current;
    if (!from || from.done) return;
    const touch = event.touches[0];
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    // 竖着划的是在滚页面，别抢；横向要划够一截才算一次翻页。
    if (Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
    swipe.current.done = true;
    // 手指向左推 = 看后面的日子，和内容跟着手走的直觉一致。
    shiftWindow(dx < 0 ? 1 : -1);
  };
  const onTouchEnd = () => {
    swipe.current = null;
  };

  // 触摸板的横向滑动走的是 wheel（deltaX），和 touch 是两套事件，得单独接。
  // 这里必须用 addEventListener 手动绑：React 的 onWheel 是被动监听，
  // 里面调不了 preventDefault，浏览器会把这一下当成页面横向滚动。
  const plotRef = useRef(null);
  useEffect(() => {
    const node = plotRef.current;
    if (!node) return undefined;
    // 触摸板一次滑动会连着发几十个小 delta，逐个响应会一下子翻过好几天。
    // 攒够一格才翻一天，翻完清零；停手一会儿（或改成竖向滚）也清零，
    // 免得上一次剩下的零头和下一次的开头凑成一次误翻。
    let travel = 0;
    let at = 0;
    const onWheel = (event) => {
      const { deltaX, deltaY } = event;
      // 竖向为主的滚动是在滚页面，让给页面。
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - at > 320) travel = 0;
      at = now;
      travel += deltaX;
      if (Math.abs(travel) < 48) return;
      const step = travel < 0 ? -1 : 1;
      travel = 0;
      // 往左推内容（deltaX > 0）= 看后面的日子，和触摸滑动的方向一致。
      shiftWindow(step);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [shiftWindow]);

  // 纵轴跟着实际睡眠走：先看这七天最多睡了几小时，再挑一个能整除成四格的
  // 刻度（1/2/3/4/6/8/12 小时）。固定上限会让午睡期的柱子矮成一条线，
  // 而按最大值直接拉满又会让每一屏的高度含义都不一样。
  const scale = useMemo(() => {
    const peak = Math.max(...days.map((d) => d.minutes), 0) / 60;
    const steps = [1, 2, 3, 4, 6, 8, 12];
    const step = peak <= 0 ? 3 : steps.find((s) => s * 4 >= peak) || Math.ceil(peak / 4);
    const top = step * 4;
    return { top, ticks: [1, 2, 3, 4].map((n) => n * step) };
  }, [days]);

  const hours = (minutes) => {
    const value = Math.round((minutes / 60) * 10) / 10;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  return (
    <div
      className="sleepweek"
      ref={plotRef}
      aria-label={tr(lang).a11y.sleepWeekAlt}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="swaxis" aria-hidden="true">
        {scale.ticks.map((value) => (
          <span className="swtick" key={value} style={{ bottom: `${(value / scale.top) * 100}%` }}>
            <span className="figure">{value}</span>
            <small>h</small>
          </span>
        ))}
      </div>
      <div className="swvals">
        {days.map((day) => (
          // 柱顶的数跟着柱子的颜色走：今天的柱子是紫的，它的数才是紫的，
          // 其余灰柱配灰数。数彩色、柱子灰会让人以为那根柱子也被强调了。
          <span className={`swval${day.now ? " now" : ""}`} key={day.key}>
            {day.minutes > 0 ? (
              <>
                <span className="figure">{hours(day.minutes)}</span>
                <small>h</small>
              </>
            ) : null}
          </span>
        ))}
      </div>
      <div className="swplot">
        {scale.ticks.map((value) => (
          <span className="swline" key={value} style={{ bottom: `${(value / scale.top) * 100}%` }} aria-hidden="true" />
        ))}
        <div className="swcols">
          {days.map((item) => (
            // 整格都可以点，不只是柱子本身：没睡的那天柱高是 0，
            // 只让柱子可点等于那天点不中。
            <button
              type="button"
              className="swcol"
              key={item.key}
              disabled={item.outside || item.now}
              aria-label={`${fullDayLabel(item.at, new Date(), lang)}`}
              onClick={() => {
                // 窗口留在原地，只把紫色挪到这一天。
                holdWindow.current = true;
                onPickDay(item.at);
              }}
            >
              <span
                className={`swstem${item.now ? " now" : ""}`}
                style={{ height: `${item.minutes > 0 ? Math.max(3, (item.minutes / (scale.top * 60)) * 100) : 0}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="swdays">
        {days.map((day) => (
          <span className={day.now ? "now" : ""} key={day.key}>
            {day.tick}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TodayView({
  records,
  timer,
  onOpenRecord,
  timerHandlers,
  baby,
  onEditBaby,
  metrics,
  onChangeMetrics,
  lang,
  view,
}) {
  const t = tr(lang).today;
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [editingTally, setEditingTally] = useState(false);
  const isToday = sameDay(day, new Date());

  // 当天的记录：从派生层的按天分组里取，和日历上的记录点、
  // 图表用的是同一份分组结果，不再各自 filter 一遍。
  const dayRecords = useMemo(() => recordsOnDay(view.byDay, day), [view, day]);

  // 换日期的唯一入口：日期条、睡眠条上的点选和滑动都走这里，
  // 边界只在这一处判，三个入口不会各自漂出一套规则。
  // 用 useCallback 固定住：睡眠条的滚轮监听是手动绑的，
  // 每次渲染换一个新函数会让它一直解绑重绑。
  const pickDay = useCallback(
    (next) => {
      const target = startOfDay(next);
      if (target > startOfDay(new Date()) || target < startOfDay(new Date(baby.birth))) return;
      setDay(target);
    },
    [baby.birth],
  );

  return (
    <div className="view">
      <div className="todaygrid">
        <HeroCard latest={view.latest} baby={baby} lang={lang} onEdit={onEditBaby} />
        <SleepTimer
          {...timerHandlers}
          timer={isToday ? timer : null}
          dayRecords={dayRecords}
          isToday={isToday}
          lang={lang}
          onStart={isToday ? timerHandlers.onStart : () => setDay(startOfDay(new Date()))}
        />
      </div>

      {/* 日期条挪到睡眠卡之后：上面两块讲的是「此刻」，从这里往下
          全部跟着所选日期走，切到别的日子标题也会变成「一日概览」。 */}
      <DayBar value={day} byDay={view.byDay} birth={baby.birth} lang={lang} onChange={pickDay} />

      {/* 概览和时间线都不再是卡片。背景插画和那条分隔线留下来，
          它们本来就负责分段，外面再套一层白底反而多一道边框。 */}
      <section className="plainblock softpattern spotcard">
        <SceneArt name="sprig" className="cardspot" />
        <header className="blockhead">
          <div className="grows">
            <h2>{isToday ? t.overview : t.overviewOther}</h2>
          </div>
        </header>
        <div className="blockbody" style={{ display: "grid", gap: 18 }}>
          <DayTally
            records={dayRecords}
            metrics={metrics}
            lang={lang}
            editing={editingTally}
            onEnterEdit={() => setEditingTally(true)}
            onExitEdit={() => setEditingTally(false)}
            onChange={onChangeMetrics}
          />
          <div>
            <div className="label" style={{ marginBottom: 10 }}>{t.sleepWeek}</div>
            <SleepWeek
              byDay={view.byDay}
              day={day}
              birth={baby.birth}
              lang={lang}
              onPickDay={pickDay}
            />
          </div>
        </div>
      </section>

      <section className="plainblock spotcard">
        <SceneArt name="stars" className="cardspot" />
        <header className="blockhead">
          <div className="grows">
            <h2>{t.timeline}</h2>
          </div>
          <span className="hushed" style={{ fontSize: 12 }}>
            <span className="figure">{dayRecords.length}</span> {tr(lang).common.records}
          </span>
        </header>
        {dayRecords.length === 0 ? (
          <div className="blank">
            <SceneArt name="crib" />
            <span>{isToday ? t.emptyToday : t.emptyOther}</span>
            <span>{isToday ? t.emptyHintToday : t.emptyHintOther}</span>
          </div>
        ) : (
          <div className="dayline">
            {dayRecords.map((record, index) => {
              const type = typeOf(record.typeId);
              return (
                <button
                  type="button"
                  className="entry"
                  key={record.id}
                  onClick={() => onOpenRecord(record)}
                  // 只给前十条排队，再往后一起出现，否则翻到记录多的一天要等很久
                  style={{ "--i": Math.min(index, 10) }}
                >
                  <span className="when">{clock(record.at)}</span>
                  <TypeGlyph typeId={type.id} glyph={type.glyph} />
                  <span className="what">
                    <span className="nm">{trType(type, lang)}</span>
                    <span className="dt quiet">{trValue(type.summary(displayValues(record, lang), lang), lang) || "—"}</span>
                  </span>
                  <AvatarTag memberId={record.memberId} />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ── 相册 ─────────────────────────────────────────────────────────────────── */

export function AlbumView({ photos, urls, onOpenPhoto, baby, lang }) {
  const months = useMemo(() => {
    const map = new Map();
    for (const photo of photos) {
      const key = monthKey(photo.at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(photo);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [photos]);

  return (
    <div className="view">
      {months.length === 0 ? (
        <div className="card">
          <div className="blank">
            <SceneArt name="frames" />
            <span>{tr(lang).album.empty}</span>
            <span>{tr(lang).album.emptyHint}</span>
          </div>
        </div>
      ) : (
        months.map(([key, rows], index) => (
          // 月份块之间不再有差别：第一个月原先套了一层带背景图的卡片，
          // 结果同一批照片被摆成两种样子。背景图现在铺在整个模块底下，
          // 这里就让所有月份用同一种排布。
          <section className="monthblock" key={key}>
            <header className="monthhead">
              <SceneArt name={spotByIndex(index)} className="monthspot" />
              <span className="mon">{monthLabel(key, lang)}</span>
              <span className="cnt figure">{rows.length} {tr(lang).album.photos}</span>
              <span className="rule" />
            </header>
            <div className="frames">
              {rows.map((photo) => {
                const age = ageLabel(baby.birth, photo.at, tr(lang).today);
                return (
                  <button type="button" className="frame" key={photo.id} onClick={() => onOpenPhoto(photo)}>
                    <span className="shot">
                      {urls[photo.id] ? (
                        <img src={urls[photo.id]} alt={(lang === "en" && photo.captionEn ? photo.captionEn : photo.caption) || tr(lang).a11y.photoAlt} loading="lazy" />
                      ) : (
                        <ShotPlaceholder prompt={photo.prompt} label={tr(lang).sheet.artPending} />
                      )}
                      <span className="agestamp figure">{age}</span>
                    </span>
                    <span className="foot">
                      <span className="cap">{(lang === "en" && photo.captionEn ? photo.captionEn : photo.caption) || tr(lang).album.unnamed}</span>
                      <span className="meta">
                        <AvatarTag memberId={photo.memberId} placement="right" />
                        <span className="figure">{dayLabel(photo.at, new Date(), lang)}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ── 家庭 ─────────────────────────────────────────────────────────────────── */

// 头像可以换成自己的照片：点头像挑一张图，换过之后角上多一个「恢复默认」。
// 图片存在本机的 IndexedDB 里，刷新、重开浏览器都还在。
function FacePicker({ memberId, lang, custom, onPick, onClear }) {
  const t = tr(lang).family;
  const inputRef = useRef(null);
  const member = usePerson(memberId);
  if (!member) return null;
  return (
    <span className="facepick">
      <button
        type="button"
        className="facebtn"
        onClick={() => inputRef.current?.click()}
        title={`${t.changeFace}${lang === "en" ? ": " : "："}${member.name}`}
        aria-label={`${t.changeFace}${lang === "en" ? ": " : "："}${member.name}`}
      >
        <Avatar memberId={memberId} size="lg" />
        <span className="faceveil" aria-hidden="true">
          <Icon.camera />
        </span>
      </button>
      {custom ? (
        <button
          type="button"
          className="facereset"
          onClick={() => onClear(memberId)}
          title={`${t.resetFace}${lang === "en" ? ": " : "："}${member.name}`}
          aria-label={`${t.resetFace}${lang === "en" ? ": " : "："}${member.name}`}
        >
          <Icon.close />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(memberId, file);
        }}
      />
    </span>
  );
}

// 名单里的一行。登录后不能换身份，切换按钮换成「你」/ 不给按钮 ——
// 留一个点了没反应的按钮，比没有按钮更让人困惑。
function MemberRow({ memberId, currentId, lang, custom, locked, onFace, onClearFace, onSwitch }) {
  const t = tr(lang).family;
  const member = usePerson(memberId);
  if (!member) return null;
  const mine = memberId === currentId;
  return (
    <div className="memberrow">
      <FacePicker
        memberId={memberId}
        lang={lang}
        custom={custom}
        onPick={onFace}
        onClear={onClearFace}
      />
      <div>
        <div className="nm">
          {member.name}
          {mine ? <span className="badge">{t.current}</span> : null}
        </div>
        <div className="rl">
          {member.custom ? (
            <span className="hushed">{member.role || t.customRole}</span>
          ) : (
            <>{member.role} · {t.joined} <span className="figure">{member.joined}</span></>
          )}
        </div>
      </div>
      {locked ? (
        mine ? (
          <span className="rolemark hushed">{t.you}</span>
        ) : null
      ) : (
        <button type="button" className="action" onClick={() => onSwitch(memberId)} disabled={mine}>
          {mine ? t.inUse : t.switch}
        </button>
      )}
    </div>
  );
}

// 贡献榜的一行。名字要跟着改过的显示名走，所以单独成组件取 context。
function ContribRow({ memberId, current, records, peak }) {
  const member = usePerson(memberId);
  if (!member) return null;
  return (
    <div className={`contribrow${current ? " on" : ""}`}>
      <Avatar memberId={memberId} size="sm" />
      <div>
        <div className="nm">{member.name}</div>
        <div className="track">
          <span className="fill" style={{ width: `${(records / peak) * 100}%` }} />
        </div>
      </div>
      <span className="cnt">{records}</span>
    </div>
  );
}

export function FamilyView({ view, currentId, faces, extraMembers, locked, onSwitch, onFace, onClearFace, lang }) {
  // locked 在这里的含义是「已登录」：真实使用时名单只有妈妈/爸爸打底 +
  // 自定义身份；演示模式才给完整的示例家庭。
  const roster = rosterMembers(extraMembers, locked);
  // 成员贡献和类型排行都读派生层算好的计数，不再自己遍历一遍 records。
  const stats = useMemo(() => {
    // 记得多的排前面。条数一样时按成员固定顺序兜底，
    // 否则每次重算的排列会随 sort 的实现漂移，看着像在乱跳。
    const rows = roster
      .map((member, index) => ({
        member,
        index,
        records: view.memberCounts.get(member.id) || 0,
      }))
      .sort((a, b) => b.records - a.records || a.index - b.index);
    const peak = Math.max(1, ...rows.map((row) => row.records));
    return { rows, peak };
  }, [view, roster]);

  const typeUsage = useMemo(
    () =>
      recordTypes
        .map((type) => ({ type, count: view.typeCounts.get(type.id) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [view],
  );

  return (
    <div className="view">
      {/* 成员名单不套卡片，也不自带画带：一家人那幅画已经铺成整个模块的
          背景了，这里再裁一块出来，同一幅画会在一屏里出现两次。 */}
      <section className="plainblock">
        <header className="blockhead">
          <div className="grows">
            <h2>{tr(lang).family.members}</h2>
          </div>
          <span className="hushed figure" style={{ fontSize: 12 }}>{roster.length} {tr(lang).family.people}</span>
        </header>
        <div className="memberlist">
          {roster.map((member) => (
            <MemberRow
              key={member.id}
              memberId={member.id}
              currentId={currentId}
              lang={lang}
              custom={Boolean(faces && faces[member.id])}
              locked={locked}
              onFace={onFace}
              onClearFace={onClearFace}
              onSwitch={onSwitch}
            />
          ))}
        </div>
        {locked ? <div className="hushed listnote">{tr(lang).family.viewOnly}</div> : null}
      </section>

      <div className="todaygrid">
        <section className="card spotcard">
          <SceneArt name="hearts" className="cardspot" />
          <header className="card-head">
            <div className="grows">
              <h2>{tr(lang).family.contrib}</h2>
            </div>
          </header>
          <div className="card-body contrib">
            {stats.rows.map((row) => (
              <ContribRow
                key={row.member.id}
                memberId={row.member.id}
                current={row.member.id === currentId}
                records={row.records}
                peak={stats.peak}
              />
            ))}
          </div>
        </section>

        <section className="card spotcard">
          <SceneArt name="envelope" className="cardspot" />
          <header className="card-head">
            <div className="grows">
              <h2>{tr(lang).family.topTypes}</h2>
            </div>
          </header>
          <div className="card-body">
            <div className="pillrow">
              {typeUsage.map((row) => (
                <span className="pill" key={row.type.id}>
                  {trType(row.type, lang)} <span className="figure">{row.count}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
