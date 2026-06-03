/**
 * Privacy Policy — `/privacy`. 개인정보처리방침 정적 페이지 (홈 푸터 진입).
 *
 * SSOT: 07-ROUTING §7.3.8(신규 — architect 확정 예정), 06-UI-MAPPING 정적 페이지 패턴.
 *
 * 책임:
 * - 정적 한국어 개인정보처리방침 본문(수집 항목~방침 변경 + 시행일)을 ScrollView로 렌더.
 * - 외부 호출 0건 — 표시 외 상태/로직 없음. 홈 푸터 링크가 유일한 진입점.
 *
 * 불변식:
 * - 공개 화면 — `useTossUserId` 미사용. api-client/fetch/hooks 호출 0건. 식별자 가드 없음
 *   (홈·generate와 동일한 공개 endpoint 정책, pages/AGENTS.md).
 * - TDS 의무 — `PageNavbar`/`Txt`/`colors`만 사용. hex 직접 사용 0건(ADR-015 D39).
 * - `<BottomTabBar active="none" />` 화면 최하단 마운트(ADR-017 D63 — 비-탭 화면).
 * - `href`/`useRouter`/`<Link>` 미사용 — 진입은 홈 푸터의 navigate('/privacy', {}).
 *
 * 사업자 정보 확정(ADR-020 D74, 2026-06-03): 개인정보처리자 "디지털공방",
 * 보호책임자 "이승헌", 문의 이메일 tmdgis19@gmail.com (제7절).
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute } from '@granite-js/react-native';
import { PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../src/components/BottomTabBar';

export const Route = createRoute('/privacy', {
  component: PrivacyPage,
});

/** 처리방침 1개 절 = 소제목 + 본문 단락 배열. */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. 수집하는 개인정보 항목',
    body: [
      '"AI 레시피"(이하 "서비스")는 회원가입·로그인 절차 없이 운영되며, 이름·연락처·주소 등 이용자를 직접 식별할 수 있는 신원 정보를 수집하지 않습니다. 서비스는 다음 정보만을 처리합니다.',
      '1. 토스가 제공하는 익명 식별자: 저장한 레시피를 이용자 단위로 구분하기 위한 비식별 식별값(개인을 직접 특정하지 않음)',
      '2. 이용자가 입력한 콘텐츠: 요리명, 인분, 상황·날씨 등 추천 테마, 저장한 레시피 데이터',
      '3. 서비스 이용 과정에서 자동 생성·수집될 수 있는 정보: 오류 진단을 위한 비식별 로그(개인정보 보호를 위해 직접 식별 정보는 포함하지 않음)',
    ],
  },
  {
    title: '2. 개인정보의 수집·이용 목적',
    body: [
      '서비스는 수집한 정보를 다음 목적으로만 이용합니다.',
      '1. AI 레시피 생성·추천 및 영양 정보 제공',
      '2. 이용자가 저장한 레시피의 보관·목록 조회·즐겨찾기·삭제 등 관리 기능 제공',
      '3. 서비스 운영·품질 개선 및 오류 진단',
    ],
  },
  {
    title: '3. 개인정보의 보유 및 이용 기간',
    body: [
      '1. 이용자가 저장한 레시피 등 입력 정보는 이용자가 삭제하거나 서비스 이용을 중단할 때까지 보관합니다.',
      '2. 관련 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관하며, 그 외의 경우 목적 달성 후 지체 없이 파기합니다.',
    ],
  },
  {
    title: '4. 개인정보의 제3자 제공',
    body: [
      '서비스는 이용자의 정보를 외부에 판매·대여하지 않습니다. 다만 AI 레시피·추천 기능 제공을 위하여 이용자가 입력한 내용(요리명·인분·테마 등)은 AI 처리를 위해 다음의 AI Provider로 전송되어 처리됩니다.',
      '1. Google LLC (Gemini AI) — 레시피·영양 정보 생성·추천 처리',
      '2. Anthropic PBC (Claude AI) — 레시피·영양 정보 생성·추천 처리(대체·롤백 시)',
      '전송되는 내용에는 이용자를 직접 식별하는 신원 정보가 포함되지 않으며, 각 AI Provider의 데이터 처리 정책이 적용됩니다.',
    ],
  },
  {
    title: '5. 개인정보 처리의 위탁',
    body: [
      '서비스는 원활한 서비스 제공을 위하여 데이터 저장·호스팅 등 일부 업무를 외부 사업자에게 위탁할 수 있습니다. 위탁 시 관련 법령에 따라 개인정보가 안전하게 처리되도록 필요한 사항을 규정하고 관리·감독합니다.',
    ],
  },
  {
    title: '6. 이용자의 권리 및 행사 방법',
    body: [
      '1. 이용자는 서비스 내에서 저장한 레시피를 직접 조회·삭제할 수 있습니다.',
      '2. 본 서비스는 이용자를 직접 식별하는 신원 정보를 수집하지 않으므로, 추가적인 열람·정정·삭제 요청이 필요한 경우 아래 문의 채널을 통해 요청할 수 있습니다.',
    ],
  },
  {
    title: '7. 개인정보 보호책임자 및 문의',
    body: [
      '서비스는 개인정보 처리에 관한 업무를 총괄하고 이용자의 문의를 처리하기 위해 개인정보 보호책임자를 두고 있습니다.',
      '- 서비스 제공자(개인정보처리자): 디지털공방',
      '- 개인정보 보호책임자: 이승헌',
      '- 문의: tmdgis19@gmail.com',
    ],
  },
  {
    title: '8. 개인정보 처리방침의 변경',
    body: [
      '본 개인정보처리방침은 법령·서비스 정책의 변경에 따라 개정될 수 있으며, 변경 시 서비스 화면을 통해 공지합니다. 변경된 방침은 게시한 시점부터 적용됩니다.',
    ],
  },
];

function PrivacyPage() {
  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>개인정보처리방침</PageNavbar.Title>
      </PageNavbar>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Txt typography="t5" color={colors.grey900}>
              {section.title}
            </Txt>
            {section.body.map((paragraph, idx) => (
              <Txt
                key={idx}
                typography="st9"
                color={colors.grey700}
                style={styles.paragraph}
              >
                {paragraph}
              </Txt>
            ))}
          </View>
        ))}

        <Txt typography="st11" color={colors.grey500} style={styles.effective}>
          시행일: 2026년 6월 1일
        </Txt>
      </ScrollView>

      <BottomTabBar active="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 24,
  },
  section: {
    gap: 8,
  },
  paragraph: {
    lineHeight: 22,
  },
  effective: {
    marginTop: 8,
  },
});
