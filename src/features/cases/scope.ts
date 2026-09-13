import type { Actor } from "@/features/auth/useStaffProfile";
import type { ExceptionCase } from "@/features/domain/types";

/**
 * Which cases a signed-in person may see. Hub staff see their hub's work
 * (including hand-offs addressed to them), riders see their own parcels,
 * care and ops see everything, senders see nothing here -- their view is the
 * sanitised SenderUpdate stream.
 */
export function scopeCases(cases: ExceptionCase[], actor: Actor | undefined): ExceptionCase[] {
  if (!actor) return [];
  switch (actor.role) {
    case "care-agent":
    case "ops-manager":
      return cases;
    case "hub-staff": {
      const hub = actor.hubCode;
      const team = actor.team;
      return cases.filter(
        (item) =>
          item.hubCode === hub ||
          item.originHubCode === hub ||
          item.destHubCode === hub ||
          item.ownerTeam === team ||
          item.pendingOwnerTeam === team ||
          item.ownerUserId === actor.userId
      );
    }
    case "rider":
      return cases.filter((item) => (actor.riderId && item.riderId === actor.riderId) || item.ownerUserId === actor.userId);
    default:
      return [];
  }
}

export function canOpenCase(actor: Actor | undefined): boolean {
  return actor?.role === "hub-staff" || actor?.role === "care-agent" || actor?.role === "ops-manager";
}

export function canConfirmNextStep(actor: Actor | undefined): boolean {
  return actor?.role === "care-agent" || actor?.role === "ops-manager";
}

export function canTransfer(actor: Actor | undefined, item: ExceptionCase): boolean {
  if (!actor) return false;
  if (actor.role === "rider" || actor.role === "sender") return false;
  if (actor.role === "ops-manager") return true;
  return item.ownerUserId === actor.userId || item.ownerTeam === actor.team;
}

export function canAcknowledge(actor: Actor | undefined, item: ExceptionCase): boolean {
  if (!actor || !item.pendingOwnerTeam) return false;
  return actor.team === item.pendingOwnerTeam || actor.role === "ops-manager";
}

export function canResolve(actor: Actor | undefined, item: ExceptionCase): boolean {
  if (!actor) return false;
  if (item.status === "resolved" || item.status === "closed") return false;
  return actor.role === "ops-manager" || actor.role === "care-agent" || item.ownerUserId === actor.userId || item.ownerTeam === actor.team;
}

export function canSubmitRiderNote(actor: Actor | undefined): boolean {
  return actor?.role === "rider" || actor?.role === "hub-staff" || actor?.role === "care-agent";
}
