/* FilterBar — search box, status chips, sort select, and refresh for the PR list. */
"use client";

import { useTranslations } from "next-intl";
import { Chip, Button, TextInput, SelectInput } from "@devdigest/ui";
import { SORT_NEWEST, SORT_OLDEST, STATUS_FILTERS } from "../../constants";
import { s } from "../../styles";

interface FilterBarProps {
  active: string;
  onActive: (status: string) => void;
  query: string;
  onQuery: (query: string) => void;
  sort: string;
  onSort: (sort: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function FilterBar({
  active,
  onActive,
  query,
  onQuery,
  sort,
  onSort,
  onRefresh,
  refreshing,
}: FilterBarProps) {
  const t = useTranslations("prReview");
  const sortOptions = [
    { value: SORT_NEWEST, label: t("list.sort.newest") },
    { value: SORT_OLDEST, label: t("list.sort.oldest") },
  ];
  return (
    <div style={s.filterBar}>
      <div style={s.filterChips}>
        <div style={s.filterSearch}>
          <TextInput value={query} onChange={onQuery} placeholder={t("list.filterPlaceholder")} />
        </div>
        {STATUS_FILTERS.map(({ key, labelKey }) => (
          <Chip key={key} active={active === key} onClick={() => onActive(key)}>
            {t(`list.filter.${labelKey}`)}
          </Chip>
        ))}
      </div>
      <div style={s.filterActions}>
        <SelectInput value={sort} onChange={onSort} options={sortOptions} mono={false} />
        <Button
          kind="secondary"
          size="sm"
          icon="RefreshCw"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? t("list.refreshing") : t("list.refresh")}
        </Button>
      </div>
    </div>
  );
}
