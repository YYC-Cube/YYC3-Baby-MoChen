import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import {
  Avatar,
  BirthFields,
  ConfirmDialog,
  PersonName,
  SceneArt,
  ShotPlaceholder,
  Stepper,
  TypeGlyph,
  sceneForType,
  usePerson,
} from "./components.jsx";
import { displayValues, initialValues, recordTypes, trGroup, trLabel, trType, trValue, typeById, typeOf } from "./data.js";
import { tr } from "./i18n.js";
import { clock, dayLabel, fromLocalInput, stampLabel, toLocalInput } from "./format.js";
import { ageLabel, animalOf, entriesBefore, zodiacOf } from "./family.js";

// 表单里的照片选择：选中的文件先留在内存里做预览，
// 真正读拍摄时间、写 IndexedDB 都在保存记录的那一刻做。
function PhotoField({ field, value, onChange, lang }) {
  const a = tr(lang).a11y;
  const inputRef = useRef(null);
  const files = Array.isArray(value) ? value : [];
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const add = (fileList) => {
    const picked = [...fileList].filter((file) => file.type.startsWith("image/"));
    if (picked.length) onChange([...files, ...picked]);
  };

  return (
    <div className="photofield">
      <div className="photorow">
        {previews.map((url, index) => (
          <span className="photochip" key={url}>
            <img src={url} alt="" />
            <button
              type="button"
              className="photodrop"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={a.removePhoto}
              title={a.removePhoto}
            >
              <Icon.close />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="photoadd"
          onClick={() => inputRef.current?.click()}
          aria-label={a.pickPhotos}
        >
          <Icon.plus />
        </button>
      </div>
      {field.hint ? <span className="photohint hushed">{lang === "en" && field.hintEn ? field.hintEn : field.hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function FieldInput({ field, value, onChange, lang }) {
  if (field.type === "photo") {
    return <PhotoField field={field} value={value} onChange={onChange} lang={lang} />;
  }
  if (field.type === "choice") {
    return (
      <div className="pillrow">
        {field.options.map((option) => (
          <button
            type="button"
            key={option}
            className={`pill${value === option ? " on" : ""}`}
            onClick={() => onChange(option)}
          >
            {trValue(option, lang)}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === "number") {
    return (
      <Stepper
        value={value}
        onChange={onChange}
        step={field.step || 1}
        min={field.min ?? 0}
        max={field.max ?? 9999}
        suffix={trValue(field.suffix, lang)}
        lang={lang}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        className="areain"
        value={value}
        placeholder={lang === "en" && field.placeholderEn ? field.placeholderEn : field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      className="textin"
      type="text"
      value={value}
      placeholder={lang === "en" && field.placeholderEn ? field.placeholderEn : field.placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

// 记录类型网格。图标和名字挨在一起，不显示分组也不显示上次时间 ——
// 这个面板是用来「快速点一下」的，多余的信息只会让目标变小。
// 长按任意一个图标进入排序态，之后可以拖着换位置。
function TypePicker({ types, lang, onPick, onReorder }) {
  const [sorting, setSorting] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const holdRef = useRef(null);
  const movedRef = useRef(false);
  const gridRef = useRef(null);

  useEffect(() => () => clearTimeout(holdRef.current), []);

  // React 的 onTouchMove 是被动监听，里面的 preventDefault 会被忽略，
  // 拖拽时页面照样跟着滚。排序态下改用原生非被动监听接管滚动拦截。
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !sorting) return undefined;
    const block = (event) => event.preventDefault();
    grid.addEventListener("touchmove", block, { passive: false });
    return () => grid.removeEventListener("touchmove", block);
  }, [sorting]);

  // 长按 480ms 进排序态；手指划动就当成滚动，不触发。
  const startHold = () => {
    movedRef.current = false;
    clearTimeout(holdRef.current);
    holdRef.current = setTimeout(() => {
      if (!movedRef.current) {
        setSorting(true);
        if (navigator.vibrate) navigator.vibrate(12);
      }
    }, 480);
  };
  const cancelHold = () => clearTimeout(holdRef.current);

  const move = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const ids = types.map((item) => item.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids);
  };

  // 触摸拖拽：手指底下是哪一格，就把被拖的那个挪过去。
  const cellUnder = (touch) => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el && el.closest(".typecell");
    return cell ? cell.dataset.id : null;
  };

  return (
    <div className={`typewrap${sorting ? " sorting" : ""}`}>
      <div className="typegrid" ref={gridRef}>
        {types.map((item) => (
          <button
            type="button"
            key={item.id}
            data-id={item.id}
            className={`typecell${dragId === item.id ? " dragging" : ""}${
              overId === item.id && dragId !== item.id ? " over" : ""
            }`}
            onClick={() => {
              if (!sorting) onPick(item.id);
            }}
            draggable={sorting}
            onDragStart={() => setDragId(item.id)}
            onDragOver={(event) => {
              if (!sorting) return;
              event.preventDefault();
              setOverId(item.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              move(dragId, item.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onTouchStart={() => {
              if (sorting) setDragId(item.id);
              else startHold();
            }}
            onTouchMove={(event) => {
              movedRef.current = true;
              cancelHold();
              if (!sorting || !dragId) return;
              const id = cellUnder(event.touches[0]);
              if (id) setOverId(id);
            }}
            onTouchEnd={(event) => {
              cancelHold();
              if (sorting && dragId) {
                const id = cellUnder(event.changedTouches[0]) || overId;
                move(dragId, id);
              }
              setDragId(null);
              setOverId(null);
            }}
            onTouchCancel={() => {
              cancelHold();
              setDragId(null);
              setOverId(null);
            }}
          >
            <TypeGlyph typeId={item.id} glyph={item.glyph} />
            <span className="nm">{trType(item, lang)}</span>
          </button>
        ))}
      </div>

      {sorting ? (
        <div className="sortbar">
          <span className="hushed">{tr(lang).sheet.sortingHint}</span>
          <button type="button" className="action lead" onClick={() => setSorting(false)}>
            <Icon.check />
            {tr(lang).common.done}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RecordDrawer({ draft, currentId, records, lang, typeOrder, onReorder, onClose, onSave, onDelete }) {
  const t = tr(lang).sheet;
  const a = tr(lang).a11y;
  const [typeId, setTypeId] = useState(draft.typeId || null);
  const [values, setValues] = useState(draft.values || {});
  const [when, setWhen] = useState(() => toLocalInput(draft.at || new Date().toISOString()));

  const editing = Boolean(draft.id);
  const type = typeId ? typeById[typeId] : null;

  useEffect(() => {
    if (!typeId || editing) return;
    setValues(initialValues(typeById[typeId]));
  }, [typeId, editing]);

  // 面板按用户排好的顺序展示；顺序里没有的（新加的类型）接在后面。
  const orderedTypes = useMemo(() => {
    const byId = new Map(recordTypes.map((item) => [item.id, item]));
    const picked = (typeOrder || []).map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(picked.map((item) => item.id));
    return [...picked, ...recordTypes.filter((item) => !seen.has(item.id))];
  }, [typeOrder]);

  if (!type) {
    return (
      <>
        <div className="scrim" onClick={onClose} />
        <aside className="drawer" role="dialog" aria-label={t.pickType}>
          <header className="drawer-head">
            <SceneArt name="gift" className="headspot" />
            <div className="grows">
              <h2>{t.pickType}</h2>
              <div className="hushed" style={{ fontSize: 12 }}>{t.reorderHint}</div>
            </div>
            <button type="button" className="iconbtn" onClick={onClose} title={t.close} aria-label={t.close}>
              <Icon.close />
            </button>
          </header>
          <div className="drawer-body">
            <TypePicker
              types={orderedTypes}
              lang={lang}
              onPick={(id) => setTypeId(id)}
              onReorder={onReorder}
            />
          </div>
        </aside>
      </>
    );
  }

  const submit = () => {
    onSave({
      id: draft.id,
      typeId: type.id,
      memberId: draft.memberId || currentId,
      at: fromLocalInput(when).toISOString(),
      values,
    });
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`${trType(type, lang)} · ${a.recordPanel}`}>
        <header className="drawer-head">
          {!editing ? (
            <button type="button" className="iconbtn" onClick={() => setTypeId(null)} title={a.back} aria-label={a.backToTypes}>
              <Icon.back />
            </button>
          ) : null}
          <TypeGlyph typeId={type.id} glyph={type.glyph} lead />
          <div className="grows">
            <h2>{trType(type, lang)}</h2>
            <div className="hushed" style={{ fontSize: 12 }}>{trGroup(type, lang)}</div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} title={a.close} aria-label={a.closePanel}>
            <Icon.close />
          </button>
        </header>

        <div className="drawer-body">
          <div className="formgrid">
            <div className="formrow">
              <span className="label">{t.when}</span>
              <input className="datein" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
            </div>
            {type.fields.map((field) => (
              <div className="formrow" key={field.key}>
                <span className="label">{trLabel(field, lang)}</span>
                <FieldInput
                  lang={lang}
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(next) => setValues((prev) => ({ ...prev, [field.key]: next }))}
                />
              </div>
            ))}
            <div className="formrow">
              <span className="label">{t.who}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Avatar memberId={draft.memberId || currentId} size="sm" />
                <PersonName memberId={draft.memberId || currentId} />
                <span className="hushed" style={{ fontSize: 11.5 }}>{t.whoHint}</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="drawer-foot">
          {editing ? (
            <button type="button" className="action risky" onClick={() => onDelete(draft.id)}>
              <Icon.trash />
              {tr(lang).common.delete}
            </button>
          ) : null}
          <span className="grows" />
          <button type="button" className="action" onClick={onClose}>
            {tr(lang).common.cancel}
          </button>
          <button type="button" className="action lead" onClick={submit}>
            <Icon.check />
            {tr(lang).common.save}
          </button>
        </footer>
      </aside>
    </>
  );
}

export function RecordDetail({ record, onClose, onEdit, onDelete, photoUrls, lang }) {
  const t = tr(lang).sheet;
  const a = tr(lang).a11y;
  const type = typeOf(record.typeId);
  const member = usePerson(record.memberId);
  // values 可能是 null 或压根没写，逐字段读之前先兜一次：
  // 缺的字段一律显示破折号，记录本身照常打得开、改得动。
  const shown = displayValues(record, lang);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer detaildrawer" role="dialog" aria-label={`${trType(type, lang)} · ${a.recordDetail}`}>
        <SceneArt name={sceneForType(type.id)} className="drawerspot" />
        <header className="drawer-head">
          <TypeGlyph typeId={type.id} glyph={type.glyph} lead />
          <div className="grows">
            <h2>{trType(type, lang)}</h2>
            <div className="hushed" style={{ fontSize: 12 }}>
              {dayLabel(record.at, new Date(), lang)} <span className="figure">{clock(record.at)}</span>
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} title={a.close} aria-label={a.closePanel}>
            <Icon.close />
          </button>
        </header>
        <div className="drawer-body">
          <div className="detaillist">
            {type.fields.map((field) => {
              if (field.type === "photo") {
                const ids = Array.isArray(shown[field.key]) ? shown[field.key] : [];
                return (
                  <div className="detailrow" key={field.key}>
                    <span className="k">{trLabel(field, lang)}</span>
                    {ids.length ? (
                      <span className="detailshots">
                        {ids.map((photoId) => (
                          <span className="detailshot" key={photoId}>
                            {photoUrls && photoUrls[photoId] ? (
                              <img src={photoUrls[photoId]} alt="" />
                            ) : null}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span>{t.noPhotos}</span>
                    )}
                  </div>
                );
              }
              return (
                <div className="detailrow" key={field.key}>
                  <span className="k">{trLabel(field, lang)}</span>
                  <span>
                    {shown[field.key] === "" || shown[field.key] === undefined || shown[field.key] === null
                      ? "—"
                      : `${trValue(shown[field.key], lang)}${field.suffix ? ` ${trValue(field.suffix, lang)}` : ""}`}
                  </span>
                </div>
              );
            })}
            <div className="detailrow">
              <span className="k">{t.addedBy}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar memberId={record.memberId} size="sm" />
                {member ? `${member.name} · ${member.role}` : t.unknownMember}
              </span>
            </div>
            <div className="detailrow">
              <span className="k">{t.writtenAt}</span>
              <span className="figure">{stampLabel(record.createdAt || record.at, lang)}</span>
            </div>
          </div>
        </div>
        <footer className="drawer-foot">
          <button type="button" className="action risky" onClick={() => onDelete(record.id)}>
            <Icon.trash />
            {tr(lang).common.delete}
          </button>
          <span className="grows" />
          <button type="button" className="action lead" onClick={() => onEdit(record)}>
            {tr(lang).common.edit}
          </button>
        </footer>
      </aside>
    </>
  );
}

export function PhotoLightbox({ photo, url, records, baby, lang, onClose, onCaption, onDelete }) {
  const t = tr(lang).sheet;
  const a = tr(lang).a11y;
  const [caption, setCaption] = useState((lang === "en" && photo.captionEn ? photo.captionEn : photo.caption) || "");
  const member = usePerson(photo.memberId);
  const age = ageLabel(baby.birth, photo.at, tr(lang).today);
  const sameDay = records.filter((r) => new Date(r.at).toDateString() === new Date(photo.at).toDateString()).slice(0, 4);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="lightbox" role="dialog" aria-label={a.photoDetail}>
        <div className="plate">
          <div className="big">
            {url ? (
              <img src={url} alt={(lang === "en" && photo.captionEn ? photo.captionEn : photo.caption) || a.photoAlt} />
            ) : (
              <ShotPlaceholder prompt={photo.prompt} label={t.artPending} />
            )}
          </div>
          <div className="side">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 560 }}>{age}</div>
                <div className="hushed figure" style={{ fontSize: 12 }}>
                  {stampLabel(photo.at, lang)}
                </div>
              </div>
              <button type="button" className="iconbtn" onClick={onClose} title={a.close} aria-label={a.closePanel}>
                <Icon.close />
              </button>
            </div>

            <div className="formrow">
              <span className="label">{t.caption}</span>
              <input
                className="textin"
                value={caption}
                placeholder={t.captionHint}
                onChange={(event) => setCaption(event.target.value)}
                onBlur={() => onCaption(photo.id, caption)}
              />
            </div>

            <div className="detaillist">
              <div className="detailrow">
                <span className="k">{t.uploader}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar memberId={photo.memberId} size="sm" />
                  {member ? member.name : t.unknownMember}
                </span>
              </div>
              <div className="detailrow">
                <span className="k">{t.timeSource}</span>
                <span>{photo.source === "exif" ? t.fromExif : t.fromFile}</span>
              </div>
            </div>

            {sameDay.length ? (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.thatDay}</div>
                <div className="pillrow">
                  {sameDay.map((record) => (
                    <span className="pill" key={record.id}>
                      <span className="figure">{clock(record.at)}</span> {trType(typeOf(record.typeId), lang)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {!url ? (
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.prompt}</div>
                <p className="promptbox">{photo.prompt}</p>
              </div>
            ) : null}

            <button type="button" className="action risky" onClick={() => onDelete(photo.id)} style={{ justifySelf: "start" }}>
              <Icon.trash />
              {t.removePhoto}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// 宝宝资料编辑：点今日页的头卡打开。出生日期会影响所有月龄计算，
// 所以这里限制不能选未来，也不能早于相册里最早的一张照片。
export function BabySheet({ baby, records, photos, lang, onClose, onSave }) {
  const t = tr(lang).sheet;
  const a = tr(lang).a11y;
  const [form, setForm] = useState(() => ({
    name: baby.name || "",
    gender: baby.gender || "女孩",
    birth: toLocalInput(baby.birth),
    birthWeight: baby.birthWeight ?? "",
    birthHeight: baby.birthHeight ?? "",
    birthHead: baby.birthHead ?? "",
    bloodType: baby.bloodType || "未记录",
    note: baby.note || "",
  }));

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const nameEmpty = !form.name.trim();
  const [pending, setPending] = useState(null);

  const commit = (capped) => {
    onSave({
      ...baby,
      name: form.name.trim(),
      gender: form.gender,
      birth: capped.toISOString(),
      birthWeight: form.birthWeight === "" ? null : Number(form.birthWeight),
      birthHeight: form.birthHeight === "" ? null : Number(form.birthHeight),
      birthHead: form.birthHead === "" ? null : Number(form.birthHead),
      bloodType: form.bloodType,
      note: form.note.trim(),
    });
  };

  // 出生日期可以随便改，但改晚之后原来那些记录并不会消失——它们只是变成
  // 「出生前」的记录。这在数据上没问题，在观感上却容易被当成出错，
  // 所以先说清楚有多少条会这样，再由用户决定。数据一条都不动。
  const submit = () => {
    if (nameEmpty) return;
    const birthDate = fromLocalInput(form.birth);
    const capped = birthDate > new Date() ? new Date() : birthDate;
    const stale = entriesBefore(capped, records, photos);
    if (stale.total > 0) {
      setPending({ capped, stale });
      return;
    }
    commit(capped);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={a.babyEdit}>
        <header className="drawer-head">
          <span className="portrait sz-sm" aria-hidden="true">
            <img src={baby.portrait} alt="" />
          </span>
          <div className="grows">
            <h2>{t.babyTitle}</h2>
            <div className="hushed" style={{ fontSize: 12 }}>{t.babyHint}</div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} title={a.close} aria-label={a.closePanel}>
            <Icon.close />
          </button>
        </header>

        <div className="drawer-body">
          <div className="formgrid">
            <div className="formrow">
              <span className="label">{t.name}</span>
              <input
                className="textin"
                value={form.name}
                placeholder={t.namePlaceholder}
                onChange={(event) => set("name")(event.target.value)}
              />
              {nameEmpty ? <span className="hushed" style={{ fontSize: 11.5 }}>{t.nameEmpty}</span> : null}
            </div>

            <div className="formrow">
              <span className="label">{t.gender}</span>
              <div className="pillrow">
                {["女孩", "男孩", "不填"].map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`pill${form.gender === option ? " on" : ""}`}
                    onClick={() => set("gender")(option)}
                  >
                    {trValue(option, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div className="formrow">
              <span className="label">{t.birth}</span>
              <BirthFields value={form.birth} onChange={set("birth")} lang={lang} />
              <span className="hushed" style={{ fontSize: 11.5 }}>{t.birthHint}</span>
            </div>

            <div className="formrow">
              <span className="label">{t.birthWeight}</span>
              <Stepper value={form.birthWeight} onChange={set("birthWeight")} step={0.1} min={0.5} max={8} suffix={trValue("千克", lang)} lang={lang} />
            </div>

            <div className="formrow">
              <span className="label">{t.birthHeight}</span>
              <Stepper value={form.birthHeight} onChange={set("birthHeight")} step={0.5} min={25} max={70} suffix={trValue("厘米", lang)} lang={lang} />
            </div>

            <div className="formrow">
              <span className="label">{t.birthHead}</span>
              <Stepper value={form.birthHead} onChange={set("birthHead")} step={0.5} min={20} max={50} suffix={trValue("厘米", lang)} lang={lang} />
            </div>

            <div className="formrow">
              <span className="label">{t.bloodType}</span>
              <div className="pillrow">
                {["未记录", "A", "B", "AB", "O"].map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={`pill${form.bloodType === option ? " on" : ""}`}
                    onClick={() => set("bloodType")(option)}
                  >
                    {trValue(option, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div className="formrow">
              <span className="label">{t.zodiac}</span>
              <span className="hushed">{zodiacOf(fromLocalInput(form.birth)?.toISOString(), lang) || "—"}</span>
            </div>

            <div className="formrow">
              <span className="label">{t.animal}</span>
              <span className="hushed">
                {(() => {
                  const a = animalOf(fromLocalInput(form.birth)?.toISOString(), lang);
                  if (!a) return "—";
                  return lang === "en" ? a : `生肖${a}`;
                })()}
              </span>
              <span className="hushed" style={{ fontSize: 11.5 }}>{t.derivedHint}</span>
            </div>

            <div className="formrow">
              <span className="label">{t.note}</span>
              <textarea
                className="areain"
                value={form.note}
                placeholder={t.notePlaceholder}
                onChange={(event) => set("note")(event.target.value)}
              />
            </div>
          </div>
        </div>

        <footer className="drawer-foot">
          <span className="grows" />
          <button type="button" className="action" onClick={onClose}>
            {tr(lang).common.cancel}
          </button>
          <button type="button" className="action lead" onClick={submit} disabled={nameEmpty}>
            <Icon.check />
            {tr(lang).common.save}
          </button>
        </footer>
      </aside>

      {pending ? (
        <ConfirmDialog
          title={t.birthLateTitle}
          body={t.birthLateBody}
          detail={`${pending.stale.records} ${t.birthLateRecords} · ${pending.stale.photos} ${t.birthLatePhotos}`}
          confirmText={t.birthLateDo}
          cancelText={t.confirmCancel}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const { capped } = pending;
            setPending(null);
            commit(capped);
          }}
        />
      ) : null}
    </>
  );
}
