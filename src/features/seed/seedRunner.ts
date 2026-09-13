import { createMany, deleteMany, listAll, updateOne } from "@/features/data/gateway";
import type { CaseEvent, ExceptionCase, Parcel, Rider, RiderNote, SchemaName, SenderUpdate, StaffProfile, SystemFields } from "@/features/domain/types";
import { buildSeed } from "./seedData";

export type SeedProgress = { step: string; done: number; total: number };
type Report = (progress: SeedProgress) => void;

const RESETTABLE: SchemaName[] = ["SenderUpdate", "RiderNote", "CaseEvent", "PrecallTask", "RoutePrediction", "ExceptionCase", "Parcel", "Rider"];

/** Deletes every row of the operational schemas. StaffProfile (real user mappings) is kept. */
export async function resetDemoData(report: Report): Promise<void> {
  for (const name of RESETTABLE) {
    const rows = await listAll<SystemFields>(name, { maxItems: 10_000 });
    if (!rows.length) continue;
    report({ step: `Deleting ${name}`, done: 0, total: rows.length });
    await deleteMany(
      name,
      rows.map((row) => row.ItemId),
      (done, total) => report({ step: `Deleting ${name}`, done, total })
    );
  }
}

export async function seedDemoData(report: Report): Promise<{ demoTrackingId: string; counts: Record<string, number> }> {
  const bundle = buildSeed(new Date());
  const counts: Record<string, number> = {};

  report({ step: "Riders", done: 0, total: bundle.riders.length });
  counts.riders = await createMany<Rider>("Rider", bundle.riders, (done, total) => report({ step: "Riders", done, total }));
  const riders = await listAll<Rider>("Rider");
  const riderByName = new Map(riders.map((rider) => [rider.name, rider.ItemId]));

  const parcelRows = bundle.parcels.map((parcel) => {
    const row: Omit<Parcel, keyof SystemFields> & { seedKey?: string } = { ...parcel, riderId: parcel.riderName ? riderByName.get(parcel.riderName) : undefined };
    delete row.seedKey;
    return row as Omit<Parcel, keyof SystemFields>;
  });
  report({ step: "Parcels", done: 0, total: parcelRows.length });
  counts.parcels = await createMany<Parcel>("Parcel", parcelRows, (done, total) => report({ step: "Parcels", done, total }));
  const parcels = await listAll<Parcel>("Parcel", { maxItems: 10_000 });
  const parcelByTracking = new Map(parcels.map((parcel) => [parcel.trackingId, parcel.ItemId]));

  const caseRows = bundle.cases.map((item) => {
    const row: Omit<ExceptionCase, keyof SystemFields> & { seedKey?: string; parcelKey?: string } = {
      ...item,
      parcelId: parcelByTracking.get(item.parcelKey) ?? "",
      riderId: item.riderName ? riderByName.get(item.riderName) : undefined
    };
    delete row.seedKey;
    delete row.parcelKey;
    return row as Omit<ExceptionCase, keyof SystemFields>;
  });
  report({ step: "Exception cases", done: 0, total: caseRows.length });
  counts.cases = await createMany<ExceptionCase>("ExceptionCase", caseRows, (done, total) => report({ step: "Exception cases", done, total }));
  const cases = await listAll<ExceptionCase>("ExceptionCase", { maxItems: 10_000 });
  const caseByNumber = new Map(cases.map((item) => [item.caseNumber, item.ItemId]));

  const eventRows = bundle.events.map(({ caseKey, ...row }) => ({ ...row, caseId: caseByNumber.get(caseKey) ?? "" }));
  report({ step: "Timeline events", done: 0, total: eventRows.length });
  counts.events = await createMany<CaseEvent>("CaseEvent", eventRows, (done, total) => report({ step: "Timeline events", done, total }));

  const noteRows = bundle.notes.map(({ caseKey, parcelKey, ...row }) => ({
    ...row,
    caseId: caseByNumber.get(caseKey) ?? "",
    parcelId: parcelByTracking.get(parcelKey) ?? "",
    riderId: riderByName.get(row.riderName)
  }));
  report({ step: "Rider notes", done: 0, total: noteRows.length });
  counts.notes = await createMany<RiderNote>("RiderNote", noteRows, (done, total) => report({ step: "Rider notes", done, total }));

  const updateRows = bundle.senderUpdates.map(({ caseKey, parcelKey, ...row }) => ({
    ...row,
    caseId: caseByNumber.get(caseKey) ?? "",
    parcelId: parcelByTracking.get(parcelKey) ?? ""
  }));
  report({ step: "Sender updates", done: 0, total: updateRows.length });
  counts.senderUpdates = await createMany<SenderUpdate>("SenderUpdate", updateRows, (done, total) => report({ step: "Sender updates", done, total }));

  // Re-link real rider logins to the freshly seeded rider rows.
  const profiles = await listAll<StaffProfile>("StaffProfile");
  const demoRider = riders.find((rider) => rider.riderCode === "R-MIR-014");
  for (const profile of profiles.filter((item) => item.role === "rider")) {
    const target = riders.find((rider) => rider.ItemId === profile.riderId) ?? demoRider;
    if (!target) continue;
    if (profile.riderId !== target.ItemId) await updateOne<StaffProfile>("StaffProfile", profile.ItemId, { riderId: target.ItemId, hubCode: target.hubCode, team: `hub:${target.hubCode}` });
    await updateOne<Rider>("Rider", target.ItemId, { userId: profile.userId });
  }

  report({ step: "Done", done: 1, total: 1 });
  return { demoTrackingId: bundle.demoTrackingId, counts };
}
