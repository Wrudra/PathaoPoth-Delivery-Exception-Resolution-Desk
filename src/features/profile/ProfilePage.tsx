"use client";

import { Mail } from "lucide-react";
import { useActor } from "@/features/auth/useStaffProfile";
import { ROLE_LABEL, hubName, teamLabel } from "@/features/domain/constants";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, Avatar, PageHeader, Skeleton } from "@/components/ui/misc";

export function ProfilePage() {
  const { actor, isLoading } = useActor();

  return (
    <section className="max-w-xl">
      <PageHeader title="You" subtitle="How the desk sees you." />

      {actor && !actor.role ? (
        <Alert tone="warn" title="No desk role" className="mb-4">
          Ask an ops manager to assign hub staff, rider, care, ops, or sender.
        </Alert>
      ) : null}

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={actor?.name} size="lg" />
          <div className="min-w-0">
            {isLoading ? <Skeleton className="h-6 w-48" /> : <h3 className="text-[20px] font-bold text-ink-900">{actor?.name}</h3>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-600">
              {actor?.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail size={13} /> {actor.email}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {actor?.role ? <Badge tone="brand">{ROLE_LABEL[actor.role]}</Badge> : null}
              {actor?.hubCode ? <Badge tone="neutral">{hubName(actor.hubCode)}</Badge> : actor ? <Badge tone="neutral">{teamLabel(actor.team)}</Badge> : null}
              {actor?.senderCompany ? <Badge tone="info">{actor.senderCompany}</Badge> : null}
            </div>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
