/**
 * DeleteConfirmDialog — 레시피 삭제 확인 다이얼로그 (Phase 4)
 *
 * SSOT: 06 §6.5, baseline §A.1·§B D3 (+ Button props 정정).
 *
 * 책임:
 * - TDS `ConfirmDialog` 합성. `leftButton`/`rightButton`은 ReactElement 필수(2개 children 강제).
 * - `ConfirmDialog.Button` = `DoubleButtonItem` = `ComponentProps<typeof Button>` —
 *   취소 `type="light" style="weak"`, 삭제 `type="danger" style="fill"`.
 *   (baseline §A.1 정정: `display="secondary"/"critical"`은 TDS Button 실 prop 아님.)
 * - presentational only — open/recipeName/onConfirm/onCancel/pending props만.
 *
 * 동작:
 * - dimmer 클릭 시 onCancel 호출 (pending 중에는 차단).
 * - 삭제 진행 중 buttons는 loading + disabled, dimmer click도 차단.
 * - onExited는 close 애니메이션 종료 시점 — 부모가 open=false를 유지하면 no-op.
 */

import React from 'react';
import { ConfirmDialog } from '@toss/tds-react-native';

export interface DeleteConfirmDialogProps {
  open: boolean;
  /** 다이얼로그 description에 노출 — 한국어 카피 안에 인용. */
  recipeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}

export function DeleteConfirmDialog({
  open,
  recipeName,
  onConfirm,
  onCancel,
  pending,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="이 레시피를 삭제할까요?"
      description={`"${recipeName}"을(를) 삭제하면 되돌릴 수 없어요.`}
      closeOnDimmerClick={!pending}
      onClose={onCancel}
      onExited={() => {
        /* close 애니메이션 종료 — 부모가 open=false 유지(no-op). */
      }}
      leftButton={
        <ConfirmDialog.Button
          type="light"
          style="weak"
          onPress={onCancel}
          disabled={pending}
        >
          취소
        </ConfirmDialog.Button>
      }
      rightButton={
        <ConfirmDialog.Button
          type="danger"
          style="fill"
          onPress={onConfirm}
          loading={pending}
          disabled={pending}
        >
          삭제
        </ConfirmDialog.Button>
      }
    />
  );
}
