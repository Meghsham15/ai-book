export function SetupNotice({ message }: { message: string }) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-line bg-card p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Setup</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight">Almost ready</h1>
      <p className="mt-3 text-base leading-7 text-muted">{message}</p>
      <ul className="mt-6 space-y-2 text-sm leading-6">
        <li>MONGODB_URI — Atlas or local Mongo connection string</li>
        <li>GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — Google OAuth</li>
        <li>AUTH_SECRET or NEXTAUTH_SECRET — session encryption key</li>
        <li>GROQ_API_KEY — answers from Groq</li>
        <li>GEMINI_API_KEY — embeddings from Gemini</li>
      </ul>
    </section>
  )
}
