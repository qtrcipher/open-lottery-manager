"use client";

import { useActionState, useMemo, useState } from "react";
import { confirmEntriesImportAction, previewEntriesImportAction, type EntryImportActionState } from "@/app/admin/actions";
import { Label, TextArea } from "@/components/ui";

const initialState: EntryImportActionState = {
  status: "idle",
  message: "",
  csv: "",
  summary: {
    totalRows: 0,
    validRows: 0,
    errorRows: 0
  },
  errors: [],
  previewRows: []
};

function actionButtonClass(variant: "primary" | "secondary" = "primary"): string {
  if (variant === "secondary") {
    return "inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-50";
  }

  return "inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-50";
}

export function CsvImportForm({ campaignId }: { campaignId: string }) {
  const [csv, setCsv] = useState("");
  const [lastAction, setLastAction] = useState<"preview" | "confirm">("preview");
  const [previewState, previewAction, previewPending] = useActionState(previewEntriesImportAction, initialState);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmEntriesImportAction, initialState);
  const activeState = lastAction === "confirm" ? confirmState : previewState;
  const canConfirm = useMemo(
    () => confirmState.status !== "imported" && previewState.status === "preview" && previewState.previewRows.length > 0 && csv === previewState.csv,
    [confirmState.status, csv, previewState]
  );

  return (
    <form action={previewAction} className="mt-4 space-y-4">
      <input name="campaignId" type="hidden" value={campaignId} />
      <div>
        <Label>CSV rows</Label>
        <TextArea
          name="csv"
          required
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          placeholder={"name,email,reference\nFatima Noor,fatima@example.com,INV-1001"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button className={actionButtonClass("secondary")} type="submit" onClick={() => setLastAction("preview")} disabled={previewPending || confirmPending}>
          Preview rows
        </button>
        <button
          className={actionButtonClass()}
          type="submit"
          formAction={confirmAction}
          onClick={() => setLastAction("confirm")}
          disabled={!canConfirm || previewPending || confirmPending}
        >
          Confirm import
        </button>
      </div>

      {activeState.message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            activeState.status === "error" || activeState.summary.errorRows > 0
              ? "border-brick/30 bg-brick/10 text-brick"
              : "border-moss/30 bg-moss/10 text-moss"
          }`}
          role="status"
        >
          {activeState.message}
        </div>
      ) : null}

      {activeState.status !== "idle" ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="text-ink/60">CSV rows</dt>
            <dd className="mt-1 text-lg font-bold">{activeState.summary.totalRows}</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="text-ink/60">Ready</dt>
            <dd className="mt-1 text-lg font-bold text-moss">{activeState.summary.validRows}</dd>
          </div>
          <div className="rounded-md border border-line bg-paper/70 p-3">
            <dt className="text-ink/60">Skipped</dt>
            <dd className="mt-1 text-lg font-bold text-brick">{activeState.summary.errorRows}</dd>
          </div>
        </dl>
      ) : null}

      {activeState.previewRows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[620px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-ink/58">
                <th className="border-b border-line px-3 py-2 font-semibold">Row</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Name</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Email</th>
                <th className="border-b border-line px-3 py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {activeState.previewRows.slice(0, 10).map((row) => (
                <tr key={`${row.rowNumber}-${row.email}`}>
                  <td className="border-b border-line px-3 py-2 text-ink/64">{row.rowNumber}</td>
                  <td className="border-b border-line px-3 py-2 font-semibold">{row.name}</td>
                  <td className="border-b border-line px-3 py-2">{row.email}</td>
                  <td className="border-b border-line px-3 py-2 text-ink/64">{row.reference || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeState.previewRows.length > 10 ? <p className="mt-2 text-xs text-ink/58">Showing first 10 ready rows.</p> : null}
        </div>
      ) : null}

      {activeState.errors.length > 0 ? (
        <div className="space-y-2">
          {activeState.errors.slice(0, 10).map((row) => (
            <p key={`${row.rowNumber}-${row.message}`} className="rounded-md border border-brick/30 bg-brick/10 p-3 text-sm text-brick">
              {row.message}
            </p>
          ))}
          {activeState.errors.length > 10 ? <p className="text-xs text-ink/58">Showing first 10 skipped rows.</p> : null}
        </div>
      ) : null}
    </form>
  );
}
