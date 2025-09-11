export interface MultiSelectItem {
  id: number;
  label: string;
  sublabel?: string | null;
  disabled?: boolean;
}

export type MultiSelectGetter = () => Promise<MultiSelectItem[]>;
export type MultiSelectCommitter = (ids: number[]) => Promise<void>;

export interface MultiSelectConfig {
  title: string;
  getItems: MultiSelectGetter;
  commit: MultiSelectCommitter;
  /** Optional CTA label for the commit action (default: "Add Selected") */
  ctaLabel?: string;
}
