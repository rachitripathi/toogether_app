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

// Single event fetch by ID
export const useEvent = (eventId: string) => {
  return useQuery({
    queryKey: ["events", eventId], // ← unique key per event
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      return data;
    },
  });
};

// Join request bhejana
export const useJoinRequest = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
    }: {
      eventId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from("events")
        .update({
          request_user_ids: supabase.rpc("array_append", {
            arr: "request_user_ids",
            val: userId,
          }),
        })
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ["events", eventId] });
    },
  });
};
