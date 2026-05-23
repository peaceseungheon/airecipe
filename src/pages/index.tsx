import { createRoute } from '@granite-js/react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatTossUserIdMask, useTossUserId } from '../hooks/useTossUserId';
import {
  ApiClientError,
  deleteRecipe,
  generateRecipe,
  getRecipe,
  listRecipes,
  saveRecipe,
  toggleFavorite,
} from '../services';

export const Route = createRoute('/', {
  component: Page,
});

const isDev = import.meta.env.APP_ENV !== 'production';

function Page() {
  return (
    <Container>
      <Text style={styles.title}>AI 레시피</Text>
      <Text style={styles.subtitle}>
        준비 중인 미니앱입니다. Phase 2부터 화면이 추가됩니다.
      </Text>
      {isDev ? <Phase1DevTrigger /> : null}
    </Container>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>{children}</View>
    </ScrollView>
  );
}

/**
 * Phase 1 — AC1.5 dev-only 임시 호출 트리거.
 *
 * baseline §F 매핑:
 * - AC1.1: tossUserId truthy 여부를 화면·console에 마스킹 형식으로 표시.
 * - AC1.5: 6 엔드포인트 모두 호출 가능. 응답/에러는 console에만 dump.
 *
 * 평문 hash 노출 금지(09 §9.5, 05 §5.10). 헤더 값은 api-client 내부에서만 헤더에 부착되며,
 * 본 트리거는 화면·로그 양쪽에서 마스킹된 형태만 출력한다.
 *
 * Phase 2 진입 시 본 컴포넌트는 제거된다 (production에서는 `isDev` 가드로 어차피 미실행).
 */
function Phase1DevTrigger() {
  const { tossUserId, refresh } = useTossUserId();
  const auth = tossUserId ? { tossUserId, refreshTossUserId: refresh } : null;
  const [log, setLog] = useState<string[]>([]);

  const append = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-9), line]);
    console.log(`[phase1-dev] ${line}`);
  }, []);

  const run = useCallback(
    (label: string, fn: () => Promise<unknown>) => async () => {
      append(`→ ${label}`);
      try {
        const out = await fn();
        append(`  ok ${label}: ${describeResult(out)}`);
      } catch (e) {
        append(`  err ${label}: ${describeError(e)}`);
      }
    },
    [append],
  );

  const requireAuth = (label: string, fn: () => Promise<unknown>) => async () => {
    if (!auth) {
      append(`skip ${label}: tossUserId 미발급 (대기 중)`);
      return;
    }
    await run(label, fn)();
  };

  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Phase 1 dev 트리거 (production 빌드에서는 제거됨)</Text>
      <Text style={styles.devLine}>APP_ENV: {import.meta.env.APP_ENV}</Text>
      <Text style={styles.devLine}>tossUserId: {formatTossUserIdMask(tossUserId)}</Text>

      <View style={styles.buttonRow}>
        <DevButton
          label="generate (공개)"
          onPress={run('generate', () =>
            generateRecipe(
              { dishName: '김치찌개', servings: 2 },
              auth ? { tossUserId: auth.tossUserId } : {},
            ),
          )}
        />
        <DevButton
          label="list"
          onPress={requireAuth('list', () =>
            listRecipes({ page: 1, pageSize: 10 }, auth!),
          )}
        />
        <DevButton
          label="get(dummy)"
          onPress={requireAuth('get', () => getRecipe('dummy-id', auth!))}
        />
        <DevButton
          label="save(stub)"
          onPress={requireAuth('save', () =>
            saveRecipe({ recipe: STUB_GENERATED_RECIPE }, auth!),
          )}
        />
        <DevButton
          label="favorite(dummy)"
          onPress={requireAuth('favorite', () =>
            toggleFavorite('dummy-id', { isFavorite: true }, auth!),
          )}
        />
        <DevButton
          label="delete(dummy)"
          onPress={requireAuth('delete', () => deleteRecipe('dummy-id', auth!))}
        />
      </View>

      <View style={styles.logBox}>
        {log.length === 0 ? (
          <Text style={styles.logEmpty}>(아직 호출 없음)</Text>
        ) : (
          log.map((line, i) => (
            <Text key={i} style={styles.logLine}>
              {line}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

function DevButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function describeResult(out: unknown): string {
  if (out === undefined || out === null) return '(empty)';
  if (Array.isArray(out)) return `array(len=${out.length})`;
  if (typeof out === 'object') {
    const keys = Object.keys(out as object);
    return `object{${keys.slice(0, 4).join(',')}${keys.length > 4 ? ',…' : ''}}`;
  }
  return typeof out;
}

function describeError(e: unknown): string {
  if (e instanceof ApiClientError) {
    return `${e.error.code} — ${e.error.message}`;
  }
  if (e instanceof Error) {
    return `unknown — ${e.message}`;
  }
  return 'unknown — non-error throw';
}

/**
 * save 호출용 임시 GeneratedRecipe — 03 §3.2.3 shape에 맞춘 최소 스텁.
 * 실제 사용자 데이터가 아니므로 PII 우려 없음.
 */
const STUB_GENERATED_RECIPE = {
  dishName: '김치찌개',
  description: '돼지고기를 넣은 기본 김치찌개.',
  servings: 2,
  cookTimeMinutes: 25,
  difficulty: 'easy' as const,
  ingredients: [
    { name: '김치', quantity: 300, unit: 'g' },
    { name: '돼지고기', quantity: 200, unit: 'g' },
  ],
  steps: [
    { order: 1, instruction: '김치를 한입 크기로 자른다.' },
    { order: 2, instruction: '냄비에 김치와 돼지고기를 넣고 볶는다.' },
  ],
  tips: ['신김치일수록 깊은 맛이 난다.'],
  nutrition: {
    calories: 320,
    carbohydrates: 10,
    protein: 22,
    fat: 18,
    fiber: 3,
    healthNote: '나트륨이 높으니 국물은 적게 드세요.',
  },
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1 },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 24,
  },
  dev: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#F7FAFC',
  },
  devTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 4,
  },
  devLine: {
    fontSize: 12,
    color: '#4A5568',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#0064FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logBox: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#1A202C',
    borderRadius: 6,
    minHeight: 80,
  },
  logEmpty: {
    color: '#A0AEC0',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
  logLine: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: 'Menlo',
  },
});
