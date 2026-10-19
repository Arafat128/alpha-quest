export default function HomeHero() {
  return (
    <section className="hero">
      <div>
        <p className="kicker">Primus zkTLS</p>
        <h1 className="display">
          Prove a fact.
          <em> Leave the rest private.</em>
        </h1>
        <p className="hero-copy">
          Show that something on a site is true, without handing over the account behind it. Primus
          checks one live page in this browser and returns a proof of that fact. The password, the
          rest of the page, and everything you did not agree to show stay where they are.
        </p>
      </div>
      <aside className="slip" aria-label="How a proof works">
        <div className="slip-top">
          <span>AQ-01</span>
          <span>Live session</span>
        </div>
        <p className="slip-title">What happens</p>
        <ol>
          <li>
            <span>01</span>
            You are already logged in, in this browser
          </li>
          <li>
            <span>02</span>
            Primus opens that site and reads one check
          </li>
          <li>
            <span>03</span>
            This page receives the proof, not your private data
          </li>
        </ol>
        <div className="slip-foot">
          <span className="seal">X follow · X post · Discord</span>
          <span>Primus</span>
        </div>
      </aside>
    </section>
  );
}
