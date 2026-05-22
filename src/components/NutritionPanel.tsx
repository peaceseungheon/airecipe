/**
 * NutritionPanel — 1인분 기준 영양 정보 표시 (presentational).
 * 입력: NutritionInfo (계약/도메인 타입). 데이터 페칭 책임 없음.
 */
import type { NutritionInfo } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NutritionPanelProps {
  nutrition: NutritionInfo;
  className?: string;
}

interface NutrientRow {
  label: string;
  value: number;
  unit: string;
}

export function NutritionPanel({ nutrition, className }: NutritionPanelProps) {
  const rows: NutrientRow[] = [
    { label: "탄수화물", value: nutrition.carbohydrates, unit: "g" },
    { label: "단백질", value: nutrition.protein, unit: "g" },
    { label: "지방", value: nutrition.fat, unit: "g" },
    { label: "식이섬유", value: nutrition.fiber, unit: "g" },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>영양 정보 (1인분 기준)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-orange-600">
            {nutrition.calories}
          </span>
          <span className="text-sm text-zinc-500">kcal</span>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
            >
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">
                {row.label}
              </dt>
              <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {row.value}
                <span className="ml-0.5 text-xs font-normal text-zinc-500">
                  {row.unit}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {nutrition.healthNote && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            {nutrition.healthNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
