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
