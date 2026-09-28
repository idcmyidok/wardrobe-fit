"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { UnitInput } from "@/components/ui/input";
import { useWardrobe } from "@/components/wardrobe/wardrobe-store";
import { BODY_FIELDS, BODY_LABELS, WEARABLE_LEVELS, fitLevelName, type BodyKey, type WearableLevel } from "@/lib/constants/body";
import { SUBCATEGORY_NAME } from "@/lib/constants/categories";
import { formatNum } from "@/lib/constants/measurements";
import { cn } from "@/lib/cn";
import {
  FIT_GROUPS,
  estimateBodyFromGarments,
  garmentRange,
  isLevelFreeKey,
  recKeys,
  recNeeds,
  type Band,
  type BodyProfile,
  type FitGroupId,
  type FitOverrides,
  type RecKey,
} from "@/lib/fit/body-fit";
import { formatDate } from "@/lib/format/date";
import { useBody } from "./body-store";
import { FIT_COLOR } from "./fit-meter";

const GROUPS = [
  { id: "basic", title: "기본" },
  { id: "upper", title: "상체" },
  { id: "lower", title: "하체" },
] as const;

const REC_LABEL: Record<RecKey, string> = { shoulder: "어깨", chest: "가슴", waist: "허리", hip: "엉덩이", thigh: "허벅지" };

type ValueDraft = Record<BodyKey, string>;

const toDraft = (p: BodyProfile | null): ValueDraft =>
  Object.fromEntries(BODY_FIELDS.map((f) => [f.key, p?.values[f.key] != null ? String(p.values[f.key]) : ""])) as ValueDraft;

/**
 * 내 치수: 신체치수 입력(모두 선택, 처음 저장할 때 별도 동의), "정확하지 않아요" 표시, 잘 맞는 옷으로 채우기,
 * 옷 종류·핏별 추천 실측 표(칸마다 고치고 되돌리기), 삭제(동의 철회).
 */
export function BodyView() {
  const { profile, calibration, save, saveOverrides, remove } = useBody();
  const { showToast } = useWardrobe();
  const [values, setValues] = useState<ValueDraft>(() => toDraft(profile));
  const [uncertain, setUncertain] = useState<BodyKey[]>(profile?.uncertain ?? []);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fillOpen, setFillOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onSave = async () => {
    if (saving) return;
    if (!profile && !consent) {
      setError("처음 저장할 때는 신체정보 수집·이용에 동의해 주세요.");
      document.getElementById("body-consent")?.focus();
      return;
    }
    const parsed: Partial<Record<BodyKey, number | null>> = {};
    for (const f of BODY_FIELDS) {
      const raw = values[f.key].trim();
      parsed[f.key] = raw === "" ? null : Number(raw);
      if (raw !== "" && isNaN(Number(raw))) {
        setFieldErrors({ [`values.${f.key}`]: `${f.label}은(는) 숫자로 입력해 주세요.` });
        return;
      }
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const r = await save({ values: parsed, uncertain, consent: profile ? undefined : consent });
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      setFieldErrors(r.fieldErrors ?? {});
      return;
    }
    showToast("내 치수를 저장했습니다");
  };

  const onDelete = async () => {
    setConfirmDelete(false);
    const r = await remove();
    if (!r.ok) {
      showToast(r.error);
      return;
    }
    setValues(toDraft(null));
    setUncertain([]);
    setConsent(false);
    showToast("내 치수와 동의 기록을 삭제했습니다");
  };

  return (
    <main className="mx-auto max-w-240 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-text pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title">내 치수</h1>
          <p className="text-base text-neutral-700">
            모두 선택 입력이에요. 입력해 두면 옷장의 예상 핏과 구매 판단이 내 몸에 맞게 더 정확해져요.
          </p>
        </div>
        <span className="font-mono text-sm text-neutral-700 tabular-nums" data-testid="body-updated">
          {profile?.updatedAt ? `마지막 수정 ${formatDate(profile.updatedAt.slice(0, 10))}` : "아직 저장하지 않음"}
        </span>
      </div>

      {!profile && <ConsentCard checked={consent} onChange={setConsent} />}

      <section className="flex flex-col gap-6 border-b border-text py-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">신체치수</h2>
          <button type="button" className="btn btn-secondary text-sm" onClick={() => setFillOpen((v) => !v)} aria-expanded={fillOpen}>
            잘 맞는 옷으로 채우기
          </button>
        </div>
        {fillOpen && (
          <FillFromGarments
            onApply={(est, overwrite) => {
              setValues((v) => {
                const next = { ...v };
                for (const [k, n] of Object.entries(est) as [BodyKey, number][]) if (overwrite || next[k] === "") next[k] = String(n);
                return next;
              });
              setFillOpen(false);
              showToast("옷 실측으로 추정한 값을 채웠습니다. 저장을 눌러야 반영됩니다");
            }}
          />
        )}
        {GROUPS.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-3">
            <legend className="mb-2 font-mono text-sm font-medium tracking-[0.08em] text-neutral-700">{group.title}</legend>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-x-5 gap-y-4">
              {BODY_FIELDS.filter((f) => f.group === group.id).map((f) => {
                const err = fieldErrors[`values.${f.key}`];
                const unsure = uncertain.includes(f.key);
                return (
                  <div key={f.key} className="field">
                    <label htmlFor={`b-${f.key}`}>{f.label}</label>
                    <UnitInput
                      id={`b-${f.key}`}
                      unit={f.unit}
                      inputMode="decimal"
                      className="text-body"
                      value={values[f.key]}
                      aria-invalid={Boolean(err)}
                      aria-describedby={`bh-${f.key}`}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                    <span id={`bh-${f.key}`} className="text-xs text-neutral-700">
                      {err ?? f.hint}
                    </span>
                    {f.key !== "weight" && (
                      <label className={cn("mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs", unsure ? "text-accent-800" : "text-neutral-700")}>
                        <input
                          type="checkbox"
                          checked={unsure}
                          onChange={() => setUncertain((u) => (unsure ? u.filter((k) => k !== f.key) : [...u, f.key]))}
                        />
                        정확하지 않아요
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p className="text-xs text-neutral-700">
          &ldquo;정확하지 않아요&rdquo;를 켠 치수는 느슨하게 적용하고, 그 치수로 낸 예상 핏은 신뢰도를 낮춰 보여 줍니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary min-h-11" disabled={saving} onClick={onSave}>
            {saving ? "저장 중…" : "저장"}
          </button>
          {error && (
            <span role="alert" className="text-sm text-accent-800">
              {error}
            </span>
          )}
        </div>
      </section>

      {profile && <Recommendations profile={profile} calibration={calibration} onSave={saveOverrides} />}

      {profile && (
        <section className="flex flex-col gap-3 py-7">
          <h2 className="text-lg">내 치수 삭제</h2>
          <p className="text-base text-neutral-800">
            입력한 신체치수, 고친 추천 치수, 동의 기록을 모두 지웁니다(동의 철회). 옷장과 다른 기록은 그대로 남습니다.
          </p>
          {confirmDelete ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                삭제
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary w-fit" onClick={() => setConfirmDelete(true)}>
              내 치수 삭제
            </button>
          )}
        </section>
      )}
    </main>
  );
}

/** 신체정보 수집·이용 동의(선택). 개인정보 보호법 제15조 2항의 네 가지를 알린다. */
function ConsentCard({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const rows: [string, string][] = [
    ["목적", "내 몸에 맞는 옷 사이즈 추천, 옷장·구매 판단의 예상 핏 계산"],
    ["항목", "키, 몸무게, 어깨너비, 가슴·허리·엉덩이·허벅지 둘레, 팔·다리 길이 중 입력한 값"],
    ["보유 기간", "직접 삭제하거나 회원 탈퇴할 때까지"],
    ["거부할 권리", "동의하지 않아도 되며, 그 경우 내 치수 기반 추천만 쓸 수 없고 다른 기능은 그대로 이용할 수 있습니다."],
  ];
  return (
    <section className="mt-6 flex flex-col gap-3 border border-text p-4" aria-labelledby="consent-title">
      <h2 id="consent-title" className="text-base font-semibold">
        신체정보 수집·이용 동의 (선택)
      </h2>
      <dl className="grid grid-cols-[88px_1fr] text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-b border-neutral-300 py-1.5 text-neutral-700">{k}</dt>
            <dd className="border-b border-neutral-300 py-1.5">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-neutral-700">
        신체치수는 본인만 볼 수 있게 저장하며, AI·관리 화면·구매 판단 기록에는 보내거나 남기지 않습니다. 자세한 내용은{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
        에 있습니다.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-2 text-base">
        <input id="body-consent" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        위 내용을 확인했고 신체정보 수집·이용에 동의합니다
      </label>
    </section>
  );
}

/** 잘 맞는 옷 몇 벌을 골라 내 치수를 거꾸로 추정한다. */
function FillFromGarments({ onApply }: { onApply: (est: Partial<Record<BodyKey, number>>, overwrite: boolean) => void }) {
  const { garments } = useWardrobe();
  const clothes = garments.filter(
    (g) => (g.categoryId === "outer" || g.categoryId === "top" || g.categoryId === "bottom") && Object.values(g.measurements).some((v) => v != null),
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const est = useMemo(() => estimateBodyFromGarments(clothes.filter((g) => picked.includes(g.id))), [clothes, picked]);
  const keys = Object.keys(est) as BodyKey[];

  return (
    <div className="flex flex-col gap-3 border border-neutral-300 bg-surface p-4">
      <p className="text-sm text-neutral-800">
        잘 맞는 옷을 몇 벌 고르면 실측에서 몸 치수를 거꾸로 추정해요. 옷에 &ldquo;내 핏&rdquo;을 표기해 두었다면 그 핏 기준으로, 아니면 레귤러핏으로 보고
        계산합니다.
      </p>
      {clothes.length === 0 ? (
        <p className="text-sm text-neutral-700">실측이 입력된 옷이 없어요.</p>
      ) : (
        <ul className="flex max-h-64 flex-col overflow-y-auto border-t border-neutral-300">
          {clothes.map((g) => (
            <li key={g.id} className="border-b border-neutral-300">
              <label className="flex cursor-pointer items-center gap-2 py-2 text-sm">
                <input type="checkbox" checked={picked.includes(g.id)} onChange={() => setPicked((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))} />
                <span className="font-semibold">{g.brand || "—"}</span>
                <span className="min-w-0 truncate">{g.productName}</span>
                <span className="ml-auto flex-none text-xs text-neutral-700">
                  {[g.subcategoryId ? SUBCATEGORY_NAME[g.subcategoryId] : null, g.sizeLabel].filter(Boolean).join(" · ")}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {keys.length > 0 && (
        <p className="font-mono text-sm tabular-nums">
          {keys.map((k) => `${BODY_LABELS[k]} ${formatNum(est[k]!)}`).join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={!keys.length} onClick={() => onApply(est, overwrite)}>
          {overwrite ? "모두 채우기" : "빈 칸만 채우기"}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-neutral-800">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          이미 입력한 칸도 덮어쓰기
        </label>
      </div>
    </div>
  );
}

const fmtBand = (b: Band) => (b[0] === b[1] ? formatNum(b[0]) : `${formatNum(b[0])}–${formatNum(b[1])}`);

/** 옷 종류·핏별 추천 실측 표. 칸을 고치면 그 값이 예상 핏 계산에도 쓰인다. */
function Recommendations({
  profile,
  calibration,
  onSave,
}: {
  profile: BodyProfile;
  calibration: ReturnType<typeof useBody>["calibration"];
  onSave: (o: FitOverrides) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const { showToast } = useWardrobe();
  const [groupId, setGroupId] = useState<FitGroupId>("short_tee");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, [string, string]>>({});
  const [busy, setBusy] = useState(false);
  const group = FIT_GROUPS.find((g) => g.id === groupId)!;
  const keys = recKeys(groupId);
  const overrides = profile.overrides;
  const noOverrides: BodyProfile = { ...profile, overrides: {} };
  // 허리처럼 핏 단계와 관계없는 열은 모든 단계가 한 칸을 같이 쓴다.
  const cellKey = (level: WearableLevel, key: RecKey) => (isLevelFreeKey(key) ? `common.${key}` : `${level}.${key}`);
  const current = (level: WearableLevel, key: RecKey) => garmentRange(groupId, level, key, profile, calibration);
  const suggested = (level: WearableLevel, key: RecKey) => garmentRange(groupId, level, key, noOverrides, calibration);
  const isEdited = (level: WearableLevel, key: RecKey) =>
    isLevelFreeKey(key) ? WEARABLE_LEVELS.some((l) => overrides[groupId]?.[l]?.[key]) : Boolean(overrides[groupId]?.[level]?.[key]);
  const groupEdited = Boolean(overrides[groupId] && Object.values(overrides[groupId]!).some((l) => l && Object.keys(l).length));
  const anyEdited = Object.values(overrides).some((g) => g && Object.values(g).some((l) => l && Object.keys(l).length));

  const commit = async (next: FitOverrides, message: string) => {
    setBusy(true);
    const r = await onSave(next);
    setBusy(false);
    showToast(r.ok ? message : r.error);
    return r.ok;
  };

  const without = (fn: (o: FitOverrides) => void): FitOverrides => {
    const next: FitOverrides = JSON.parse(JSON.stringify(overrides));
    fn(next);
    return next;
  };

  const resetCell = (level: WearableLevel, key: RecKey) =>
    commit(
      without((o) => {
        for (const l of isLevelFreeKey(key) ? WEARABLE_LEVELS : [level]) delete o[groupId]?.[l]?.[key];
      }),
      "추천값으로 되돌렸습니다",
    );

  const startEdit = () => {
    const d: Record<string, [string, string]> = {};
    for (const level of WEARABLE_LEVELS)
      for (const key of keys) {
        const b = current(level, key);
        d[cellKey(level, key)] = b ? [String(b[0]), String(b[1])] : ["", ""];
      }
    setDraft(d);
    setEditing(true);
  };

  const saveEdit = async () => {
    const next = without((o) => {
      for (const level of WEARABLE_LEVELS)
        for (const key of keys) {
          // 한 칸을 같이 쓰는 열은 레귤러 자리에만 저장하고 다른 단계의 예전 값은 지운다.
          if (isLevelFreeKey(key) && level !== "regular") {
            delete o[groupId]?.[level]?.[key];
            continue;
          }
          const [a, b] = draft[cellKey(level, key)] ?? ["", ""];
          const lo = Number(a);
          const hi = Number(b);
          const sug = suggested(level, key);
          const levelMap = ((o[groupId] ??= {})[level] ??= {});
          if (a === "" || b === "" || isNaN(lo) || isNaN(hi) || lo <= 0 || hi <= 0) {
            delete levelMap[key];
            continue;
          }
          const band: Band = [Math.min(lo, hi), Math.max(lo, hi)];
          // 추천값과 같으면 고친 것으로 남기지 않는다.
          if (sug && Math.abs(sug[0] - band[0]) < 0.05 && Math.abs(sug[1] - band[1]) < 0.05) delete levelMap[key];
          else levelMap[key] = band;
        }
    });
    if (await commit(next, "추천 치수를 저장했습니다")) setEditing(false);
  };

  return (
    <section className="flex flex-col gap-4 border-b border-text py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">옷 종류별 추천 실측</h2>
        <span className="text-sm text-neutral-700">cm · 가슴·허리·엉덩이·허벅지는 단면 · 여유분 규칙으로 계산한 참고값</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="옷 종류">
        {FIT_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === groupId}
            disabled={editing}
            onClick={() => setGroupId(g.id)}
            className={cn("btn min-h-9 px-3 py-1.5 text-sm", g.id === groupId ? "btn-primary" : "btn-secondary")}
          >
            {g.name}
            {overrides[g.id] && Object.values(overrides[g.id]!).some((l) => l && Object.keys(l).length) && <span aria-label="수정됨"> ·</span>}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        {/* 열 너비를 고정해 어느 옷 종류를 눌러도 칸이 같은 자리에 선다(하의는 오른쪽에 한 열이 더 붙는다). */}
        <table className="table w-auto table-fixed font-mono tabular-nums" data-testid="rec-table">
          <colgroup>
            <col className="w-28" />
            {keys.map((k) => (
              <col key={k} className="w-48" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>핏</th>
              {keys.map((k) => (
                <th key={k} className="text-right">
                  {REC_LABEL[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEARABLE_LEVELS.map((level, row) => (
              <tr key={level}>
                <td className="font-sans font-semibold whitespace-nowrap" style={{ color: FIT_COLOR[level] }}>
                  {fitLevelName(level, group.kind)}
                </td>
                {keys.map((key) => {
                  const shared = isLevelFreeKey(key);
                  if (shared && row > 0) return null;
                  const span = shared ? { rowSpan: WEARABLE_LEVELS.length } : {};
                  const cellName = shared ? `${REC_LABEL[key]}(모든 핏 공통)` : `${fitLevelName(level, group.kind)} ${REC_LABEL[key]}`;
                  const b = current(level, key);
                  const edited = isEdited(level, key);
                  if (editing) {
                    const [a, z] = draft[cellKey(level, key)] ?? ["", ""];
                    const set = (i: 0 | 1, v: string) => setDraft((d) => ({ ...d, [cellKey(level, key)]: i === 0 ? [v, z] : [a, v] }));
                    return (
                      <td key={key} {...span} className={cn("text-right", shared && "align-middle")}>
                        <span className="inline-flex items-center gap-1">
                          <input className="input w-15 px-1.5 py-1 text-right text-sm" inputMode="decimal" aria-label={`${cellName} 최소`} value={a} onChange={(e) => set(0, e.target.value)} />
                          –
                          <input className="input w-15 px-1.5 py-1 text-right text-sm" inputMode="decimal" aria-label={`${cellName} 최대`} value={z} onChange={(e) => set(1, e.target.value)} />
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={key} {...span} className={cn("text-right whitespace-nowrap", shared && "align-middle")}>
                      {b ? (
                        <>
                          <span className={edited ? "font-semibold text-accent-800" : undefined}>{fmtBand(b)}</span>
                          {edited && (
                            <button
                              type="button"
                              className="ml-1.5 cursor-pointer font-sans text-2xs text-neutral-700 underline underline-offset-2 hover:text-accent-700"
                              disabled={busy}
                              title="추천값으로 되돌리기"
                              onClick={() => resetCell(level, key)}
                            >
                              직접 수정 · 되돌리기
                            </button>
                          )}
                          {shared && <span className="block font-sans text-2xs text-neutral-600">모든 핏 공통 · 적정 범위</span>}
                        </>
                      ) : (
                        <span className="font-sans text-xs text-neutral-500" title={`${recNeeds(groupId, key).map((k) => BODY_LABELS[k]).join("·")} 입력 필요`}>
                          {recNeeds(groupId, key).map((k) => BODY_LABELS[k]).join("·")} 필요
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={saveEdit}>
              {busy ? "저장 중…" : "수정 저장"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              취소
            </button>
            <span className="text-xs text-neutral-700">칸을 비우면 추천값으로 돌아갑니다.</span>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={startEdit}>
              이 옷 종류 수정
            </button>
            {groupEdited && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  commit(
                    without((o) => {
                      delete o[groupId];
                    }),
                    `${group.name} 추천값으로 되돌렸습니다`,
                  )
                }
              >
                이 옷 종류 되돌리기
              </button>
            )}
            {anyEdited && (
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => commit({}, "모든 추천 치수를 되돌렸습니다")}>
                전체 되돌리기
              </button>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-neutral-700">
        고친 값은 이 옷 종류의 예상 핏 판정에도 그대로 쓰입니다. 옷에 &ldquo;내 핏&rdquo;을 표기하면 같은 종류의 기준이 내 취향 쪽으로 조금씩(최대 4cm) 옮겨집니다.
      </p>
    </section>
  );
}
