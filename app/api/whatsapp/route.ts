import { NextRequest, NextResponse } from "next/server"

type WhatsAppWebhookBody = {
  entry?: {
    changes?: {
      value?: {
        messages?: {
          from: string
          type: "text"
          text: {
            body: string
          }
        }[]
      }
    }[]
  }[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  } else {
    return new NextResponse("Forbidden", { status: 403 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhatsAppWebhookBody
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

    if (message && message.type === "text") {
      const userText = message.text.body
      const userPhoneNumber = message.from

      const aiResponse = await getAIResponse(userText)

      await sendWhatsAppMessage(userPhoneNumber, aiResponse)
    }

    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("Erreur lors du traitement du webhook:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

async function getAIResponse(douleur: string): Promise<string> {
  // const prompt = `
  // Tu es inspiré du livre "Dis-moi où tu as mal, je te dirai pourquoi".
  // Analyse cette douleur : "${douleur}" et donne une cause possible en termes émotionnels.
  // Réponds de manière claire, bienveillante et synthétique.
  // `

  const prompt = `Tu es un expert inspiré du livre "Dis-moi où tu as mal, je te dirai pourquoi" de Michel Odoul.
Ton objectif est de fournir des pistes de réflexion émotionnelle de manière interactive et bienveillante pour un bot WhatsApp.

Analyse la douleur suivante : "${douleur}".

Pour ta réponse, tu DOIS respecter scrupuleusement le format en 6 points ci-dessous. Sépare chaque point par "---" pour que je puisse les transformer en messages WhatsApp distincts.

1.  **Introduction :** Un message très court qui confirme la prise en compte de la douleur.
2.  **Symbolique principale :** Explique la fonction principale de cette partie du corps et sa symbolique émotionnelle clé. Utilise du **gras** et un emoji pertinent.
3.  **Pistes d'analyse :** Donne 2 ou 3 causes possibles sous forme de liste à puces (avec des tirets). Termine ce message par une question ouverte pour inciter l'utilisateur à réfléchir.
4.  **Enrichissement (si pertinent) :** Ajoute une distinction gauche/droite (gauche = affectif/familial, droite = social/matériel). Si cette distinction n'est pas applicable à la douleur, écris simplement : "Pas de distinction spécifique pour cette zone."
5.  **Interaction :** Propose à l'utilisateur d'explorer 1 ou 2 zones du corps qui sont liées ou complémentaires à sa douleur initiale pour l'encourager à continuer la conversation.
6.  **Disclaimer :** Termine TOUJOURS par ce message de sécurité obligatoire et identique : "IMPORTANT : Cet outil est une source de réflexion et ne remplace en aucun cas un avis médical. Pour toute douleur, consultez un professionnel de santé."`

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!res.ok) {
      throw new Error(`Erreur de l'API OpenAI: ${res.statusText}`)
    }

    const data = await res.json()
    return data.choices[0].message.content
  } catch (error) {
    console.error("Erreur dans getAIResponse:", error)
    return "Je suis désolé, une erreur est survenue lors de la génération de la réponse."
  }
}

async function sendWhatsAppMessage(
  phoneNumber: string,
  text: string
): Promise<void> {
  const apiUrl = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        text: { body: text },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Erreur de l'API WhatsApp: ${JSON.stringify(errorData)}`)
    }
  } catch (error) {
    console.error("Erreur dans sendWhatsAppMessage:", error)
  }
}
