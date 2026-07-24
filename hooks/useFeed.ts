import { supabase } from "@/utils/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Fetch all events
export const useFeed = () => {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

// Create event
export const useCreateEvent = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (event: any) => {
      const { data, error } = await supabase
        .from("events")
        .insert([event])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] }); // auto refetch feed
    },
  });
};
