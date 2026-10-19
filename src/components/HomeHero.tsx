export default function HomeHero({
  campaigns,
  tasks,
}: {
  campaigns: number;
  tasks: number;
}) {
  return (
    <section className="hero">
      <div>
        <p className="kicker">Primus zkTLS · no account</p>
        <h1 className="display">
          Prove the action.
          <em> Keep the session yours.</em>
        </h1>
        <p className="hero-copy">
          No login. Open a campaign and click a task. Primus zkTLS proves it from the X or Discord
          session already open in this browser. {campaigns} campaigns, {tasks} tasks.
        </p>
        <a href="#campaigns" className="btn-primary mt-8">
          Try a proof
        </a>
      </div>
      <aside className="slip" aria-label="How a proof works">
        <div className="slip-top">
          <span>AQ-01</span>
          <span>Live session</span>
        </div>
        <p className="slip-title">Attestation</p>
        <ol>
          <li>
            <span>01</span>
            Open a campaign
          </li>
          <li>
            <span>02</span>
            Do the action in your own browser
          </li>
          <li>
            <span>03</span>
            zkTLS proves it. The session stays local
          </li>
        </ol>
        <div className="slip-foot">
          <span className="seal">
            {String(campaigns).padStart(2, "0")} campaigns · {tasks} tasks
          </span>
          <span>Primus</span>
        </div>
      </aside>
    </section>
  );
}
