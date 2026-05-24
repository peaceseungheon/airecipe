/**
 * EmptyState — 빈 목록 안내(마이 0건 등).
 *
 * SSOT: 06-UI-MAPPING §6.5(추가 컴포넌트), baseline §A.2·§B.3.
 *
 * 책임:
 * - 타이틀 + 설명 + 단일 액션 버튼(콜백).
 * - 다양한 빈 상태(마이 0건 / Phase 4 즐겨찾기 0건 등)에서 props로 재사용.
 *
 * 불변식:
 * - presentational only. 비즈니스 로직 0건.
 * - actionLabel/onAction은 항상 쌍으로 들어와야 한다(타입 강제).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Txt } from '@toss/tds-react-native';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityLabel={title}>
      <Txt typography="t3" color="#191F28" style={styles.title}>
        {title}
      </Txt>
      <Txt typography="st9" color="#4E5968" style={styles.description}>
        {description}
      </Txt>
      <View style={styles.action}>
        <Button
          type="primary"
          style="fill"
          display="block"
          size="medium"
          onPress={onAction}
        >
          {actionLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
});
