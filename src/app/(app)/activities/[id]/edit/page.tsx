import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { loadManage } from "@/server/activities";
import { loadInterests, photoUrl, requireOnboarded } from "@/server/profile";
import { StepOne } from "../../new/StepOne";

/** ST-114: Edit details — the S12 form with only title and details editable. */
export default function EditActivityPage({ params }: PageProps<"/activities/[id]/edit">) {
  return (
    <Suspense fallback={<PageContainer><div aria-busy="true" className="h-[480px] animate-pulse rounded-card bg-hover" /></PageContainer>}>
      <EditActivity params={params} />
    </Suspense>
  );
}

async function EditActivity({ params }: Pick<PageProps<"/activities/[id]/edit">, "params">) {
  const { id } = await params;
  const { supabase, profile } = await requireOnboarded();
  const catalogue = await loadInterests(supabase);
  const a = await loadManage(supabase, id, catalogue);
  if (!a || a.phase !== "open") notFound();
  return (
    <>
      <MobileHeader title="Edit details" back={{ href: `/activities/${id}/manage`, label: "Back to your activity" }} />
      <PageContainer>
        <StepOne
          catalogue={catalogue}
          mine={profile.interestIds}
          host={{ id: profile.id, firstName: profile.firstName ?? "", photoUrl: photoUrl(profile.photoPath) }}
          edit={{ id: a.id, interestId: a.interest.id, title: a.title, details: a.description ?? "" }}
        />
      </PageContainer>
    </>
  );
}
