"use client";

import { Bot, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useAiStatus } from "@/features/ai/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { useActor } from "@/features/auth/useStaffProfile";
import { ROLE_LABEL, hubName, teamLabel } from "@/features/domain/constants";
import { blocksConfig } from "@/lib/blocks/config";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, Avatar, PageHeader, Skeleton } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";

export function ProfilePage() {
  const me = useCurrentUser();
  const { actor } = useActor();
  const { claims } = useAuth();
  const ai = useAiStatus();
  const profile = me.data?.data;
  const expiresAt = typeof claims?.exp === "number" ? new Date((claims.exp as number) * 1000) : undefined;

  return (
    <section className="max-w-3xl">
      <PageHeader title="Profile" subtitle="Your Blocks IAM identity and how the desk scopes you." />

      {actor && !actor.role ? (
        <Alert tone="warn" title="No desk role yet" className="mb-4">
          Your account has none of the five desk roles (hub-staff, rider, care-agent, ops-manager, sender). Ask an ops manager to grant one with{" "}
          <code className="rounded bg-white px-1">blocks iam users access grant</code>.
        </Alert>
      ) : null}

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={actor?.name} size="lg" />
          <div className="min-w-0">
            {me.isLoading ? <Skeleton className="h-6 w-48" /> : <h3 className="text-[20px] font-bold text-ink-900">{actor?.name}</h3>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-600">
              {profile?.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail size={13} /> {profile.email}
                </span>
              ) : null}
              {actor?.role ? <Badge tone="brand">{ROLE_LABEL[actor.role]}</Badge> : null}
              {actor?.hubCode ? <Badge tone="neutral">{hubName(actor.hubCode)}</Badge> : actor ? <Badge tone="neutral">{teamLabel(actor.team)}</Badge> : null}
              {actor?.senderCompany ? <Badge tone="info">{actor.senderCompany}</Badge> : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader icon={<ShieldCheck size={16} />} title="Roles" subtitle="From Blocks IAM. The most privileged desk role wins." />
          <CardBody className="flex flex-wrap gap-1.5">
            {(profile?.roles ?? []).length ? profile!.roles!.map((role) => <Badge key={role}>{role}</Badge>) : <span className="text-[13px] text-ink-500">No roles assigned</span>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<KeyRound size={16} />} title="Session" />
          <CardBody className="grid gap-1 text-[13px] text-ink-700">
            <div>
              <span className="text-ink-500">User id:</span> <span className="mono">{profile?.itemId ?? "—"}</span>
            </div>
            <div>
              <span className="text-ink-500">Tenant:</span> <span className="mono">{blocksConfig.xBlocksKey}</span>
            </div>
            <div>
              <span className="text-ink-500">Session expires:</span> {expiresAt ? formatDateTime(expiresAt) : "cookie session"}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<Bot size={16} />} title="AI engine" subtitle="How rider notes get structured on this deployment." />
          <CardBody className="text-[13px] text-ink-700">
            {ai.data?.configured ? (
              <>
                <Badge tone="violet">Gemini · {ai.data.model}</Badge>
                <p className="mt-2">Gemini structures notes with a strict JSON schema; the rule engine cross-checks every answer and disagreements below 75% confidence go to manual review.</p>
              </>
            ) : (
              <>
                <Badge tone="neutral">Rule engine</Badge>
                <p className="mt-2">
                  No <code className="rounded bg-ink-100 px-1">GEMINI_API_KEY</code> on the server, so the deterministic Banglish engine handles structuring. Add the key to <code className="rounded bg-ink-100 px-1">.env.local</code> to upgrade.
                </p>
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<UserRound size={16} />} title="Permissions" subtitle={`${profile?.permissions?.length ?? 0} returned by IAM`} />
          <CardBody className="max-h-48 overflow-y-auto">
            <div className="flex flex-wrap gap-1">
              {(profile?.permissions ?? []).slice(0, 60).map((permission) => (
                <span key={permission} className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
                  {permission}
                </span>
              ))}
              {!profile?.permissions?.length ? <span className="text-[13px] text-ink-500">Runtime desk features need no endpoint permissions.</span> : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}
