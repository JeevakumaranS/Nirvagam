"use client";
import React, { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiDownload, apiFetch, saveDownloadedFile } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

export function ImportExportActions({ operation, canImport = false, onComplete }: { operation: string; canImport?: boolean; onComplete?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [templateType, setTemplateType] = useState("mixed");
  const [templateChooserOpen, setTemplateChooserOpen] = useState(false);
  const { toast } = useToast();
  const download = async (endpoint: string, fallback: string) => {
    setBusy(true);
    try { saveDownloadedFile(await apiDownload(endpoint, {}, fallback)); }
    catch (error: any) { toast({ title: "Download failed", message: error.message, type: "error" }); }
    finally { setBusy(false); }
  };
  const downloadTemplate = (type = templateType) => {
    setTemplateType(type);
    setTemplateChooserOpen(false);
    return download(`/import-export/templates/${operation}?templateType=${type}`, `nirvagam-${operation}-${type}-template-v2.xlsx`);
  };
  const waitForJob = async (id: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const job = await apiFetch(`/import-export/jobs/${id}`);
      if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(job.status)) return job;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return null;
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const body = new FormData(); body.append("file", file); body.append("templateType", templateType);
      const result = await apiFetch(`/import-export/inventory/${operation}/validate`, { method: "POST", body });
      const errors = result?.errors || [];
      const id = result?.id;
      if (result?.alreadyProcessed && result.status !== "READY") {
        toast({ title: "Import already submitted", message: `This file is already ${String(result.status).toLowerCase()}. Check Import History for its result.`, type: result.status === "FAILED" ? "error" : "info" });
        return;
      }
      if (errors.length && !window.confirm(`${errors.length} validation errors found. Import valid rows only?`)) return;
      const confirmed = await apiFetch(`/import-export/${id}/confirm`, { method: "POST", body: JSON.stringify({ mode: "CREATE_OR_UPDATE", allowPartial: errors.length > 0 }) });
      const finalJob = await waitForJob(confirmed.id || id);
      if (finalJob?.status === "FAILED") throw new Error(finalJob.errorMessage || "Import failed");
      toast({ title: finalJob?.status === "PARTIAL" ? "Import partially completed" : "Import completed", message: finalJob ? `${finalJob.successRows || 0} rows processed, ${finalJob.failedRows || 0} failed.` : "The import is still processing. Check Import History for progress.", type: finalJob?.status === "PARTIAL" ? "warning" : "success" });
      onComplete?.();
    } catch (error: any) { toast({ title: "Import failed", message: error.message, type: "error" }); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  return <div className="flex gap-2">
    {canImport && <><input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} /><Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()} icon={<Upload className="h-3.5 w-3.5" />}>{busy ? "Validating…" : "Import"}</Button></>}
    <Button size="sm" variant="secondary" disabled={busy} onClick={() => operation === "catalog" ? setTemplateChooserOpen(true) : downloadTemplate("mixed")} icon={<Download className="h-3.5 w-3.5" />}>Excel template</Button>
    <Modal isOpen={templateChooserOpen} onClose={() => setTemplateChooserOpen(false)} title="Choose an Excel template" description="Select the type of products you want to import.">
      <div className="grid gap-2">
        {[{ value: "standard", title: "Standard products", description: "Products without variants." }, { value: "variants", title: "Products with variants", description: "A product sheet plus a separate variants sheet." }, { value: "mixed", title: "Mixed catalogue", description: "Standard and variant-enabled products in one workbook." }].map((option) => (
          <button key={option.value} type="button" className="rounded-lg border border-border p-3 text-left hover:bg-surface-secondary transition-colors" onClick={() => downloadTemplate(option.value)}>
            <span className="block text-sm font-medium text-text-primary">{option.title}</span>
            <span className="block mt-1 text-xs text-text-tertiary">{option.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  </div>;
}
