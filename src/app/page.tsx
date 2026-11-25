import Image from "next/image";
import { Suspense } from "react";
import { AccountDeletedNotice } from "./AccountDeletedNotice";
import { OnboardingActions, OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/GoogleIcon";

function WelcomeImage() {
  return (
    <Image
      src="/images/welcome.svg"
      alt="Friends meeting in a park, city behind"
      width={1200}
      height={800}
      priority
      unoptimized
      className="mt-5 h-[260px] w-full rounded-media object-cover lg:mt-0"
    />
  );
}

export default function WelcomePage() {
  return (
    <OnboardingShell>
      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>
      <WelcomeImage />
      <h1 className="mt-6 font-display text-[26px] leading-8 font-extrabold tracking-[-0.02em] md:text-[30px] md:leading-9 lg:mt-5 lg:text-[36px] lg:leading-[42px]">
        Find people.
        <br />
        Do things together.
      </h1>
      <p className="mt-3 text-[16px] leading-6 text-slate">
        Meet people nearby who share your interests, and turn plans into real meetups.
      </p>
      <OnboardingActions>
        <form action="/auth/google" method="post">
          <Button type="submit" leadingIcon={<GoogleIcon />}>
            Continue with Google
          </Button>
        </form>
        <p className="mt-4 text-center text-[13px] leading-[18px] text-slate">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </OnboardingActions>
    </OnboardingShell>
  );
}
