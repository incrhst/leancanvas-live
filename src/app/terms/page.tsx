import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { ContactLink, List, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service — CriticalDash by Incrementic",
  description: "The terms for using CriticalDash: accounts, your content, plans and trials, acceptable use, and liability.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="2 November 2026">
      <Section title="The agreement">
        <p>
          These terms are between you and Incrementic, which runs CriticalDash (criticaldash.com). By creating an account
          or using the app, you agree to them. If you use CriticalDash for a business, you agree on that business&apos;s
          behalf and confirm you have the authority to do so.
        </p>
      </Section>

      <Section title="Your account">
        <List>
          <li>You sign in with an email link or a Google account. Keep access to that email or account secure.</li>
          <li>You&apos;re responsible for what happens under your account, including through AI agents you connect to it.</li>
          <li>You must be at least 16.</li>
        </List>
      </Section>

      <Section title="Your content">
        <p>
          You own what you put into CriticalDash. You give us permission to store, copy and display it only as needed to
          run the service for you and the people you share it with. We don&apos;t claim any other rights to it.
        </p>
        <p>
          When you invite people to a canvas or share a link to it, they can see, and depending on their role change,
          what&apos;s on it. You decide who has access. Before adding someone&apos;s name and email, make sure you&apos;re
          allowed to contact them about your work.
        </p>
      </Section>

      <Section title="Plans and trials">
        <List>
          <li>Drawing a canvas is free.</li>
          <li>
            Running a canvas as a live plan (tests, check-ins, decisions, snapshots and the review) is a paid plan, priced
            per live plan. Your first live plan runs free for a 30-day trial.
          </li>
          <li>When a trial or paid period ends without renewal, the plan pauses. Your content stays and can still be read and exported.</li>
          <li>Answering a decision or a check-in you&apos;ve been asked for is always free.</li>
          <li>We&apos;ll show the price before you pay and give at least 30 days&apos; notice of any price change.</li>
        </List>
      </Section>

      <Section title="Acceptable use">
        <p>Don&apos;t use CriticalDash to:</p>
        <List>
          <li>break the law or infringe anyone&apos;s rights;</li>
          <li>send spam or emails people haven&apos;t agreed to receive;</li>
          <li>upload malware or try to get into accounts, canvases or systems you haven&apos;t been given access to;</li>
          <li>overload, scrape or reverse-engineer the service, beyond the agent connection we provide.</li>
        </List>
        <p>We may suspend accounts that do, and will tell you why unless the law or safety stops us.</p>
      </Section>

      <Section title="AI features">
        <p>
          Stress tests and connected agents use AI and can be wrong. Treat what they produce as input to your decisions,
          not as advice. The decisions are yours.
        </p>
      </Section>

      <Section title="The service">
        <p>
          We work to keep CriticalDash available and your data safe, but we provide it &ldquo;as is&rdquo;, without a
          guarantee that it will be uninterrupted or error-free. We may change or improve features. If we stop offering
          CriticalDash, we&apos;ll give at least 60 days&apos; notice so you can export your content.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the extent the law allows, Incrementic isn&apos;t liable for indirect or consequential losses, such as lost
          profits or business, arising from your use of CriticalDash. Our total liability to you is limited to what you
          paid us in the 12 months before the claim. Nothing in these terms limits liability that the law doesn&apos;t
          allow us to limit.
        </p>
      </Section>

      <Section title="Ending">
        <p>
          You can stop using CriticalDash and ask us to delete your account at any time. How we handle your data is set
          out in our{" "}
          <Link href="/privacy" className="font-semibold text-incrementic-red underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of Jamaica, and the courts of Jamaica hear any dispute about them.</p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If we change these terms, we&apos;ll update the date above and email account holders about significant changes
          before they take effect. Questions go to <ContactLink />.
        </p>
      </Section>
    </LegalPage>
  );
}
