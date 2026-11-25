import { Suspense } from "react";
import { MobileHeader, PageContainer } from "@/components/app/AppShell";
import { BackLink } from "@/components/ui/BackLink";
import { loadBlocked, loadSettings } from "@/server/settings";
import { requireOnboarded } from "@/server/profile";
import { SettingsForm } from "./SettingsForm";

/** S22 Settings: every change saves immediately. */
export default function SettingsPage() {
  return (
    <>
      <MobileHeader title="Settings" back={{ href: "/profile", label: "Back to Profile" }} />
      <PageContainer>
        <div className="mx-auto w-full max-w-[760px]">
          <BackLink href="/profile" label="Back to Profile" />
          <h1 className="sr-only font-display text-[30px] leading-9 font-extrabold tracking-[-0.02em] md:not-sr-only md:mt-4 md:block lg:text-[40px] lg:leading-[48px]">
            Settings
          </h1>
          <Suspense fallback={<div aria-busy="true" className="mt-6 h-[640px] animate-pulse rounded-card bg-hover" />}>
            <Settings />
          </Suspense>
        </div>
      </PageContainer>
    </>
  );
}

async function Settings() {
  const { supabase, userId, profile } = await requireOnboarded();
  const [settings, blocked] = await Promise.all([loadSettings(supabase, userId), loadBlocked(supabase)]);
  return (
    <SettingsForm
      initial={settings}
      place={[profile.areaName, profile.city].filter(Boolean).join(", ")}
      blocked={blocked}
    />
  );
}
