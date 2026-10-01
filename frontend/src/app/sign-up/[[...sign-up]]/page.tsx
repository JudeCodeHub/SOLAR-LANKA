import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create account · Solar Lanka" };

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
      <SignUp />
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        New accounts are customer accounts. Company and administrator access is granted
        separately by the platform and cannot be chosen here.
      </p>
    </div>
  );
}
