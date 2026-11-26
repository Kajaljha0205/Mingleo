import Image from "next/image";
import { Suspense } from "react";
import { AccountDeletedNotice } from "./AccountDeletedNotice";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { WelcomeBrandPanel } from "@/components/welcome/WelcomeBrandPanel";
import styles from "@/components/welcome/welcome.module.css";

function WelcomeImage() {
  return (
    <Image
      src="/images/welcome.svg"
      alt="Friends meeting in a park, city behind"
      width={1200}
      height={800}
      priority
      unoptimized
      className={`${styles.welcomeIllustration} h-[260px] w-full rounded-media object-cover`}
    />
  );
}

export default function WelcomePage() {
  return (
    <div className={styles.shell}>
      <WelcomeBrandPanel />

      <main className={styles.cardPanel}>
        <div data-testid="onboarding-card" className={styles.cardBox}>
          <div className={styles.mobilePilot}>
            <span aria-hidden="true" className={styles.mobilePilotDot} />
            Piloting in Bengaluru
          </div>
          <Suspense fallback={null}>
            <AccountDeletedNotice />
          </Suspense>
          <WelcomeImage />
          <h2 className="font-display text-[26px] leading-[1.12] font-extrabold tracking-[-0.02em] text-charcoal md:text-[34px] md:leading-[1.1]">
            Find people.
            <br />
            Do things together.
          </h2>
          <p className={`${styles.cardSubline} mt-3 text-[16px] leading-6 text-slate`}>
            Meet people nearby who share your interests, and turn plans into real meetups.
          </p>
          <div className="mt-5 md:mt-6">
            <form action="/auth/google" method="post">
              <Button type="submit" leadingIcon={<GoogleIcon />}>
                Continue with Google
              </Button>
            </form>
            <p className="mt-4 text-center text-[13px] leading-[18px] text-slate">
              By continuing you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
