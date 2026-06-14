import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";

export function useBackendHealth(pollMs = 5000) {
  return useQuery({
    queryKey: ["backend-health"],
    queryFn: fetchHealth,
    refetchInterval: pollMs,
    retry: 1,
  });
}
