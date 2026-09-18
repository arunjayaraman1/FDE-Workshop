import { Suspense } from "react";
import LoginForm from "../components/login-form";
import { LockupLight } from "../components/brand";

export default function LoginPage() {
  return (
    <div className="login-grid">
      <div className="lp-brand">
        <div>
          <div className="brand-line">
            <LockupLight className="np-lockup" />
          </div>
          <div className="brand-sub">Internal deploy console</div>
        </div>

        <div className="lp-hero">
          <div className="lp-kicker">Ship to the edge</div>
          <h1>
            One launchpad for every app you&apos;ll <span className="orange">ever ship</span>
          </h1>
          <p>
            Scaffold a project, push it to GitHub, and let actions deploy it to Cloudflare
            Workers or AWS. Templates, environments, previews and live logs — in one place.
          </p>
          <div className="bullets">
            <div className="bullet">
              <span className="b-arrow">›</span>
              Template-powered scaffolds for Workers, Pages, and serverless
            </div>
            <div className="bullet">
              <span className="b-arrow">›</span>
              Deploy secrets wired straight into CI — securely, per environment
            </div>
            <div className="bullet">
              <span className="b-arrow">›</span>
              Branch previews and live request logs for every deployment
            </div>
          </div>
        </div>

        <div className="lp-foot">
          <div className="trust">
            <span className="tdot" />
            <span className="tdot" />
            <span className="tdot" />
          </div>
          Over 2,000 deployments served this year
        </div>
      </div>

      <div className="lp-form">
        <div className="lp-card">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <div className="lp-hint">
            Launchpad access is invite-only. Your workspace admin can add you — learn more at
            {" "}
            <code>#launchpad</code>
          </div>
        </div>
      </div>
    </div>
  );
}