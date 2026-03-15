import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SpeedTestResult } from "../backend.d";
import { useActor } from "./useActor";

export function useGetResults() {
  const { actor, isFetching } = useActor();
  return useQuery<SpeedTestResult[]>({
    queryKey: ["results"],
    queryFn: async () => {
      if (!actor) return [];
      const results = await actor.getResults();
      return [...results]
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
        .slice(0, 10);
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddResult() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      downloadSpeed,
      uploadSpeed,
      ping,
    }: {
      downloadSpeed: number;
      uploadSpeed: number;
      ping: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      await actor.addResult(downloadSpeed, uploadSpeed, ping);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
    },
  });
}
