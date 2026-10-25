/**
 * The Google client id of this app, for saving the transfer file in the person's own Drive. It is
 * public (it only says which app asks), so it is kept in the code. A build can use another one
 * with `VITE_GOOGLE_CLIENT_ID`, for example to try the app at another address; with both empty
 * the Drive buttons are not shown. See `docs/GOOGLE_DRIVE.md`.
 */
const PUBLISHED_CLIENT_ID =
  "2858480811-2qcnpte23jffji1og5hcs4sugqemhum4.apps.googleusercontent.com";

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || PUBLISHED_CLIENT_ID;
