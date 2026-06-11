"use client";

import * as React from "react";
import { CheckCircle2, Clock, FileUp, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_LABELS } from "@/lib/constants";
import { submitVerification } from "@/server/actions/verification";
import type { DocumentType, VerificationRequestRow } from "@/types";

const STATUS_BADGE = {
  pending: { variant: "warning" as const, icon: Clock, label: "Pending review" },
  approved: { variant: "success" as const, icon: CheckCircle2, label: "Approved" },
  rejected: { variant: "destructive" as const, icon: XCircle, label: "Rejected" },
};

export function DocumentUploadCard({
  documentType,
  userId,
  request,
  propertyId,
  description,
}: {
  documentType: DocumentType;
  userId: string;
  request: VerificationRequestRow | null;
  propertyId?: string;
  description: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const path = `${userId}/${documentType}${propertyId ? `-${propertyId}` : ""}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const formData = new FormData();
      formData.set("documentType", documentType);
      formData.set("storagePath", path);
      if (propertyId) formData.set("propertyId", propertyId);

      const result = await submitVerification(formData);
      if (!result.ok) throw new Error(result.error);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const status = request ? STATUS_BADGE[request.status] : null;
  const canUpload = !request || request.status === "rejected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-display text-lg">{DOCUMENT_LABELS[documentType]}</CardTitle>
          {status && (
            <Badge variant={status.variant}>
              <status.icon />
              {status.label}
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {request?.status === "rejected" && request.rejection_reason && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Rejected: {request.rejection_reason}
          </p>
        )}
        {canUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp />
              {uploading ? "Uploading…" : request ? "Re-upload document" : "Upload document"}
            </Button>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF · max 10 MB</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {request?.status === "approved"
              ? "This document is verified."
              : "We're reviewing this document — usually within 24 hours."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
