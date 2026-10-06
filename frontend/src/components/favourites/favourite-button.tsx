"use client";

import { useAuth } from "@clerk/nextjs";
import { Heart } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { describeError } from "@/lib/api/errors";
import { useSessionState } from "@/lib/api/use-session";
import { useFavouriteIds, useSetFavourite } from "@/lib/favourites/hooks";
import { wouldExceedLimit } from "@/lib/favourites/state";
import { signInHref } from "@/lib/redirect";
import { useReturnPath } from "@/lib/use-return-path";
import { cn } from "@/lib/utils";
import { format, messages } from "@/messages";

const text = messages.favourites;
const buttonClass =
  "inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:bg-orange-tint motion-reduce:transition-none";

/** The heart on a product. */
export function FavouriteButton({ id, name }: { id: string; name: string }) {
  const { isSignedIn } = useAuth();
  return <FavouriteControl id={id} name={name} signedIn={isSignedIn} />;
}

/** `signedIn` is undefined while Clerk is still loading. */
export function FavouriteControl({
  id,
  name,
  signedIn,
}: {
  id: string;
  name: string;
  signedIn: boolean | undefined;
}) {
  const { state } = useSessionState(signedIn === true);
  const isCustomer = state.status === "ready" && state.user.role === "customer";
  const ids = useFavouriteIds(isCustomer);
  const set = useSetFavourite();
  const returnPath = useReturnPath();
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState(false);
  // Synchronous guard: React state is too slow to stop several clicks in the same moment.
  const inFlight = useRef(false);

  if (signedIn === false) {
    return (
      <Link href={signInHref(returnPath)} className={buttonClass}>
        <Heart aria-hidden className="size-5" />
        <span className="sr-only">{format(text.signInToSave, { name })}</span>
      </Link>
    );
  }
  // Not a customer, still loading, or the saved list could not be read: no heart.
  if (!isCustomer || !ids.data) {
    return null;
  }

  const favourite = ids.data.product_ids.includes(id);
  const toggle = () => {
    if (inFlight.current) return;
    const next = !favourite;
    if (next && wouldExceedLimit(ids.data.product_ids, id, ids.data.max_favourites)) {
      setProblem(true);
      setMessage(format(text.limit, { max: ids.data.max_favourites }));
      return;
    }
    setProblem(false);
    inFlight.current = true;
    set.mutate(
      { id, favourite: next },
      {
        onSettled: () => {
          inFlight.current = false;
        },
        onSuccess: () => setMessage(format(next ? text.saved : text.removed, { name })),
        onError: (error) => {
          setProblem(true);
          setMessage(describeError(error).message || text.failed);
        },
      },
    );
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={favourite}
        aria-busy={set.isPending}
        className={cn(buttonClass, set.isPending && "opacity-70")}
      >
        <Heart aria-hidden className={cn("size-5", favourite && "fill-current text-danger")} />
        <span className="sr-only">{format(text.save, { name })}</span>
      </button>
      <span role="status" className={cn(problem ? "max-w-48 text-right text-xs font-medium text-danger" : "sr-only")}>
        {message}
      </span>
    </div>
  );
}
