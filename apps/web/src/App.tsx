import { corePackage } from "@web-cad/cad-core";
import { protocolPackage } from "@web-cad/cad-protocol";
import { rendererPackage } from "@web-cad/renderer";
import "./styles.css";

const packages = [protocolPackage, corePackage, rendererPackage];

export function App() {
  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="app-status-title">
        <p className="eyebrow">Milestone 0</p>
        <h1 id="app-status-title">CAD app shell is running.</h1>
        <p className="summary">
          The browser shell is wired to the workspace packages and ready for the
          command-layer milestones.
        </p>
        <ul className="package-list" aria-label="Workspace package status">
          {packages.map((pkg) => (
            <li key={pkg.name}>
              <span>{pkg.name}</span>
              <strong>{pkg.status}</strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
