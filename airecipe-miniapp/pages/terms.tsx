/**
 * Terms of Service — `/terms`. 서비스 이용약관 정적 페이지 (홈 푸터 진입).
 *
 * SSOT: 07-ROUTING §7.3.7(신규 — architect 확정 예정), 06-UI-MAPPING 정적 페이지 패턴.
 *
 * 책임:
 * - 정적 한국어 이용약관 본문(제1조~제10조 + 시행일)을 ScrollView로 렌더.
 * - 외부 호출 0건 — 표시 외 상태/로직 없음. 홈 푸터 링크가 유일한 진입점.
 *
 * 불변식:
 * - 공개 화면 — `useTossUserId` 미사용. api-client/fetch/hooks 호출 0건. 식별자 가드 없음
 *   (홈·generate와 동일한 공개 endpoint 정책, pages/AGENTS.md).
 * - TDS 의무 — `PageNavbar`/`Txt`/`colors`만 사용. hex 직접 사용 0건(ADR-015 D39).
 * - `<BottomTabBar active="none" />` 화면 최하단 마운트(ADR-017 D63 — 비-탭 화면).
 * - `href`/`useRouter`/`<Link>` 미사용 — 진입은 홈 푸터의 navigate('/terms', {}).
 *
 * 사업자 정보 확정(ADR-020 D74, 2026-06-03): 서비스 제공자 "디지털공방"(제2조 4호),
 * 관할 법원은 별도 합의 관할 없이 민사소송법 기준(제10조 2항).
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { createRoute } from '@granite-js/react-native';
import { PageNavbar, Txt, colors } from '@toss/tds-react-native';

import { BottomTabBar } from '../src/components/BottomTabBar';

export const Route = createRoute('/terms', {
  component: TermsPage,
});

/** 약관 1개 조항 = 소제목 + 본문 단락 배열. */
const ARTICLES: { title: string; body: string[] }[] = [
  {
    title: '제1조 (목적)',
    body: [
      '본 약관은 "AI 레시피"(이하 "서비스")가 앱인토스 미니앱을 통해 제공하는 AI 기반 요리 레시피 생성·추천 및 영양 정보 제공 서비스의 이용 조건과 절차, 이용자와 서비스 제공자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.',
    ],
  },
  {
    title: '제2조 (정의)',
    body: [
      '본 약관에서 사용하는 용어의 정의는 다음과 같습니다.',
      '1. "서비스"란 AI(인공지능)를 활용하여 요리명·인분 등 이용자의 입력에 따라 레시피·조리법·영양 정보를 생성·추천하고, 이용자가 레시피를 저장·관리할 수 있도록 제공하는 미니앱 서비스를 말합니다.',
      '2. "이용자"란 본 약관에 따라 서비스를 이용하는 자를 말합니다. 본 서비스는 별도의 회원가입·로그인 절차 없이 토스가 제공하는 익명 식별자를 기반으로 이용됩니다.',
      '3. "AI 생성 콘텐츠"란 서비스가 AI Provider(Google Gemini, Anthropic Claude 등)를 통해 생성·제공하는 레시피·조리법·영양 정보 등 일체의 결과물을 말합니다.',
      '4. "서비스 제공자"란 본 서비스를 운영하는 디지털공방을 말합니다.',
    ],
  },
  {
    title: '제3조 (약관의 효력 및 변경)',
    body: [
      '1. 본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.',
      '2. 서비스 제공자는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 화면에 게시한 시점부터 효력이 발생합니다.',
      '3. 이용자가 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단할 수 있습니다. 변경된 약관의 효력 발생 후에도 서비스를 계속 이용하는 경우 변경 사항에 동의한 것으로 봅니다.',
    ],
  },
  {
    title: '제4조 (서비스의 내용)',
    body: [
      '서비스는 다음 각 호의 기능을 제공합니다.',
      '1. 이용자가 입력한 요리명·인분에 따른 AI 레시피 생성 및 조리법·재료·영양 정보 제공',
      '2. 상황·날씨 등 테마 기반 요리 추천',
      '3. 생성된 레시피의 저장·목록 조회·즐겨찾기·삭제 관리',
      '서비스의 구체적인 기능과 범위는 서비스 제공자의 정책에 따라 추가·변경·중단될 수 있습니다.',
    ],
  },
  {
    title: '제5조 (서비스 이용)',
    body: [
      '1. 서비스 이용은 서비스 제공자가 정한 운영 정책 및 앱인토스 플랫폼의 정책에 따릅니다.',
      '2. 서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 하나, 시스템 점검·증설·교체·장애 또는 AI Provider·플랫폼 사정 등 부득이한 경우 일시 중단될 수 있습니다.',
      '3. 서비스 이용에 따른 데이터 통신 요금 등은 이용자가 부담합니다.',
    ],
  },
  {
    title: '제6조 (AI 생성 콘텐츠의 한계 및 면책)',
    body: [
      '1. 서비스가 제공하는 레시피·조리법·영양 정보 등 AI 생성 콘텐츠는 AI에 의해 자동 생성된 참고용 정보이며, 서비스 제공자는 그 정확성·완전성·안전성·적합성을 보장하지 않습니다.',
      '2. 영양 정보(열량·영양소 함량 등)는 추정치이며 실제 식자재·조리 방법·분량에 따라 달라질 수 있습니다. 의학적·영양학적 판단의 근거로 사용해서는 안 됩니다.',
      '3. 식품 알레르기, 식이 제한, 기저 질환 등 이용자 본인의 건강 상태에 따른 식자재·조리법의 적합성 확인 및 그에 따른 모든 책임은 이용자에게 있습니다. 우려가 있는 경우 반드시 전문가(의사·영양사 등)와 상담하시기 바랍니다.',
      '4. 이용자가 AI 생성 콘텐츠를 신뢰하여 행한 조리·섭취 등의 결과에 대하여 서비스 제공자는 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.',
    ],
  },
  {
    title: '제7조 (이용자의 의무)',
    body: [
      '이용자는 다음 각 호의 행위를 하여서는 안 됩니다.',
      '1. 서비스의 정상적인 운영을 방해하는 행위',
      '2. 타인의 권리나 명예, 신용 등을 침해하는 입력 또는 행위',
      '3. 관련 법령 또는 공공질서·미풍양속에 반하는 목적으로 서비스를 이용하는 행위',
      '4. 서비스를 비정상적인 방법으로 자동화·대량 호출하거나 역설계하는 행위',
    ],
  },
  {
    title: '제8조 (서비스 제공의 중지·변경)',
    body: [
      '1. 서비스 제공자는 운영상·기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중지할 수 있습니다.',
      '2. 무료로 제공되는 서비스의 변경·중지로 인하여 이용자에게 발생한 손해에 대하여 서비스 제공자는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.',
    ],
  },
  {
    title: '제9조 (책임의 제한)',
    body: [
      '1. 서비스 제공자는 천재지변, 불가항력, AI Provider 또는 플랫폼의 장애 등 서비스 제공자의 합리적 통제를 벗어난 사유로 인한 서비스 중단에 대하여 책임을 지지 않습니다.',
      '2. 본 서비스는 무료로 제공되며, 서비스 제공자는 관련 법령이 허용하는 최대 범위에서 서비스 이용으로 발생한 직접·간접·부수적 손해에 대한 책임을 지지 않습니다.',
    ],
  },
  {
    title: '제10조 (준거법 및 분쟁 해결)',
    body: [
      '1. 본 약관 및 서비스 이용에 관한 사항은 대한민국 법령을 준거법으로 합니다.',
      '2. 서비스 이용과 관련하여 분쟁이 발생한 경우, 당사자 간 협의를 통한 원만한 해결을 우선으로 하며, 협의가 이루어지지 않을 경우 「민사소송법」이 정한 관할 법원에 제기합니다.',
    ],
  },
];

function TermsPage() {
  return (
    <View style={styles.root}>
      <PageNavbar>
        <PageNavbar.Title>서비스 이용약관</PageNavbar.Title>
      </PageNavbar>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {ARTICLES.map((article) => (
          <View key={article.title} style={styles.article}>
            <Txt typography="t5" color={colors.grey900}>
              {article.title}
            </Txt>
            {article.body.map((paragraph, idx) => (
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
  article: {
    gap: 8,
  },
  paragraph: {
    lineHeight: 22,
  },
  effective: {
    marginTop: 8,
  },
});
