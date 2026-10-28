export function SetupNotice({ message }: { message: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl border border-line bg-card p-8">
      <h1 className="font-display text-4xl tracking-tight">Almost ready</h1>
      <p className="mt-3 text-base leading-7 text-muted">{message}</p>
      <ul className="mt-6 space-y-2 text-sm leading-6">
        <li>MONGODB_URI — Atlas or local Mongo connection string</li>
        <li>GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — Google OAuth</li>
        <li>AUTH_SECRET or NEXTAUTH_SECRET — session encryption key</li>
        <li>NVIDIA_API_KEY — answers and embeddings from NVIDIA</li>
        <li>NVIDIA_CHAT_MODEL — nvidia/nemotron-3.5-super-vl-120b-a12b</li>
        <li>NVIDIA_EMBEDDING_MODEL — nvidia/nemotron-3.5-embed-8b</li>
      </ul>
    </section>
  )
}
