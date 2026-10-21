import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./kit.css";
import "./styles.css";
import { Icon } from "./icons.jsx";
import { Avatar, BirthFields, ConfirmDialog, PeopleContext, SceneArt, Toasts, usePerson } from "./components.jsx";
import { BabySheet, PhotoLightbox, RecordDetail, RecordDrawer } from "./drawer.jsx";
import { AlbumView, FamilyView, TodayView } from "./views.jsx";
import { ChartsView } from "./chartview.jsx";
import { ageLabel, babyName, defaultBaby, findMember, memberName, memberRole, members, rosterMembers } from "./family.js";
import { languages, tr } from "./i18n.js";
import { formatDuration, trValue } from "./data.js";
import { fromLocalInput, toLocalInput } from "./format.js";
import { derive } from "./derive.js";
import { archiveState, loadState, newId, resetState, roleOf, saveState, signedInState, withRole } from "./store.js";
import { endSignOut, readSession, startSignIn, subscribeSession } from "./auth.js";
import { shotTimeOf } from "./exif.js";
import { dropBlob, loadBlobs, putBlob } from "./photos.js";
import * as remote from "./remote.js";

const TIMER_KEY = "baby-growth-log/sleep-timer/v1";

// 每个模块自己的背景插画。相册和家庭用的就是它们原来那张卡片背景 ——
// 一幅画要么铺成整屏的气氛，要么裁进卡片，不要两种都做：
// 同一屏里出现两张同源的画，只会让人觉得画被切碎了。
const tabBg = {
  charts: "bgCharts",
  today: "bgToday",
  album: "bgAlbum",
  family: "bgFamily",
};

function bgForTab(tab) {
  return tabBg[tab] || "bgToday";
}

// 四个模块的顺序和图标。名字和副标题按语言从 i18n 的 tabs 里取。
const tabs = [
  { id: "charts", icon: Icon.chart },
  { id: "today", icon: Icon.home },
  { id: "album", icon: Icon.album },
  { id: "family", icon: Icon.family },
];

// 计时器存在 localStorage 里，跨刷新继续走。这份数据可能已经不成样子：
// 手动改过、上个版本写的、或者关着页面过了一夜。
//   startedAt 不是数字 —— new Date(它).toISOString() 直接抛错，整页白屏；
//   startedAt 在未来   —— 走出负的时长，秒表倒着跑；
//   paused 比总时长大  —— 同样是负数；
//   跑了超过 24 小时   —— 多半是忘了停，与其显示「38:12:44」不如作废重来。
// 这些一律当成「没有正在进行的计时」，同时不动任何已保存的睡眠记录。
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

// 作废的计时不能不声不响地消失，进页面时要说一句。用模块变量捎出来，
// 因为 loadTimer 跑在 useState 的初始化里，那时还没有 toast 可用。
let timerDropped = null;

function loadTimer() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return drop("bad");
    const startedAt = Number(parsed.startedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) return drop("bad");
    const now = Date.now();
    if (startedAt > now + 60000) return drop("bad");
    if (now - startedAt > MAX_TIMER_MS) return drop("long");
    const paused = Number.isFinite(Number(parsed.paused)) ? Math.max(0, Number(parsed.paused)) : 0;
    const pausedAt = Number.isFinite(Number(parsed.pausedAt)) ? Number(parsed.pausedAt) : null;
    return { startedAt, paused: Math.min(paused, now - startedAt), pausedAt };
  } catch {
    return null;
  }
}

function drop(reason) {
  timerDropped = reason;
  try {
    localStorage.removeItem(TIMER_KEY);
  } catch {
    // 清不掉也没关系，下次进来还是会被同样的规则挡下
  }
  return null;
}

// 头像入口。桌面端在顶栏里带上名字和身份，手机端只是右上角一枚悬浮头像。
function IdentityButton({ currentId, floating, label, onOpen }) {
  const current = usePerson(currentId);
  if (!current) return null;
  return (
    <button
      type="button"
      className={floating ? "identityfab" : "identitybtn"}
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      <Avatar memberId={currentId} />
      {!floating ? (
        <>
          <span className="who">
            <span className="nm">{current.name}</span>
            <span className="rl">{current.role}</span>
          </span>
          <span className="caret" aria-hidden="true">
            <Icon.caret />
          </span>
        </>
      ) : null}
    </button>
  );
}

// 设置面板里的一行成员，点选即切换身份。
function MemberOption({ memberId, current, onSwitch }) {
  const member = usePerson(memberId);
  if (!member) return null;
  return (
    <button
      type="button"
      className={`setmember${current ? " on" : ""}`}
      onClick={() => onSwitch(memberId)}
      aria-current={current ? "true" : undefined}
    >
      <Avatar memberId={memberId} />
      <span className="grows">
        <span className="nm">{member.name}</span>
        <span className="rl">{member.role}</span>
      </span>
      {current ? (
        <span className="tick" aria-hidden="true">
          <Icon.check />
        </span>
      ) : null}
    </button>
  );
}

// 名字改起来在两处都要用（设置面板、家庭名单），收成一个小组件。
// 只改显示名：身份是家庭角色，不跟着名字动。
function NameField({ memberId, lang, onRename }) {
  const member = usePerson(memberId);
  const [text, setText] = useState(member ? member.name : "");
  const t = tr(lang).settings;
  if (!member) return null;
  const commit = () => {
    const next = text.trim();
    // 名字不能改成空的：空名字会让头像占位字和署名都变成空白。
    if (!next) {
      setText(member.name);
      return;
    }
    if (next !== member.name) onRename(memberId, next);
  };
  return (
    <label className="formrow">
      <span className="label">{t.rename}</span>
      <input
        className="textin"
        value={text}
        maxLength={20}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="sethint hushed">{t.renameHint}</span>
    </label>
  );
}

// 身份描述的编辑框，和 NameField 同款交互（失焦/回车提交）。
// 和名字不一样：描述允许清空，清空就回到名单里的默认说法。
function RoleNoteField({ memberId, lang, onSave }) {
  const member = usePerson(memberId);
  const [text, setText] = useState(member ? member.role : "");
  const t = tr(lang).settings;
  if (!member) return null;
  const commit = () => {
    const next = text.trim();
    if (next !== member.role) onSave(memberId, next);
  };
  return (
    <label className="formrow">
      <span className="label">{t.roleNote}</span>
      <input
        className="textin"
        value={text}
        maxLength={20}
        placeholder={t.roleNotePh}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="sethint hushed">{t.roleNoteHint}</span>
    </label>
  );
}

// 首次使用的引导：选家庭身份 + 填宝宝基本信息。这一步不能跳过也不能
// 取消 —— 记录必须署在某个人名下，宝宝资料是整张时间轴的原点，
// 缺了这两样，后面每一屏都不知道该用什么口径展示。
function Onboarding({ lang, taken, onDone }) {
  const t = tr(lang);
  const o = t.onboard;
  const [picked, setPicked] = useState("");
  const [roleName, setRoleName] = useState("");
  // 出厂预填宝宝资料：郭沫辰，2026-10-02 01:02，男孩。用户仍可修改。
  const [name, setName] = useState(defaultBaby.name || "");
  const [gender, setGender] = useState(defaultBaby.gender || "女孩");
  const [birth, setBirth] = useState(() => {
    const d = new Date(defaultBaby.birth);
    return Number.isNaN(d.getTime()) ? "" : toLocalInput(d.toISOString());
  });
  // 内置可选身份只有妈妈/爸爸；其余身份由用户自己起名（「其他身份」）。
  const builtin = members.filter((member) => member.id === "mom" || member.id === "dad");
  const custom = picked === "custom";
  const ready = picked && (!custom || roleName.trim()) && name.trim() && birth;
  return (
    <>
      {/* 蒙层和弹窗必须是兄弟节点：蒙层叠进弹窗那一层里时，
          它的 backdrop-filter 会把弹窗自己也糊掉。 */}
      <div className="scrim confirmscrim" />
      <div className="confirmlayer">
        <div className="confirmbox rolebox onboardbox" role="dialog" aria-modal="true" aria-label={o.title}>
        <h3>{o.title}</h3>
        <div className="obsection">
          <div className="oblabel">{o.roleTitle}</div>
          <div className="rolelist">
            {builtin.map((member) => (
              <button
                type="button"
                key={member.id}
                className={`rolecell${picked === member.id ? " on" : ""}`}
                onClick={() => setPicked(member.id)}
                aria-pressed={picked === member.id}
              >
                <Avatar memberId={member.id} />
                <span className="grows">
                  <span className="nm">{memberName(member, lang)}</span>
                  <span className="rl">{memberRole(member, lang)}</span>
                </span>
                {taken.includes(member.id) ? <span className="rolenote hushed">{t.role.taken}</span> : null}
              </button>
            ))}
            <button
              type="button"
              className={`rolecell${custom ? " on" : ""}`}
              onClick={() => setPicked("custom")}
              aria-pressed={custom}
            >
              <span className="avatar tone-lilac avatar-dashed" aria-hidden="true">
                <Icon.plus />
              </span>
              <span className="grows">
                <span className="nm">{o.customRole}</span>
                <span className="rl">{o.customRoleHint}</span>
              </span>
            </button>
          </div>
          {custom ? (
            <div className="formrow">
              <span className="label">{o.customName}</span>
              <input
                className="textin"
                value={roleName}
                maxLength={12}
                placeholder={o.customNamePh}
                onChange={(event) => setRoleName(event.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="obsection">
          <div className="oblabel">{o.babyTitle}</div>
          <div className="formrow">
            <span className="label">{o.name}</span>
            <input
              className="textin"
              value={name}
              placeholder={o.namePh}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="formrow">
            <span className="label">{o.gender}</span>
            <div className="pillrow">
              {["女孩", "男孩", "不填"].map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`pill${gender === option ? " on" : ""}`}
                  onClick={() => setGender(option)}
                >
                  {trValue(option, lang)}
                </button>
              ))}
            </div>
          </div>
          <div className="formrow">
            <span className="label">{o.birth}</span>
            <BirthFields value={birth} onChange={setBirth} lang={lang} />
          </div>
        </div>
        <div className="confirmfoot">
          <button
            type="button"
            className="action lead"
            disabled={!ready}
            onClick={() => onDone({ roleId: custom ? "" : picked, customName: roleName.trim(), name: name.trim(), gender, birth })}
          >
            {o.confirm}
          </button>
        </div>
        </div>
      </div>
    </>
  );
}

// 登录闸门：个人专用版没有落地页和演示数据，应用打开先问会话 ——
//   checking    正在问会话，什么都不渲染主干，免得闪错屏；
//   redirecting 未登录且登录可用，正在整页跳去授权；
//   unavailable 登录组件没接/服务不可达，给一个说法和重试按钮；
// 过了闸（有账号）才渲染应用本体。
function GateScreen({ lang, phase, onRetry }) {
  const t = tr(lang);
  return (
    <div className="landing gate">
      <img className="landingbg" src="/assets/scenes/hero-sky.jpg" alt="" aria-hidden="true" />
      <div className="landingveil" aria-hidden="true" />
      <div className="landingbox">
        <img className="landingmark" src="/assets/logo.png" alt="" aria-hidden="true" />
        <h1>{t.brand}</h1>
        <p className="landingsub">
          {phase === "checking" ? t.gate.checking : phase === "redirecting" ? t.gate.redirecting : t.gate.unavailable}
        </p>
        {phase === "unavailable" ? (
          <div className="landingentries">
            <div className="landingentry">
              <button type="button" className="action landingcta" onClick={onRetry}>
                {t.gate.retry}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// 设置面板：身份、外观、语言、数据。手机上从底部升起，桌面上是右侧抽屉。
function SettingsSheet({
  currentId,
  lang,
  theme,
  account,
  extraMembers,
  onSwitch,
  onRename,
  onRoleNote,
  onLang,
  onTheme,
  onSignOut,
  onClose,
}) {
  const t = tr(lang);
  // 登录前后都可以点选切换身份：未登录切的是这台设备的预览视角，
  // 登录后切的是账号在家庭里的身份（跟着同步走）。
  const signedIn = Boolean(account);

  useEffect(() => {
    const esc = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer settingsheet" role="dialog" aria-label={t.settings.title}>
        <header className="drawer-head">
          <div className="grows">
            <h2>{t.settings.title}</h2>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} title={t.settings.close} aria-label={t.settings.close}>
            <Icon.close />
          </button>
        </header>

        <div className="drawer-body">
          <section className="setgroup">
            <div className="label">{t.settings.identity}</div>
            <div className="setmembers">
              {rosterMembers(extraMembers, signedIn).map((member) => (
                <MemberOption
                  key={member.id}
                  memberId={member.id}
                  current={member.id === currentId}
                  onSwitch={onSwitch}
                />
              ))}
            </div>
            <span className="sethint hushed">
              {signedIn ? t.settings.identitySwitch : t.settings.identityHint}
            </span>
            {signedIn ? (
              <>
                <NameField memberId={currentId} lang={lang} onRename={onRename} />
                <RoleNoteField memberId={currentId} lang={lang} onSave={onRoleNote} />
              </>
            ) : null}
          </section>

          <section className="setgroup">
            <div className="label">{t.settings.appearance}</div>
            <div className="segtrack wide" role="tablist" aria-label={t.settings.appearance}>
              {[
                { id: "light", name: t.settings.light },
                { id: "dark", name: t.settings.dark },
                { id: "system", name: t.settings.system },
              ].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  role="tab"
                  aria-selected={theme === option.id}
                  className={`segtab${theme === option.id ? " on" : ""}`}
                  onClick={() => onTheme(option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </section>

          <section className="setgroup">
            <div className="label">{t.settings.language}</div>
            <div className="segtrack wide" role="tablist" aria-label={t.settings.language}>
              {languages.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  role="tab"
                  aria-selected={lang === option.id}
                  className={`segtab${lang === option.id ? " on" : ""}`}
                  onClick={() => onLang(option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </section>

          <section className="setgroup">
            <div className="label">{t.settings.account}</div>
            {account ? (
              <>
                <div className="setaccount">
                  <span className="k hushed">{t.settings.signedInAs}</span>
                  <span className="v">{account.name || account.email || account.userId}</span>
                </div>
                <button type="button" className="action wide" onClick={onSignOut}>
                  {t.settings.signOut}
                </button>
                <span className="sethint hushed">{t.settings.signOutHint}</span>
              </>
            ) : (
              // 设置只在使用中打得开，走到这里说明会话刚断，把情况说清楚即可。
              <div className="setaccount">
                <span className="v">{t.settings.noProvider}</span>
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("today");
  // 个人专用版没有落地页：应用打开先过登录闸。checking 是「还在问会话」，
  // 这时候什么都不渲染，免得登录的人先闪一眼未登录屏；
  // 问完会话要么有账号进应用，要么没账号直接跳去授权页（redirecting）。
  const [gate, setGate] = useState("checking");
  const [draft, setDraft] = useState(null);
  const [detail, setDetail] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [editingBaby, setEditingBaby] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timer, setTimer] = useState(loadTimer);
  const [toasts, setToasts] = useState([]);
  const [urls, setUrls] = useState({});
  // 自定义头像的 object URL，键是成员 id。位图在 IndexedDB 里，
  // state.faces 只存位图 id，所以每次进页面都要重新换成 URL。
  const [faceUrls, setFaceUrls] = useState({});
  const [uploading, setUploading] = useState(false);

  // 服务端共享存储是否可用。静态站没有服务端，这里一直是 false，
  // 下面所有远端逻辑都不会触发，行为和之前完全一致。
  const [shared, setShared] = useState(false);
  // 有没有可用的登录方式（注入式 provider 或服务端会话）。
  // 没有就把账号那一栏说明清楚，而不是给一个点了没反应的登录按钮。
  const [authReady, setAuthReady] = useState(false);
  // 服务端那份状态有没有拉下来过。共享形态下「还没选身份」要等它 ——
  // 身份存在共享状态里，数据没到就问，等于问了一个已经有答案的问题。
  const [synced, setSynced] = useState(false);
  // 破坏性操作先问一句。存的是「问什么 + 答应了做什么」，
  // 这样四处删除共用同一个弹窗，文案各自不同、行为各自独立。
  const [confirming, setConfirming] = useState(null);
  // 服务端那份数据的版本号，写回时带上，用来挡并发覆盖。
  const revisionRef = useRef(0);
  // 本地刚从服务端拉下来的那一拍不要再推回去，否则会自己和自己打架。
  const skipPushRef = useRef(false);

  const { memberId, baby, metrics, faces, names, lang, theme, typeOrder, account } = state;
  const t = tr(lang);

  // 未登录时的去向：登录组件可用就整页跳去授权页（服务端式是跳转，
  // 注入式当场返回用户由调用方接着处理）；不可用就把闸停在 unavailable，
  // GateScreen 会把情况和重试按钮摆出来。
  const redirectToSignIn = useCallback(async () => {
    if (!authReadyRef.current) {
      setGate("unavailable");
      return;
    }
    setGate("redirecting");
    const user = await startSignIn();
    // 注入式登录不跳页、当场给结果：拿到了按登录处理，没拿到留在原地。
    if (user) {
      remote.resetWriteGate();
      setState((prev) => signedInState(prev, user));
      closeAllSheetsRef.current();
      setGate("in");
      toastRef.current(tr(langRef.current).sheet.signedInDone);
    }
  }, []);

  // 这个账号在家庭里的身份。身份存在共享状态里，所以换设备也还是它。
  const myRole = roleOf(state);
  // 登录了就以账号的身份为准，任何地方都不能用别人的身份记东西。
  const actingId = myRole || memberId;

  // 全站唯一的派生入口：所有口径（排序、按天分组、各类计数、每类最近一条）
  // 都从这一次计算出来，视图只消费结果。state.records 一变，下面全部跟着变，
  // 不会出现「某处更新了、某处还是旧的」。
  const view = useMemo(() => derive(state.records, state.photos), [state.records, state.photos]);
  const { records, photos } = view;

  // 事件处理器里要读「此刻」的状态，而闭包里的 state 停在上一次渲染。
  // 这个 ref 每次渲染后同步，保证 delete / restore 这类操作看到的是最新数据。
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  // redirectToSignIn 定义得早，里面要读「登录组件是否可用」和「关掉所有面板」，
  // 这两样都走 ref，每次渲染后同步最新值。
  const authReadyRef = useRef(false);
  useEffect(() => {
    authReadyRef.current = authReady;
  }, [authReady]);
  const closeAllSheetsRef = useRef(() => {});
  useEffect(() => {
    closeAllSheetsRef.current = closeAllSheets;
  });
  // 同上：toast 定义在组件后段，redirectToSignIn 走 ref 读最新实例，
  // 避开「渲染中引用后定义变量」的暂时性死区。
  const toastRef = useRef(() => {});
  useEffect(() => {
    toastRef.current = toast;
  });

  // 确认弹窗的文案在回调里取，闭包会停在上一次渲染的语言上，所以也走 ref。
  const langRef = useRef(state.lang);
  useEffect(() => {
    langRef.current = state.lang;
  });

  // 本地始终存一份：断网、服务端不可用时页面还能照常打开。
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 上一次的计时如果被判定作废，进页面时说明一次，别让用户以为记录丢了。
  useEffect(() => {
    if (!timerDropped) return;
    const why = timerDropped;
    timerDropped = null;
    toast(why === "long" ? t.sheet.timerTooLong : t.sheet.timerBroken);
    // 只在首屏说一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 首屏问一次会话：现在有没有登录方式、当前是谁。
  //
  // 会话是外部 auth 组件说的算，本地存的 account 只是上一次的缓存。
  // 三种情况：
  //   会话里有人、本地没有   —— 刚登录回来（跳转式登录会走这条），按登录处理
  //   会话里有人、和本地同一人 —— 什么都不做，接着用本地那份
  //   会话里没人、本地有     —— 在别处退了或过期了，本地跟着回到未登录
  //
  // 最后一条有个前提：必须真的问到了一个能回答的登录组件。组件没接、
  // 请求失败、临时断网时「问不到」不等于「没登录」，那时候把本地清掉
  // 就是拿一次网络抖动去换用户的数据。问不到就保持原样。
  useEffect(() => {
    let alive = true;
    const apply = (user, available) => {
      if (!alive) return;
      const own = stateRef.current.account;
      if (user && (!own || own.userId !== user.userId)) {
        // 换了人，之前「未登录不许写」的判定作废，重新允许同步。
        remote.resetWriteGate();
        // 真实账号进门：开闸进应用。
        setGate("in");
        setState((prev) => signedInState(prev, user));
        return;
      }
      if (user) {
        setGate("in");
        return;
      }
      // 没人登录：本地那份是上一个账号留下的，先归档清零，
      // 然后直接跳去授权页 —— 个人专用版未登录没有可看的东西。
      if (own && available) landSignedOut();
      else if (!own) redirectToSignIn();
      else setGate("unavailable");
    };
    (async () => {
      const session = await readSession();
      if (!alive) return;
      setAuthReady(session.available);
      // apply 紧接着就要读这个值，ref 的渲染后同步来不及，这里直接写入。
      authReadyRef.current = session.available;
      apply(session.user, session.available);
      // 授权跳转带来的 signin 参数只在首屏用一次（决定先画哪一屏），
      // 问完会话就从地址里摘掉；失败的要告诉人一声，不然落得无声无息。
      const params = new URLSearchParams(window.location.search);
      if (params.has("signin")) {
        history.replaceState(null, "", window.location.pathname + window.location.hash);
        if (params.get("signin") === "failed" && !session.user) {
          const why = params.get("why");
          toast(tr(langRef.current).sheet.signInFailed + (why ? `（${why}）` : ""));
        }
      }
    })();
    // 另一个标签页退出、token 过期这类变化也要跟上。
    // 这条消息是登录组件自己发的，所以「没人」就是真的退了。
    const off = subscribeSession((user) => apply(user, true));
    return () => {
      alive = false;
      off();
    };
    // 只在首屏建立一次；landSignedOut / redirectToSignIn 用 ref 读最新状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 首屏探一次服务端。有共享存储就把家庭那份数据拉下来覆盖本地，
  // 没有就什么都不做，继续走本地存储。
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await remote.probe();
      if (!alive || !ok) return;
      setShared(true);
      try {
        const row = await remote.pullState();
        if (!alive) return;
        revisionRef.current = row.revision || 0;
        if (row.payload) {
          skipPushRef.current = true;
          setState((prev) => ({ ...prev, ...row.payload }));
        }
      } catch {
        // 拉取失败就先用本地这份，下一次改动会尝试推上去
      } finally {
        // 成功与否都算「问过了」：一直等下去会把选身份这一步永远卡住。
        if (alive) setSynced(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 状态一变就推给服务端。冲突（别人先存了）时以服务端为准重新落地，
  // 避免两个人来回覆盖对方的记录。
  useEffect(() => {
    if (!shared) return undefined;
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const payload = {
          records: state.records,
          photos: state.photos,
          baby: state.baby,
          metrics: state.metrics,
          faces: state.faces,
          names: state.names,
          roleNotes: state.roleNotes,
          roles: state.roles,
          extraMembers: state.extraMembers,
          typeOrder: state.typeOrder,
        };
        const result = await remote.pushState(payload, revisionRef.current, actingId);
        if (!alive) return;
        if (result.conflict && result.current) {
          revisionRef.current = result.current.revision || 0;
          skipPushRef.current = true;
          setState((prev) => ({ ...prev, ...result.current.payload }));
        } else if (result.ok) {
          revisionRef.current = result.revision;
        }
      } catch {
        // 推送失败不打断操作，本地已经存下了
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // 只有真正共享的那几项变化才需要同步，语言和主题是每个人自己的偏好。
  }, [
    shared,
    actingId,
    state.records,
    state.photos,
    state.baby,
    state.metrics,
    state.faces,
    state.names,
    state.roleNotes,
    state.roles,
    state.extraMembers,
    state.typeOrder,
  ]);

  // 主题写在 <html> 的 data-theme 上，CSS 变量按它切换。
  // 选了「跟随系统」就监听偏好，系统换了这里也跟着换。
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.setAttribute("data-theme", resolved);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", resolved === "dark" ? "#101012" : "#f6f6f7");
    };
    apply();
    if (theme !== "system") return undefined;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  // 语言同步到 <html lang>，读屏和浏览器的断词规则都靠它。
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
  }, [lang]);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
      else localStorage.removeItem(TIMER_KEY);
    } catch {
      // 存不下计时器不影响当前会话的计时。
    }
  }, [timer]);

  // 照片位图存在 IndexedDB 里，进页面时换成 object URL；组件卸载时释放。
  useEffect(() => {
    let alive = true;
    const created = [];
    const ids = photos.filter((p) => p.blobId).map((p) => p.blobId);
    loadBlobs(ids).then((map) => {
      if (!alive) return;
      const next = {};
      for (const photo of photos) {
        const blob = photo.blobId ? map.get(photo.blobId) : null;
        if (blob) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[photo.id] = url;
        } else if (photo.image) {
          next[photo.id] = photo.image;
        } else if (shared && photo.blobId) {
          // 别人上传的照片本机没有位图，直接走服务端地址。
          next[photo.id] = remote.photoUrl(photo.blobId);
        }
      }
      setUrls(next);
    });
    return () => {
      alive = false;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [photos, shared]);

  // 自定义头像同样存在 IndexedDB 里，进页面时换成 object URL。
  useEffect(() => {
    let alive = true;
    const created = [];
    const pairs = Object.entries(faces || {}).filter(([, blobId]) => blobId);
    loadBlobs(pairs.map(([, blobId]) => blobId)).then((map) => {
      if (!alive) return;
      const next = {};
      for (const [id, blobId] of pairs) {
        const blob = map.get(blobId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[id] = url;
        } else if (shared) {
          // 别人换的头像本机没有位图，走服务端那份。
          next[id] = remote.photoUrl(blobId);
        }
      }
      setFaceUrls(next);
    });
    return () => {
      alive = false;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [faces, shared]);

  // 删照片：本地和服务端两份都要清掉，不然库里会留下孤儿位图。
  const forgetBlob = useCallback(
    (blobId) => {
      dropBlob(blobId);
      if (shared) remote.dropPhotoBlob(blobId);
    },
    [shared],
  );

  const toast = useCallback((text) => {
    const id = newId("t");
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 2600);
  }, []);

  const sortRecords = (rows) => [...rows].sort((a, b) => new Date(b.at) - new Date(a.at));

  // 把选中的文件读成相册条目：拍摄时间来自 EXIF，位图进 IndexedDB。
  const ingestPhotos = useCallback(
    async (files, caption, ownerId) => {
      const added = [];
      for (const file of files) {
        const { at, source } = await shotTimeOf(file);
        const blobId = newId("b");
        const stored = await putBlob(blobId, file);
        // 共享形态下位图也要上传，否则别的成员只看到一条没有图的记录。
        if (shared) await remote.putPhotoBlob(blobId, file);
        added.push({
          id: newId("p"),
          memberId: ownerId,
          caption: caption || "",
          prompt: "",
          at: at.toISOString(),
          addedAt: new Date().toISOString(),
          source,
          blobId: stored ? blobId : null,
          image: "",
          name: file.name,
        });
      }
      return added;
    },
    [shared],
  );


  const saveRecord = useCallback(
    async (payload, { silent = false } = {}) => {
      // 表单里选的照片是 File 对象，存进状态之前先读成相册条目，
      // 记录本身只留照片 id，这样「照片」和「随手记配图」都会出现在相册时间轴上。
      const files = Array.isArray(payload.values?.photos) ? payload.values.photos.filter((f) => f instanceof File) : [];
      // 登录状态下署名只能是自己：表单里带上来的 memberId 一概不作数。
      // 编辑旧记录时保留原作者 —— 那条记录是别人记的，不该被改成自己的。
      const own = stateRef.current;
      const mine = roleOf(own);
      const author = mine
        ? payload.id
          ? payload.memberId || mine
          : mine
        : payload.memberId || own.memberId;
      let photos = [];
      if (files.length) {
        setUploading(true);
        photos = await ingestPhotos(files, payload.values.caption || "", author);
        setUploading(false);
      }

      const keptIds = Array.isArray(payload.values?.photos)
        ? payload.values.photos.filter((f) => typeof f === "string")
        : [];
      const photoIds = [...keptIds, ...photos.map((photo) => photo.id)];
      const values = payload.values ? { ...payload.values } : {};
      if ("photos" in values) values.photos = photoIds;
      const entry = { ...payload, memberId: author };

      setState((prev) => {
        // photos 这里是本次新读出来的照片条目（局部变量），要并进 prev.photos。
        const nextPhotos = photos.length
          ? [...photos, ...prev.photos].sort((a, b) => new Date(b.at) - new Date(a.at))
          : prev.photos;
        if (payload.id) {
          const rows = prev.records.map((record) =>
            record.id === payload.id ? { ...record, ...entry, values } : record,
          );
          return { ...prev, records: sortRecords(rows), photos: nextPhotos };
        }
        const record = { ...entry, values, id: newId("r"), createdAt: new Date().toISOString() };
        return { ...prev, records: sortRecords([record, ...prev.records]), photos: nextPhotos };
      });

      setDraft(null);
      setDetail(null);
      if (silent) return;
      const c = tr(langRef.current).sheet;
      if (photos.length) {
        const exif = photos.filter((photo) => photo.source === "exif").length;
        toast(
          exif === photos.length
            ? c.savedWithExif.replace("%n", photos.length)
            : c.savedWithFallback.replace("%n", photos.length).replace("%k", photos.length - exif),
        );
        return;
      }
      toast(payload.id ? c.updatedRecord : c.savedRecord);
    },
    [ingestPhotos, toast],
  );

  const deleteRecordNow = useCallback(
    (id) => {
      // updater 必须是纯函数：不在里面做副作用，也不靠它往外带值
      // （React 可能延后执行或重跑）。先用 stateRef 读到当前状态算好结果，
      // 再提交更新和副作用。stateRef 始终指向最新一次的 state，
      // 不像闭包里的 records/photos 那样停在上一次渲染。
      const current = stateRef.current;
      const gone = current.records.find((record) => record.id === id);
      if (!gone) return;
      // 记录带的配图是随记录一起进相册的，删记录时把这些照片一并撤掉，
      // 否则相册里会留下一张点不回任何记录的孤图。
      const photoIds = Array.isArray(gone.values?.photos) ? gone.values.photos : [];
      const dropped = photoIds.length
        ? current.photos.filter((photo) => photoIds.includes(photo.id))
        : [];

      setState((prev) => ({
        ...prev,
        records: prev.records.filter((record) => record.id !== id),
        photos: photoIds.length
          ? prev.photos.filter((photo) => !photoIds.includes(photo.id))
          : prev.photos,
      }));
      for (const photo of dropped) if (photo.blobId) forgetBlob(photo.blobId);

      setDraft(null);
      setDetail(null);
      const c = tr(langRef.current).sheet;
      toast(dropped.length ? c.deletedRecordPhotos.replace("%n", dropped.length) : c.deletedRecord);
    },
    [forgetBlob, toast],
  );

  // 删记录前先问一句。带了照片的记录要说清楚照片也会一起走，
  // 否则用户以为只删了一条文字记录。
  const deleteRecord = useCallback(
    (id) => {
      const gone = stateRef.current.records.find((record) => record.id === id);
      if (!gone) return;
      const photoIds = Array.isArray(gone.values?.photos) ? gone.values.photos : [];
      const c = tr(langRef.current).sheet;
      setConfirming({
        title: c.confirmDeleteRecord,
        body: c.confirmDeleteRecordBody,
        detail: photoIds.length ? c.confirmDeleteRecordPhotos : "",
        confirmText: c.confirmDeleteRecordDo,
        run: () => deleteRecordNow(id),
      });
    },
    [deleteRecordNow],
  );

  const timerHandlers = useMemo(
    () => ({
      onStart: () => {
        setTimer({ startedAt: Date.now(), paused: 0, pausedAt: null });
        toast(tr(langRef.current).sheet.timerStarted);
      },
      onPause: () => setTimer((prev) => (prev ? { ...prev, pausedAt: Date.now() } : prev)),
      onResume: () =>
        setTimer((prev) =>
          prev && prev.pausedAt
            ? { ...prev, paused: prev.paused + (Date.now() - prev.pausedAt), pausedAt: null }
            : prev,
        ),
      onFinish: (elapsed) => {
        const minutes = Math.max(1, Math.round(elapsed / 60000));
        const startedAt = timer ? new Date(timer.startedAt).toISOString() : new Date().toISOString();
        saveRecord(
          {
            typeId: "sleep",
            memberId: actingId,
            at: startedAt,
            values: { minutes, place: "婴儿床", note: "" },
          },
          { silent: true },
        );
        setTimer(null);
        toast(`${tr(langRef.current).sheet.timerSaved} ${formatDuration(minutes)}`);
      },
      onDiscard: () => {
        const c = tr(langRef.current).sheet;
        setConfirming({
          title: c.confirmDiscard,
          body: c.confirmDiscardBody,
          confirmText: c.confirmDiscardDo,
          run: () => {
            setTimer(null);
            toast(c.timerDiscarded);
          },
        });
      },
    }),
    [actingId, saveRecord, timer, toast],
  );

  // 删这张照片会不会连带删掉整条记录：只有「照片」类型、且这是它最后一张图时才会。
  // 「照片」记录除了图就只剩一句说明，图没了那条记录就是个空壳；随手记这类
  // 本身有正文，掉一张配图不该把整条抹掉。
  const recordEmptiedBy = useCallback((photoId, state) => {
    return state.records.find((record) => {
      if (record.typeId !== "photo") return false;
      const ids = record.values?.photos;
      return Array.isArray(ids) && ids.includes(photoId) && ids.length === 1;
    });
  }, []);

  const removePhotoNow = useCallback(
    (id) => {
      const current = stateRef.current;
      const found = current.photos.find((item) => item.id === id);
      if (found && found.blobId) forgetBlob(found.blobId);
      const emptied = recordEmptiedBy(id, current);

      setState((prev) => {
        const photo = prev.photos.find((item) => item.id === id);
        if (!photo) return prev;
        // 照片是被某条记录带进来的，移除后把那条记录里的引用也摘掉，
        // 否则记录详情里会留一个指向空图的位置。
        // 「照片」记录的最后一张图被删时，整条记录一起删 —— 留一条没有照片的
        // 照片记录，时间线上就是一行点开什么都没有的空记录。
        const records = prev.records
          .filter((record) => !(emptied && record.id === emptied.id))
          .map((record) => {
            const ids = record.values?.photos;
            if (!Array.isArray(ids) || !ids.includes(id)) return record;
            return { ...record, values: { ...record.values, photos: ids.filter((x) => x !== id) } };
          });
        return { ...prev, photos: prev.photos.filter((item) => item.id !== id), records };
      });
      setViewing(null);
      // 同时删掉的那条记录可能正开着详情
      if (emptied) setDetail((open) => (open && open.id === emptied.id ? null : open));
      const c = tr(langRef.current).sheet;
      toast(emptied ? c.photoRemovedRecord : c.photoRemoved);
    },
    [forgetBlob, recordEmptiedBy, toast],
  );

  const removePhoto = useCallback(
    (id) => {
      const c = tr(langRef.current).sheet;
      // 会连带删掉一条记录的话，先说清楚，不然用户以为只是少了张图。
      const emptied = recordEmptiedBy(id, stateRef.current);
      setConfirming({
        title: c.confirmDeletePhoto,
        body: c.confirmDeletePhotoBody,
        detail: emptied ? c.confirmDeletePhotoRecord : "",
        confirmText: c.confirmDeletePhotoDo,
        run: () => removePhotoNow(id),
      });
    },
    [recordEmptiedBy, removePhotoNow],
  );

  const setCaption = useCallback((id, caption) => {
    setState((prev) => ({
      ...prev,
      photos: prev.photos.map((photo) => (photo.id === id ? { ...photo, caption } : photo)),
    }));
  }, []);

  const setTypeOrder = useCallback((next) => {
    setState((prev) => ({ ...prev, typeOrder: next }));
  }, []);

  const setLang = useCallback((next) => {
    setState((prev) => ({ ...prev, lang: next }));
  }, []);

  const setTheme = useCallback((next) => {
    setState((prev) => ({ ...prev, theme: next }));
  }, []);

  const saveMetrics = useCallback((next) => {
    setState((prev) => ({ ...prev, metrics: next }));
  }, []);

  const saveBaby = useCallback(
    (next) => {
      setState((prev) => ({ ...prev, baby: next }));
      setEditingBaby(false);
      toast(tr(langRef.current).sheet.babyUpdated);
    },
    [toast],
  );

  // 成员当前显示的名字。改过名的走 names，没改过的用名单里的原名。
  // toast 里要报名字，而 usePerson 只能在组件里用，所以回调走这个。
  const nameOf = useCallback((id) => {
    const own = stateRef.current;
    const found = findMember(id, own.extraMembers);
    return (own.names && own.names[id]) || (found && found.custom ? found.name : memberName(found, langRef.current)) || id;
  }, []);

  // 切换身份。未登录时只改这台设备的预览视角；登录后写进 roles 里
  // 自己那条 —— 身份跟着账号走，换设备、同步给家里人看到的都是新的。
  const switchMember = useCallback(
    (id) => {
      setState((prev) => {
        if (!prev.account) return { ...prev, memberId: id };
        return { ...prev, memberId: id, roles: { ...prev.roles, [prev.account.userId]: id } };
      });
      toast(`${tr(langRef.current).sheet.switchedTo} · ${nameOf(id)}`);
    },
    [nameOf, toast],
  );

  // 换照护者头像：位图进 IndexedDB，state 里只记一个位图 id。
  // 换掉的那张要顺手删掉，否则每换一次库里就多留一张再也用不到的图。
  const setFace = useCallback(
    async (id, file) => {
      if (!file) return;
      if (!/^image\//.test(file.type || "")) {
        toast(tr(langRef.current).family.faceBadType);
        return;
      }
      const blobId = newId("f");
      const stored = await putBlob(blobId, file);
      if (!stored) {
        toast(tr(langRef.current).family.faceFailed);
        return;
      }
      if (shared) await remote.putPhotoBlob(blobId, file);
      const previous = stateRef.current.faces?.[id];
      setState((prev) => ({ ...prev, faces: { ...prev.faces, [id]: blobId } }));
      if (previous) forgetBlob(previous);
      toast(`${nameOf(id)}${tr(langRef.current).family.faceChanged}`);
    },
    [forgetBlob, nameOf, shared, toast],
  );

  // 恢复出厂头像：state 里的指针拿掉，位图一起删。
  const clearFace = useCallback(
    (id) => {
      const previous = stateRef.current.faces?.[id];
      if (!previous) return;
      setState((prev) => {
        const next = { ...prev.faces };
        delete next[id];
        return { ...prev, faces: next };
      });
      forgetBlob(previous);
      toast(`${nameOf(id)}${tr(langRef.current).family.faceReset}`);
    },
    [forgetBlob, nameOf, toast],
  );

  const closeAllSheets = useCallback(() => {
    setTimer(null);
    setDraft(null);
    setDetail(null);
    setViewing(null);
    setEditingBaby(false);
  }, []);

  // 回到未登录。用户自己的内容不丢：先归档到对应账号名下，
  // 重新登录时原样恢复（服务端也还有一份，双保险）。归档按账号隔离，
  // 这台设备上换一个人登录，看不到上一个账号的记录和照片。
  // 位图（IndexedDB 里的照片和头像）留着：归档里的指针还有效，
  // 别的账号的状态不引用这些 id，界面上自然也碰不到它们。
  // 归档完直接跳去授权页 —— 个人专用版未登录没有可停留的界面。
  const landSignedOut = useCallback(() => {
    const keepLang = stateRef.current.lang;
    archiveState(stateRef.current);
    // 语言和主题是这台设备的偏好，不属于账号，退出后留着。
    const { theme: keepTheme } = stateRef.current;
    setState(resetState({ lang: keepLang, theme: keepTheme }));
    closeAllSheetsRef.current();
    toast(tr(keepLang).sheet.signedOutDone);
    redirectToSignIn();
  }, [redirectToSignIn, toast]);

  // 闸门的重试按钮：再问一次会话，走和首屏相同的分派。
  const recheckSession = useCallback(async () => {
    setGate("checking");
    const session = await readSession();
    setAuthReady(session.available);
    authReadyRef.current = session.available;
    const own = stateRef.current.account;
    if (session.user) {
      remote.resetWriteGate();
      setGate("in");
      if (!own || own.userId !== session.user.userId) {
        setState((prev) => signedInState(prev, session.user));
      }
      return;
    }
    if (own && session.available) landSignedOut();
    else if (!own) redirectToSignIn();
    else setGate("unavailable");
  }, [landSignedOut, redirectToSignIn]);

  const signOutNow = useCallback(async () => {
    await endSignOut();
    landSignedOut();
  }, [landSignedOut]);

  // 退出登录不二次确认：数据有归档和服务端两份保障，退出去再回来
  // 什么都没有变，这一步没有破坏性。
  const signOut = useCallback(() => {
    signOutNow();
  }, [signOutNow]);

  // 首次登录后选定家庭身份。选定即不可更改，所以先问一句。
  // 引导提交：身份和宝宝信息一起落地。身份不可更改这件事先说清楚，
  // 确认弹窗复用全局那一个，不单独造轮子。
  const finishOnboarding = useCallback(
    (data) => {
      const c = tr(langRef.current).role;
      const birthDate = fromLocalInput(data.birth);
      const capped = birthDate > new Date() ? new Date() : birthDate;
      setState((prev) => {
        let roleId = data.roleId;
        let extraMembers = prev.extraMembers || [];
        // 「其他身份」：用用户起的名字新建一个家庭成员，身份就落在它身上。
        if (!roleId && data.customName) {
          roleId = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          extraMembers = [...extraMembers, { id: roleId, name: data.customName.slice(0, 12), custom: true }];
        }
        return {
          ...withRole({ ...prev, extraMembers }, roleId),
          baby: { ...prev.baby, name: data.name, gender: data.gender, birth: capped.toISOString() },
        };
      });
      toast(c.picked);
    },
    [toast],
  );

  // 改显示名。身份不动，只覆盖这个成员显示出来的名字。
  const renameMember = useCallback(
    (id, name) => {
      setState((prev) => ({ ...prev, names: { ...prev.names, [id]: name } }));
      toast(tr(langRef.current).family.renameDone);
    },
    [toast],
  );

  // 改身份描述（名字下面那行小字）。清空就是回到名单里的默认描述。
  const setRoleNote = useCallback(
    (id, note) => {
      setState((prev) => {
        const roleNotes = { ...prev.roleNotes };
        if (note) roleNotes[id] = note;
        else delete roleNotes[id];
        return { ...prev, roleNotes };
      });
      toast(tr(langRef.current).settings.roleNoteDone);
    },
    [toast],
  );

  // 详情页要按「照片 id」取图，而 urls 的键就是照片 id，直接复用。
  const photoUrlsById = urls;

  // 成员的显示层信息（改过的名字 + 换过的头像）走 context，
  // 谁要画头像或署名谁自己取，不逐层传。
  const people = useMemo(
    () => ({ faces: faceUrls, names, roleNotes: state.roleNotes, extraMembers: state.extraMembers, lang }),
    [faceUrls, names, state.roleNotes, state.extraMembers, lang],
  );

  // 登录了但引导还没走完（没选身份或宝宝信息没填）—— 这一步必须先走完，
  // 否则记录不知道该署给谁、时间轴不知道原点在哪。
  // 要等服务端那份状态拉下来之后才能判断，否则换设备时会在
  // 数据到达前先弹一次引导，填完又和已有的撞上。
  const needsOnboarding = Boolean(account && (!myRole || !baby.birth) && (!shared || synced));

  const age = ageLabel(baby.birth, new Date(), t.today);
  const active = tabs.find((item) => item.id === tab);
  const label = (id) => t.tabs[id] || { name: id, caption: "" };

  return (
    <PeopleContext.Provider value={people}>
    {gate !== "in" ? (
      <GateScreen lang={lang} phase={gate} onRetry={recheckSession} />
    ) : (
    <div className="shell">
      <nav className="sidenav">
        <button
          type="button"
          className="brandmark brandhome"
          onClick={() => setTab("today")}
          title={t.brand}
          aria-label={t.brand}
        >
          <img className="mark" src="/assets/logo.png" alt="" aria-hidden="true" />
          <span>
            <span className="wordmark" style={{ display: "block" }}>{t.brand}</span>
          </span>
        </button>

        <div className="navlist">
          {tabs.map((item) => {
            const Shape = item.icon;
            return (
              <button type="button" key={item.id} className={item.id === tab ? "on" : ""} onClick={() => setTab(item.id)}>
                <Shape />
                {label(item.id).name}
              </button>
            );
          })}
        </div>

        <div className="sidefoot">
          <div className="babycard spotcard">
            <SceneArt name="moonstars" className="cardspot" />
            <button
              type="button"
              className="row babyrow"
              onClick={() => setEditingBaby(true)}
              aria-label={`${t.a11y.editProfile} · ${babyName(baby, state.lang)}`}
            >
              <span className="avatar tone-lilac" aria-hidden="true">{(babyName(baby, state.lang) || "?")[0]}</span>
              <span className="grows">
                <span className="name" style={{ display: "block" }}>{babyName(baby, state.lang)}</span>
                <span className="age figure">{age}</span>
              </span>
              <Icon.pen />
            </button>
            <div className="hushed" style={{ fontSize: 11.5 }}>
              <span className="figure">{view.recordTotal}</span> {t.common.records} ·{" "}
              <span className="figure">{view.photoTotal}</span> {t.album.photos}
            </div>
          </div>
        </div>
      </nav>

      <main className="work">
        <header className="workbar">
          <div className="grows">
            <h1>{label(active.id).name}</h1>
            <div className="caption">{label(active.id).caption}</div>
          </div>
          <IdentityButton
            currentId={actingId}
            label={t.settings.open}
            onOpen={() => setSettingsOpen(true)}
          />
        </header>

        {/* 手机上没有顶栏，头像浮在右上角 */}
        <IdentityButton
          floating
          currentId={actingId}
          label={t.settings.open}
          onOpen={() => setSettingsOpen(true)}
        />

        {/* 模块背景：贴在滚动容器之外，所以滚内容时它固定不动。
            四个模块各一张，用 cover 铺满，任何屏幕比例下都不会露出白边。 */}
        <SceneArt name={bgForTab(tab)} className="viewbg" key={tab} />

        <div className="scrollarea">
          {tab === "charts" ? (
            <ChartsView records={records} lang={lang} onOpenRecord={(record) => setDetail(record)} />
          ) : null}
          {tab === "today" ? (
            <TodayView
              view={view}
              records={records}
              timer={timer}
              timerHandlers={timerHandlers}
              baby={baby}
              metrics={metrics}
              lang={lang}
              onChangeMetrics={saveMetrics}
              onEditBaby={() => setEditingBaby(true)}
              onOpenRecord={(record) => setDetail(record)}
            />
          ) : null}
          {tab === "album" ? (
            <AlbumView photos={photos} urls={urls} baby={baby} lang={lang} onOpenPhoto={(photo) => setViewing(photo)} />
          ) : null}
          {tab === "family" ? (
            <FamilyView
              view={view}
              lang={lang}
              currentId={actingId}
              faces={faces}
              extraMembers={state.extraMembers}
              locked={Boolean(account)}
              onSwitch={switchMember}
              onFace={setFace}
              onClearFace={clearFace}
            />
          ) : null}
        </div>
      </main>

      <button
        type="button"
        className="addfab deskonly"
        onClick={() => setDraft({ at: new Date().toISOString(), memberId: actingId })}
        title={t.common.add}
        aria-label={t.common.add}
      >
        <Icon.plus />
      </button>

      <nav className="tabbar">
        {tabs.slice(0, 2).map((item) => {
          const Shape = item.icon;
          return (
            <button type="button" key={item.id} className={item.id === tab ? "on" : ""} onClick={() => setTab(item.id)}>
              <Shape />
              {label(item.id).name}
            </button>
          );
        })}
        <button
          type="button"
          className="tabadd"
          onClick={() => setDraft({ at: new Date().toISOString(), memberId: actingId })}
          aria-label={t.common.add}
        >
          <span className="tabaddring">
            <Icon.plus />
          </span>
        </button>
        {tabs.slice(2).map((item) => {
          const Shape = item.icon;
          return (
            <button type="button" key={item.id} className={item.id === tab ? "on" : ""} onClick={() => setTab(item.id)}>
              <Shape />
              {label(item.id).name}
            </button>
          );
        })}
      </nav>

      {draft ? (
        <RecordDrawer
          lang={lang}
          typeOrder={typeOrder}
          onReorder={setTypeOrder}
          draft={draft}
          currentId={actingId}
          records={records}
          onClose={() => setDraft(null)}
          onSave={saveRecord}
          onDelete={deleteRecord}
        />
      ) : null}

      {detail && !draft ? (
        <RecordDetail
          lang={lang}
          photoUrls={photoUrlsById}
          record={detail}
          onClose={() => setDetail(null)}
          onEdit={(record) => {
            setDraft(record);
            setDetail(null);
          }}
          onDelete={deleteRecord}
        />
      ) : null}

      {viewing ? (
        <PhotoLightbox
          baby={baby}
          photo={photos.find((item) => item.id === viewing.id) || viewing}
          url={urls[viewing.id]}
          records={records}
          onClose={() => setViewing(null)}
          onCaption={setCaption}
          onDelete={removePhoto}
        />
      ) : null}

      {editingBaby ? (
        <BabySheet
          baby={baby}
          records={records}
          photos={photos}
          lang={lang}
          onClose={() => setEditingBaby(false)}
          onSave={saveBaby}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsSheet
          currentId={actingId}
          lang={lang}
          theme={theme}
          account={account}
          extraMembers={state.extraMembers}
          onSwitch={switchMember}
          onRename={renameMember}
          onRoleNote={setRoleNote}
          onLang={setLang}
          onTheme={setTheme}
          onSignOut={() => {
            setSettingsOpen(false);
            signOut();
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {/* 引导挡在最前面：身份和宝宝信息不齐就没法记东西，
          所以它不给关闭入口，直到填完为止。 */}
      {needsOnboarding ? (
        <Onboarding
          lang={lang}
          // 已经被别的账号认领的身份要标出来。不禁止选 —— 家里的人可能比
          // 名单上的角色多，硬禁会把最后一个人挡在门外；标出来让人自己避开。
          taken={Object.entries(state.roles || {})
            .filter(([userId]) => !account || userId !== account.userId)
            .map(([, roleId]) => roleId)}
          onDone={finishOnboarding}
        />
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={confirming.title}
          body={confirming.body}
          detail={confirming.detail}
          confirmText={confirming.confirmText}
          cancelText={t.sheet.confirmCancel}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const run = confirming.run;
            setConfirming(null);
            run();
          }}
        />
      ) : null}

      <Toasts items={toasts} />
    </div>
    )}
    </PeopleContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
