import * as React from "react"

import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    viewportRef?: React.RefObject<HTMLDivElement>
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
    ({ className, children, viewportRef, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("relative overflow-hidden", className)}
            {...props}
        >
            <div
                ref={viewportRef}
                className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            >
                {children}
            </div>
        </div>
    )
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
