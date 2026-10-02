import { resolveGroupIcon } from "@/data/groupIcons";

interface Props {
  iconId?: string | null;
  className?: string;
  size?: number;
}

export function GroupIcon({ iconId, className = "", size = 20 }: Props) {
  const definition = resolveGroupIcon(iconId);
  const IconComponent = definition.icon;

  return (
    <div className={`flex items-center justify-center shrink-0 ${className}`}>
      <IconComponent size={size} strokeWidth={2} />
    </div>
  );
}
