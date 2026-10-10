import { Link } from "react-router-dom";
import { LegalLayout, type LegalSection } from "@/features/legal/LegalLayout";
import { legalDetails as d } from "@/features/legal/details";

// Keep this notice aligned with actual collection, access and retention practices.
// Operator details remain placeholders until the operator supplies and verifies them.
const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who handles your information",
    body: (
      <p>
        {d.operatorName} is responsible for the personal information described in this policy. For privacy questions, write to{" "}
        <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>.
      </p>
    ),
  },
  {
    id: "collect",
    title: "Information we receive",
    body: (
      <ul>
        <li>
          <strong>Google account details.</strong> Signing in gives us your Google account
          identifier, email address, name and profile picture. We store the identifier and email
          address. Your name and picture identify you in the signed-in interface.
        </li>
        <li>
          <strong>Broker registrations.</strong> We store the API key or app code, API secret,
          registration label and, where needed, client ID that you enter in Settings.
        </li>
        <li>
          <strong>Broker connections.</strong> Connecting an account gives us access tokens and
          account identifiers supplied by that broker. These let us retrieve data for the connected account.
        </li>
        <li>
          <strong>Portfolio and market data.</strong> We retrieve positions, holdings, balances,
          margins and available prices. We also store broker responses and portfolio snapshots
          used by the analysis features. Market prices may come from a separate quote source;
          they are distinct from your private account records.
        </li>
        <li>
          <strong>Service logs.</strong> Server logs contain technical information such as IP
          addresses, browser details, requested page paths, timestamps and application errors.
        </li>
      </ul>
    ),
  },
  {
    id: "why",
    title: "How we use it",
    body: (
      <>
        <p>We use this information to:</p>
        <ul>
          <li>identify your account and keep you signed in;</li>
          <li>connect to the broker accounts you authorise;</li>
          <li>display your portfolio and calculate payoff, margin and risk figures;</li>
          <li>retain portfolio snapshots for analysis;</li>
          <li>investigate faults, protect accounts and prevent misuse.</li>
        </ul>
        <p>
          We do not sell personal information, use your portfolio for advertising, or use it to
          train AI models. Other GoldenBook users cannot browse your portfolio. The operator may
          access stored information when needed to run the service or handle a support request.
        </p>
      </>
    ),
  },
  {
    id: "basis",
    title: "Your choices",
    body: (
      <>
        <p>
          You choose whether to sign in and which broker accounts to connect. Connecting a broker
          authorises us to retrieve its data for the purposes described in this policy. We need
          your Google account details to provide a signed-in account, and broker access to show
          that broker's portfolio.
        </p>
        <p>
          You can disconnect accounts and remove saved registrations in <Link to="/app/settings">Settings</Link>.
          Revoke access through the broker as well if you want its tokens invalidated. These actions
          do not delete data already stored by GoldenBook. To withdraw consent for continued use
          of your personal information or request account closure, contact us using the details below.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Services involved",
    body: (
      <>
        <ul>
          <li><strong>Google</strong> handles account sign-in.</li>
          <li>
            <strong>Your connected brokers</strong> handle authentication and portfolio requests.
            Supported integrations include Zerodha, Alice Blue, Paytm Money, Upstox and Dhan.
            We send the relevant credentials or tokens when their APIs require them.
          </li>
          <li>
            <strong>Oracle Cloud Infrastructure</strong> hosts the application and database in
            Hyderabad, India.
          </li>
          <li>
            <strong>Google Fonts</strong> supplies the website's fonts. Your browser contacts
            Google to download them, which shares your IP address and request details with Google.
          </li>
        </ul>
        <p>
          These providers also handle information under their own policies. We may disclose
          information when required by applicable law or a valid legal order.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Protecting your data",
    body: (
      <>
        <p>
          The public service uses HTTPS. Stored API secrets and broker access tokens are encrypted
          using AES-256-GCM, with the encryption key kept outside the database. API keys and client
          IDs are stored as identifiers; they are not encrypted in the same way as secrets.
        </p>
        <p>
          Saved API secrets are used for broker authentication and are not returned to the browser.
          Account data is scoped to the signed-in user. These measures reduce risk, but they cannot
          guarantee that a security incident will never occur.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and sessions",
    body: (
      <p>
        GoldenBook uses cookies to keep you signed in and protect requests against cross-site
        forgery. Your application session ends at midnight India time, even if you have been active.
        We do not use analytics, advertising or tracking cookies.
      </p>
    ),
  },
  {
    id: "retention",
    title: "Storage and deletion",
    body: (
      <>
        <ul>
          <li>
            <strong>Broker credentials</strong> stay saved until you remove the registration or
            they are deleted as part of account closure.
          </li>
          <li>
            <strong>Broker sessions</strong> are stored in encrypted form. Only sessions created
            on the current India calendar date are restored after a restart. This does not mean
            every stored token is erased at midnight.
          </li>
          <li>
            <strong>Portfolio history and original broker responses</strong> are stored for
            analysis. Automatic deletion after a fixed period is not currently implemented.
          </li>
          <li><strong>Server logs</strong> are retained for no more than 30 days.</li>
        </ul>
        <p>
          Account deletion is handled by contacting the operator. We do not currently offer an
          automatic account-deletion process or a guaranteed completion period. Routine backups
          outside the application server are not currently enabled; manual recovery copies may
          contain older data. When you request deletion, we will explain what will be removed,
          any information that must be retained, and how recovery copies will be handled.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Privacy requests",
    body: (
      <p>
        Contact <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a> from the email address
        you use to sign in to request a summary of your information, a correction, deletion or
        account closure, or to raise a privacy complaint. We may ask you to verify that the account
        is yours before acting. We aim to reply within 30 days. You retain any rights and routes
        for complaint available under applicable Indian data-protection law, including nomination
        rights where they apply.
      </p>
    ),
  },
  {
    id: "breach",
    title: "Security incidents",
    body: (
      <p>
        If we discover a breach affecting your personal information, we will contact you without
        undue delay with what we know, the likely impact and the steps being taken. If broker
        credentials are affected, we will explain how to revoke access or replace them. We will
        also notify the relevant authority where required by applicable law.
      </p>
    ),
  },
  {
    id: "age",
    title: "Age requirement",
    body: <p>GoldenBook is intended for adults aged 18 or older using their own broker accounts.</p>,
  },
  {
    id: "changes",
    title: "Policy updates",
    body: (
      <p>
        We will update this page when our data practices change, and revise the effective date
        and version shown above. Please check the current policy when deciding whether to continue
        using the service.
      </p>
    ),
  },
  {
    id: "grievance",
    title: "Contact for privacy concerns",
    body: (
      <p>
        Send privacy complaints and grievances to{" "}
        <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>. Describe the concern and the
        account involved, but do not include passwords, API secrets or access tokens in your email.
      </p>
    ),
  },
];

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy policy"
      summary={
        <>
          GoldenBook uses your Google identity and connected broker data to show your portfolio
          and calculate analysis. This policy explains what we store, who handles it, and how to
          request a correction or deletion.
        </>
      }
      sections={sections}
    />
  );
}
