import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { PRIVACY_OFFICER, SERVICE_NAME, TERMS_EFFECTIVE_DATE } from "@/lib/legal";

export const metadata: Metadata = { title: `이용약관 · ${SERVICE_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effectiveDate={TERMS_EFFECTIVE_DATE}>
      <LegalSection title="1. 목적">
        <p>이 약관은 {SERVICE_NAME}(이하 &ldquo;서비스&rdquo;)를 이용하는 조건과 절차, 이용자와 운영자의 권리·의무를 정합니다.</p>
      </LegalSection>

      <LegalSection title="2. 서비스 내용">
        <p>
          서비스는 이용자가 가진 옷의 실측과 후기를 기록하고, 사려는 옷의 사이즈를 기록과 비교해 참고 정보를 보여 주는 무료 서비스입니다. 운영 사정에 따라 기능이
          바뀌거나 중단될 수 있으며, 중요한 변경은 미리 알립니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 가입과 계정">
        <LegalList
          items={[
            "만 14세 이상이면 이메일로 가입할 수 있습니다.",
            "계정과 비밀번호는 본인이 관리하며, 다른 사람에게 빌려주거나 넘길 수 없습니다.",
            "언제든지 계정 설정에서 탈퇴할 수 있고, 탈퇴하면 기록은 모두 삭제되어 되살릴 수 없습니다.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. 이용 한도">
        <p>
          무료 운영을 위해 계정마다 24시간 기준 링크 분석, 구매 판단, AI 요약 횟수와 저장할 수 있는 옷·사진 수에 한도가 있습니다. 현재 한도와 사용량은 각 화면에
          표시합니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 금지 행위">
        <LegalList
          items={[
            "다른 사람의 이메일로 가입하거나 다른 사람의 계정을 쓰는 행위",
            "자동화 도구로 대량 요청을 보내는 등 서비스 운영을 방해하는 행위",
            "불법 촬영물, 타인의 초상권·저작권을 침해하는 사진 등 법령에 어긋나는 내용을 올리는 행위",
            "서비스의 보안 취약점을 악용하거나 다른 이용자의 정보에 접근하려는 행위",
          ]}
        />
        <p>위 행위가 확인되면 이용을 제한하거나 계정을 정지·삭제할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="6. 판단 결과와 책임">
        <p>
          구매 판단, AI 요약, 내 치수로 계산한 예상 핏과 추천 실측은 이용자가 입력한 기록·신체치수와 쇼핑몰이 공개한 사이즈표를 바탕으로 한 참고 정보이며, 실제 착용감이나 구매 결과를 보장하지 않습니다. 구매
          결정과 그에 따른 거래는 이용자와 판매자 사이의 일이며, 운영자는 고의나 중대한 과실이 없는 한 이에 대해 책임지지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 게시물">
        <p>
          이용자가 올린 사진과 기록의 권리는 이용자에게 있으며, 운영자는 서비스를 보여 주는 데 필요한 범위에서만 저장·표시합니다. 링크 분석으로 가져온 상품 정보와
          사진은 이용자 본인의 기록용으로만 써야 합니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 개인정보">
        <p>개인정보 처리는 개인정보처리방침을 따릅니다.</p>
      </LegalSection>

      <LegalSection title="9. 약관 변경과 문의">
        <p>
          약관을 바꾸면 시행 7일 전부터 이 화면에 알립니다. 문의는 {PRIVACY_OFFICER.email}로 보내 주세요.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
