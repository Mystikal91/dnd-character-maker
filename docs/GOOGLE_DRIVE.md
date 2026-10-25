# Saving the transfer file in Google Drive

The window **Move to another device** can keep its file in the person's own Google Drive, so that
a second device only has to load it. The buttons **Save to Google Drive** and **Load from Google
Drive** appear only when the build knows a Google client id.

## What the app can see

The app asks for the `drive.file` permission, the narrowest one Drive has: it lets the app read
and write only the files **it made itself**. It cannot list or open anything else in the Drive.
The only file it makes is `dnd-character-maker.dndtransfer.json`, the same file that Export saves
(including the passphrase protection, if the person chose one). There is no server: the browser
talks to Google directly, and the access token lives in memory only, so it is asked for again the
next time the page is opened. Google's sign-in script is fetched only when the window is opened.

## Making the client id (once, by whoever publishes the app)

1. In the [Google Cloud console](https://console.cloud.google.com/) make a project (or use one).
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: type **External**, fill in the name and an email,
   add the scope `.../auth/drive.file`, and add the people who may test while the app is in
   *Testing* (or publish it: `drive.file` does not need a Google review).
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Under
   **Authorized JavaScript origins** put the address the app is served from, for example
   `https://<user>.github.io` (no path) and, for development, `http://localhost:5173`.
5. Copy the client id (`....apps.googleusercontent.com`). It is public.

## Giving the id to the app

- For the published site: in the repository, **Settings → Secrets and variables → Actions →
  Variables**, add `GOOGLE_CLIENT_ID`. The workflow passes it to the build.
- For development: a file `.env.local` (not committed) with
  `VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com`.

Without an id nothing changes for the person: the window works with files, as before.
