import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Glyph, Icon } from "./icons.jsx";
import { findMember, memberName, memberRole } from "./family.js";
import { tr } from "./i18n.js";

// 成员的「显示层」信息：换过的自定义头像（本地位图的 object URL）和
// 改过的名字。两者都在十几处出现，逐层传 props 会把它们摊进每个视图的签名里，
// 所以走一个只读的 context，谁要显示谁自己取。
export const PeopleContext = createContext(null);

// 一个成员当前该显示成什么样。名单本身是固定的家庭角色，
// 名字可以改（改的是显示名，角色不变），所以要在这里合一次。
export function usePerson(memberId) {
  const people = useContext(PeopleContext);
  const member = findMember(memberId, people && people.extraMembers);
  if (!member) return null;
  const lang = (people && people.lang) || "zh";
  // 用户改过的名字不分语言，直接用；没改过才取名单里当前语言的说法。
  // 自定义身份的名字就是创建时填的那个，名单里没有多语言版本。
  const name = (people && people.names && people.names[memberId]) || (member.custom ? member.name : memberName(member, lang));
  return {
    ...member,
    name,
    // 身份描述也能改：roleNotes 里的覆盖优先，自定义身份默认没有描述。
    role: (people && people.roleNotes && people.roleNotes[memberId]) || (member.custom ? "" : memberRole(member, lang)),
    tone: member.tone || "lilac",
    // 头像占位字取显示名的首字，改了名就跟着改。
    initials: name.slice(0, 1) || member.initials,
    face: (people && people.faces && people.faces[memberId]) || member.face,
  };
}

// 只要一个名字的地方。名字可能被改过，所以不能直接读 members 名单。
export function PersonName({ memberId }) {
  const member = usePerson(memberId);
  return <span style={{ fontSize: 13 }}>{member ? member.name : ""}</span>;
}

export function Avatar({ memberId, size = "" }) {
  const member = usePerson(memberId);
  const [broken, setBroken] = useState(false);
  const src = member?.face;
  // 换了新头像要重新给一次机会：上一张读不出来不代表这一张也不行。
  useEffect(() => setBroken(false), [src]);
  if (!member) return null;
  return (
    <span className={`avatar tone-${member.tone}${size ? ` sz-${size}` : ""}`} aria-hidden="true">
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : member.initials}
    </span>
  );
}

// 出生时间输入：年/月/日/时/分五个下拉，按中文习惯从大到小排。
// 原生 datetime-local 的显示顺序跟着浏览器 locale 走（中文用户也会看到
// mm/dd/yyyy），所以自己拼。选项按当前时间收敛 —— 选了今年就只有已过的月，
// 选了今天就只有已过的时分，未来时间在选项层面就选不到。
// value 是 datetime-local 格式的 "YYYY-MM-DDTHH:mm"（或空串），和原生输入一致。
export function BirthFields({ value, onChange, lang }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const parse = (v) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime())
      ? [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]
      : ["", "", "", "", ""];
  };
  // 五个格子是内部状态：选齐才向外发完整 ISO，选到一半父级拿不到半成品。
  const [fields, setFields] = useState(() => parse(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setFields(parse(value));
    }
  }, [value]);
  const [year, month, day, hour, minute] = fields;
  const units = lang === "en" ? ["Year", "Month", "Day", "Hour", "Min"] : ["年", "月", "日", "时", "分"];
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const thisDay = now.getDate();
  const isThisMonth = year === thisYear && month === thisMonth;
  const isToday = isThisMonth && day === thisDay;
  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 31;
  const seq = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  const optionLists = () => [
    seq(thisYear - 10, thisYear).reverse(),
    seq(1, year === thisYear ? thisMonth : 12),
    seq(1, isThisMonth ? thisDay : daysInMonth),
    seq(0, isToday ? now.getHours() : 23),
    seq(0, isToday && hour === now.getHours() ? now.getMinutes() : 59),
  ];
  const pick = (index) => (event) => {
    const next = [...fields];
    next[index] = event.target.value === "" ? "" : Number(event.target.value);
    // 高位变了，低位可能超出新范围（比如 1 月 31 日改成 2 月），超出的低位清掉重选。
    const lists = (() => {
      const ym = next[0] === thisYear && next[1] === thisMonth;
      const td = ym && next[2] === thisDay;
      return [
        seq(thisYear - 10, thisYear).reverse(),
        seq(1, next[0] === thisYear ? thisMonth : 12),
        seq(1, ym ? thisDay : new Date(next[0] || thisYear, next[1] || 1, 0).getDate()),
        seq(0, td ? now.getHours() : 23),
        seq(0, td && next[3] === now.getHours() ? now.getMinutes() : 59),
      ];
    })();
    for (let i = index + 1; i < 5; i += 1) {
      if (next[i] !== "" && !lists[i].includes(next[i])) next[i] = "";
    }
    setFields(next);
    const iso = next.some((v) => v === "") ? "" : `${next[0]}-${pad(next[1])}-${pad(next[2])}T${pad(next[3])}:${pad(next[4])}`;
    lastEmitted.current = iso;
    onChange(iso);
  };
  return (
    <div className="birthfields">
      {optionLists().map((options, index) => (
        <label key={units[index]} className="birthfield">
          <select value={fields[index]} onChange={pick(index)} aria-label={units[index]} disabled={index > 0 && fields[index - 1] === ""}>
            <option value="">{units[index]}</option>
            {options.map((val) => (
              <option key={val} value={val}>
                {index >= 3 ? pad(val) : val}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

// 只显示头像、点一下才浮出名字。列表里把名字常驻会撑宽一列、也让行变高，
// 而“谁记的”多数时候不需要一直看见。
// 这枚头像一定长在某个按钮里（时间线的行、图表明细的行都是按钮），所以它自己
// 不能再是 button —— 按钮套按钮是非法 HTML，浏览器会把内层拆出去，React 也会报
// hydration 警告。改成带 role="img" 的 span：名字仍然读得到，点击只做视觉上的
// 浮出，真正“谁记的”在记录详情里有一行正式的。
export function AvatarTag({ memberId, size = "sm", placement = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const member = usePerson(memberId);

  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const esc = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    const timer = setTimeout(() => setOpen(false), 2200);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      clearTimeout(timer);
    };
  }, [open]);

  if (!member) return null;
  const name = member.name;
  return (
    <span className={`avatartag${open ? " open" : ""}`} ref={ref}>
      <span
        className="avatartag-btn"
        role="img"
        // 列表行本身是个按钮，点头像不应该顺带打开记录详情
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={name}
        title={name}
      >
        <Avatar memberId={memberId} size={size} />
      </span>
      {open ? (
        <span className={`avatartag-name ${placement}`} role="status">
          {name}
        </span>
      ) : null}
    </span>
  );
}

// 记录类型的图形：优先用插画，素材缺失时回落到线性图标，界面不会开天窗。
const glyphArt = {
  nursing: "/assets/glyphs/nursing.png",
  bottle: "/assets/glyphs/bottle.png",
  diaper: "/assets/glyphs/diaper.png",
  pump: "/assets/glyphs/pump.png",
  stock: "/assets/glyphs/stock.png",
  sleep: "/assets/glyphs/sleep.png",
  thermometer: "/assets/glyphs/thermometer.png",
  ruler: "/assets/glyphs/ruler.png",
  capsule: "/assets/glyphs/capsule.png",
  plate: "/assets/glyphs/plate.png",
  juice: "/assets/glyphs/juice.png",
  pencil: "/assets/glyphs/pencil.png",
  camera: "/assets/glyphs/camera.png",
  sun: "/assets/glyphs/sun.png",
  syringe: "/assets/glyphs/syringe.png",
};

export function TypeGlyph({ typeId, glyph, big = false, lead = false, small = false, bare = false }) {
  const Shape = Glyph[glyph] || Glyph.pencil;
  const [artBroken, setArtBroken] = useState(false);
  const art = glyphArt[glyph];
  if (bare) return <Shape />;
  return (
    <span
      className={`glyphdot${big ? " sz-lg" : ""}${small ? " sz-sm" : ""}${lead ? " lead" : ""}${
        art && !artBroken ? " art" : ""
      }`}
      data-type={typeId}
      aria-hidden="true"
    >
      {art && !artBroken ? (
        // 插画和线描都渲染出来，由样式按底盘大小决定露哪一个：
        // 大的地方给插画，小到 30px 的地方给线描，避免细节糊掉。
        <>
          <img src={art} alt="" loading="lazy" onError={() => setArtBroken(true)} />
          <Shape />
        </>
      ) : (
        <Shape />
      )}
    </span>
  );
}

// 场景插画：睡眠、空相册这类需要一整幅图的位置。
const sceneArt = {
  sleep: "/assets/scenes/moon-sleep.png",
  album: "/assets/scenes/album-empty.png",
  growth: "/assets/scenes/growth-bud.png",
  family: "/assets/scenes/family-hearts.png",
  // 模块级背景：铺满整个内容区、固定不随滚动
  bgToday: "/assets/scenes/bg-today.jpg",
  bgCharts: "/assets/scenes/bg-charts.jpg",
  bgFamily: "/assets/scenes/family-group.jpg",
  bgAlbum: "/assets/scenes/album-frames.jpg",
  // 整幅场景：作为重要卡片自己的背景铺在内容之下
  sky: "/assets/scenes/hero-sky.jpg",
  bannerChart: "/assets/scenes/chart-growth.jpg",
  // 小幅场景：空状态和卡片角落
  seedling: "/assets/scenes/sc-seedling.png",
  frames: "/assets/scenes/sc-frames.png",
  hearts: "/assets/scenes/sc-hearts.png",
  crib: "/assets/scenes/sc-crib.png",
  // 点缀小图：月份分隔、卡片角落、侧栏落款
  bottlecloud: "/assets/spots/ill-bottlecloud.png",
  nappystack: "/assets/spots/ill-nappystack.png",
  moonstars: "/assets/spots/ill-moonstars.png",
  thermoheart: "/assets/spots/ill-thermoheart.png",
  notebook: "/assets/spots/ill-notebook.png",
  cloud: "/assets/spots/ill-cloud.png",
  stars: "/assets/spots/ill-stars.png",
  sprig: "/assets/spots/ill-sprig.png",
  balloon: "/assets/spots/ill-balloon.png",
  envelope: "/assets/spots/ill-envelope.png",
  handsheart: "/assets/spots/ill-handsheart.png",
  house: "/assets/spots/ill-house.png",
  rattle: "/assets/spots/ill-rattle.png",
  blanket: "/assets/spots/ill-blanket.png",
  socks: "/assets/spots/ill-socks.png",
  bear: "/assets/spots/ill-bear.png",
  airballoon: "/assets/spots/ill-airballoon.png",
  raincloud: "/assets/spots/ill-raincloud.png",
  rainbow: "/assets/spots/ill-rainbow.png",
  clock: "/assets/spots/ill-clock.png",
  books: "/assets/spots/ill-books.png",
  mobile: "/assets/spots/ill-mobile.png",
  flower: "/assets/spots/ill-flower.png",
  jug: "/assets/spots/ill-jug.png",
  mittens: "/assets/spots/ill-mittens.png",
  rings: "/assets/spots/ill-rings.png",
  butterfly: "/assets/spots/ill-butterfly.png",
  gift: "/assets/spots/ill-gift.png",
  bath: "/assets/spots/ill-bath.png",
  duck: "/assets/spots/ill-duck.png",
  towel: "/assets/spots/ill-towel.png",
  pillow: "/assets/spots/ill-pillow.png",
  barchart: "/assets/spots/ill-barchart.png",
  linegraph: "/assets/spots/ill-linegraph.png",
  piechart: "/assets/spots/ill-piechart.png",
  calendar: "/assets/spots/ill-calendar.png",
  wallclock: "/assets/spots/ill-wallclock.png",
  hourglass: "/assets/spots/ill-hourglass.png",
  ruler: "/assets/spots/ill-ruler.png",
  scale: "/assets/spots/ill-scale.png",
  milkdrop: "/assets/spots/ill-milkdrop.png",
  bowl: "/assets/spots/ill-bowl.png",
  sippy: "/assets/spots/ill-sippy.png",
  fruit: "/assets/spots/ill-fruit.png",
  boat: "/assets/spots/ill-boat.png",
  plane: "/assets/spots/ill-plane.png",
  whale: "/assets/spots/ill-whale.png",
  sleepmoon: "/assets/spots/ill-sleepmoon.png",
  stroller: "/assets/spots/ill-stroller.png",
  highchair: "/assets/spots/ill-highchair.png",
  sling: "/assets/spots/ill-sling.png",
  playpen: "/assets/spots/ill-playpen.png",
  pacifier: "/assets/spots/ill-pacifier.png",
  bib: "/assets/spots/ill-bib.png",
  shoes: "/assets/spots/ill-shoes.png",
  hat: "/assets/spots/ill-hat.png",
  soap: "/assets/spots/ill-soap.png",
  hairbrush: "/assets/spots/ill-hairbrush.png",
  clipper: "/assets/spots/ill-clipper.png",
  swab: "/assets/spots/ill-swab.png",
  heartstar: "/assets/spots/ill-heartstar.png",
  bubbles: "/assets/spots/ill-bubbles.png",
  bookmark: "/assets/spots/ill-bookmark.png",
  plant: "/assets/spots/ill-plant.png",
};

// 每类记录在图表空窗时给一幅自己的画，比十四类共用一张更有指向。
const typeScene = {
  nursing: "pillow",
  bottle: "bottlecloud",
  diaper: "nappystack",
  pumping: "jug",
  milkstock: "milkdrop",
  sleep: "crib",
  temperature: "thermoheart",
  growth: "ruler",
  medicine: "clock",
  solids: "bowl",
  supplement: "flower",
  note: "notebook",
  photo: "frames",
  jaundice: "rainbow",
  vaccine: "butterfly",
};

export function sceneForType(typeId) {
  return typeScene[typeId] || "growth";
}

// 月份分隔、列表间隔这类地方轮着用的小图，顺序固定，翻回同一个月看到的还是同一幅。
const spotCycle = [
  "stars", "cloud", "moonstars", "balloon", "sprig", "socks", "rattle", "blanket",
  "airballoon", "butterfly", "rainbow", "flower", "duck", "gift", "mittens", "rings",
  "boat", "plane", "whale", "sleepmoon", "stroller", "hat", "shoes", "pacifier",
  "bib", "plant", "bubbles", "bookmark", "heartstar", "fruit", "sippy", "hairbrush",
];

// 「3 次」「5 小时 41 分」「2 天前」这类串是数字和文字混在一起的。
// 全站的规矩是：只有数字上色，量词、单位、「前」这些汉字/英文一律走灰。
// 整串套一个颜色就会出现「彩色的『天前』」，所以在这里按数字边界切开，
// 数字段进 <b>（由 .measure b 上色），其余留在外面走继承的灰。
// split 要带捕获组才能把分隔符本身留在结果里；判断用不带 /g 的那个 ——
// 带 /g 的正则 .test() 会记住 lastIndex，连着调用的结果会跳着为真。
const NUM_SPLIT = /(\d+(?:[.:]\d+)*)/g;
const NUM_ONLY = /^\d+(?:[.:]\d+)*$/;

export function Measure({ text }) {
  const value = text === 0 || text ? String(text) : "";
  if (!value) return null;
  const parts = value.split(NUM_SPLIT).filter((chunk) => chunk !== "");
  return (
    <span className="measure">
      {parts.map((chunk, index) =>
        NUM_ONLY.test(chunk) ? (
          // eslint-disable-next-line react/no-array-index-key
          <b className="figure" key={index}>{chunk}</b>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <span key={index}>{chunk}</span>
        ),
      )}
    </span>
  );
}

export function spotByIndex(index) {
  return spotCycle[((index % spotCycle.length) + spotCycle.length) % spotCycle.length];
}

// 铺成整屏背景时，画面本身偏浓的那几张要再压一档透明度，否则会盖过内容。
// 这是素材的属性，不是某个模块的属性，所以标在素材表旁边，
// 而不是写成按文件名匹配的 CSS 选择器（换张图就得回来改选择器）。
const denseScenes = new Set(["bgAlbum", "bgFamily"]);

export function SceneArt({ name, className = "" }) {
  const [broken, setBroken] = useState(false);
  const src = sceneArt[name];
  if (!src || broken) return null;
  return (
    <img
      className={`sceneart ${className}${denseScenes.has(name) ? " dense" : ""}`.trim()}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, suffix, lang = "zh" }) {
  const a = tr(lang).a11y;
  const decimals = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  const round = (n) => Number(n.toFixed(decimals));
  const shift = (delta) => onChange(round(Math.min(max, Math.max(min, Number(value || 0) + delta))));
  return (
    <div className="stepper">
      <button type="button" className="knob" onClick={() => shift(-step)} aria-label={suffix ? `${a.decrease} · ${suffix}` : a.decrease} title={a.decrease}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <label className="amount">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? "" : round(Number(next)));
          }}
          aria-label={suffix ? `${a.value} · ${suffix}` : a.value}
        />
      </label>
      {suffix ? <span className="suffix">{suffix}</span> : null}
      <button type="button" className="knob" onClick={() => shift(step)} aria-label={suffix ? `${a.increase} · ${suffix}` : a.increase} title={a.increase}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// 破坏性操作的二次确认。删一条记录、删一张照片、清空全部数据都走这里，
// 免得手滑点掉的东西找不回来。默认焦点落在「取消」上，Esc 也等于取消：
// 误触时最省力的那条路，通向的是不删。
export function ConfirmDialog({ title, body, detail, confirmText, cancelText, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (cancelRef.current) cancelRef.current.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <>
      <div className="scrim confirmscrim" onClick={onCancel} />
      {/* 居中交给外面这层 grid，弹窗自己不做 translate 定位 ——
          入场动画结尾是 transform: none，会把用来居中的 translate 一起抹掉。 */}
      <div className="confirmlayer">
        <div className="confirmbox" role="alertdialog" aria-modal="true" aria-label={title}>
          <h2 className="confirmtitle">{title}</h2>
          <p className="confirmbody">{body}</p>
          {detail ? <p className="confirmdetail">{detail}</p> : null}
          <div className="confirmfoot">
            <button type="button" className="action" ref={cancelRef} onClick={onCancel}>
              {cancelText}
            </button>
            <button type="button" className="action lead risky" onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function Toasts({ items }) {
  if (!items.length) return null;
  return (
    <div className="toastwrap" role="status" aria-live="polite">
      {items.map((item) => (
        <div className="toast" key={item.id}>
          <Icon.check />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

// 生图前的占位：把提示词留在 title 上，替换素材时直接照着写。
export function ShotPlaceholder({ prompt, label }) {
  return (
    <div className="placeholder" title={prompt}>
      <Icon.image />
      <span className="tagline">{label}</span>
    </div>
  );
}

export function useNow(active, interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  return now;
}
