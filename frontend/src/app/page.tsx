import { Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { messages } from "@/messages";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <Sun aria-hidden className="size-8 justify-self-center text-amber-600" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {messages.home.title}
          </h1>
          <CardDescription>{messages.home.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{messages.home.note}</CardContent>
        <CardFooter className="justify-center">
          <Button disabled>{messages.home.catalogueSoon}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
