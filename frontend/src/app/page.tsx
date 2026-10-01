import { Sun } from "lucide-react";

import { AuthStatus } from "@/components/auth-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Sun aria-hidden className="size-8 text-amber-600" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Solar Lanka
          </h1>
          <CardDescription>
            Explore solar products, estimate your system and compare quotations.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Portfolio demonstration under development. All companies, prices and
          estimates will be fictional samples.
        </CardContent>
        <CardFooter className="flex-col justify-center gap-3">
          <Button disabled>Catalogue coming soon</Button>
          <AuthStatus />
        </CardFooter>
      </Card>
    </main>
  );
}
