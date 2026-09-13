import { describe, expect, it } from "vitest";
import { structureRiderNote } from "./riderNoteEngine";

describe("structureRiderNote (Banglish heuristic engine)", () => {
  it("structures the demo refused-COD note into an evening redelivery", () => {
    const note =
      "3 bar try korsi, phone off chilo, guard dhukte dey na. 2 ta kalo building er pashe basha. Receiver bollo shondhay thakbe, COD 2300 taka ready nai bolse.";
    const result = structureRiderNote(note, { caseType: "refused", codAmount: 2300, area: "GEC Circle" });

    expect(result.attempts).toBe(3);
    expect(result.phoneStatus).toBe("off");
    expect(result.codIssue).toBe(true);
    expect(result.preferredWindow).toBe("evening");
    expect(result.addressQuality).toBe("vague");
    expect(result.landmarks.join(" ")).toMatch(/kalo building/);
    expect(result.recommendedAction).toBe("evening_redelivery");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.needsManualReview).toBe(false);
    expect(result.senderSafeSummary).not.toMatch(/guard|rider|phone off/i);
    expect(result.evidence.length).toBeGreaterThanOrEqual(4);
  });

  it("recommends return to sender for a firm refusal without a reschedule signal", () => {
    const result = structureRiderNote("Customer bole order kore nai, nibe na. Ferot niye aslam hub e.", { caseType: "refused", codAmount: 1500 });
    expect(result.failureReason).toBe("refused");
    expect(result.refusalFirm).toBe(true);
    expect(result.recommendedAction).toBe("return_to_sender");
  });

  it("asks for address verification when only landmarks are given", () => {
    const result = structureRiderNote("address pai nai, house number nai, shudhu boro mosjid er pashe likha. call dhore na.", { caseType: "address_missing" });
    expect(result.failureReason).toBe("address_issue");
    expect(["incomplete", "vague"]).toContain(result.addressQuality);
    expect(result.recommendedAction).toBe("address_verification");
  });

  it("opens a courier claim for damage", () => {
    const result = structureRiderNote("packet bhije gese, box vanga, customer nite chay na", { caseType: "damaged" });
    expect(result.failureReason).toBe("damaged");
    expect(result.recommendedAction).toBe("courier_claim");
  });

  it("calls the customer when unreachable after fewer than three attempts", () => {
    const result = structureRiderNote("dui bar gesi, phone dhore na, bashay nai", { caseType: "delayed" });
    expect(result.attempts).toBe(2);
    expect(result.phoneStatus).toBe("unanswered");
    expect(result.recommendedAction).toBe("call_customer");
  });

  it("does not bluff on an empty or meaningless note", () => {
    const result = structureRiderNote("ok done", {});
    expect(result.failureReason).toBe("unknown");
    expect(result.recommendedAction).toBe("manual_review");
    expect(result.needsManualReview).toBe(true);
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("counts Bangla number words for attempts", () => {
    expect(structureRiderNote("tin bar try korechi, phone bondho").attempts).toBe(3);
    expect(structureRiderNote("panch bar gesi").attempts).toBe(5);
    expect(structureRiderNote("abar jabo kal").attempts).toBe(2);
  });
});
