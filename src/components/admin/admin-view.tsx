import Link from "next/link";
import { cn } from "@/lib/cn";
import { IMPORT_FAILURE, type ImportFailureCode } from "@/lib/import/messages";
import type { AdminOverview, AdminOverviewError } from "@/server/admin/queries";
import { UsdRateForm } from "./usd-rate-form";
import { UserActions } from "./user-actions";

const section = "flex flex-col gap-4 border-b border-divider py-8";
const colLabel = "font-mono text-label font-medium tracking-[0.08em] text-neutral-700";
const head = "border-r border-b border-neutral-300 bg-neutral-100 px-3 py-2 text-left font-medium whitespace-nowrap";
const cell = "border-r border-b border-neutral-300 px-3 py-2 align-middle";
const mono = "font-mono tabular-nums";

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const when = (value: string | null) => (value ? dateTime.format(new Date(value)) : "—");
const n = (value: number) => value.toLocaleString("ko-KR");

function failureLabel(code: string) {
  return IMPORT_FAILURE[code as ImportFailureCode]?.title ?? code;
}

/** overview가 null이면 서버에 service role 키가 없어 전체 데이터를 읽을 수 없는 상태다. */
export function AdminView({
  overview,
  myId,
  usdRate,
}: {
  overview: AdminOverview | AdminOverviewError | null;
  myId: string;
  usdRate: number;
}) {
  return (
    <main className="mx-auto max-w-320 px-[clamp(16px,3vw,32px)] pt-6 pb-16">
      <div className="flex flex-col gap-1 border-b border-divider pb-4">
        <span className={cn(colLabel, "uppercase")}>Admin</span>
        <h1 className="text-title">관리자</h1>
      </div>

      {!overview ? (
        <p className="py-8 text-base text-pretty">
          서버에 <code>SUPABASE_SERVICE_ROLE_KEY</code>가 설정되지 않아 전체 통계를 읽을 수 없습니다. 배포 환경 변수에 추가한 뒤 다시
          배포해 주세요.
        </p>
      ) : "error" in overview ? (
        <div role="alert" className="flex flex-col gap-2 py-8 text-base text-pretty">
          <p className="font-semibold text-negative">관리자 데이터를 불러오지 못했습니다.</p>
          {overview.hint && <p>{overview.hint}</p>}
          <p className="font-mono text-sm break-all text-neutral-700">{overview.error}</p>
        </div>
      ) : (
        <>
          <Stats overview={overview} />
          <Failures overview={overview} />
          <Users overview={overview} myId={myId} />
        </>
      )}

      <section className={section} aria-labelledby="admin-settings">
        <h2 id="admin-settings" className="text-body font-semibold">
          달러 환율
        </h2>
        <UsdRateForm current={usdRate} />
      </section>

      <section className={section} aria-labelledby="admin-roast-texts">
        <h2 id="admin-roast-texts" className="text-body font-semibold">
          내 패션 훈수 문장
        </h2>
        <p className="text-sm text-neutral-700">패턴별 멘트, 질문과 반응, 패션 퀴즈 문장을 모두 보고 고칠 수 있습니다.</p>
        <Link href="/admin/roast-texts" className="w-fit text-base underline underline-offset-4">
          문장 고치러 가기
        </Link>
        <p className="text-sm text-neutral-700">옷장·주문내역 훈수의 점수 판정 기준을 코드의 현재 값 그대로 정리해 봅니다.</p>
        <Link href="/admin/score-criteria" className="w-fit text-base underline underline-offset-4">
          점수 판정 기준 보기
        </Link>
      </section>
    </main>
  );
}

function Stats({ overview: { stats } }: { overview: AdminOverview }) {
  const tiles = [
    { label: "가입자", value: stats.users_total, sub: `최근 7일 +${n(stats.users_7d)} · 정지 ${n(stats.users_banned)}` },
    { label: "등록된 옷", value: stats.garments_total, sub: `최근 7일 +${n(stats.garments_7d)}` },
    { label: "구매 판단 (24시간)", value: stats.fit_checks_24h, sub: `최근 7일 ${n(stats.fit_checks_7d)}` },
    {
      label: "AI 호출 (24시간)",
      value: stats.ai_calls_24h,
      sub: `최근 7일 ${n(stats.ai_calls_7d)} · 한도 도달 ${n(stats.ai_limited_7d)}`,
    },
    { label: "링크 분석 (7일)", value: stats.imports_7d, sub: `실패 ${n(stats.imports_failed_7d)}` },
  ];
  return (
    <section className={section} aria-labelledby="admin-stats">
      <h2 id="admin-stats" className="text-body font-semibold">
        통계
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-8 gap-y-6">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1">
            <span className={colLabel}>{t.label}</span>
            <span className="font-display text-display-lg tabular-nums">{n(t.value)}</span>
            <span className="text-sm text-neutral-700">{t.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Failures({ overview: { failures } }: { overview: AdminOverview }) {
  return (
    <section className={section} aria-labelledby="admin-failures">
      <h2 id="admin-failures" className="text-body font-semibold">
        링크 분석 실패 (최근 7일)
      </h2>
      {failures.length === 0 ? (
        <p className="text-base text-neutral-700">실패한 분석이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 border-collapse border-t border-l border-neutral-300 bg-surface text-sm">
            <thead>
              <tr>
                <th scope="col" className={head}>쇼핑몰</th>
                <th scope="col" className={head}>원인</th>
                <th scope="col" className={cn(head, "text-right")}>횟수</th>
                <th scope="col" className={head}>마지막</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={`${f.domain}:${f.errorCode}`}>
                  <td className={cell}>{f.domain}</td>
                  <td className={cell} title={f.errorCode}>{failureLabel(f.errorCode)}</td>
                  <td className={cn(cell, mono, "text-right")}>{n(f.failures)}</td>
                  <td className={cn(cell, mono, "text-neutral-700")}>{when(f.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Users({ overview, myId }: { overview: AdminOverview; myId: string }) {
  const { users, page, lastPage } = overview;
  return (
    <section className={section} aria-labelledby="admin-users">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="admin-users" className="text-body font-semibold">
          사용자
        </h2>
        <span className="text-sm text-neutral-700">
          정지하면 바로 로그아웃되고 다시 로그인할 수 없습니다. 삭제하면 옷·기록·사진이 모두 지워지고 되돌릴 수 없습니다. 테스터는 관리자처럼 분석 한도가 없습니다.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-240 border-collapse border-t border-l border-neutral-300 bg-surface text-sm">
          <thead>
            <tr>
              <th scope="col" className={head}>이메일</th>
              <th scope="col" className={head}>가입</th>
              <th scope="col" className={head}>마지막 로그인</th>
              <th scope="col" className={cn(head, "text-right")}>옷</th>
              <th scope="col" className={cn(head, "text-right")}>판단</th>
              <th scope="col" className={cn(head, "text-right")}>링크 분석</th>
              <th scope="col" className={head}>상태</th>
              <th scope="col" className={head}>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-user-email={u.email ?? undefined}>
                <td className={cn(cell, "max-w-72 truncate")} title={u.email ?? undefined}>
                  {u.email ?? "—"}
                </td>
                <td className={cn(cell, mono, "text-neutral-700")}>{when(u.createdAt)}</td>
                <td className={cn(cell, mono, "text-neutral-700")}>{when(u.lastSignInAt)}</td>
                <td className={cn(cell, mono, "text-right")}>{n(u.garments)}</td>
                <td className={cn(cell, mono, "text-right")}>{n(u.fitChecks)}</td>
                <td className={cn(cell, mono, "text-right")}>{n(u.imports)}</td>
                <td className={cell}>
                  {u.isAdmin ? "관리자" : u.banned ? <span className="text-negative">정지됨</span> : u.confirmed ? "정상" : "인증 전"}
                  {u.isTester && !u.isAdmin && <span className="ml-2 border border-border px-1.5 py-0.5 text-xs font-medium">테스터</span>}
                </td>
                <td className={cn(cell, "whitespace-nowrap")}>
                  {u.isAdmin || u.id === myId ? (
                    <span className="text-neutral-700">—</span>
                  ) : (
                    <UserActions userId={u.id} email={u.email ?? u.id} banned={u.banned} tester={u.isTester} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lastPage > 1 && (
        <nav aria-label="사용자 목록 페이지" className="flex items-center gap-4 text-sm">
          {page > 1 ? <Link href={`/admin?page=${page - 1}`}>이전</Link> : <span className="text-neutral-500">이전</span>}
          <span className={mono}>
            {page} / {lastPage}
          </span>
          {page < lastPage ? <Link href={`/admin?page=${page + 1}`}>다음</Link> : <span className="text-neutral-500">다음</span>}
        </nav>
      )}
    </section>
  );
}
