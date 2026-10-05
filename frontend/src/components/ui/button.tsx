import { DialLoader } from "@/components/ui/dial-loader"
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/** Every size is at least 44 px tall; "sm" and "xs" are narrower and smaller in type, not shorter. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-[0.9375rem] font-medium tracking-tight whitespace-nowrap select-none transition-[background-color,box-shadow,transform,color] duration-[var(--ds-dur-base)] ease-[var(--ds-ease)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:bg-disabled-bg disabled:text-disabled-text disabled:shadow-none aria-disabled:cursor-not-allowed [&[aria-disabled=true]:not([data-loading=true])]:bg-disabled-bg [&[aria-disabled=true]:not([data-loading=true])]:text-disabled-text [&[aria-disabled=true]:not([data-loading=true])]:shadow-none data-[loading=true]:cursor-progress aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-orange text-on-orange [box-shadow:inset_0_1px_0_rgb(255_255_255/0.3),var(--ds-shadow-1)] hover:bg-orange-hover active:bg-orange-pressed",
        secondary:
          "border-line bg-paper-2 text-ink hover:border-field-border hover:bg-surface aria-expanded:bg-surface",
        outline:
          "border-field-border bg-transparent text-ink hover:bg-paper-2 aria-expanded:bg-paper-2",
        ghost: "text-ink hover:bg-paper-2 aria-expanded:bg-paper-2",
        destructive: "bg-danger text-on-danger shadow-e1 hover:brightness-95 active:brightness-90",
        link: "rounded-md text-orange-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xs: "h-11 px-3 text-[0.8125rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-11 px-4 text-sm has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        lg: "h-14 px-8 text-base has-data-[icon=inline-end]:pr-7 has-data-[icon=inline-start]:pl-7",
        icon: "size-11",
        "icon-xs": "size-11",
        "icon-sm": "size-11",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Busy: keeps its colours, shows a spinner, announces itself as busy and ignores clicks. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const busy = loading && !asChild

  return (
    <Comp
      {...props}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={busy ? "true" : undefined}
      aria-busy={busy ? true : undefined}
      aria-disabled={busy ? true : props["aria-disabled"]}
      onClick={busy ? undefined : onClick}
      className={cn(buttonVariants({ variant, size, className }))}
    >
      {asChild ? (
        children
      ) : (
        <>
          {busy ? <DialLoader /> : null}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
