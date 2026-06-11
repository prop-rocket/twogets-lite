import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { DocumentUploadCard } from "@/components/verification/document-upload-card";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { Badge } from "@/components/ui/badge";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { DocumentType, VerificationRequestRow } from "@/types";

export const metadata = { title: "Verification Center" };

export default async function VerificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("verification_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const byType = new Map<string, VerificationRequestRow>();
  for (const request of requests ?? []) {
    const key = `${request.document_type}:${request.property_id ?? ""}`;
    if (!byType.has(key)) byType.set(key, request);
  }
  const identityDoc = (type: DocumentType) => byType.get(`${type}:`) ?? null;

  const { data: properties } =
    user.role === "homeowner"
      ? await supabase
          .from("properties")
          .select("id, title, is_verified")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
      : { data: null };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Verification Center</h1>
          <p className="text-muted-foreground">
            Verified members get the trust badge, higher trust scores and faster responses.
          </p>
        </div>
        {user.is_verified ? (
          <VerifiedBadge kind={user.role === "homeowner" ? "owner" : "tenant"} />
        ) : (
          <Badge variant="warning">
            <ShieldCheck />
            Not verified yet
          </Badge>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Identity documents</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentUploadCard
            documentType="aadhaar"
            userId={user.id}
            request={identityDoc("aadhaar")}
            description="Government-issued Aadhaar card (front side). Mask the last 8 digits if you prefer."
          />
          <DocumentUploadCard
            documentType="pan"
            userId={user.id}
            request={identityDoc("pan")}
            description="PAN card — used only for identity verification, never shared."
          />
        </div>
        {user.role === "tenant" && (
          <p className="text-sm text-muted-foreground">
            Tenants need <strong>both Aadhaar and PAN approved</strong> to earn the Verified Tenant
            badge. Add your LinkedIn on the{" "}
            <a href="/dashboard/profile" className="text-primary underline">
              profile page
            </a>{" "}
            to strengthen your application.
          </p>
        )}
      </section>

      {user.role === "homeowner" && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Property ownership documents</h2>
          {!properties?.length ? (
            <p className="text-sm text-muted-foreground">
              Create a listing first — then verify it here with a utility bill, property tax receipt
              or sale deed.
            </p>
          ) : (
            properties.map((property) => (
              <div key={property.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{property.title}</h3>
                  {property.is_verified && <VerifiedBadge kind="property" />}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {(["utility_bill", "property_tax_receipt", "sale_deed"] as DocumentType[]).map(
                    (type) => (
                      <DocumentUploadCard
                        key={type}
                        documentType={type}
                        userId={user.id}
                        propertyId={property.id}
                        request={byType.get(`${type}:${property.id}`) ?? null}
                        description={
                          type === "utility_bill"
                            ? "Recent electricity/water bill in your name."
                            : type === "property_tax_receipt"
                              ? "Latest property tax payment receipt."
                              : "Registered sale deed (first page is enough)."
                        }
                      />
                    ),
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Any one approved document earns this property the Verified badge.
                </p>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
