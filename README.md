# AI Book

AI Book is a shared library you can ask questions about. Each library keeps its own files, pages, notes, members, and chat. Answers are written from those sources, and each fact can be checked against the passage it came from.

Sign in with Google. Creating a library makes you its owner.

## Use the app

1. Create a library from the dashboard.
2. Add a source: a PDF or text file (up to 50 MB), a public web page, or a note you paste in.
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
- 50 MB per uploaded file
- About 120,000 characters of text indexed from one source
- 20 questions per minute

## Run it locally

You need Node.js, a MongoDB database, a Google OAuth client, a Groq API key for answers, and a Gemini API key for search embeddings.

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
| `GROQ_API_KEY`, `GROQ_CHAT_MODEL` | The model that writes answers |
| `GEMINI_API_KEY`, `EMBEDDING_PROVIDER=gemini` | Turning source text into search vectors |
| `INVITE_FROM_EMAIL`, `SMTP_USER`, `SMTP_PASS` | Invitation email. `SMTP_PASS` is a Google app password, not the mailbox password |
| `VECTOR_SEARCH` | `memory` works on any MongoDB. `atlas` uses a MongoDB Atlas vector index named `chunk_vector_index` |

With Gemini embeddings, an Atlas vector index uses **768** dimensions, cosine similarity, the `embedding` field, and a filter on `organizationId`. `memory` does not need that index.

```bash
npm run build
npm start
```
