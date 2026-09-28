import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_HISTORY, PRIVACY_OFFICER, SERVICE_NAME } from "@/lib/legal";

export const metadata: Metadata = { title: `개인정보처리방침 · ${SERVICE_NAME}` };

/**
 * 개인정보 보호법 제30조 개인정보처리방침. 실제 처리와 달라지면(항목·위탁·AI 전송 범위 등) 이 문서와 시행일을 함께 고친다.
 * - AI 전송 범위: src/server/ai/gemini.ts(privacy "minimal"), src/server/import/ai-size-chart.ts
 * - 관리자 열람 범위: src/server/admin/queries.ts
 * - 신체치수(선택 동의): supabase/migrations/20260928000014_body_profiles.sql, 동의 문구 src/components/body/body-view.tsx
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" effectiveDate={PRIVACY_EFFECTIVE_DATE}>
      <p>
        {SERVICE_NAME}(이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 원활하게 처리하기 위해 다음과 같이
        개인정보처리방침을 둡니다.
      </p>

      <LegalSection title="1. 처리 목적">
        <LegalList
          items={[
            "회원 가입과 로그인, 본인 확인(이메일 인증), 비밀번호 재설정",
            "옷장 기록(옷 정보·실측·사진·후기) 저장과 보여 주기, 옷장 분석",
            "상품 링크 분석과 구매 사이즈 판단 제공",
            "내 치수(선택)를 입력한 경우 내 몸에 맞는 옷 사이즈 추천과 예상 핏 계산",
            "사용 한도 관리, 부정 이용 방지, 장애 대응과 서비스 개선을 위한 통계",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. 처리하는 개인정보 항목">
        <LegalList
          items={[
            <>
              <strong>가입 시(필수)</strong>: 이메일, 비밀번호. 비밀번호는 복원할 수 없는 방식으로 암호화해 저장하며 운영자도 볼 수 없습니다.
            </>,
            <>
              <strong>이용 중 직접 입력(선택)</strong>: 옷의 분류·브랜드·제품명·사이즈·컬러·시즌·구매 날짜·구매가·상품 링크·실측 치수·핏 후기, 옷 사진, 구매 판단에
              넣은 상품 정보와 판단 결과, 링크 분석 기록
            </>,
            <>
              <strong>별도 동의 시(선택)</strong>: 신체치수(키, 몸무게, 어깨너비, 가슴·허리·엉덩이·허벅지 둘레 중 입력한 값), &ldquo;정확하지
              않아요&rdquo; 표시, 직접 고친 추천 치수, 동의 일시와 동의한 문구 버전, 옷마다 표기한 &ldquo;내 핏&rdquo;
            </>,
            <>
              <strong>자동 생성</strong>: 가입·최근 로그인 일시, 서비스 이용 기록(분석·판단 횟수), 접속 IP와 브라우저 정보(호스팅 서버 로그), 쿠키
            </>,
          ]}
        />
        <p>
          신체치수는 가입 동의와 별도로 &ldquo;내 치수&rdquo; 화면에서 선택 동의를 받은 경우에만 저장하며, 동의하지 않아도 다른 기능은 그대로 이용할 수 있습니다.
          신체치수는 옷 사이즈 계산에만 쓰고 건강 상태 판단 등 다른 목적으로 쓰지 않습니다. 사진을 올릴 때 촬영 위치 등 사진 속 부가 정보(EXIF)는 지우고 저장합니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 보유 기간과 파기">
        <p>
          개인정보는 회원 탈퇴 때까지 보유하고, 탈퇴하면 계정과 옷장 기록·사진·판단 기록을 지체 없이 파기합니다. 탈퇴는 로그인 후 사용자 메뉴의
          &ldquo;계정 설정&rdquo;에서 직접 할 수 있습니다. 운영 시스템의 백업에 남은 사본은 백업 보관 기간이 지나면 함께 삭제됩니다.
        </p>
        <p>
          신체치수는 &ldquo;내 치수&rdquo; 화면의 &ldquo;내 치수 삭제&rdquo;로 언제든 지울 수 있으며(동의 철회), 지우면 동의 기록과 함께 지체 없이 파기합니다.
        </p>
        <p>전자적 파일은 복구할 수 없는 방법으로 삭제합니다.</p>
      </LegalSection>

      <LegalSection title="4. 제3자 제공">
        <p>이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 특별한 규정이 있는 경우에만 예외로 합니다.</p>
      </LegalSection>

      <LegalSection title="5. 처리 위탁과 국외 이전">
        <p>서비스 운영을 위해 아래 업체의 클라우드를 사용하며, 개인정보는 해당 업체의 해외 서버에 네트워크로 전송되어 저장·처리됩니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 border-collapse text-sm">
            <thead>
              <tr className="border-b border-text text-left">
                <th className="py-2 pr-3 font-medium">받는 자(국가)</th>
                <th className="py-2 pr-3 font-medium">이전 항목</th>
                <th className="py-2 font-medium">목적</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-neutral-300">
                <td className="py-2 pr-3">Supabase, Inc.(미국 등 해외 리전)</td>
                <td className="py-2 pr-3">2장의 모든 항목</td>
                <td className="py-2">데이터베이스, 로그인, 사진 저장</td>
              </tr>
              <tr className="border-b border-neutral-300">
                <td className="py-2 pr-3">Vercel Inc.(미국)</td>
                <td className="py-2 pr-3">접속 IP, 브라우저 정보, 요청 기록</td>
                <td className="py-2">웹사이트 호스팅</td>
              </tr>
              <tr className="border-b border-neutral-300">
                <td className="py-2 pr-3">Google LLC(미국)</td>
                <td className="py-2 pr-3">
                  구매 판단 시 사이즈별 실측 숫자와 계산 결과, 링크 분석 시 공개된 상품 페이지의 사이즈 관련 문구
                </td>
                <td className="py-2">AI 요약(Gemini API)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          이전 시기와 방법: 서비스를 이용할 때마다 암호화된 네트워크(HTTPS)로 전송합니다. 보유 기간: 회원 탈퇴 또는 위탁 계약 종료 시까지. AI 요약에는 이메일 등 계정
          정보와 옷 이름·후기 원문, 신체치수를 보내지 않습니다. 국외 이전을 원하지 않으면 가입하지 않거나 탈퇴할 수 있으며, 이 경우 서비스를 이용할 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 운영자의 열람 범위">
        <p>
          운영자는 서비스 운영에 필요한 범위에서만 개인정보를 확인합니다. 관리 화면에서는 이메일, 가입·최근 로그인 일시, 이메일 인증 여부, 계정별 기록 개수, 전체 통계만
          보여 주며, 옷 사진·실측·후기 내용과 신체치수는 보여 주지 않습니다. 부정 이용 대응, 장애 처리, 이용자의 요청이 있을 때에만 필요한 범위의 기록을 확인하며, 관리자 작업은
          기록으로 남깁니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다. 옷장 기록은 화면에서 직접 고치거나 지울 수 있고, 계정 삭제는 &ldquo;계정
          설정&rdquo;의 회원 탈퇴로 할 수 있습니다. 그 밖의 요청은 아래 개인정보 보호책임자에게 이메일로 보내 주시면 지체 없이 처리합니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 안전성 확보 조치">
        <LegalList
          items={[
            "모든 통신을 HTTPS로 암호화하고, 비밀번호는 단방향 암호화로 저장",
            "데이터베이스 행 단위 접근 제어로 본인 기록만 읽고 쓸 수 있게 제한",
            "신체치수는 본인만 읽을 수 있는 별도 테이블에 두고, 예상 핏은 화면에서 계산해 판단 기록·관리 화면·AI에 남기거나 보내지 않음",
            "관리자 권한을 최소 인원에게만 부여하고 관리자 작업 기록 보관",
            "서비스 키 등 비밀 값은 서버에만 두고 브라우저로 보내지 않음",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. 쿠키">
        <p>
          로그인 상태 유지, 로그인 유지 선택, 마지막으로 쓴 이메일 기억, 화면 모드(밝게·어둡게)를 위해 쿠키와 브라우저 저장소를 씁니다. 광고·추적 쿠키는 쓰지 않습니다.
          브라우저 설정에서 쿠키를 막을 수 있지만, 그러면 로그인할 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 만 14세 미만 아동">
        <p>
          서비스는 만 14세 이상만 가입할 수 있으며, 가입할 때 만 14세 이상인지 본인 확인을 받습니다. 만 14세 미만 아동이 가입한 사실을 알게 되면 해당 계정과
          기록을 지체 없이 삭제합니다.
        </p>
      </LegalSection>

      <LegalSection title="11. 개인정보 보호책임자">
        <LegalList items={[`책임자: ${PRIVACY_OFFICER.name}`, `이메일: ${PRIVACY_OFFICER.email}`]} />
      </LegalSection>

      <LegalSection title="12. 권익 침해 구제">
        <p>개인정보 침해에 대한 신고나 상담이 필요하면 아래 기관에 문의할 수 있습니다.</p>
        <LegalList
          items={[
            "개인정보침해신고센터: (국번 없이) 118, privacy.kisa.or.kr",
            "개인정보분쟁조정위원회: 1833-6972, www.kopico.go.kr",
            "대검찰청: (국번 없이) 1301, www.spo.go.kr",
            "경찰청: (국번 없이) 182, ecrm.police.go.kr",
          ]}
        />
      </LegalSection>

      <LegalSection title="13. 방침의 변경">
        <p>이 방침은 {PRIVACY_EFFECTIVE_DATE}부터 적용합니다. 내용이 바뀌면 시행 7일 전부터 이 화면에 알립니다.</p>
        {PRIVACY_HISTORY.length > 0 && <LegalList items={PRIVACY_HISTORY.map((d) => `이전 방침: ${d}`)} />}
      </LegalSection>
    </LegalPage>
  );
}
