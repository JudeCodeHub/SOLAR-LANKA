"use client";

import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { useDownloadPhoto } from "@/lib/support/hooks";
import { format } from "@/messages";

/** A private photo list: each one is fetched through its access-checked route, never linked. */
export function PhotoList({ photos, fetchPhoto, label, none }: { photos: { asset_id: string }[]; fetchPhoto: (asset: string) => Promise<Blob>; label: string; none: string }) {
  const download = useDownloadPhoto(fetchPhoto);
  if (photos.length === 0) return <p className="text-sm text-muted-foreground">{none}</p>;
  return (
    <div className="space-y-1">
      <ul className="space-y-1" data-photos>
        {photos.map((photo, index) => (
          <li key={photo.asset_id}>
            <Button type="button" variant="outline" size="sm" aria-disabled={download.isPending} data-download onClick={() => !download.isPending && download.mutate(photo.asset_id)}>
              {format(label, { number: index + 1 })}
            </Button>
          </li>
        ))}
      </ul>
      {download.error ? <ApiErrorMessage error={download.error} /> : null}
    </div>
  );
}
