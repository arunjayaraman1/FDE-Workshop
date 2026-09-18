import { getConfigStatus } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import SettingsPanel from "../components/settings-panel";
import { PageHead } from "../components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();

  if (!user || user.globalRole !== "admin") {
    return (
      <div>
        <PageHead
          eyebrow="Administration"
          title="Settings"
          desc="Server configuration is only available to global admins."
        />
      </div>
    );
  }

  const status = await getConfigStatus();

  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="Settings"
        desc="Server configuration and security status."
      />
      <SettingsPanel initialStatus={status} />
    </div>
  );
}