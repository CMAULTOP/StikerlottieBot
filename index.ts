import { Telegraf } from "telegraf"
import zlib from "zlib"

const BOT_TOKEN = process.env.BOT_TOKEN!
const bot = new Telegraf(BOT_TOKEN)

bot.on("sticker", async (ctx) => {
  const s = ctx.message.sticker

  if (!s.is_animated || !s.set_name) {
    return ctx.reply("❌ только анимированный стикер из пака")
  }

  const set = await ctx.telegram.getStickerSet(s.set_name)

  let sent = 0

  for (const st of set.stickers) {
    if (!st.is_animated) continue

    const file = await ctx.telegram.getFile(st.file_id)
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`

    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    const json = zlib.gunzipSync(buf)

    await ctx.replyWithDocument({
      source: json,
      filename: `${++sent}.json`,
    })

    await new Promise((r) => setTimeout(r, 300))
  }

  ctx.reply(`✅ отправлено ${sent} lottie json`)
})

bot.launch()
console.log("Bot started")
