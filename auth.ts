import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"

function readGoogleProfile(profile: unknown) {
  if (!profile || typeof profile !== "object") return null
  const record = profile as Record<string, unknown>
  const email = typeof record.email === "string" ? record.email.toLowerCase() : ""
  const sub = typeof record.sub === "string" ? record.sub : ""
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Member"
  const image = typeof record.picture === "string" ? record.picture : undefined
  if (!email || !sub) return null
  return { email, sub, name, image }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false
      return Boolean(readGoogleProfile(profile))
    },
    async jwt({ token, account, profile }) {
      const google = account ? readGoogleProfile(profile) : null
      if (google) {
        await connectDB()
        const user = await User.findOneAndUpdate(
          { googleId: google.sub },
          {
            $set: {
              email: google.email,
              name: google.name,
              image: google.image,
              googleId: google.sub,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        token.userId = user._id.toString()
        token.email = google.email
        token.name = google.name
        token.picture = google.image
      } else if (!token.userId && token.email) {
        await connectDB()
        const user = await User.findOne({ email: String(token.email).toLowerCase() })
        if (user) token.userId = user._id.toString()
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : ""
        if (typeof token.email === "string") session.user.email = token.email.toLowerCase()
        if (typeof token.name === "string") session.user.name = token.name
      }
      return session
    },
  },
})
