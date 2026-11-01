# AI Book

AI Book is a shared library you can ask questions about. Each library keeps its own files, pages, notes, members, and chat. Answers are written from those sources, and each fact can be checked against the passage it came from.

Sign in with Google. Creating a library makes you its owner.

## Use the app

1. Create a library from the dashboard.
2. Add a source: a PDF or text file (up to 4.5 MB), a public web page, or a note you paste in.
3. Wait until the source says **Ready**. Indexing reads the text, splits it, and stores it for search.
4. Ask a question in the library chat. The answer streams in, with citations such as `[1]`.
5. Hover a citation to read the document name and the quoted passage. Click it to keep that passage open.

The dashboard shows how many documents, chunks, and questions you have, plus a chart of the last 14 days.

The chat belongs to the library. Everyone in that library sees the same thread. **Clear** removes it for all of them.

## People

| Role | What they can do |
| --- | --- |
| Owner | Everything an admin can do, plus delete the library or transfer ownership |
| Admin | Rename the library, invite people, and change roles |
| Manager | Add and remove sources |
| Member | Ask questions |

Invite someone by email from library settings. A person who already uses AI Book also sees the invitation on their dashboard. A new person opens the link and signs in with that same Google account.

Deleting a library is permanent. It removes the files, pages, notes, search data, chat, members, and pending invitations for everyone connected to it. Only the owner can do this, and the library name has to be typed to confirm.

## Limits

These are fixed in the app. They are not edited in settings.

- 50 files, 20 websites, and 100 notes per library
- 10,000 search chunks per library
- 4.5 MB per uploaded file
- About 120,000 characters of text indexed from one source
- 20 questions per minute

## API error codes

Failed API responses are JSON:

```json
{ "error": "Choose a file to upload.", "code": "FILE_REQUIRED" }
```

`error` is the sentence shown in the app. `code` stays the same if that sentence changes. The app appends the code in brackets, such as `Choose a file to upload. [FILE_REQUIRED]`. A failed source stores the same text.

A chat failure that happens while the answer is streaming is an event instead of an HTTP error:

```json
{ "type": "error", "error": "The model returned an empty answer. Try asking again.", "code": "ANSWER_EMPTY" }
```

Indexing keeps the original code and returns HTTP 422 when a later step fails, so a source can be marked failed. `STREAM_FAILED` is only produced in the browser when the event stream cannot be read.

| Code | HTTP | When it is returned |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | The request has no signed-in user |
| `LIBRARY_NOT_FOUND` | 404 | The library id is missing or not a library |
| `LIBRARY_FORBIDDEN` | 403 | The signed-in user is not a member of that library |
| `ROLE_FORBIDDEN` | 403 | The member's role cannot do that action |
| `LIBRARY_DELETED` | 404 | The library was already deleted |
| `OWNER_REQUIRED` | 403 | Only the owner can delete or transfer the library |
| `MEMBER_NOT_FOUND` | 404 | That person is not a member |
| `MEMBER_REQUIRED` | 400 | A member was not chosen |
| `SOURCE_NOT_FOUND` | 404 | That source is not in the library |
| `SOURCE_PROCESSING` | 409 | The source is still being indexed |
| `SOURCE_NOT_READY` | 400 | A question names a source that is not ready |
| `NOTE_ONLY` | 400 | Only a note can be rewritten in place |
| `INPUT_INVALID` | 400 | The body failed validation and no more specific code applies |
| `INVALID_JSON` | 400 | The request body is not JSON |
| `EMAIL_INVALID` | 400 | The email address is missing or not valid |
| `LIBRARY_NAME_INVALID` | 400 | The library name is shorter than 2 characters |
| `LIBRARY_NAME_MISMATCH` | 400 | The typed name does not match the library being deleted |
| `LIBRARY_REQUIRED` | 400 | No library was chosen |
| `TITLE_REQUIRED` | 400 | A note title is missing |
| `NOTE_EMPTY` | 400 | A note has no text |
| `QUESTION_REQUIRED` | 400 | The chat question is empty |
| `QUESTION_AFTER_SOURCE` | 400 | A message names a source and nothing else |
| `SOURCE_ID_INVALID` | 400 | The chosen source id is not a source id |
| `CHAT_REQUIRED` | 400 | A chat was not chosen |
| `CHAT_NOT_FOUND` | 404 | That chat is not in this library |
| `FILE_REQUIRED` | 400 | No file was attached |
| `FILE_EMPTY` | 400 | The file has no bytes |
| `FILE_TOO_LARGE` | 400 | The file is over 4.5 MB |
| `FILE_TYPE_UNSUPPORTED` | 400 | An upload is not a PDF, TXT, or Markdown file |
| `FILE_UNREADABLE` | 400 | The file or source has no readable text |
| `PDF_UNREADABLE` | 400 | A PDF has no readable text |
| `PDF_PICTURES_UNREADABLE` | 400 | A pictured PDF could not be read |
| `PDF_VISION_KEY_MISSING` | 400 | A pictured PDF needs `NVIDIA_API_KEY` |
| `PDF_VISION_FAILED` | 502 | NVIDIA could not read a pictured PDF page |
| `FILE_LINK_REQUIRED` | 400 | A shared-file request has no link |
| `SHARED_FILE_TYPE` | 400 | A shared file is not a PDF or text file |
| `SHARED_LINK_ARCHIVE` | 400 | The link is a folder or archive |
| `SHARED_LINK_PRIVATE` | 400 | The link did not return a file anyone can open |
| `SHARED_LINK_DOWNLOAD_FAILED` | 400 | The shared file could not be downloaded |
| `SHARED_LINK_REDIRECT` | 400 | The link redirected without a usable destination |
| `SHARED_LINK_UNSUPPORTED` | 400 | The link is not a supported shared file |
| `DRIVE_FOLDER` | 400 | The Google Drive link is a folder |
| `DRIVE_LINK_INVALID` | 400 | The Google Drive link is not a file |
| `GOOGLE_DOC_LINK_INVALID` | 400 | The Google link is not a Doc, Sheet, or Slide |
| `WEBSITE_URL_REQUIRED` | 400 | A website request has no URL |
| `WEBSITE_URL_INVALID` | 400 | The website URL could not be parsed |
| `WEBSITE_URL_PROTOCOL` | 400 | The website URL is not http or https |
| `WEBSITE_URL_BLOCKED` | 400 | The website URL points at a private or local address |
| `WEBSITE_EMPTY` | 400 | The page had no readable text |
| `WEBSITE_REDIRECT` | 400 | The page redirected without a destination |
| `WEBSITE_FETCH_FAILED` | 400 | The page could not be fetched |
| `WEBSITE_IS_PDF` | 400 | The website link is a PDF |
| `EMBEDDING_PROVIDER_MISMATCH` | 422 | The library's stored vectors use a different embedding provider |
| `SOURCE_LIMIT` | 409 | The library is at its file, website, or note limit |
| `CHUNK_LIMIT` | 409 | The library does not have room for this source's chunks |
| `LIMIT_BELOW_USAGE` | 409 | A limit was set below what the library already stores |
| `CHAT_RATE_LIMIT` | 429 | This person asked more than 20 questions in a minute |
| `MODEL_BUSY` | 429 | NVIDIA asked the app to wait |
| `MONGODB_MISSING` | 503 | `MONGODB_URI` is missing |
| `NVIDIA_CHAT_KEY_MISSING` | 503 | `NVIDIA_API_KEY` is missing for answers |
| `NVIDIA_CHAT_KEY_INVALID` | 503 | NVIDIA rejected the chat API key |
| `NVIDIA_CHAT_FAILED` | 502 | NVIDIA could not answer |
| `ANSWER_EMPTY` | 502 | The model returned no answer |
| `SMTP_MISSING` | 201 | The invitation was saved, and the response `warning` says the sender password is missing |
| `INVITE_EMAIL_FAILED` | 201 | The invitation was saved, and the response `warning` says the email was not sent |
| `NVIDIA_EMBED_KEY_MISSING` | 422 | `NVIDIA_API_KEY` is missing for embeddings |
| `NVIDIA_EMBED_AUTH` | 422 | NVIDIA rejected the embedding API key or model |
| `NVIDIA_EMBED_EMPTY` | 422 | NVIDIA returned an empty embedding |
| `NVIDIA_EMBED_BATCH` | 422 | NVIDIA returned the wrong number of embeddings |
| `NVIDIA_EMBED_FAILED` | 422 | NVIDIA could not embed the source |
| `GROQ_EMBED_KEY_MISSING` | 422 | `GROQ_API_KEY` is missing |
| `GROQ_EMBED_EMPTY` | 422 | Groq returned an empty embedding |
| `GROQ_EMBED_FAILED` | 422 | Groq could not embed the source |
| `XAI_EMBED_KEY_MISSING` | 422 | `XAI_API_KEY` is missing |
| `XAI_EMBED_FAILED` | 422 | xAI could not embed the source |
| `GEMINI_EMBED_KEY_MISSING` | 422 | `GEMINI_API_KEY` is missing |
| `GEMINI_EMBED_EMPTY` | 422 | Gemini returned an empty embedding |
| `GEMINI_EMBED_FAILED` | 422 | Gemini could not embed the source |
| `ALREADY_MEMBER` | 400 | That email is already in the library |
| `TRANSFER_PENDING` | 400 | That email already has a pending ownership transfer |
| `ALREADY_OWNER` | 400 | The owner tried to transfer the library to themselves |
| `TRANSFER_BEFORE_ROLE` | 400 | The owner's role cannot change until ownership is transferred |
| `TRANSFER_BEFORE_REMOVE` | 400 | The owner cannot be removed until ownership is transferred |
| `TRANSFER_TARGET_REQUIRED` | 400 | Ownership can only move to someone who is already a member |
| `TRANSFER_INACTIVE` | 400 | The ownership request is no longer active |
| `INVITE_ID_INVALID` | 400 | No invitation was chosen, or the id is not an id |
| `INVITE_NOT_PENDING` | 404 | That invitation is no longer pending |
| `INVITE_TOKEN_INVALID` | 400 | The invitation link is not a valid token |
| `INVITE_INACTIVE` | 400 | The invitation is expired, accepted, or revoked |
| `INVITE_EMAIL_MISMATCH` | 403 | The signed-in Google account is not the invited email |
| `INDEX_FAILED` | 422 | Indexing failed for a reason that has no more specific code |
| `INTERNAL` | 500 | An unexpected server error |
| `STREAM_FAILED` | — | The browser could not read the answer stream |

## Run it locally

You need Node.js, a MongoDB database, a Google OAuth client, and an NVIDIA API key. Answers use `nvidia/nemotron-3.5-super-vl-120b-a12b`. Search embeddings use `nvidia/nemotron-3.5-embed-8b`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

In Google Cloud Console, create a Web OAuth client and set the authorized redirect URI to:

```text
http://localhost:3000/api/auth/callback/google
```

`.env.example` lists every value. Replace the `replace-me` placeholders before signing in.

| Values | What they are for |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `MONGODB_URI` | Libraries, sources, members, and chat |
| `NVIDIA_API_KEY` | Answers and embeddings |
| `NVIDIA_CHAT_MODEL` | `nvidia/nemotron-3.5-super-vl-120b-a12b` |
| `NVIDIA_EMBEDDING_MODEL`, `EMBEDDING_PROVIDER=nvidia` | `nvidia/nemotron-3.5-embed-8b` vectors, stored in the `nvidiachunks` collection |
| `INVITE_FROM_EMAIL`, `SMTP_USER`, `SMTP_PASS` | Invitation email. `SMTP_PASS` is a Google app password, not the mailbox password |
| `VECTOR_SEARCH` | `memory` works on any MongoDB. `atlas` uses a MongoDB Atlas vector index named `nvidia_chunk_vector_index` on the `nvidiachunks` collection |

NVIDIA embeddings are **4096** dimensions. The Atlas index uses cosine similarity, the `embedding` field, and filters on `organizationId` and `documentId`. `memory` does not need that index. The `documentId` filter lets a question aimed at one source stay inside Atlas. Without it, that question still searches only the chosen source by comparing its stored vectors.

Sources indexed with an older embedding model have to be removed and added again. Their vectors are a different size and stay in the old `chunks` collection.

### Atlas vector index

Create this index after the first NVIDIA source exists, so the `nvidiachunks` collection is already in the same database as `organizations`.

1. In Atlas, open the cluster, then **Search & Vector Search** (or the collection's **Search Indexes** tab).
2. Create a **JSON Editor** index on the database the app uses and the collection `nvidiachunks`.
3. Name it `nvidia_chunk_vector_index`.
4. Paste:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 4096,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "organizationId"
    },
    {
      "type": "filter",
      "path": "documentId"
    }
  ]
}
```

5. Wait until the index status is **Active**. Until then, search still works by comparing stored vectors in memory.
6. Keep `VECTOR_SEARCH=atlas` and `ATLAS_VECTOR_INDEX=nvidia_chunk_vector_index`. Do not point this index at the old `chunks` collection.

```bash
npm run build
npm start
```
