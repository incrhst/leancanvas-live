import type { Metadata } from "next";
import LegalPage, { ContactLink, List, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy — CriticalDash by Incrementic",
  description: "What CriticalDash collects, why, who processes it, and how to see, export or delete your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="2 November 2026">
      <Section title="Who we are">
        <p>
          CriticalDash (criticaldash.com) is run by Incrementic. This policy covers the website and the app. We handle
          personal data in line with Jamaica&apos;s Data Protection Act, 2020. Questions and requests go to <ContactLink />.
        </p>
      </Section>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Your account.</strong> Your email address. If you sign in with Google, also the name and profile
            picture on your Google account. We never see your Google password.
          </li>
          <li>
            <strong>What you put in.</strong> Canvases, notes, goals, decisions, tests, evidence, check-ins, runbooks,
            snapshots, links and the history of changes to them.
          </li>
          <li>
            <strong>People you add.</strong> The names and email addresses of people you invite to a canvas or add as
            someone to ask for a decision or a check-in. They may not have an account.
          </li>
          <li>
            <strong>Live presence.</strong> While you have a canvas open, your name, email, picture and cursor position
            are shown to others on it. This record is cleared about 30 seconds after you leave.
          </li>
          <li>
            <strong>Agent connections.</strong> If you connect an AI agent, we keep the access tokens in hashed form and
            the time they expire.
          </li>
          <li>
            <strong>Security records.</strong> When someone enters a password for a protected share link, we keep a
            one-way hash of their IP address to limit guessing. We don&apos;t keep the IP address itself.
          </li>
          <li>
            <strong>Plan records.</strong> Whether your plans are on a trial, active or paused. We don&apos;t collect card
            details.
          </li>
        </List>
      </Section>

      <Section title="How we use it">
        <List>
          <li>To sign you in and run the app.</li>
          <li>
            To send the emails the app exists to send: sign-in links, invitations, decision requests, check-ins and
            notices about a canvas you belong to.
          </li>
          <li>To keep the service secure and stop abuse.</li>
        </List>
        <p>
          We don&apos;t sell personal data, show ads, or use advertising or analytics trackers. We don&apos;t use your
          content to train AI models.
        </p>
      </Section>

      <Section title="Who processes it for us">
        <List>
          <li><strong>Convex</strong>: database and backend, where your account and content are stored.</li>
          <li><strong>Vercel</strong>: hosts the website and app.</li>
          <li><strong>Resend</strong>: delivers our emails.</li>
          <li><strong>Google</strong>: sign-in, if you choose it. Fonts are also loaded from Google Fonts, which sees your IP address.</li>
          <li>
            <strong>OpenAI</strong>: only when someone on a canvas runs a stress test. The canvas&apos;s content is sent
            to OpenAI&apos;s API to produce the result.
          </li>
        </List>
        <p>These providers may store data outside Jamaica, including in the United States.</p>
      </Section>

      <Section title="Your browser">
        <p>
          The app keeps your sign-in session and a few display preferences, such as how your dashboard is sorted, in
          your browser&apos;s local storage. We don&apos;t set advertising cookies.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your account and content while your account exists. Sign-in links expire after 24 hours.
          Presence records are cleared within a minute. When you ask us to delete your account, we delete it and the
          canvases only you own within 30 days. Content you added to other people&apos;s canvases stays with those
          canvases unless you ask us to remove it.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <List>
          <li>See, correct or export your data. Canvases can be exported from the app; for anything else, email us.</li>
          <li>Delete your account: email <ContactLink /> from the address you sign in with.</li>
          <li>Stop emails from a canvas: use the link at the bottom of any email it sends.</li>
          <li>Cut off an AI agent: remove the connection in the agent, or email us and we&apos;ll revoke its access.</li>
        </List>
        <p>We answer requests within 30 days.</p>
      </Section>

      <Section title="Children">
        <p>CriticalDash is for businesses and isn&apos;t meant for anyone under 16.</p>
      </Section>

      <Section title="Changes">
        <p>
          If we change this policy, we&apos;ll update the date above. If the change is significant, we&apos;ll email
          account holders before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}
