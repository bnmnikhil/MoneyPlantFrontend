import { Link } from "react-router-dom";
import { LegalLayout, type LegalSection } from "@/features/legal/LegalLayout";
import { legalDetails as d } from "@/features/legal/details";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        These terms are an agreement between you and {d.operatorName}, who operates GoldenBook. By
        signing in you accept them and the <Link to="/privacy">privacy policy</Link>. If you do
        not agree, do not use GoldenBook.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Who may use GoldenBook",
    body: (
      <p>
        You must be at least 18, and you may connect only broker accounts that are your own. Use
        your own Google account, and do not share your access with anyone else.
      </p>
    ),
  },
  {
    id: "service",
    title: "What GoldenBook is — and is not",
    body: (
      <>
        <p>
          GoldenBook is a <strong>read-only</strong> tool. It brings together positions, holdings
          and margins from the broker accounts you connect, and calculates payoff, margin and risk
          figures from them.
        </p>
        <ul>
          <li>
            <strong>It places no orders</strong>, and it cannot modify or cancel orders or move
            money.
          </li>
          <li>
            <strong>It is not investment advice.</strong> We are not a SEBI-registered investment
            adviser or research analyst. Nothing in GoldenBook is a recommendation to buy, sell or
            hold anything. The Strategy Builder's templates are educational examples of common
            option structures, not suggestions.
          </li>
          <li>Every decision you take, and its outcome, is yours.</li>
        </ul>
      </>
    ),
  },
  {
    id: "estimates",
    title: "Figures are estimates",
    body: (
      <>
        <p>
          Margin, payoff, profit-and-loss and risk figures are <strong>computed by GoldenBook</strong>,
          and they can differ from your broker's. In particular, the margin estimate is not the
          exchange's SPAN calculation, and a payoff chart for positions with different expiries is
          a simplified scenario. Data from brokers can be delayed, incomplete or wrong.
        </p>
        <p>
          <strong>Your broker is always the source of truth.</strong> Check your broker's figures
          before acting on any number shown here.
        </p>
      </>
    ),
  },
  {
    id: "brokers",
    title: "Your broker accounts and API apps",
    body: (
      <ul>
        <li>
          You register your own developer app at each broker. You are responsible for following
          that broker's API terms and paying any fees it charges.
        </li>
        <li>
          You authorise GoldenBook to use the credentials you enter for one purpose only: fetching
          your own data from that broker on your behalf.
        </li>
        <li>
          You can revoke this at any time: delete the credentials in Settings, and delete or
          regenerate the app at your broker.
        </li>
        <li>
          Your broker may limit or end API access independently of us. GoldenBook is not
          affiliated with or endorsed by Zerodha, Alice Blue or Paytm Money, whose names are
          trademarks of their owners.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <p>
        Do not try to reach another user's data, probe or overload the service, scrape it,
        reverse-engineer it, or use it for anything unlawful. We may suspend an account that does.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and price",
    body: (
      <p>
        {d.pricing} We will give notice before introducing any charge. GoldenBook is provided "as
        is" and "as available": it may be unavailable at times — including during market hours —
        and features may change or be withdrawn.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        To the extent the law allows, we are not liable for trading losses, for decisions made
        using GoldenBook, for errors or delays in data, or for brokers' outages. Our total liability
        to you is limited to the amount you have paid us in the preceding twelve months. Nothing
        in these terms limits any right you have that the law does not allow to be excluded.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending",
    body: (
      <p>
        You may stop using GoldenBook at any time and ask us to delete your data — see{" "}
        <Link to="/privacy#rights">your rights</Link>. We may end or suspend access if you breach
        these terms, or if we stop running the service, in which case we will give reasonable
        notice where we can.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of India. The courts at {d.operatorLocation} have
        jurisdiction over any dispute.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change these terms materially, you will be asked to accept the new version the next
        time you sign in. Questions: <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>.
      </p>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of use"
      summary={
        <>
          <strong className="text-foreground">In short:</strong> GoldenBook shows you your own
          broker data and calculates figures from it. It places no orders, it is not investment
          advice, its figures are estimates, and your broker is the source of truth.
        </>
      }
      sections={sections}
    />
  );
}
