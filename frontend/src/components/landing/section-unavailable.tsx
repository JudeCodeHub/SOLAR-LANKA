"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messages } from "@/messages";

/** Shown in place of one landing section whose data could not be loaded; the rest still render. */
export function SectionUnavailable() {
  const router = useRouter();
  const text = messages.landing.unavailable;
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>
        <p>{text.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => router.refresh()}>
          {text.retry}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
