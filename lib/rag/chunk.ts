import "server-only"

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/constants"

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
})

export async function splitText(text: string) {
  const pieces = await splitter.splitText(text)
  return pieces.map((piece) => piece.trim()).filter(Boolean)
}
