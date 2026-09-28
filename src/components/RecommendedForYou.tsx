"use client";

import { Lock, Clock } from "lucide-react";
import { useGameStore, isTrackUnlocked } from "@/lib/store";
import { useTracks } from "@/lib/curriculum-db";
import type { TrackId } from "@/lib/store";

/**
 * Custom branded SVG cover images for the Recommended section.
 * Same set as ContinueLearning — consistent branding across the app.
 */
const REC_COVER: Record<string, string> = {
  beginner:     "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImJlZ2lubmVyIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmcxIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzBEMkU2RSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxQTREQjUiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Im9yYjEiIGN4PSI3MCUiIGN5PSIzMCUiIHI9IjQ1JSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiM2MEE1RkEiIHN0b3Atb3BhY2l0eT0iMC4yNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2MEE1RkEiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjYmcxKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjEpIi8+CiAgPCEtLSBHcmlkIGRvdHMgLS0+CiAgPGcgZmlsbD0iIzYwQTVGQSIgb3BhY2l0eT0iMC4xNSI+CiAgICA8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNjAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMTAwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSIxNDAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMTgwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSIyMCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI2MCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMTAwIiB5PSI2MCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjE0MCIgeT0iNjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjEwMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjYwIiB5PSIxMDAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjE0MCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICA8L2c+CiAgPCEtLSBEZWNvcmF0aXZlIGNpcmNsZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDkwIiBjeT0iNTUiIHI9IjkwIiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xOCIvPgogIDxjaXJjbGUgY3g9IjQ5MCIgY3k9IjU1IiByPSI2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjBBNUZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMTMiLz4KICA8Y2lyY2xlIGN4PSI0OTAiIGN5PSI1NSIgcj0iMzIiIGZpbGw9IiMzQjgyRjYiIG9wYWNpdHk9IjAuMTgiLz4KICA8IS0tIFBlcnNvbiBhdCBsYXB0b3AgKGZyb250LWZhY2luZywgbGVhcm5pbmcpIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMzMCwgNTApIj4KICAgIDwhLS0gVGFibGUgc3VyZmFjZSAtLT4KICAgIDxyZWN0IHg9Ii0yMCIgeT0iMTkwIiB3aWR0aD0iMjcwIiBoZWlnaHQ9IjEwIiByeD0iMyIgZmlsbD0iIzFFM0E2RSIgb3BhY2l0eT0iMC42Ii8+CiAgICA8IS0tIExhcHRvcCBzY3JlZW4gLS0+CiAgICA8cmVjdCB4PSIzMCIgeT0iODAiIHdpZHRoPSIxODAiIGhlaWdodD0iMTEwIiByeD0iNyIgZmlsbD0iIzBBMUEzRSIgc3Ryb2tlPSIjM0I4MkY2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC45NSIvPgogICAgPCEtLSBTY3JlZW4gY29udGVudDogIkhlbGxvIEFJIiBwcm9tcHQgLS0+CiAgICA8cmVjdCB4PSI0NCIgeT0iOTgiIHdpZHRoPSI0MCIgaGVpZ2h0PSI1IiByeD0iMiIgZmlsbD0iIzkzQzVGRCIgb3BhY2l0eT0iMC44Ii8+CiAgICA8cmVjdCB4PSI0NCIgeT0iMTEwIiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjQiIHJ4PSIyIiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjQiLz4KICAgIDxyZWN0IHg9IjQ0IiB5PSIxMjAiIHdpZHRoPSIxMDAiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiMzQjgyRjYiIG9wYWNpdHk9IjAuNCIvPgogICAgPHJlY3QgeD0iNTQiIHk9IjEzMCIgd2lkdGg9Ijc1IiBoZWlnaHQ9IjQiIHJ4PSIyIiBmaWxsPSIjNjBBNUZBIiBvcGFjaXR5PSIwLjUiLz4KICAgIDxyZWN0IHg9IjU0IiB5PSIxNDAiIHdpZHRoPSI5MCIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC4zNSIvPgogICAgPHJlY3QgeD0iNDQiIHk9IjE1MCIgd2lkdGg9IjExNSIgaGVpZ2h0PSI0IiByeD0iMiIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cmVjdCB4PSI0NCIgeT0iMTYwIiB3aWR0aD0iNjAiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9IiM5M0M1RkQiIG9wYWNpdHk9IjAuNiIvPgogICAgPHJlY3QgeD0iMTEzIiB5PSIxNjAiIHdpZHRoPSI2IiBoZWlnaHQ9IjQiIHJ4PSIxIiBmaWxsPSIjOTNDNUZEIi8+CiAgICA8IS0tIExhcHRvcCBiYXNlIC0tPgogICAgPHJlY3QgeD0iMjAiIHk9IjE5MCIgd2lkdGg9IjIwMCIgaGVpZ2h0PSI5IiByeD0iMyIgZmlsbD0iIzBBMUEzRSIgc3Ryb2tlPSIjM0I4MkY2IiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgPHJlY3QgeD0iODUiIHk9IjE5OSIgd2lkdGg9IjcwIiBoZWlnaHQ9IjUiIHJ4PSIyIiBmaWxsPSIjMEExQTNFIiBzdHJva2U9IiMzQjgyRjYiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC40Ii8+CiAgPC9nPgogIDwhLS0gUGVyc29uIHNpbGhvdWV0dGUgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjgwLCA5NSkiPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIxNiIgcj0iMTUiIGZpbGw9IiMyNTYzRUIiIG9wYWNpdHk9IjAuNTUiLz4KICAgIDxwYXRoIGQ9Ik0yIDQyIFEyMCAzMCAzOCA0MiBMNDIgMTAwIEwtMiAxMDAgWiIgZmlsbD0iIzI1NjNFQiIgb3BhY2l0eT0iMC40NSIvPgogICAgPHBhdGggZD0iTTM0IDU1IFE1MiA2NSA2MCA4OCIgc3Ryb2tlPSIjMjU2M0VCIiBzdHJva2Utd2lkdGg9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC40NSIvPgogIDwvZz4KICA8IS0tIEJyYWluL2xpZ2h0YnVsYiBpY29uIHRvcCByaWdodCAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1MjgsIDMyKSI+CiAgICA8Y2lyY2xlIGN4PSIyOCIgY3k9IjI4IiByPSIyNCIgZmlsbD0iIzNCODJGNiIgb3BhY2l0eT0iMC4xMiIgc3Ryb2tlPSIjNjBBNUZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuMjUiLz4KICAgIDx0ZXh0IHg9IjI4IiB5PSIzNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIwIiBmaWxsPSIjOTNDNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBvcGFjaXR5PSIwLjgiPvCfkqE8L3RleHQ+CiAgPC9nPgogIDwhLS0gVGV4dCAtLT4KICA8dGV4dCB4PSI0MCIgeT0iODgiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIxMSIgZmlsbD0iIzkzQzVGRCIgbGV0dGVyLXNwYWNpbmc9IjMiIG9wYWNpdHk9IjAuODUiPkJFR0lOTkVSIFRSQUNLPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxMzIiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIzOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGRkZGRkYiPkZvdW5kYXRpb25zPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNjIiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0JGREJGRSIgb3BhY2l0eT0iMC45Ij5BSSBmb3IgRXZlcnlvbmUg4oCUIG5vIGV4cGVyaWVuY2UgbmVlZGVkLjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTgwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNCRkRCRkUiIG9wYWNpdHk9IjAuNyI+U3RhcnQgbGVhcm5pbmcgQUkgZnJvbSBzY3JhdGNoLCBzdGVwIGJ5IHN0ZXAuPC90ZXh0PgogIDwhLS0gQmFkZ2UgLS0+CiAgPHJlY3QgeD0iNDAiIHk9IjIwNSIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIyOCIgcng9IjE0IiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjI1Ii8+CiAgPHJlY3QgeD0iNDAiIHk9IjIwNSIgd2lkdGg9IjEyMCIgaGVpZ2h0PSIyOCIgcng9IjE0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MEE1RkEiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC41NSIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iMjI0IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjOTNDNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+RlJFRSBGSVJTVCBMRVNTT048L3RleHQ+CiAgPHJlY3QgeD0iMCIgeT0iMjkwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjM0I4MkY2IiBvcGFjaXR5PSIwLjM1Ii8+Cjwvc3ZnPg==",
  intermediate: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImludGVybWVkaWF0ZSI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnMiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxQTBBM0IiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMkQxMDYwIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJvcmIyYSIgY3g9Ijc1JSIgY3k9IjI1JSIgcj0iNDUlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iIzhCNUNGNiIgc3RvcC1vcGFjaXR5PSIwLjMiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjOEI1Q0Y2IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9Im9yYjJiIiBjeD0iMzAlIiBjeT0iODAlIiByPSIzNSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNjM2NkYxIiBzdG9wLW9wYWNpdHk9IjAuMiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM2MzY2RjEiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjYmcyKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjJhKSIvPgogIDxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI29yYjJiKSIvPgogIDwhLS0gTmV1cmFsIG5ldHdvcmsgKyBhdXRvbWF0aW9uIGZsb3cgLS0+CiAgPCEtLSBJbnB1dCBub2RlcyAtLT4KICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSI4MCIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC43Ii8+CiAgPGNpcmNsZSBjeD0iMzQwIiBjeT0iMTI1IiByPSI5IiBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjciLz4KICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIxNzAiIHI9IjkiIGZpbGw9IiM4QjVDRjYiIG9wYWNpdHk9IjAuNyIvPgogIDxjaXJjbGUgY3g9IjM0MCIgY3k9IjIxNSIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC43Ii8+CiAgPCEtLSBIaWRkZW4gbm9kZXMgLS0+CiAgPGNpcmNsZSBjeD0iNDI1IiBjeT0iMTAwIiByPSIxMSIgZmlsbD0iI0E3OEJGQSIgb3BhY2l0eT0iMC44NSIvPgogIDxjaXJjbGUgY3g9IjQyNSIgY3k9IjE1MCIgcj0iMTEiIGZpbGw9IiNBNzhCRkEiIG9wYWNpdHk9IjAuODUiLz4KICA8Y2lyY2xlIGN4PSI0MjUiIGN5PSIyMDAiIHI9IjExIiBmaWxsPSIjQTc4QkZBIiBvcGFjaXR5PSIwLjg1Ii8+CiAgPCEtLSBPdXRwdXQgbm9kZSAtLT4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSIxNTAiIHI9IjE0IiBmaWxsPSIjQzRCNUZEIiBvcGFjaXR5PSIwLjkiLz4KICA8IS0tIENvbm5lY3Rpb25zIGluLWhpZGRlbiAtLT4KICA8ZyBzdHJva2U9IiM4QjVDRjYiIHN0cm9rZS13aWR0aD0iMC44IiBvcGFjaXR5PSIwLjMiPgogICAgPGxpbmUgeDE9IjM0OSIgeTE9IjgwIiB4Mj0iNDE0IiB5Mj0iMTAwIi8+CiAgICA8bGluZSB4MT0iMzQ5IiB5MT0iODAiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIxMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxMjUiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxNzAiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIxNzAiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIyMTUiIHgyPSI0MTQiIHkyPSIyMDAiLz4KICAgIDxsaW5lIHgxPSIzNDkiIHkxPSIyMTUiIHgyPSI0MTQiIHkyPSIxNTAiLz4KICA8L2c+CiAgPCEtLSBDb25uZWN0aW9ucyBoaWRkZW4tb3V0cHV0IC0tPgogIDxnIHN0cm9rZT0iI0E3OEJGQSIgc3Ryb2tlLXdpZHRoPSIxLjIiIG9wYWNpdHk9IjAuNSI+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMTAwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMTUwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgICA8bGluZSB4MT0iNDM2IiB5MT0iMjAwIiB4Mj0iNDk2IiB5Mj0iMTUwIi8+CiAgPC9nPgogIDwhLS0gSGlnaGxpZ2h0ZWQgYWN0aXZlIHBhdGggLS0+CiAgPGxpbmUgeDE9IjM0OSIgeTE9IjEyNSIgeDI9IjQxNCIgeTI9IjE1MCIgc3Ryb2tlPSIjQzRCNUZEIiBzdHJva2Utd2lkdGg9IjIuMiIgb3BhY2l0eT0iMC44NSIvPgogIDxsaW5lIHgxPSI0MzYiIHkxPSIxNTAiIHgyPSI0OTYiIHkyPSIxNTAiIHN0cm9rZT0iI0M0QjVGRCIgc3Ryb2tlLXdpZHRoPSIyLjIiIG9wYWNpdHk9IjAuODUiLz4KICA8IS0tIEJ1c2luZXNzIGF1dG9tYXRpb24gaWNvbnMgLS0+CiAgPCEtLSBHZWFyIGljb24gLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNTUyLCA0MikiIG9wYWNpdHk9IjAuNSI+CiAgICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQTc4QkZBIiBzdHJva2Utd2lkdGg9IjEuNSIvPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iOSIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4zIiBzdHJva2U9IiNBNzhCRkEiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPHJlY3QgeD0iMTciIHk9IjIiIHdpZHRoPSI2IiBoZWlnaHQ9IjciIHJ4PSIyIiBmaWxsPSIjQTc4QkZBIi8+CiAgICA8cmVjdCB4PSIxNyIgeT0iMzEiIHdpZHRoPSI2IiBoZWlnaHQ9IjciIHJ4PSIyIiBmaWxsPSIjQTc4QkZBIi8+CiAgICA8cmVjdCB4PSIyIiB5PSIxNyIgd2lkdGg9IjciIGhlaWdodD0iNiIgcng9IjIiIGZpbGw9IiNBNzhCRkEiLz4KICAgIDxyZWN0IHg9IjMxIiB5PSIxNyIgd2lkdGg9IjciIGhlaWdodD0iNiIgcng9IjIiIGZpbGw9IiNBNzhCRkEiLz4KICA8L2c+CiAgPCEtLSBIZXhhZ29uIHdpdGggQUkgdGV4dCAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NDMsIDIzMCkiPgogICAgPHBvbHlnb24gcG9pbnRzPSIyNywwIDU0LDE1IDU0LDQ2IDI3LDYxIDAsNDYgMCwxNSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOEI1Q0Y2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cG9seWdvbiBwb2ludHM9IjI3LDggNDYsMTkgNDYsNDIgMjcsNTMgOCw0MiA4LDE5IiBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjE1Ii8+CiAgICA8dGV4dCB4PSIyNyIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiIG9wYWNpdHk9IjAuODUiPkFJPC90ZXh0PgogIDwvZz4KICA8IS0tIERvdHMgZ3JpZCAtLT4KICA8ZyBmaWxsPSIjOEI1Q0Y2IiBvcGFjaXR5PSIwLjE4Ij4KICAgIDxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI1NSIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI5MCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMTI1IiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjIwIiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI1NSIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSI5MCIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iNTUiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogIDwvZz4KICA8IS0tIFRleHQgLS0+CiAgPHRleHQgeD0iNDAiIHk9IjkwIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiIGZvbnQtc2l6ZT0iMTEiIGZpbGw9IiNBNzhCRkEiIGxldHRlci1zcGFjaW5nPSIzIiBvcGFjaXR5PSIwLjg1Ij5JTlRFUk1FRElBVEUgVFJBQ0s8L3RleHQ+CiAgPHRleHQgeD0iNDAiIHk9IjEzMiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZGRkZGRiI+QUk8L3RleHQ+CiAgPHRleHQgeD0iODUiIHk9IjEzMiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0M0QjVGRCI+IEZvdW5kYXRpb25zPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNzAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0RERDZGRSIgb3BhY2l0eT0iMC44NSI+QUkgJmFtcDsgQnVzaW5lc3MgQXV0b21hdGlvbjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTkwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNDNEI1RkQiIG9wYWNpdHk9IjAuNjUiPlVzZSBBSSB0byBncm93IGFuZCBhdXRvbWF0ZSB5b3VyIGJ1c2luZXNzLjwvdGV4dD4KICA8IS0tIEJhZGdlIC0tPgogIDxyZWN0IHg9IjQwIiB5PSIyMTgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4yMiIvPgogIDxyZWN0IHg9IjQwIiB5PSIyMTgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQTc4QkZBIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNTUiLz4KICA8dGV4dCB4PSIxMDUiIHk9IjIzNyIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjEiPkZSRUUgRklSU1QgTEVTU09OPC90ZXh0PgogIDxyZWN0IHg9IjAiIHk9IjI5MCIgd2lkdGg9IjYwMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzhCNUNGNiIgb3BhY2l0eT0iMC4zNSIvPgo8L3N2Zz4=",
  expert:       "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDYwMCAzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgaWQ9ImV4cGVydCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImJnMyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMzRDEyMDAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjN0MyRDBEIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJvcmIzIiBjeD0iNzAlIiBjeT0iMzUlIiByPSI0NSUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRkI5MjNDIiBzdG9wLW9wYWNpdHk9IjAuMyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiNGQjkyM0MiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ib3JiM2IiIGN4PSIyMCUiIGN5PSI3NSUiIHI9IjMwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiNGOTczMTYiIHN0b3Atb3BhY2l0eT0iMC4yIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0Y5NzMxNiIgc3RvcC1vcGFjaXR5PSIwIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNiZzMpIi8+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9InVybCgjb3JiMykiLz4KICA8cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNvcmIzYikiLz4KICA8IS0tIEhvdXNlIC8gcHJvcGVydHkgaWxsdXN0cmF0aW9uIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMxMCwgMjApIj4KICAgIDwhLS0gSG91c2UgMSAobGFyZ2UsIG1haW4pIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzAsIDQwKSI+CiAgICAgIDwhLS0gUm9vZiAtLT4KICAgICAgPHBvbHlnb24gcG9pbnRzPSI3MCwwIDE0MCw1NSAwLDU1IiBmaWxsPSIjNUMxQTAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMS41IiBvcGFjaXR5PSIwLjkiLz4KICAgICAgPCEtLSBDaGltbmV5IC0tPgogICAgICA8cmVjdCB4PSIxMDAiIHk9IjgiIHdpZHRoPSIxNCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzRBMTUwMCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgICA8IS0tIFdhbGxzIC0tPgogICAgICA8cmVjdCB4PSIxMCIgeT0iNTUiIHdpZHRoPSIxMjAiIGhlaWdodD0iOTUiIGZpbGw9IiM0NTEyMDAiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIxLjIiIG9wYWNpdHk9IjAuOSIvPgogICAgICA8IS0tIERvb3IgLS0+CiAgICAgIDxyZWN0IHg9IjUyIiB5PSIxMDAiIHdpZHRoPSIzNiIgaGVpZ2h0PSI1MCIgcng9IjE4IiBmaWxsPSIjNUMxQTAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC44Ii8+CiAgICAgIDxjaXJjbGUgY3g9IjgyIiBjeT0iMTI2IiByPSIzIiBmaWxsPSIjRkI5MjNDIiBvcGFjaXR5PSIwLjgiLz4KICAgICAgPCEtLSBXaW5kb3dzIC0tPgogICAgICA8cmVjdCB4PSIxOCIgeT0iNjgiIHdpZHRoPSIzMiIgaGVpZ2h0PSIyNiIgcng9IjMiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMTUiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIxIi8+CiAgICAgIDxsaW5lIHgxPSIxOCIgeTE9IjgxIiB4Mj0iNTAiIHkyPSI4MSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxsaW5lIHgxPSIzNCIgeTE9IjY4IiB4Mj0iMzQiIHkyPSI5NCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxyZWN0IHg9IjkwIiB5PSI2OCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjI2IiByeD0iMyIgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC4xNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiLz4KICAgICAgPGxpbmUgeDE9IjkwIiB5MT0iODEiIHgyPSIxMjIiIHkyPSI4MSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC40Ii8+CiAgICAgIDxsaW5lIHgxPSIxMDYiIHkxPSI2OCIgeDI9IjEwNiIgeTI9Ijk0IiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMC44IiBvcGFjaXR5PSIwLjQiLz4KICAgIDwvZz4KICAgIDwhLS0gSG91c2UgMiAoc21hbGxlciwgcmlnaHQpIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg1LCA5MCkiPgogICAgICA8cG9seWdvbiBwb2ludHM9IjQ4LDAgOTYsMzggMCwzOCIgZmlsbD0iIzVDMUEwMCIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNyIvPgogICAgICA8cmVjdCB4PSI4IiB5PSIzOCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjYyIiBmaWxsPSIjNDUxMjAwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC43Ii8+CiAgICAgIDxyZWN0IHg9IjM0IiB5PSI2NSIgd2lkdGg9IjI0IiBoZWlnaHQ9IjM1IiByeD0iMTIiIGZpbGw9IiM1QzFBMDAiIHN0cm9rZT0iI0ZCOTIzQyIgc3Ryb2tlLXdpZHRoPSIwLjgiIG9wYWNpdHk9IjAuNiIvPgogICAgICA8cmVjdCB4PSIxMiIgeT0iNDYiIHdpZHRoPSIyMiIgaGVpZ2h0PSIxOCIgcng9IjIiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgICA8cmVjdCB4PSI1OCIgeT0iNDYiIHdpZHRoPSIyMiIgaGVpZ2h0PSIxOCIgcng9IjIiIGZpbGw9IiNGQjkyM0MiIG9wYWNpdHk9IjAuMSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPC9nPgogICAgPCEtLSBTdGFycyAvIHJldmlldyBpbmRpY2F0b3JzIC0tPgogICAgPGcgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC44NSI+CiAgICAgIDx0ZXh0IHg9IjMwIiB5PSIxNzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCI+4piF4piF4piF4piF4piFPC90ZXh0PgogICAgPC9nPgogICAgPHRleHQgeD0iMzAiIHk9IjE5NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjkiIGZpbGw9IiNGRUQ3QUEiIG9wYWNpdHk9IjAuNiIgbGV0dGVyLXNwYWNpbmc9IjEiPjQuOSDCtyAzMTIgUkVWSUVXUzwvdGV4dD4KICAgIDwhLS0gTG9jYXRpb24gcGluIC0tPgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjI4LCAzNikiIG9wYWNpdHk9IjAuNyI+CiAgICAgIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjEwIiBmaWxsPSIjRjk3MzE2IiBvcGFjaXR5PSIwLjI1IiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgICAgIDxjaXJjbGUgY3g9IjEyIiBjeT0iMTAiIHI9IjQiIGZpbGw9IiNGQjkyM0MiLz4KICAgICAgPGxpbmUgeDE9IjEyIiB5MT0iMjAiIHgyPSIxMiIgeTI9IjMwIiBzdHJva2U9IiNGQjkyM0MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgICA8L2c+CiAgPC9nPgogIDwhLS0gQm9va2luZy5jb20gLyBwbGF0Zm9ybSBpY29ucyAocGlsbCBiYWRnZXMpIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDMxMCwgMjI1KSI+CiAgICA8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iNzAiIGhlaWdodD0iMjAiIHJ4PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPHRleHQgeD0iMzUiIHk9IjE0IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOSIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGRUQ3QUEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSIwLjUiPkFJUkJOQjwvdGV4dD4KICAgIDxyZWN0IHg9Ijc4IiB5PSIwIiB3aWR0aD0iODAiIGhlaWdodD0iMjAiIHJ4PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4yNSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjAuOCIvPgogICAgPHRleHQgeD0iMTE4IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjkiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjRkVEN0FBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5CT09LSU5HLkNPTTwvdGV4dD4KICA8L2c+CiAgPCEtLSBEb3RzIHBhdHRlcm4gLS0+CiAgPGcgZmlsbD0iI0ZCOTIzQyIgb3BhY2l0eT0iMC4xMiI+CiAgICA8cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNTUiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iOTAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPjxyZWN0IHg9IjEyNSIgeT0iMjAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSIxNjAiIHk9IjIwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPjxyZWN0IHg9IjIwIiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICAgIDxyZWN0IHg9IjU1IiB5PSI1NSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz48cmVjdCB4PSI5MCIgeT0iNTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+CiAgICA8cmVjdCB4PSIyMCIgeT0iOTAiIHdpZHRoPSIyIiBoZWlnaHQ9IjIiIHJ4PSIxIi8+PHJlY3QgeD0iNTUiIHk9IjkwIiB3aWR0aD0iMiIgaGVpZ2h0PSIyIiByeD0iMSIvPgogICAgPHJlY3QgeD0iMjAiIHk9IjEyNSIgd2lkdGg9IjIiIGhlaWdodD0iMiIgcng9IjEiLz4KICA8L2c+CiAgPCEtLSBUZXh0IC0tPgogIDx0ZXh0IHg9IjQwIiB5PSI4OCIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjExIiBmaWxsPSIjRkI5MjNDIiBsZXR0ZXItc3BhY2luZz0iMyIgb3BhY2l0eT0iMC45Ij5FWFBFUlQgVFJBQ0s8L3RleHQ+CiAgPHRleHQgeD0iNDAiIHk9IjEyNSIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjI4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZGRkZGRiI+R2V0dGluZyBTdGFydGVkPC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIxNTgiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGQjkyM0MiPm9uIEFpcmJuYjwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iMTg4IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTMiIGZpbGw9IiNGRUQ3QUEiIG9wYWNpdHk9IjAuOCI+TGlzdCwgcHJpY2UgJmFtcDsgb3BlcmF0ZSB5b3VyIHByb3BlcnR5PC90ZXh0PgogIDx0ZXh0IHg9IjQwIiB5PSIyMDYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMyIgZmlsbD0iI0ZFRDdBQSIgb3BhY2l0eT0iMC44Ij5saWtlIGEgcHJvIG9uIEFpcmJuYiAmYW1wOyBCb29raW5nLmNvbS48L3RleHQ+CiAgPCEtLSBCYWRnZSAtLT4KICA8cmVjdCB4PSI0MCIgeT0iMjI4IiB3aWR0aD0iMTMwIiBoZWlnaHQ9IjI4IiByeD0iMTQiIGZpbGw9IiNGOTczMTYiIG9wYWNpdHk9IjAuMiIvPgogIDxyZWN0IHg9IjQwIiB5PSIyMjgiIHdpZHRoPSIxMzAiIGhlaWdodD0iMjgiIHJ4PSIxNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjRkI5MjNDIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNTUiLz4KICA8dGV4dCB4PSIxMDUiIHk9IjI0NyIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0ZFRDdBQSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjEiPkZSRUUgRklSU1QgTEVTU09OPC90ZXh0PgogIDxyZWN0IHg9IjAiIHk9IjI5MCIgd2lkdGg9IjYwMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI0Y5NzMxNiIgb3BhY2l0eT0iMC4zNSIvPgo8L3N2Zz4=",
};

/** Static courses coming soon — always locked, not yet in curriculum DB */
const COMING_SOON_COURSES = [
  {
    id: "it_fundamentals",
    name: "Computer Hardware & OS",
    subtitle: "IT Fundamentals",
    tone: "#2563EB",
    toneDeep: "#1E3A8A",
    cover: "/images/courses/it-fundamentals.jpg",   // real photo shown in screenshot
    modules: 4,
    duration: "4 min",
  },
];

export function RecommendedForYou() {
  const { tracks: TRACKS } = useTracks();
  const activeTrack = useGameStore((s) => s.activeTrack);
  const missionsPassed = useGameStore((s) => s.missionsPassed);
  const purchasedTracks = useGameStore((s) => s.purchasedTracks);

  if (!TRACKS || TRACKS.length === 0 || TRACKS.some((tr) => !tr)) {
    return null;
  }

  // Dynamic tracks (from curriculum DB) that aren't active — filtered to hide
  // intermediate & expert which are not purchasable yet
  const dynamicRecommended = TRACKS.filter(
    (t) =>
      t.id !== activeTrack &&
      t.id !== "expert" &&
      !isTrackUnlocked(t.id as TrackId, missionsPassed, purchasedTracks)
  );

  // Total visible = dynamic + static coming-soon cards
  const hasSomething = dynamicRecommended.length > 0 || COMING_SOON_COURSES.length > 0;

  if (!hasSomething) {
    return (
      <section>
        <h2 className="font-bold text-nuru-ink text-lg mb-2">Recommended for You</h2>
        <div className="bg-nuru-card rounded-2xl border border-nuru-line p-6 text-center text-sm text-nuru-muted">
          🎉 You&apos;ve unlocked all available courses! More coming soon.
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-nuru-ink text-lg leading-tight">Recommended for You</h2>
          <p className="text-xs text-nuru-muted mt-0.5">Based on your progress, interests and learning goals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* ── Static coming-soon cards (always locked) ── */}
        {COMING_SOON_COURSES.map((c) => (
          <div
            key={c.id}
            aria-disabled="true"
            className="relative rounded-2xl overflow-hidden text-left bg-nuru-card select-none opacity-80"
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.14)", cursor: "not-allowed" }}
          >
            {/* Full cover image */}
            <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.cover}
                alt={c.name}
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                  if (img.parentElement) {
                    img.parentElement.style.background = `linear-gradient(135deg, ${c.toneDeep}, ${c.tone})`;
                  }
                }}
              />

              {/* Dark overlay — stronger to signal locked */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Gradient fade at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Colored banner at top */}
              <div
                className="absolute top-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between"
                style={{ background: c.toneDeep + "DD" }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                  {c.subtitle}
                </span>
                <span className="text-[10px] font-semibold text-white/70 flex items-center gap-1">
                  <Clock size={9} /> {c.duration} · Free first lesson
                </span>
              </div>

              {/* Centre lock badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-black/40 border-2 border-white/30 grid place-items-center backdrop-blur-sm">
                  <Lock size={20} className="text-white/80" />
                </div>
                <span className="text-white font-bold text-sm tracking-wide px-4 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
                  Coming Soon
                </span>
              </div>

              {/* Course name at bottom */}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                <div
                  className="font-bold text-white text-[18px] leading-snug mb-1 line-clamp-2"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
                >
                  {c.name}
                </div>
                <div className="text-white/60 text-[12px]">{c.subtitle}</div>
              </div>
            </div>

            {/* CTA row — disabled */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: c.tone + "12" }}
            >
              <span className="text-[12px] text-nuru-muted font-medium">
                {c.modules} modules · Launching soon
              </span>
              <div
                className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full opacity-40"
                style={{ color: c.tone, border: `1.5px solid ${c.tone}` }}
              >
                <Lock size={11} />
                Locked
              </div>
            </div>
          </div>
        ))}

        {/* ── Dynamic tracks from curriculum DB (also shown as locked / coming soon) ── */}
        {dynamicRecommended.map((t) => {
          const firstModule = t.modules[0];
          if (!firstModule) return null;
          const bannerBg = (t.toneDeep ?? t.tone) + "DD";

          return (
            <div
              key={t.id}
              aria-disabled="true"
              className="relative rounded-2xl overflow-hidden text-left bg-nuru-card select-none opacity-80"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.14)", cursor: "not-allowed" }}
            >
              <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={REC_COVER[t.id] ?? REC_COVER.beginner}
                  alt={t.name}
                  className="w-full h-full object-cover object-left"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div
                  className="absolute top-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between"
                  style={{ background: bannerBg }}
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">
                    {t.subtitle ?? t.name}
                  </span>
                  <span className="text-[10px] font-semibold text-white/70 flex items-center gap-1">
                    <Clock size={9} /> 4 min · Free first lesson
                  </span>
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-black/40 border-2 border-white/30 grid place-items-center backdrop-blur-sm">
                    <Lock size={20} className="text-white/80" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide px-4 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
                    Coming Soon
                  </span>
                </div>

                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                  <div
                    className="font-bold text-white text-[18px] leading-snug mb-1 line-clamp-2"
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
                  >
                    {t.name}
                  </div>
                  <div className="text-white/60 text-[12px]">{firstModule.name}</div>
                </div>
              </div>

              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ background: t.tone + "12" }}
              >
                <span className="text-[12px] text-nuru-muted font-medium">
                  {t.modules.length} modules · Launching soon
                </span>
                <div
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full opacity-40"
                  style={{ color: t.tone, border: `1.5px solid ${t.tone}` }}
                >
                  <Lock size={11} />
                  Locked
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
