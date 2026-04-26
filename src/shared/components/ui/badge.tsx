import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "rounded-full border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "rounded-full border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "rounded-full border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "rounded-full text-foreground",
        red:
          "rounded border-transparent bg-gardens-red-lt text-gardens-red-dk",
        amber:
          "rounded border-transparent bg-gardens-amb-lt text-gardens-amb-dk",
        green:
          "rounded border-transparent bg-gardens-grn-lt text-gardens-grn-dk",
        blue:
          "rounded border-transparent bg-gardens-blu-lt text-gardens-blu-dk",
        grey:
          "rounded border-transparent bg-gardens-page text-gardens-txs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge }
