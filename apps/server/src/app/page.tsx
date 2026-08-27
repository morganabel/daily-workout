export default function Index() {
  return (
    <main className="status-page">
      <section className="status-panel" aria-labelledby="status-title">
        <p className="eyebrow">Community Edition API</p>
        <h1 id="status-title">Leveza</h1>
        <p className="lede">
          The backend is running. Use the Expo mobile app for the workout
          experience, or call the API endpoints directly during development.
        </p>
        <dl className="endpoint-list">
          <div>
            <dt>Capabilities</dt>
            <dd>
              <code>GET /api/meta</code>
            </dd>
          </div>
          <div>
            <dt>Workout generation</dt>
            <dd>
              <code>POST /api/workouts/generate</code>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
