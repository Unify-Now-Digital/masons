import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { OrganizationProvider } from "@/shared/context/OrganizationContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        <TooltipProvider>
          {children}
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </OrganizationProvider>
    </QueryClientProvider>
  );
}

