import { Suspense } from "react";
import { listTemplates } from "@/lib/templates";
import { getEnvPat, getDefaultAccountId, getOrgName, getAwsCredentialEnvVars } from "@/lib/config";
import LaunchPad from "./components/launch-pad";
import { PageHead } from "./components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const templates = listTemplates();
  const awsEnv = await getAwsCredentialEnvVars();
  return (
    <div>
      <PageHead
        eyebrow="Launchpad"
        title="Launch an app to Cloudflare or AWS"
        desc="Choose a language, then a template. Launchpad scaffolds the project, creates a GitHub repo with deploy secrets, pushes the code, and GitHub Actions deploys it to Cloudflare or AWS."
      />
      <Suspense fallback={<p className="text-sm text-slate-500">Loading launch pad…</p>}>
        <LaunchPad
          templates={templates}
          envPatSet={Boolean(await getEnvPat())}
          envTokenSet={Boolean(process.env.CLOUDFLARE_API_TOKEN)}
          defaultAccountId={await getDefaultAccountId()}
          envAwsAccessKeySet={Boolean((process.env[awsEnv.accessKeyEnv] ?? "").trim())}
          envAwsSecretKeySet={Boolean((process.env[awsEnv.secretKeyEnv] ?? "").trim())}
          org={await getOrgName()}
        />
      </Suspense>
    </div>
  );
}