import { Link } from "react-router-dom";
import { LegalLayout, type LegalSection } from "@/features/legal/LegalLayout";
import { legalDetails as d } from "@/features/legal/details";

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Using GoldenBook",
    body: (
      <p>
        GoldenBook is operated by {d.operatorName}. These terms explain the conditions for using
        the service. By signing in, you agree to these terms. Our <Link to="/privacy">privacy
        policy</Link> explains how we handle your information. If you do not agree, please do
        not use the service.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "Your account",
    body: (
      <p>
        You must be 18 or older and use your own Google account. Connect only broker accounts
        that belong to you. Keep your sign-in details, broker credentials and access tokens
        private, and do not let anyone else use your GoldenBook account.
      </p>
    ),
  },
  {
    id: "service",
    title: "What the service does",
    body: (
      <>
        <p>
          GoldenBook brings positions, holdings and account balances from your connected brokers
          into one place. It also calculates payoff scenarios, margin estimates and risk figures.
          The Strategy Builder lets you explore hypothetical changes to a portfolio.
        </p>
        <p>
          <strong>GoldenBook is read-only.</strong> It does not submit, change or cancel orders,
          and it does not transfer money. Changes you make in the Strategy Builder stay hypothetical.
        </p>
        <p>
          <strong>GoldenBook does not provide investment advice.</strong> We are not a
          SEBI-registered investment adviser or research analyst. Charts, calculations and strategy
          templates are information for your own analysis, not recommendations to buy, sell or hold
          an investment. You are responsible for your trading decisions and their outcomes.
        </p>
      </>
    ),
  },
  {
    id: "estimates",
    title: "Understanding the figures",
    body: (
      <>
        <p>
          Some figures come from your broker; others are calculated by GoldenBook. Broker data
          may arrive late, be incomplete or contain errors. Stored portfolio snapshots can also
          be older than your current positions. A missing quote is not a price of zero.
        </p>
        <p>
          Our margin estimate is not an exchange or broker margin quotation. Payoff charts rely
          on assumptions about prices and expiry. When legs expire on different dates, the chart
          shows a simplified common-price scenario; its displayed maximum loss is not a guaranteed
          limit on losses across those dates. Trading costs and actual execution can also change
          your result.
        </p>
        <p>
          <strong>Check your broker before acting.</strong> Use your broker's records to confirm
          positions, available funds, margin requirements and transaction details. GoldenBook's
          calculations do not replace those records or guarantee a trading outcome.
        </p>
      </>
    ),
  },
  {
    id: "brokers",
    title: "Connecting a broker",
    body: (
      <>
        <ul>
          <li>
            Register your own API app where the broker requires one. You are responsible for
            complying with the broker's terms and paying its API or market-data charges.
          </li>
          <li>
            By connecting an account, you authorise GoldenBook to use the credentials and tokens
            you provide to retrieve that account's data for the features described here.
          </li>
          <li>
            To stop access, disconnect the account and remove its saved registration in Settings.
            For revocation at the broker itself, use the broker's controls to revoke access or
            regenerate credentials. Disconnecting does not erase previously stored portfolio data;
            see the <Link to="/privacy#rights">privacy policy</Link> for deletion requests.
          </li>
          <li>
            Available features depend on your broker and subscription. Some brokers do not supply
            every price or balance, and API access can change or stop without our control.
          </li>
        </ul>
        <p>
          GoldenBook is independent of Zerodha, Alice Blue, Paytm Money, Upstox and Dhan. These
          brokers do not endorse the service. Their names and trademarks belong to their owners.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Responsible use",
    body: (
      <p>
        Use GoldenBook lawfully. Do not attempt to access another person's account or data,
        bypass security controls, overload the service, scrape it or reverse-engineer it. We may
        suspend access if you misuse the service or put other users at risk.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and charges",
    body: (
      <p>
        {d.pricing} We will give notice before introducing a charge. The service is provided
        "as is" and "as available". We cannot promise uninterrupted access, including during
        market hours. Features may change or be withdrawn, and broker outages may prevent us
        from retrieving your data.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limits on liability",
    body: (
      <p>
        To the extent permitted by law, we are not liable for trading losses, decisions you
        make using the service, inaccurate or delayed data, or broker outages. Our total liability
        to you is limited to the amount you paid us in the twelve months before the claim arose.
        These terms do not exclude rights or liabilities that cannot legally be excluded.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Leaving the service",
    body: (
      <p>
        You can stop using GoldenBook at any time. To request account closure and deletion of
        stored information, follow the <Link to="/privacy#rights">privacy policy</Link>. We may
        suspend or end access for a breach of these terms, or close the service. Where possible,
        we will give reasonable notice before closing it.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: (
      <p>
        Indian law governs these terms. Subject to any mandatory legal protections, the courts
        at {d.operatorLocation} have jurisdiction over disputes concerning the service.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Updates and questions",
    body: (
      <p>
        We may update these terms as the service changes. We will publish revisions here and
        update the date and version shown above. Please read the current terms before continuing
        to use GoldenBook. For questions, email <a href={`mailto:${d.contactEmail}`}>{d.contactEmail}</a>.
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
          GoldenBook helps you review your broker accounts and explore portfolio scenarios.
          It does not place trades or give investment advice. Check data and calculations with
          your broker before making a decision.
        </>
      }
      sections={sections}
    />
  );
}
