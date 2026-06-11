import Image from "next/image";
import Link from "next/link";
import { BedDouble, MapPin, PawPrint, Sofa } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/shared/star-rating";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { FURNISHED_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/constants";
import { formatRent, publicMediaUrl } from "@/lib/utils";
import type { PropertyListItem } from "@/types";

export function PropertyCard({ property }: { property: PropertyListItem }) {
  const cover =
    property.property_images.find((i) => i.is_cover) ?? property.property_images[0];

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      <Link href={`/properties/${property.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {cover ? (
            <Image
              src={publicMediaUrl(cover.storage_path)}
              alt={cover.alt_text || property.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No photos yet
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {property.is_verified && <VerifiedBadge kind="property" />}
            {property.owner.is_verified && <VerifiedBadge kind="owner" />}
          </div>
          <Badge variant="accent" className="absolute bottom-3 left-3 text-sm">
            {formatRent(property.rent)}/mo
          </Badge>
        </div>

        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-display text-lg font-semibold">{property.title}</h3>
          </div>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="line-clamp-1">
              {property.locality}, {property.city}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="size-3.5" />
              {property.bhk} BHK · {PROPERTY_TYPE_LABELS[property.property_type]}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sofa className="size-3.5" />
              {FURNISHED_LABELS[property.furnished_status]}
            </span>
            {property.pet_friendly && (
              <span className="inline-flex items-center gap-1">
                <PawPrint className="size-3.5" />
                Pets OK
              </span>
            )}
          </div>
          <StarRating rating={Number(property.avg_rating)} count={property.review_count} />
        </div>
      </Link>
    </Card>
  );
}
