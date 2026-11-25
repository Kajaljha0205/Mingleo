import type { ReactNode } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { ActivityCover } from "@/components/cards/ActivityCard";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { spotsLeftLabel } from "@/lib/activity";

type Props = {
  interest: { slug: string; name: string } | null;
  title: string;
  host: { id: string; firstName: string; photoUrl: string | null };
  /** Step 2 fills these in; step 1 shows "… in step 2". */
  when?: string | null;
  where?: string | null;
  limit?: number;
};

/** Live preview card for S12/S13 (and edit mode). */
export function ActivityPreview({ interest, title, host, when, where, limit }: Props) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-white" data-testid="preview">
      {interest ? (
        <ActivityCover
          slug={interest.slug}
          interestName={interest.name}
          className="h-[150px] lg:h-[190px]"
          sizes="(min-width: 1024px) 420px, 100vw"
        />
      ) : (
        <div className="flex h-[150px] items-center justify-center bg-hover text-[15px] text-slate lg:h-[190px]">
          Pick an interest to see the cover
        </div>
      )}
      <div className="flex flex-col gap-2.5 p-4 lg:p-5">
        <p className={`truncate font-display text-[19px] leading-[26px] font-bold ${title.trim() ? "" : "text-slate"}`}>
          {title.trim() || "Your activity title"}
        </p>
        <div className="flex items-center gap-2.5 text-[15px] text-slate">
          <Avatar id={host.id} name={host.firstName} photoUrl={host.photoUrl} size={30} />
          <span className="flex-1">Hosted by you</span>
          {limit !== undefined && <span className="font-bold text-charcoal">1/{limit}</span>}
        </div>
        <PreviewRow icon={<CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />} muted={!when}>
          {when ?? "Date and time in step 2"}
        </PreviewRow>
        <PreviewRow icon={<MapPin size={18} strokeWidth={1.8} aria-hidden="true" />} muted={!where}>
          <span className="min-w-0 flex-1 truncate">{where ?? "Location in step 2"}</span>
          {limit !== undefined && <StatusPill variant="spots">{spotsLeftLabel(limit - 1)}</StatusPill>}
        </PreviewRow>
      </div>
    </div>
  );
}

function PreviewRow({ icon, muted, children }: { icon: ReactNode; muted: boolean; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2.5 text-[15px] ${muted ? "text-slate/80" : "text-charcoal"}`}>
      <span className="shrink-0 text-slate">{icon}</span>
      {children}
    </div>
  );
}
