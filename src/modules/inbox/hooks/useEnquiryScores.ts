import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useOrganization } from "@/shared/context/OrganizationContext";

export interface EnquiryScore {
  id: string;
  score: number;
  band: "Converted" | "Hot" | "Warm" | "Cool";
  breakdown: Record<string, number>;
}

export const enquiryScoresKeys = {
  all: ["enquiry-scores"] as const,
  list: (organizationId: string) => ["enquiry-scores", "list", organizationId] as const,
};

async function fetchEnquiryScores(organizationId: string) {
  const { data, error } = await supabase
    .from("enquiry_scores")
    .select("id, score, band, breakdown")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return data as EnquiryScore[];
}

export function useEnquiryScores() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? enquiryScoresKeys.list(organizationId)
      : ["enquiry-scores", "list", "disabled"],
    queryFn: () => fetchEnquiryScores(organizationId!),
    enabled: !!organizationId,
  });
}