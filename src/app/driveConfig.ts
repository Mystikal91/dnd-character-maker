/**
 * The Google client id of this app, for saving the transfer file in the person's own Drive. It is
 * public (it only says which app asks), so it is kept in the code. Leave it empty and the Drive
 * buttons are not shown. See `docs/GOOGLE_DRIVE.md` for how to make one.
 */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
