"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Globe, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProperty, setPropertyStatus } from "@/server/actions/properties";
import type { PropertyStatus } from "@/types";

export function ListingActions({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function changeStatus(next: PropertyStatus) {
    startTransition(async () => {
      const result = await setPropertyStatus(propertyId, next);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Listing actions">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/listings/${propertyId}/edit`}>
              <Pencil />
              Edit
            </Link>
          </DropdownMenuItem>
          {status !== "active" && (
            <DropdownMenuItem onSelect={() => changeStatus("active")}>
              <Globe />
              Publish
            </DropdownMenuItem>
          )}
          {status === "active" && (
            <DropdownMenuItem onSelect={() => changeStatus("archived")}>
              <Archive />
              Archive
            </DropdownMenuItem>
          )}
          {status === "active" && (
            <DropdownMenuItem onSelect={() => changeStatus("rented")}>
              <Archive />
              Mark as rented
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              This permanently removes the listing, its photos, and all related inquiries. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep listing
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteProperty(propertyId);
                  if (result.ok) {
                    toast.success(result.message);
                    setConfirmDelete(false);
                  } else toast.error(result.error);
                })
              }
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
