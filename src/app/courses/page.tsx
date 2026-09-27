"use client";

import { useState } from "react";
import {
  Lock, Medal, Play, Swords, BookOpen, FileText,
  Video, Zap, CheckCircle2, Star,
  CreditCard, Sparkles, X, ChevronDown,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { TopBar } from "@/components/TopBar";
import { JourneyMap } from "@/components/JourneyMap";
import { LevelPlayer } from "@/components/LevelPlayer";
import { PurchaseTrackModal } from "@/components/PurchaseTrackModal";
import { MissionQuestModal } from "@/components/MissionQuestModal";
import { ProtectedVideoPlayer } from "@/components/ProtectedVideoPlayer";
import { Nuru } from "@/components/Nuru";
import { createClient } from "@/lib/supabase/client";
import { useTracks } from "@/lib/curriculum-db";
import { useGameStore, isTrackUnlocked } from "@/lib/store";
import type { TrackId } from "@/lib/store";
import type { JourneyNode, Lesson, DailyChallenge } from "@/lib/types";

import type { CourseModule } from "@/lib/types";

// ── Embedded course cover images (SVG, no Unsplash dependency) ────────────────
const TRACK_COVER: Record<string, string> = {
  beginner:     "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImJlZ2lubmVyIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmcxIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBEMkU2RSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxQTREQjUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Im9yYjEiIGN4PSI3MCUiIGN5PSIzMCUiIHI9IjQ1JSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2MEE1RkEiIHN0b3Atb3BhY2l0eT0iMC4yNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2MEE1RkEiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjYmcxKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjEpIi8+CiAgPCEtLSBHcmlkIGRvdHMgLS0+CiAgPGcgZmlsbD0iIzYwQTVGQSIgb3BhY2l0eT0iMC4xNSI+CiAgICA8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNjAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMTAwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSIxNDAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMTgwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI2MCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMTAwIiB5PSI2MCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjE0MCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjEwMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjYwIiB5PSIxMDAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjE0MCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICA8L2c+CiAgPCEtLSBEZWNvcmF0aXZlIGNpcmNsZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDkwIiBjeT0iNTUiIHI9IjkwIiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xOCIvPgogIDxjaXJjbGUgY3g9IjQ5MCIgY3k9IjU1IiByPSI2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjBBNUZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMTMiLz4KICA8Y2lyY2xlIGN4PSI0OTAiIGN5PSI1NSIgcj0iMzIiIGZpbGw9IiMzQjgyRjYiIG9wYWNpdHk9IjAuMTgiLz4KICA8IS0tIFBlcnNvbiBhdCBsYXB0b3AgKGZyb250LWZhY2luZywgbGVhcm5pbmcpIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMzMCwgNTApIj4KICAgIDwhLS0gVGFibGUgc3VyZmFjZSAtLT4KICAgIDxyZWN0IHg9Ii0yMCIgeT0iMTkwIiB3aWR0aD0iMjcwIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iIzFFM0E2RSIgb3BhY2l0eT0iMC42Ii8+CiAgICA8IS0tIExhcHRvcCBzY3JlZW4gLS0+CiAgICA8cmVjdCB4PSIzMCIgeT0iODAiIHdpZHRoPSIxODAiIGhlaWdodD0iMTEwIiByeD0iNyIgZmlsbD0iIzBBMUEzRSIgc3Ryb2tlPSIjM0I4MkY2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC45NSIvPgogICAgPCEtLSBTY3JlZW4gY29udGVudDogIkhlbGxvIEFJIiBwcm9tcHQgLS0+CiAgICA8cmVjdCB4PSI0NCIgeT0iOTgiIHdpZHRoPSI0MCIgaGVpZ2h0PSI1IiByeD0iMiIgZmlsbD0iIzkzQzVGRCIgb3BhY2l0eT0iMC44Ii8+CiAgICA8cmVjdCB4PSI0NCIgeT0iMTEwIiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjQiIHJ4PSIyIiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjQiLz4KICAgIDxyZWN0IHg9IjQ0IiB5PSIxMjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiMzQjgyRjYiIG9wYWNpdHk9IjAuNCIvPgogICAgPHJlY3QgeD0iNTQiIHk9IjEzMCIgd2lkdGg9Ijc1IiBoZWlnaHQ9IjQiIHJ4PSIyIiBmaWxsPSIjNjBBNUZBIiBvcGFjaXR5PSIwLjUiLz4KICAgIDxyZWN0IHg9IjU0IiB5PSIxNDAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC4zNSIvPgogICAgPHJlY3QgeD0iNDQiIHk9IjE1MCIgd2lkdGg9IjExNSIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cmVjdCB4PSI0NCIgeT0iMTYwIiB3aWR0aD0iNjAiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiM5M0M1RkQiIG9wYWNpdHk9IjAuNiIvPgogICAgPHJlY3QgeD0iMTEzIiB5PSIxNjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjQiIHJ4PSIxIiBmaWxsPSIjOTNDNUZEIi8+CiAgICA8IS0tIExhcHRvcCBiYXNlIC0tPgogICAgPHJlY3QgeD0iMjAiIHk9IjE5MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSI5IiByeD0iMyIgZmlsbD0iIzBBMUEzRSIgc3Ryb2tlPSIjM0I4MkY2IiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgPHJlY3QgeD0iODUiIHk9IjE5OSIgd2lkdGg9IjcwIiBoZWlnaHQ9IjUiIHJ4PSIyIiBmaWxsPSIjMEExQTNFIiBzdHJva2U9IiMzQjgyRjYiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC40Ii8+CiAgPC9nPgogIDwhLS0gUGVyc29uIHNpbGhvdWV0dGUgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjgwLCA5NSkiPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiMyNTYzRUIiIG9wYWNpdHk9IjAuNTUiLz4KICAgIDxwYXRoIGQ9Ik0yIDQyIFEyMCAzMCAzOCA0MiBMNDIgMTAwIEwtMiAxMDAgWiIgZmlsbD0iIzI1NjNFQiIgb3BhY2l0eT0iMC40NSIvPgogICAgPHBhdGggZD0iTTM0IDU1IFE1MiA2NSA2MCA4OCIgc3Ryb2tlPSIjMjU2M0VCIiBzdHJva2Utd2lkdGg9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC40NSIvPgogIDwvZz4KICA8IS0tIEJyYWluL2xpZ2h0YnVsYiBpY29uIHRvcCByaWdodCAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1MjgsIDMyKSI+CiAgICA8Y2lyY2xlIGN4PSIyOCIgY3k9IjI4IiByPSIyNCIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC4xMiIgc3Ryb2tlPSIjNjBBNUZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMjUiLz4KICAgIDx0ZXh0IHg9IjI4IiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTNDNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBvcGFjaXR5PSIwLjgiPvCfkqE8L3RleHQ+CiAgPC9nPgogIDwhLS0gVGV4dCAtLT4KICA8dGV4dCB4PSI0MCIgeT0iODgiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIxMSIgZmlsbD0iIzkzQzVGRCIgbGV0dGVyLXNwYWNpbmc9IjMiIG9wYWNpdHk9IjAuODUiPkJFR0lOTkVSIFRSQUNLPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxMzIiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIzOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGRkZGRkYiPkZvdW5kYXRpb25zPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNjIiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0JGREJGRSIgb3BhY2l0eT0iMC45Ij5BSSBmb3IgRXZlcnlvbmUg4oCUIG5vIGV4cGVyaWVuY2UgbmVlZGVkLjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTgwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNCRkRCRkUiIG9wYWNpdHk9IjAuNyI+U3RhcnQgbGVhcm5pbmcgQUkgZnJvbSBzY3JhdGNoLCBzdGVwIGJ5IHN0ZXAuPC90ZXh0PgogIDwhLS0gQmFkZ2UgLS0+CiAgPHJlY3QgeD0iNDAiIHk9IjIwNSIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIyOCIgcng9IjE0IiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjI1Ii8+CiAgPHJlY3QgeD0iNDAiIHk9IjIwNSIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIyOCIgcng9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC41NSIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iMjI0IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjOTNDNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+RlJFRSBGSVJTVCBMRVNTT048L3RleHQ+CiAgPHJlY3QgeD0iMCIgeT0iMjkwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjM1Ii8+Cjwvc3ZnPg==",
  intermediate: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImludGVybWVkaWF0ZSI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnMiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxQTBBM0IiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMkQxMDYwIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJvcmIyYSIgY3g9Ijc1JSIgY3k9IjI1JSIgcj0iNDUlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzhCNUNGNiIgc3RvcC1vcGFjaXR5PSIwLjMiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjOEI1Q0Y2IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Im9yYjJiIiBjeD0iMzAlIiBjeT0iODAlIiByPSIzNSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNjM2NkYxIiBzdG9wLW9wYWNpdHk9IjAuMiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2MzY2RjEiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjYmcyKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjJhKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjJiKSIvPgogIDwhLS0gTmV1cmFsIG5ldHdvcmsgKyBhdXRvbWF0aW9uIGZsb3cgLS0+CiAgPCEtLSBJbnB1dCBub2RlcyAtLT4KICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSI4MCIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC43Ii8+CiAgPGNpcmNsZSBjeD0iMzQwIiBjeT0iMTI1IiByPSI5IiBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjciLz4KICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIxNzAiIHI9IjkiIGZpbGw9IiM4QjVDRjYiIG9wYWNpdHk9IjAuNyIvPgogIDxjaXJjbGUgY3g9IjM0MCIgY3k9IjIxNSIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC43Ii8+CiAgPCEtLSBIaWRkZW4gbm9kZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDI1IiBjeT0iMTAwIiByPSIxMSIgZmlsbD0iI0E3OEJGQSIgb3BhY2l0eT0iMC44NSIvPgogIDxjaXJjbGUgY3g9IjQyNSIgY3k9IjE1MCIgcj0iMTEiIGZpbGw9IiNBNzhCRkEiIG9wYWNpdHk9IjAuODUiLz4KICA8Y2lyY2xlIGN4PSI0MjUiIGN5PSIyMDAiIHI9IjExIiBmaWxsPSIjQTc4QkZBIiBvcGFjaXR5PSIwLjg1Ii8+CiAgPCEtLSBPdXRwdXQgbm9kZSAtLT4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSIxNTAiIHI9IjE0IiBmaWxsPSIjQzRCNUZEIiBvcGFjaXR5PSIwLjkiLz4KICA8IS0tIENvbm5lY3Rpb25zIGluLWhpZGRlbiAtLT4KICA8ZyBzdHJva2U9IiM4QjVDRjYiIHN0cm9rZS13aWR0aD0iMC44IiBvcGFjaXR5PSIwLjMiPgogICAgPGxpbmUgeDE9IjM0OSIgeTE9IjgwIiB4Mj0iNDE0IiB5Mj0iMTAwIi8+CiAgICA8bGluZSB4MT0iMzQ5IiB5MT0iODAiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIxMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxNzAiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxNzAiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIyMTUiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIyMTUiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICA8L2c+CiAgPCEtLSBDb25uZWN0aW9ucyBoaWRkZW4tb3V0cHV0IC0tPgogIDxnIHN0cm9rZT0iI0E3OEJGQSIgc3Ryb2tlLXdpZHRoPSIxLjIiIG9wYWNpdHk9IjAuNSI+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMTAwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMTUwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMjAwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgPC9nPgogIDwhLS0gSGlnaGxpZ2h0ZWQgYWN0aXZlIHBhdGggLS0+CiAgPGxpbmUgeDE9IjM0OSIgeTE9IjEyNSIgeDI9IjQxNCIgeTI9IjE1MCIgc3Ryb2tlPSIjQzRCNUZEIiBzdHJva2Utd2lkdGg9IjIuMiIgb3BhY2l0eT0iMC44NSIvPgogIDxsaW5lIHgxPSI0MzYiIHkxPSIxNTAiIHgyPSI0OTYiIHkyPSIxNTAiIHN0cm9rZT0iI0M0QjVGRCIgc3Ryb2tlLXdpZHRoPSIyLjIiIG9wYWNpdHk9IjAuODUiLz4KICA8IS0tIEJ1c2luZXNzIGF1dG9tYXRpb24gaWNvbnMgLS0+CiAgPCEtLSBHZWFyIGljb24gLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNTUyLCA0MikiIG9wYWNpdHk9IjAuNSI+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQTc4QkZBIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4zIiBzdHJva2U9IiNBNzhCRkEiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPHJlY3QgeD0iMTciIHk9IjIiIHdpZHRoPSI2IiBoZWlnaHQ9IjciIHJ4PSIyIiBmaWxsPSIjQTc4QkZBIi8+CiAgICA8cmVjdCB4PSIxNyIgeT0iMzEiIHdpZHRoPSI2IiBoZWlnaHQ9IjciIHJ4PSIyIiBmaWxsPSIjQTc4QkZBIi8+CiAgICA8cmVjdCB4PSIyIiB5PSIxNyIgd2lkdGg9IjciIGhlaWdodD0iNiIgcng9IjIiIGZpbGw9IiNBNzhCRkEiLz4KICAgIDxyZWN0IHg9IjMxIiB5PSIxNyIgd2lkdGg9IjciIGhlaWdodD0iNiIgcng9IjIiIGZpbGw9IiNBNzhCRkEiLz4KICA8L2c+CiAgPCEtLSBIZXhhZ29uIHdpdGggQUkgdGV4dCAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NDMsIDIzMCkiPgogICAgPHBvbHlnb24gcG9pbnRzPSIyNywwIDU0LDE1IDU0LDQ2IDI3LDYxIDAsNDYgMCwxNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1Q0Y2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cG9seWdvbiBwb2ludHM9IjI3LDggNDYsMTkgNDYsNDIgMjcsNTMgOCw0MiA4LDE5IiBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjE1Ii8+CiAgICA8dGV4dCB4PSIyNyIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiIG9wYWNpdHk9IjAuODUiPkFJPC90ZXh0PgogIDwvZz4KICA8IS0tIERvdHMgZ3JpZCAtLT4KICA8ZyBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjE4Ij4KICAgIDxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI1NSIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI5MCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMTI1IiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjIwIiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI1NSIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI5MCIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iNTUiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogIDwvZz4KICA8IS0tIFRleHQgLS0+CiAgPHRleHQgeD0iNDAiIHk9IjkwIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZpbGw9IiNBNzhCRkEiIGxldHRlci1zcGFjaW5nPSIzIiBvcGFjaXR5PSIwLjg1Ij5JTlRFUk1FRElBVEUgVFJBQ0s8L3RleHQ+CiAgPHRleHQgeD0iNDAiIHk9IjEzMiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZGRkZGRiI+QUk8L3RleHQ+CiAgPHRleHQgeD0iODUiIHk9IjEzMiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0M0QjVGRCI+IEZvdW5kYXRpb25zPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNzAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0RERDZGRSIgb3BhY2l0eT0iMC44NSI+QUkgJmFtcDsgQnVzaW5lc3MgQXV0b21hdGlvbjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTkwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNDNEI1RkQiIG9wYWNpdHk9IjAuNjUiPlVzZSBBSSB0byBncm93IGFuZCBhdXRvbWF0ZSB5b3VyIGJ1c2luZXNzLjwvdGV4dD4KICA8IS0tIEJhZGdlIC0tPgogIDxyZWN0IHg9IjQwIiB5PSIyMTgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4yMiIvPgogIDxyZWN0IHg9IjQwIiB5PSIyMTgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQTc4QkZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNTUiLz4KICA8dGV4dCB4PSIxMDUiIHk9IjIzNyIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjEiPkZSRUUgRklSU1QgTEVTU09OPC90ZXh0PgogIDxyZWN0IHg9IjAiIHk9IjI5MCIgd2lkdGg9IjYwMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4zNSIvPgo8L3N2Zz4=",
  expert:       "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImV4cGVydCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnMyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMzRDEyMDAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjN0MyRDBEIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJvcmIzIiBjeD0iNzAlIiBjeT0iMzUlIiByPSI0NSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRkI5MjNDIiBzdG9wLW9wYWNpdHk9IjAuMyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNGQjkyM0MiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ib3JiM2IiIGN4PSIyMCUiIGN5PSI3NSUiIHI9IjMwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGOTczMTYiIHN0b3Atb3BhY2l0eT0iMC4yIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0Y5NzMxNiIgc3RvcC1vcGFjaXR5PSIwIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNiZzMpIi8+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjb3JiMykiLz4KICA8cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNvcmIzYikiLz4KICA8IS0tIEhvdXNlIC8gcHJvcGVydHkgaWxsdXN0cmF0aW9uIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMxMCwgMjApIj4KICAgIDwhLS0gSG91c2UgMSAobGFyZ2UsIG1haW4pIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzAsIDQwKSI+CiAgICAgIDwhLS0gUm9vZiAtLT4KICAgICAgPHBvbHlnb24gcG9pbnRzPSI3MCwwIDE0MCw1NSAwLDU1IiBmaWxsPSIjNUMxQTAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMS41IiBvcGFjaXR5PSIwLjkiLz4KICAgICAgPCEtLSBDaGltbmV5IC0tPgogICAgICA8cmVjdCB4PSIxMDAiIHk9IjgiIHdpZHRoPSIxNCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzRBMTUwMCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgICA8IS0tIFdhbGxzIC0tPgogICAgICA8cmVjdCB4PSIxMCIgeT0iNTUiIHdpZHRoPSIxMjAiIGhlaWdodD0iOTUiIGZpbGw9IiM0NTEyMDAiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIxLjIiIG9wYWNpdHk9IjAuOSIvPgogICAgICA8IS0tIERvb3IgLS0+CiAgICAgIDxyZWN0IHg9IjUyIiB5PSIxMDAiIHdpZHRoPSIzNiIgaGVpZ2h0PSI1MCIgcng9IjE4IiBmaWxsPSIjNUMxQTAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC44Ii8+CiAgICAgIDxjaXJjbGUgY3g9IjgyIiBjeT0iMTI2IiByPSIzIiBmaWxsPSIjRkI5MjNDIiBvcGFjaXR5PSIwLjgiLz4KICAgICAgPCEtLSBXaW5kb3dzIC0tPgogICAgICA8cmVjdCB4PSIxOCIgeT0iNjgiIHdpZHRoPSIzMiIgaGVpZ2h0PSIyNiIgcng9IjMiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMTUiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIxIi8+CiAgICAgIDxsaW5lIHgxPSIxOCIgeTE9IjgxIiB4Mj0iNTAiIHkyPSI4MSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxsaW5lIHgxPSIzNCIgeTE9IjY4IiB4Mj0iMzQiIHkyPSI5NCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxyZWN0IHg9IjkwIiB5PSI2OCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjI2IiByeD0iMyIgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC4xNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiLz4KICAgICAgPGxpbmUgeDE9IjkwIiB5MT0iODEiIHgyPSIxMjIiIHkyPSI4MSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxsaW5lIHgxPSIxMDYiIHkxPSI2OCIgeDI9IjEwNiIgeTI9Ijk0IiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMC44IiBvcGFjaXR5PSIwLjQiLz4KICAgIDwvZz4KICAgIDwhLS0gSG91c2UgMiAoc21hbGxlciwgcmlnaHQpIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg1LCA5MCkiPgogICAgICA8cG9seWdvbiBwb2ludHM9IjQ4LDAgOTYsMzggMCwzOCIgZmlsbD0iIzVDMUEwMCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgICA8cmVjdCB4PSI4IiB5PSIzOCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjYyIiBmaWxsPSIjNDUxMjAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC43Ii8+CiAgICAgIDxyZWN0IHg9IjM0IiB5PSI2NSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjM1IiByeD0iMTIiIGZpbGw9IiM1QzFBMDAiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIwLjgiIG9wYWNpdHk9IjAuNiIvPgogICAgICA8cmVjdCB4PSIxMiIgeT0iNDYiIHdpZHRoPSIyMiIgaGVpZ2h0PSIxOCIgcng9IjIiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgICA8cmVjdCB4PSI1OCIgeT0iNDYiIHdpZHRoPSIyMiIgaGVpZ2h0PSIxOCIgcng9IjIiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPC9nPgogICAgPCEtLSBTdGFycyAvIHJldmlldyBpbmRpY2F0b3JzIC0tPgogICAgPGcgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC44NSI+CiAgICAgIDx0ZXh0IHg9IjMwIiB5PSIxNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCI+4piF4piF4piF4piF4piFPC90ZXh0PgogICAgPC9nPgogICAgPHRleHQgeD0iMzAiIHk9IjE5NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjkiIGZpbGw9IiNGRUQ3QUEiIG9wYWNpdHk9IjAuNiIgbGV0dGVyLXNwYWNpbmc9IjEiPjQuOSDCtyAzMTIgUkVWSUVXUzwvdGV4dD4KICAgIDwhLS0gTG9jYXRpb24gcGluIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjI4LCAzNikiIG9wYWNpdHk9IjAuNyI+CiAgICAgIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjEwIiBmaWxsPSIjRjk3MzE2IiBvcGFjaXR5PSIwLjI1IiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICAgIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjQiIGZpbGw9IiNGQjkyM0MiLz4KICAgICAgPGxpbmUgeDE9IjEyIiB5MT0iMjAiIHgyPSIxMiIgeTI9IjMwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgICA8L2c+CiAgPC9nPgogIDwhLS0gQm9va2luZy5jb20gLyBwbGF0Zm9ybSBpY29ucyAocGlsbCBiYWRnZXMpIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMxMCwgMjI1KSI+CiAgICA8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iNzAiIGhlaWdodD0iMjAiIHJ4PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPHRleHQgeD0iMzUiIHk9IjE0IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOSIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGRUQ3QUEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSIwLjUiPkFJUkJOQjwvdGV4dD4KICAgIDxyZWN0IHg9Ijc4IiB5PSIwIiB3aWR0aD0iODAiIGhlaWdodD0iMjAiIHJ4PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPHRleHQgeD0iMTE4IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjkiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjRkVEN0FBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5CT09LSU5HLkNPTTwvdGV4dD4KICA8L2c+CiAgPCEtLSBEb3RzIHBhdHRlcm4gLS0+CiAgPGcgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC4xMiI+CiAgICA8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNTUiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iOTAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPjxyZWN0IHg9IjEyNSIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSIxNjAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPjxyZWN0IHg9IjIwIiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjU1IiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI5MCIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSIyMCIgeT0iOTAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNTUiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMjAiIHk9IjEyNSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICA8L2c+CiAgPCEtLSBUZXh0IC0tPgogIDx0ZXh0IHg9IjQwIiB5PSI4OCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjExIiBmaWxsPSIjRkI5MjNDIiBsZXR0ZXItc3BhY2luZz0iMyIgb3BhY2l0eT0iMC45Ij5FWFBFUlQgVFJBQ0s8L3RleHQ+CiAgPHRleHQgeD0iNDAiIHk9IjEyNSIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjI4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZGRkZGRiI+R2V0dGluZyBTdGFydGVkPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNTgiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGQjkyM0MiPm9uIEFpcmJuYjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTg4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNGRUQ3QUEiIG9wYWNpdHk9IjAuOCI+TGlzdCwgcHJpY2UgJmFtcDsgb3BlcmF0ZSB5b3VyIHByb3BlcnR5PC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIyMDYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZmlsbD0iI0ZFRDdBQSIgb3BhY2l0eT0iMC44Ij5saWtlIGEgcHJvIG9uIEFpcmJuYiAmYW1wOyBCb29raW5nLmNvbS48L3RleHQ+CiAgPCEtLSBCYWRnZSAtLT4KICA8cmVjdCB4PSI0MCIgeT0iMjI4IiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjI4IiByeD0iMTQiIGZpbGw9IiNGOTczMTYiIG9wYWNpdHk9IjAuMiIvPgogIDxyZWN0IHg9IjQwIiB5PSIyMjgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNTUiLz4KICA8dGV4dCB4PSIxMDUiIHk9IjI0NyIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZFRDdBQSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjEiPkZSRUUgRklSU1QgTEVTU09OPC90ZXh0PgogIDxyZWN0IHg9IjAiIHk9IjI5MCIgd2lkdGg9IjYwMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4zNSIvPgo8L3N2Zz4=",
};

function nodesOf(mod: CourseModule): JourneyNode[] {
  return [
    ...mod.lessons.map((l) => ({ ...l, kind: "lesson" as const })),
    ...(mod.quiz ? [{ kind: "quest" as const, title: "Mission Quest", quest: mod.quiz }] : []),
  ];
}

function isAdvancedModule(moduleIdx: number) {
  return moduleIdx > 0;
}

type LearningTab = "lesson" | "video" | "notes" | "challenge";

const TAB_META: { id: LearningTab; label: string; icon: typeof BookOpen }[] = [
  { id: "lesson",    label: "Lesson",          icon: BookOpen },
  { id: "video",     label: "Video Tutorial",  icon: Video },
  { id: "notes",     label: "Notes",           icon: FileText },
  { id: "challenge", label: "Daily Challenge", icon: Zap },
];

function DailyChallengePanel({
  challenge, tone, lessonTitle, onComplete,
}: {
  challenge: DailyChallenge;
  tone: string;
  lessonTitle: string;
  onComplete: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | string | null>(null);
  const [shortVal, setShortVal] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [claimed, setClaimed] = useState(false);

  function submit() {
    if (challenge.type === "mcq" && picked === null) return;
    if (challenge.type === "short" && !shortVal.trim()) return;
    setRevealed(true);
  }

  const isCorrect = challenge.type === "mcq"
    ? picked === challenge.correct
    : typeof challenge.correct === "string"
      ? shortVal.trim().toLowerCase().includes(challenge.correct.toLowerCase())
      : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 p-4 rounded-2xl border-2" style={{ borderColor: tone, background: `${tone}0C` }}>
        <Zap size={20} style={{ color: tone }} className="shrink-0" />
        <div>
          <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: tone }}>
            Daily Challenge · {lessonTitle}
          </div>
          <div className="text-xs text-nuru-muted mt-0.5">Answer correctly to earn +{challenge.xpReward} bonus XP</div>
        </div>
      </div>

      <div className="bg-nuru-card rounded-2xl p-5 border border-nuru-line shadow-card">
        <p className="font-semibold text-nuru-ink text-base leading-relaxed mb-4">{challenge.question}</p>

        {challenge.hint && !revealed && (
          <p className="text-xs text-nuru-muted italic mb-3">💡 Hint: {challenge.hint}</p>
        )}

        {challenge.type === "mcq" && challenge.options && (
          <div className="flex flex-col gap-2 mb-4">
            {challenge.options.map((opt, i) => {
              let cls = "border-nuru-line bg-nuru-bg text-nuru-ink hover:border-nuru-purple/40";
              if (revealed) {
                if (i === challenge.correct) cls = "border-nuru-green bg-green-50 text-nuru-green font-bold";
                else if (i === picked) cls = "border-nuru-rose bg-red-50 text-nuru-rose";
                else cls = "border-nuru-line bg-nuru-bg text-nuru-muted opacity-50";
              } else if (picked === i) {
                cls = "border-nuru-purple bg-nuru-lav text-nuru-ink";
              }
              return (
                <button
                  key={i}
                  onClick={() => !revealed && setPicked(i)}
                  disabled={revealed}
                  className={`text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {challenge.type === "short" && (
          <div className="mb-4">
            <input
              value={shortVal}
              onChange={(e) => setShortVal(e.target.value)}
              disabled={revealed}
              placeholder="Type your answer…"
              maxLength={200}
              className="w-full bg-nuru-bg border-2 border-nuru-line rounded-xl px-4 py-3 text-sm outline-none focus:border-nuru-purple transition-colors disabled:opacity-60"
            />
          </div>
        )}

        {!revealed ? (
          <button
            onClick={submit}
            className="w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: tone }}
          >
            Submit Answer
          </button>
        ) : (
          <div className={`rounded-xl p-4 mb-3 ${isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <div className={`font-bold text-sm mb-1 ${isCorrect ? "text-nuru-green" : "text-nuru-rose"}`}>
              {isCorrect ? "✓ Correct!" : "✗ Not quite"}
            </div>
            {challenge.hint && (
              <p className="text-xs text-nuru-ink2 leading-relaxed">
                {isCorrect ? `Great work. ${challenge.hint}` : `The answer: ${challenge.correct}. ${challenge.hint}`}
              </p>
            )}
            {!claimed && (
              <button
                onClick={() => { setClaimed(true); onComplete(isCorrect); }}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold"
                style={{ background: tone }}
              >
                <Sparkles size={14} />
                {isCorrect ? `Claim +${challenge.xpReward} XP` : "Continue"}
              </button>
            )}
            {claimed && <p className="text-xs font-semibold text-nuru-purple mt-2">✓ Reward claimed</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function NotesPanel({ lesson, tone }: { lesson: Lesson; tone: string }) {
  const notes = lesson.notes ?? [
    `# ${lesson.title}`,
    ``,
    `**Objective:** ${lesson.objective}`,
    ``,
    `## ${lesson.block1.topic}`,
    ...lesson.block1.points.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## ${lesson.block2.topic}`,
    ...lesson.block2.points.map((p, i) => `${i + 1}. ${p}`),
    ...(lesson.demo ? [``, `## Try It`, lesson.demo] : []),
    ...(lesson.homework ? [``, `## Homework`, lesson.homework] : []),
  ].join("\n");

  function renderNotes(md: string) {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h1 key={i} className="font-display font-extrabold text-xl text-nuru-ink mb-2">{line.slice(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="font-bold text-base mt-4 mb-2" style={{ color: tone }}>{line.slice(3)}</h2>;
      }
      if (/^\d+\.\s/.test(line)) {
        const [num, ...rest] = line.split(". ");
        return (
          <div key={i} className="flex gap-2.5 mb-2">
            <span className="w-5 h-5 rounded-full grid place-items-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: tone }}>
              {num}
            </span>
            <p className="text-sm text-nuru-ink2 leading-relaxed">{renderInline(rest.join(". "))}</p>
          </div>
        );
      }
      if (line === "") return <div key={i} className="h-1" />;
      return <p key={i} className="text-sm text-nuru-ink2 leading-relaxed mb-1.5">{renderInline(line)}</p>;
    });
  }

  function renderInline(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} className="font-semibold text-nuru-ink">{p}</strong>
        : p
    );
  }

  return (
    <div className="bg-nuru-card rounded-2xl p-6 border border-nuru-line shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color: tone }}>
          Study Notes · Day {lesson.day}
        </div>
        <button
          onClick={() => {
            const blob = new Blob([notes], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `${lesson.title.replace(/\s+/g, "-")}-notes.txt`; a.click();
          }}
          className="text-xs font-semibold text-nuru-purple hover:underline flex items-center gap-1"
        >
          <FileText size={12} /> Download notes
        </button>
      </div>
      <div className="prose-nuru space-y-0.5">{renderNotes(notes)}</div>
    </div>
  );
}

function AdvancedPaywall({
  trackName, priceTZS, tone,
  onUnlock, onClose,
}: {
  trackName: string; priceTZS: string; tone: string;
  onUnlock: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-nuru-ink/70 backdrop-blur-sm grid place-items-center p-5" onClick={onClose}>
      <div className="bg-nuru-card rounded-3xl w-full max-w-md p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-nuru-lav grid place-items-center text-nuru-muted hover:text-nuru-ink">
          <X size={15} />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl grid place-items-center mb-4" style={{ background: `${tone}18` }}>
            <Lock size={28} style={{ color: tone }} />
          </div>
          <h2 className="font-display font-extrabold text-xl text-nuru-ink mb-2">Advanced Content</h2>
          <p className="text-sm text-nuru-muted leading-relaxed mb-1">
            Modules 2–5 of <strong>{trackName}</strong> are included in the full course.
          </p>
          <p className="text-sm text-nuru-muted leading-relaxed mb-5">
            Unlock everything — videos, notes, daily challenges, and all Mission Quests — for:
          </p>
          <div className="bg-nuru-lav rounded-2xl px-6 py-4 mb-6 w-full">
            <div className="font-display font-extrabold text-3xl text-nuru-ink">TZS {priceTZS}</div>
            <div className="text-xs text-nuru-muted mt-1">One-time · All 5 weeks included · Mobile money (M-Pesa, Tigo, Airtel, HaloPesa)</div>
          </div>
          <div className="space-y-2 text-left w-full mb-6">
            {[
              "All 5 modules · 25 lessons",
              "Protected video tutorials",
              "Printable study notes",
              "Daily challenge XP bonuses",
              "4 more Mission Quests",
              "Certificate of completion",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-nuru-ink">
                <CheckCircle2 size={15} className="text-nuru-green shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <button
            onClick={onUnlock}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-bold text-base"
            style={{ background: tone }}
          >
            <CreditCard size={18} /> Unlock Full Course
          </button>
          <button onClick={onClose} className="mt-3 text-xs text-nuru-muted hover:text-nuru-ink transition-colors">
            Continue with Week 1 (free preview)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { tracks: TRACKS } = useTracks();
  const activeTrack        = useGameStore((s) => s.activeTrack);
  const setActiveTrack     = useGameStore((s) => s.setActiveTrack);
  const activeModuleIdx    = useGameStore((s) => {
    const idx = s.activeModuleIdx;
    return (typeof idx === "object" && idx !== null)
      ? ((idx as Record<string, number>)[activeTrack] ?? 0)
      : 0;
  });
  const setActiveModuleIdx = useGameStore((s) => s.setActiveModuleIdx);
  const progress           = useGameStore((s) => s.progress[activeTrack]);
  const completeLesson     = useGameStore((s) => s.completeLesson);
  const passMission        = useGameStore((s) => s.passMission);
  const missionsPassed     = useGameStore((s) => s.missionsPassed);
  const purchasedTracks    = useGameStore((s) => s.purchasedTracks);
  const advanceQuest       = useGameStore((s) => s.advanceQuest);
  const claimQuestReward   = useGameStore((s) => s.claimQuestReward);
  const loadTodayQuests    = useGameStore((s) => s.loadTodayQuests);
  const logStudyMinutes    = useGameStore((s) => s.logStudyMinutes);

  const [lessonOpen, setLessonOpen]     = useState<{ lesson: Lesson; done?: boolean } | null>(null);
  const [activeTab, setActiveTab]       = useState<LearningTab>("lesson");
  const [purchaseTarget, setPurchaseTarget] = useState<{
    id: string; name: string; priceTZS: string; tone: string;
  } | null>(null);
  const [showPaywall, setShowPaywall]   = useState(false);
  const [questOpen, setQuestOpen]       = useState(false);

  if (!TRACKS || TRACKS.length === 0) {
    return (
      <Shell>
        <TopBar title="My Courses" subtitle="Loading…" />
        <div className="flex items-center justify-center py-20 text-nuru-muted text-sm">Loading courses…</div>
      </Shell>
    );
  }

  const track = TRACKS.find((t) => t.id === activeTrack) ?? TRACKS[0];
  if (!track) {
    return (
      <Shell>
        <TopBar title="My Courses" subtitle="Loading…" />
        <div className="flex items-center justify-center py-20 text-nuru-muted text-sm">Loading courses…</div>
      </Shell>
    );
  }
  const safeModuleIdx = Math.min(activeModuleIdx, track.modules.length - 1);
  const mod   = track.modules[safeModuleIdx];
  const nodes = nodesOf(mod);
  const cur   = Math.min(progress, nodes.length);

  const isTrackPaid = isTrackUnlocked(activeTrack, missionsPassed, purchasedTracks);
  const moduleGated = isAdvancedModule(activeModuleIdx) && !isTrackPaid;

  const curNode   = nodes[Math.min(cur, nodes.length - 1)];
  const isQuestUp = curNode?.kind === "quest";

  function onNode(i: number, status: "done" | "current" | "locked", node: JourneyNode) {
    if (status === "locked") return;
    if (node.kind === "quest") {
      if (moduleGated) { setShowPaywall(true); return; }
      if (status === "current") setQuestOpen(true);
    } else {
      if (moduleGated) { setShowPaywall(true); return; }
      setLessonOpen({ lesson: node, done: status === "done" });
      setActiveTab("lesson");
    }
  }

  function openCurrent() {
    if (!curNode) return;
    if (moduleGated) { setShowPaywall(true); return; }
    if (curNode.kind === "quest") setQuestOpen(true);
    else { setLessonOpen({ lesson: curNode, done: false }); setActiveTab("lesson"); }
  }

  function selectModule(idx: number) {
    const advanced = isAdvancedModule(idx);
    const unlocked = isTrackUnlocked(activeTrack, missionsPassed, purchasedTracks);
    const canOpen  = idx === 0 || missionsPassed[`${activeTrack}:${track.modules[idx - 1].id}`] || idx <= activeModuleIdx;
    if (!canOpen) return;
    if (advanced && !unlocked) { setShowPaywall(true); return; }
    setActiveModuleIdx(activeTrack, idx);
  }

  return (
    <Shell>
      <TopBar title="My Courses" subtitle="Choose a course and pick up where you left off." />

      {/* ── Course picker — stacked cards, each visually self-contained ── */}
      <div className="flex flex-col gap-3 mb-6">
        {TRACKS.map((t) => {
          const isActive = t.id === activeTrack;
          const unlocked = isTrackUnlocked(t.id as TrackId, missionsPassed, purchasedTracks);
          const cover    = TRACK_COVER[t.id] ?? TRACK_COVER.beginner;

          return (
            <div
              key={t.id}
              className={`rounded-2xl border overflow-hidden transition-all ${
                isActive
                  ? "border-transparent shadow-pop ring-2"
                  : "border-nuru-line bg-nuru-card shadow-card cursor-pointer hover:border-nuru-purple/30"
              }`}
              style={isActive ? { ringColor: t.tone } as React.CSSProperties : undefined}
              onClick={() => !isActive && setActiveTrack(t.id as TrackId)}
            >
              {/* Course header — always visible, compact when inactive */}
              <div
                className={`flex items-center gap-4 p-4 transition-all ${isActive ? "cursor-default" : ""}`}
                style={{ background: isActive ? `linear-gradient(135deg, ${t.toneDeep ?? t.tone}, ${t.tone}CC)` : undefined }}
              >
                {/* Mini cover thumbnail */}
                <div
                  className="w-16 h-14 rounded-xl shrink-0 overflow-hidden"
                  style={{ background: t.tone }}
                >
                  <img
                    src={cover}
                    alt={t.name}
                    className="w-full h-full object-cover object-left"
                    draggable={false}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="font-display font-bold text-base leading-tight truncate"
                    style={{ color: isActive ? "#fff" : "#1F1B2E" }}
                  >
                    {t.name}
                  </div>
                  <div
                    className="text-[10px] font-bold tracking-widest uppercase mt-0.5"
                    style={{ color: isActive ? "rgba(255,255,255,0.55)" : "#8B87A0" }}
                  >
                    {t.subtitle.replace(" Track", " Level")}
                  </div>
                  {!unlocked && (
                    <div
                      className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.18)" : `${t.tone}18`,
                        color: isActive ? "#fff" : t.tone,
                      }}
                    >
                      <Lock size={9} />
                      Free trial · Week 1
                    </div>
                  )}
                  {unlocked && (
                    <div
                      className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.18)" : "#D1FAE518",
                        color: isActive ? "#fff" : "#059669",
                      }}
                    >
                      <CheckCircle2 size={9} />
                      Full access
                    </div>
                  )}
                </div>

                <ChevronDown
                  size={18}
                  className="shrink-0 transition-transform"
                  style={{
                    color: isActive ? "rgba(255,255,255,0.7)" : "#8B87A0",
                    transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </div>

              {/* ── Course content — ONLY shown for the active course ── */}
              {isActive && (
                <div className="bg-nuru-bg border-t border-white/10">

                  {/* Purchase modal */}
                  {purchaseTarget && (
                    <PurchaseTrackModal
                      trackId={purchaseTarget.id}
                      trackName={purchaseTarget.name}
                      priceTZS={purchaseTarget.priceTZS}
                      tone={purchaseTarget.tone}
                      onClose={() => setPurchaseTarget(null)}
                      onUnlocked={() => { setActiveTrack(purchaseTarget.id as TrackId); setPurchaseTarget(null); }}
                    />
                  )}

                  {/* ── Week / Module tabs — INSIDE the active course card ── */}
                  <div className="px-4 pt-4 pb-0">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-nuru-muted mb-2 pl-0.5">
                      Modules
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {track.modules.map((m, i) => {
                        const passed   = missionsPassed[`${track.id}:${m.id}`];
                        const isSelected = i === safeModuleIdx;
                        const canOpen  = i === 0 || missionsPassed[`${track.id}:${track.modules[i - 1].id}`] || i <= activeModuleIdx;
                        const isLocked = isAdvancedModule(i) && !isTrackPaid;
                        return (
                          <button
                            key={m.id}
                            onClick={() => selectModule(i)}
                            className={`shrink-0 px-3 py-2 rounded-xl border-2 text-left min-w-[130px] transition-all ${
                              isSelected
                                ? "shadow-sm"
                                : "bg-nuru-card border-nuru-line hover:border-nuru-purple/30"
                            } ${!canOpen && !isLocked ? "opacity-40 cursor-not-allowed" : ""}`}
                            style={isSelected ? { background: `${track.tone}18`, borderColor: track.tone } : undefined}
                          >
                            <div
                              className="flex items-center gap-1 text-[9px] font-bold tracking-wide uppercase mb-0.5"
                              style={{ color: passed ? "#DE9E1F" : isSelected ? track.tone : "#8B87A0" }}
                            >
                              {passed ? <Medal size={10} /> : isLocked ? <Lock size={10} /> : !canOpen ? <Lock size={10} /> : null}
                              Week {m.week}
                              {isLocked && (
                                <span
                                  className="ml-auto text-[8px] font-bold px-1.5 py-px rounded-full"
                                  style={{ background: `${track.tone}20`, color: track.tone }}
                                >
                                  PRO
                                </span>
                              )}
                            </div>
                            <div
                              className="font-semibold text-[12px] leading-tight"
                              style={{ color: canOpen || isLocked ? "#1F1B2E" : "#8B87A0" }}
                            >
                              {m.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paywall upgrade banner */}
                  {moduleGated && (
                    <div
                      className="mx-4 mt-3 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-2"
                      style={{ borderColor: track.tone, background: `${track.tone}0A` }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Star size={18} style={{ color: track.tone }} className="shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-nuru-ink">Module 1 is free — unlock all modules to continue</div>
                          <div className="text-xs text-nuru-muted mt-0.5">
                            Full course access: all modules, videos, notes, challenges, and quests for TZS {track.priceTZS}.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setPurchaseTarget({ id: track.id, name: track.name, priceTZS: track.priceTZS, tone: track.tone })}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 flex items-center justify-center gap-1.5"
                        style={{ background: track.tone }}
                      >
                        <CreditCard size={13} /> Unlock Course
                      </button>
                    </div>
                  )}

                  {/* ── Next up / Nuru mascot ── */}
                  <div
                    className="mx-4 mt-3 rounded-2xl p-4 flex items-center gap-4 border border-nuru-line"
                    style={{ background: `linear-gradient(90deg, ${track.tone}0F, transparent 70%)` }}
                  >
                    <div className="shrink-0"><Nuru size={52} /></div>
                    <div className="flex-1 min-w-0">
                      {isQuestUp ? (
                        <>
                          <div className="text-[10px] font-bold tracking-wide uppercase text-nuru-goldDeep">Mission Quest ready</div>
                          <div className="font-semibold text-sm mt-0.5 truncate">
                            Prove Week {mod.week}: <span style={{ color: track.tone }}>{mod.name}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] font-bold tracking-wide uppercase" style={{ color: track.tone }}>Next up</div>
                          <div className="font-semibold text-sm mt-0.5 truncate">
                            Day {curNode && "day" in curNode ? curNode.day : "—"} —{" "}
                            <span style={{ color: track.tone }}>{curNode?.title ?? "Week complete"}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={openCurrent}
                      className="px-3.5 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 shrink-0"
                      style={{ background: isQuestUp ? "#F5B942" : track.tone }}
                    >
                      {moduleGated ? <Lock size={13} /> : isQuestUp ? <Swords size={13} /> : <Play size={13} fill="white" />}
                      {moduleGated ? "Unlock" : isQuestUp ? "Begin quest" : "Open lesson"}
                    </button>
                  </div>

                  {/* ── Journey map — week's lesson nodes ── */}
                  <div className="mx-4 mt-3 mb-4 bg-nuru-card rounded-2xl pt-4 pb-5 border border-nuru-line">
                    <div className="px-4 pb-3">
                      <div className="text-[10px] font-bold tracking-wide uppercase" style={{ color: track.tone }}>
                        Week {mod.week} — {mod.name}
                      </div>
                      <div className="text-[12px] text-nuru-muted mt-0.5">{mod.tagline}</div>
                    </div>
                    <JourneyMap nodes={nodes} cur={moduleGated ? 0 : cur} tone={track.tone} onNode={onNode} />
                    <div className="text-center text-xs text-nuru-muted mt-1 px-5">
                      {moduleGated
                        ? "Unlock this week to access all content"
                        : "Tap any level to review or open its content."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lesson modal ── */}
      {lessonOpen && !moduleGated && (
        <div className="fixed inset-0 z-[80] bg-nuru-ink/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
          onClick={() => setLessonOpen(null)}>
          <div className="bg-nuru-bg w-full max-w-3xl rounded-3xl shadow-2xl my-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-white rounded-t-3xl relative"
              style={{ background: `linear-gradient(135deg, ${track.tone}, #241033)` }}>
              <button onClick={() => setLessonOpen(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/15 grid place-items-center hover:bg-white/25">
                <X size={15} />
              </button>
              <div className="text-[11px] font-bold tracking-widest uppercase opacity-75">
                {track.subtitle} · Week {mod.week} · Day {lessonOpen.lesson.day}
              </div>
              <h2 className="font-display font-bold text-2xl mt-1 pr-10 leading-tight">{lessonOpen.lesson.title}</h2>
              <p className="text-white/75 text-sm mt-1.5 leading-relaxed">{lessonOpen.lesson.objective}</p>
            </div>

            <div className="flex border-b border-nuru-line bg-nuru-card px-4 gap-1 overflow-x-auto">
              {TAB_META.filter((tab) => {
                if (tab.id === "video" && !lessonOpen.lesson.videoId) return false;
                return true;
              }).map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === id ? "border-nuru-purple text-nuru-purple" : "border-transparent text-nuru-muted hover:text-nuru-ink"
                  }`}>
                  <Icon size={14} />
                  {label}
                  {id === "challenge" && lessonOpen.lesson.dailyChallenge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-nuru-purple ml-0.5" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {activeTab === "lesson" && (
                <LevelPlayer
                  lesson={lessonOpen.lesson}
                  tone={track.tone}
                  trackLabel={track.subtitle}
                  moduleLabel={`Week ${mod.week}`}
                  done={lessonOpen.done}
                  onClose={() => setLessonOpen(null)}
                  onComplete={async (elapsedMinutes) => {
                    completeLesson(activeTrack);
                    logStudyMinutes(elapsedMinutes);
                    setLessonOpen(null);
                    const supabase = createClient();
                    await supabase.rpc("complete_lesson", { p_track_id: activeTrack, p_minutes: elapsedMinutes });
                    const lessonResult = await advanceQuest("lesson");
                    if (lessonResult.justCompleted) console.log("Lesson quest completed — reward available to claim");
                    await advanceQuest("study20", elapsedMinutes);
                    await loadTodayQuests();
                  }}
                  inline
                />
              )}

              {activeTab === "video" && lessonOpen.lesson.videoId && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase" style={{ color: track.tone }}>
                    <Video size={13} />
                    Video Tutorial · {lessonOpen.lesson.videoTitle ?? lessonOpen.lesson.title}
                  </div>
                  <ProtectedVideoPlayer videoId={lessonOpen.lesson.videoId} title={lessonOpen.lesson.videoTitle ?? lessonOpen.lesson.title} />
                  <div className="bg-nuru-lav rounded-xl px-4 py-3 flex items-start gap-2.5">
                    <Lock size={13} className="text-nuru-purple shrink-0 mt-0.5" />
                    <p className="text-xs text-nuru-ink2 leading-relaxed">
                      This video is protected. Right-click, downloading, and screen recording are blocked.
                      The stream link expires in 60 seconds and cannot be shared.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "notes" && <NotesPanel lesson={lessonOpen.lesson} tone={track.tone} />}

              {activeTab === "challenge" && (
                lessonOpen.lesson.dailyChallenge ? (
                  <DailyChallengePanel
                    challenge={lessonOpen.lesson.dailyChallenge}
                    tone={track.tone}
                    lessonTitle={lessonOpen.lesson.title}
                    onComplete={async (correct) => {
                      if (correct) {
                        const result = await advanceQuest("challenge");
                        if (result.justCompleted) console.log("Daily challenge quest completed — reward claimable");
                        await loadTodayQuests();
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-nuru-lav grid place-items-center mb-4">
                      <Zap size={24} className="text-nuru-purple" />
                    </div>
                    <h3 className="font-bold text-nuru-ink mb-1">No challenge today</h3>
                    <p className="text-sm text-nuru-muted max-w-xs leading-relaxed">
                      Daily challenges are being added for this lesson. Check back soon!
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <AdvancedPaywall
          trackName={track.name}
          priceTZS={track.priceTZS}
          tone={track.tone}
          onClose={() => setShowPaywall(false)}
          onUnlock={() => {
            setShowPaywall(false);
            setPurchaseTarget({ id: track.id, name: track.name, priceTZS: track.priceTZS, tone: track.tone });
          }}
        />
      )}

      {questOpen && mod.quiz && (
        <MissionQuestModal
          quiz={mod.quiz}
          moduleId={`${activeTrack}:${mod.id}`}
          tone={track.tone}
          weekLabel={`Week ${mod.week}`}
          onClose={() => setQuestOpen(false)}
          onFinish={async (passed, pct) => {
            // Always record today in study_log when a quiz is attempted,
            // pass or fail — the DB's submit_quiz_attempt RPC now does this
            // too (migration 017), but this client-side upsert is a
            // belt-and-suspenders fallback so the streak survives even on
            // older DB deployments where the migration hasn't run yet.
            const supabase = createClient();
            const today = new Date().toISOString().slice(0, 10);
            supabase
              .from("study_log")
              .upsert(
                { study_date: today, minutes: 15 },
                { onConflict: "user_id,study_date", ignoreDuplicates: false }
              )
              .then(({ error }) => {
                if (error) console.warn("study_log upsert failed:", error);
              });

            if (passed) {
              passMission(activeTrack, mod.id, pct);
              const result = await advanceQuest("quiz");
              if (result.justCompleted) console.log("Quiz quest completed — reward claimable");
              await loadTodayQuests();
              if (activeModuleIdx < track.modules.length - 1) {
                setTimeout(() => setActiveModuleIdx(activeTrack, activeModuleIdx + 1), 700);
              }
            }
            setQuestOpen(false);
          }}
        />
      )}
    </Shell>
  );
}
