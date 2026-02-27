import React from "react";
import { useRouteError, isRouteErrorResponse, Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle } from "lucide-react";

export function RouteErrorFallback() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);
  const status = isRouteError ? error.status : null;
  const message =
    isRouteError && error.data && typeof error.data === "object" && "message" in error.data
      ? String((error.data as { message?: string }).message)
      : error instanceof Error
        ? error.message
        : "Something went wrong.";

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border bg-card p-6 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <div>
          <h2 className="text-lg font-semibold">
            {status === 403 ? "Access denied" : status === 401 ? "Please sign in" : "Something went wrong"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    </div>
  );
}
