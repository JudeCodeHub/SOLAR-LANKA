"use client";

import { Download } from "lucide-react";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { useDownloadPhoto } from "@/lib/support/hooks";
import { format } from "@/messages";

/** A private photo list: each one is fetched through its access-checked route, never linked. */
export function PhotoList({ photos, fetchPhoto, label, none }: { photos: { asset_id: string }[]; fetchPhoto: (asset: string) => Promise<Blob>; label: string; none: string }) {
  const download = useDownloadPhoto(fetchPhoto);
  if (photos.length === 0) return <p className="type-body text-ink-2" data-no-photos>{none}</p>;
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-3" data-photos>
        {photos.map((photo, index) => (
          <li key={photo.asset_id}>
            <Button type="button" variant="outline" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
              <Download aria-hidden />
              {format(label, { number: index + 1 })}
            </Button>
          </li>
        ))}
      </ul>
      {download.error ? <ApiErrorMessage error={download.error} /> : null}
    </div>
  );
}
