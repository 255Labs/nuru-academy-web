import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export interface DuelParticipant {
  id: string;
  room_id: string;
  user_id: string;
  correct_count: number;
  current_question_idx: number;
  finished_at: string | null;
  final_rank: number | null;
}

export interface DuelRoom {
  id: string;
  mode: "1v1" | "group";
  max_players: number;
  quiz_id: string;
  status: "waiting" | "active" | "finished";
  invite_code: string | null;
}

/** Creates a friend-invite room and auto-joins the caller — real RPC,
 * matches create_duel_room() in schema.sql exactly. */
export async function createDuelRoom(supabase: SupabaseClient, mode: "1v1" | "group", quizId: string) {
  const { data, error } = await supabase.rpc("create_duel_room", { p_mode: mode, p_quiz_id: quizId });
  if (error) throw error;
  return data as { room_id: string; invite_code: string; max_players: number };
}

/** Joins an existing room by its real invite code. */
export async function joinDuelRoom(supabase: SupabaseClient, inviteCode: string) {
  const { data, error } = await supabase.rpc("join_duel_room", { p_invite_code: inviteCode });
  if (error) throw error;
  return data as { room_id: string; quiz_id: string };
}

/** Joins the random-matchmaking queue — may return an immediate match if
 * enough players were already waiting, or 'queued' if not. */
export async function queueForRandomDuel(supabase: SupabaseClient, mode: "1v1" | "group", quizId: string) {
  const { data, error } = await supabase.rpc("queue_for_random_duel", { p_mode: mode, p_quiz_id: quizId });
  if (error) throw error;
  return data as { status: "queued" | "matched"; room_id?: string };
}

export async function leaveDuelQueue(supabase: SupabaseClient, mode: "1v1" | "group", quizId: string) {
  await supabase.rpc("leave_duel_queue", { p_mode: mode, p_quiz_id: quizId });
}

/** Submits one answer through the same anti-cheat-tested grading path
 * used everywhere else — write-once per question, server-graded. */
export async function submitDuelAnswer(supabase: SupabaseClient, roomId: string, questionId: string, answer: unknown) {
  const { data, error } = await supabase.rpc("submit_duel_answer", {
    p_room_id: roomId,
    p_question_id: questionId,
    p_answer: answer,
  });
  if (error) throw error;
  return data as { ok: boolean; already_answered: boolean; finished: boolean; rank?: number };
}

export async function getDuelRoom(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.from("duel_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as DuelRoom;
}

export async function getDuelParticipants(supabase: SupabaseClient, roomId: string) {
  const { data, error } = await supabase.from("duel_participants").select("*").eq("room_id", roomId);
  if (error) throw error;
  return (data ?? []) as DuelParticipant[];
}

/**
 * Live opponent sync — subscribes to real Postgres row changes on
 * duel_participants (and optionally duel_rooms) for one room, via
 * Supabase Realtime. Requires both tables to be added to the
 * `supabase_realtime` publication (see schema.sql) — without that this
 * connects successfully but silently never receives an event, which is
 * exactly why that publication step is called out explicitly there.
 *
 * Returns an unsubscribe function — always call it on unmount, or the
 * channel keeps an open websocket alive after the component is gone.
 */
export function subscribeDuelRoom(
  supabase: SupabaseClient,
  roomId: string,
  onParticipantsChange: () => void,
  onRoomChange?: () => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`duel-room-${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "duel_participants", filter: `room_id=eq.${roomId}` },
      onParticipantsChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "duel_rooms", filter: `id=eq.${roomId}` },
      () => onRoomChange?.()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
