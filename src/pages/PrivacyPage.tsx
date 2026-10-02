import { Link } from "react-router-dom";
import { LegalLayout, type LegalSection } from "@/features/legal/LegalLayout";
import { legalDetails as d } from "@/features/legal/details";

/*
 * Every statement here is a claim about the running system. When the code
 * changes what is collected, where it goes or how long it stays, this page
 * changes in the same PR, and `termsVersion` is bumped.
 */
const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        GoldenBook is operated by <strong>{d.operatorName}</strong>, {d.operatorLocation} ("we",
        "us"). For the personal data described here we are the Data Fiduciary under India's
        Digital Personal Data Protection Act, 2023. Contact us at{" "}
        <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <strong>From Google, when you sign in:</strong> your Google account identifier, email
          address, name and profile picture. We store the identifier and email address; the name
          and picture are only used to show who is signed in.
        </li>
        <li>
          <strong>Broker credentials you enter:</strong> the API key or app code and API secret of
          the developer app you registered at each broker, and the label you give it.
        </li>
        <li>
          <strong>Broker sessions:</strong> the access tokens your broker issues when you connect,
          and the client code of the account you connected.
        </li>
        <li>
          <strong>Your portfolio, as your broker reports it:</strong> positions, holdings, margins
          and funds, including the broker's original response, plus market prices fetched over your
          own connection.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, pages requested and
          timestamps, in our server logs.
        </li>
      </ul>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <>
        <ul>
          <li>to sign you in and keep your session;</li>
          <li>to connect to the broker accounts you authorise, and only those;</li>
          <li>to show you your positions, holdings, margins, payoff charts and risk figures;</li>
          <li>to keep a history of your own portfolio for the risk features;</li>
          <li>to keep the service secure, prevent abuse and fix faults.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data, show you advertising, share your portfolio
          with other users, or use it to build profiles or train AI models. GoldenBook cannot place
          orders or move money.
        </p>
      </>
    ),
  },
  {
    id: "basis",
    title: "Consent",
    body: (
      <p>
        We process your data on the basis of the consent you give when you first sign in and
        accept these documents. You can withdraw it at any time: delete your broker credentials in{" "}
        <Link to="/app/settings">Settings</Link>, or email us to close your account. Withdrawing
        consent stops further processing; it does not affect processing that already happened.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who else handles your data",
    body: (
      <ul>
        <li>
          <strong>Google</strong>, to sign you in.
        </li>
        <li>
          <strong>Your brokers</strong> (Zerodha, Alice Blue and Paytm Money; only the ones you
          connect). We send them your credentials and tokens to fetch your own data.
        </li>
        <li>
          <strong>Oracle Cloud Infrastructure</strong>, which hosts GoldenBook and its encrypted
          backups in its Hyderabad, India region.
        </li>
        <li>
          <strong>Cloudflare</strong> provides our DNS only; your traffic does not pass through it.
        </li>
        <li>
          <strong>Google Fonts</strong>: your browser downloads the typeface from Google, which
          therefore sees your IP address.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <p>
        All traffic uses HTTPS. API secrets and broker access tokens are encrypted with
        AES-256-GCM, under a key kept outside the database. Your API secret is used only to
        complete a login you start, and is never sent back to any browser — not even to you.
        Backups are encrypted before they leave the server. Only the operator can reach the
        servers. No system is perfectly secure, and we will tell you if we learn your data was
        exposed (see "If something goes wrong").
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We set two cookies, both necessary: a session cookie that keeps you signed in and ends at
        midnight India time, and a security token that protects your requests against cross-site
        forgery. There are no analytics, advertising or tracking cookies.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Broker sessions: until the end of the trading day. They are never reused the next day.</li>
        <li>Broker credentials: until you delete them in Settings or close your account.</li>
        <li>Portfolio history: while your account is open.</li>
        <li>Server logs: no more than 30 days.</li>
        <li>
          Backups: 30 days. After you close your account, your data is removed from the live
          database within 7 days and has left every backup 30 days after that.
        </li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <p>
        You may ask for a summary of the personal data we hold about you, have it corrected or
        erased, nominate someone to exercise these rights if you die or are incapacitated, and
        have a grievance answered. Email <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>{" "}
        from the address you sign in with. We reply within 30 days. If you are not satisfied with
        our answer, you may complain to the Data Protection Board of India.
      </p>
    ),
  },
  {
    id: "breach",
    title: "If something goes wrong",
    body: (
      <p>
        If a breach affects your personal data, we will tell you without undue delay what
        happened, what it means for you and what we are doing about it, and we will report it to
        the Data Protection Board of India as the law requires. If broker credentials may have
        been exposed, we will also tell you to regenerate the API secret at your broker.
      </p>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>GoldenBook is for people aged 18 or over who hold their own broker accounts.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        The effective date and version above change whenever this policy does. If a change is
        material, you will be asked to accept the new version the next time you sign in.
      </p>
    ),
  },
  {
    id: "grievance",
    title: "Grievance officer",
    body: (
      <p>
        {d.grievanceOfficer}, {d.operatorLocation} —{" "}
        <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>.
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
          <strong className="text-foreground">In short:</strong> we keep what is needed to show you
          your own portfolio — your Google identity, the broker credentials you enter (secrets
          encrypted), and what your brokers report. Nobody else sees it, nothing is sold, and you
          can have it deleted.
        </>
      }
      sections={sections}
    />
  );
}
