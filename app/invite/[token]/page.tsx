import InviteAcceptForm from "../../components/invite-accept-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(620px 420px at 50% -10%, #e4f1ef, var(--bg))",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 424 }}>
        <div className="lp-card">
          <div className="lp-eyebrow">Cloudflare · Launchpad</div>
          <h2>Join a project</h2>
          <p className="sub">Accept your invite to Cloudflare Launchpad.</p>
          <InviteAcceptForm token={token} />
        </div>
      </div>
    </div>
  );
}