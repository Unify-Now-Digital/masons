import * as React from "react"
import { FocusScope } from "@radix-ui/react-focus-scope"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/shared/lib/utils"

const DrawerResetKeyContext = React.createContext(0)

export const useDrawerResetKey = () => React.useContext(DrawerResetKeyContext)

export function useOnDrawerReset(cb: () => void) {
  const resetKey = useDrawerResetKey()
  const prevKeyRef = React.useRef(resetKey)

  React.useEffect(() => {
    if (prevKeyRef.current !== resetKey) {
      prevKeyRef.current = resetKey
      cb()
    }
  }, [resetKey, cb])
}

const Drawer = ({
  shouldScaleBackground = true,
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => {
  const [resetKey, setResetKey] = React.useState(0)
  const prevOpenRef = React.useRef<boolean | undefined>(open ?? defaultOpen)

  const handleOpenChange = (nextOpen: boolean) => {
    const wasOpen = prevOpenRef.current
    if (wasOpen && !nextOpen) {
      setResetKey((k) => k + 1)
    }
    prevOpenRef.current = nextOpen

    if (onOpenChange) {
      onOpenChange(nextOpen)
    }
  }

  return (
    <DrawerResetKeyContext.Provider value={resetKey}>
      <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </DrawerResetKeyContext.Provider>
  )
}
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-40 bg-black/80", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

// Side presentation only. vaul does not forward `modal` to Radix, so the dialog's FocusScope
// traps. A non-trapping scope on top of Radix's focus-scope stack pauses it. Mounted one commit
// late: effects run child-first, so a same-commit mount would land under the dialog's scope.
function SideFocusRelease() {
  const [armed, setArmed] = React.useState(false)
  React.useEffect(() => setArmed(true), [])
  if (!armed) return null
  return (
    <FocusScope
      hidden
      onMountAutoFocus={(e) => e.preventDefault()}
      onUnmountAutoFocus={(e) => e.preventDefault()}
    />
  )
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    side?: boolean
  }
>(({ className, children, side = false, ...props }, ref) => {
  const resetKey = useDrawerResetKey()

  if (side) {
    // Docked right, used with modal={false}. DrawerOverlay renders null there but
    // must stay: its rAF is what restores body pointer-events.
    return (
      <DrawerPortal>
        <DrawerOverlay />
        <div className="fixed inset-y-0 right-0 z-50 flex pointer-events-none">
          <DrawerPrimitive.Content
            key={resetKey}
            ref={ref}
            className={cn(
              "relative z-50 flex h-full w-[440px] flex-col min-h-0 overflow-hidden rounded-none border-l bg-background shadow-lg pointer-events-auto",
              className
            )}
            {...props}
          >
            {children}
            <SideFocusRelease />
          </DrawerPrimitive.Content>
        </div>
      </DrawerPortal>
    )
  }

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6">
        <DrawerPrimitive.Content
          key={resetKey}
          ref={ref}
          className={cn(
            "relative z-50 flex w-[720px] max-w-[90vw] max-h-[90vh] flex-col min-h-0 overflow-hidden rounded-xl border bg-background shadow-lg pointer-events-auto",
            className
          )}
          {...props}
        >
          <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
          {children}
        </DrawerPrimitive.Content>
      </div>
    </DrawerPortal>
  )
})
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
