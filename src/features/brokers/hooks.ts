import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { installBrokerDefinitions } from "@/features/brokers/catalog";

export const brokerDefinitionKeys = {
  all: ["broker-definitions"] as const,
};

/** Product metadata, not account state. Shared for the lifetime of the app. */
export function useBrokerDefinitions() {
  return useQuery({
    queryKey: brokerDefinitionKeys.all,
    queryFn: async () => {
      const definitions = await api.brokerDefinitions();
      installBrokerDefinitions(definitions);
      return definitions;
    },
    staleTime: Infinity,
  });
}
