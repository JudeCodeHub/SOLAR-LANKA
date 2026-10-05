import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "field-control h-11 w-full min-w-0 px-3.5 py-2 file:mr-3 file:inline-flex file:h-8 file:rounded-full file:border-0 file:bg-paper-2 file:px-3 file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
