import { Telegraf } from "telegraf"
import { message } from "telegraf/filters"
import zlib from "zlib"
import JSZip from "jszip"

const BOT_TOKEN = process.env.BOT_TOKEN!
if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing")

const bot = new Telegraf(BOT_TOKEN)

bot.on(message("sticker"), async (ctx) => {
  const s = ctx.message.sticker

  if (!s.is_animated || !s.set_name) {
    return ctx.reply("❌ только анимированный стикер из пака")
  }

  const set = await ctx.telegram.getStickerSet(s.set_name)

  const zip = new JSZip()
  let count = 0

  for (const st of set.stickers) {
    if (!st.is_animated) continue

    const file = await ctx.telegram.getFile(st.file_id)
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`

    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    const json = zlib.gunzipSync(buf)

    zip.file(`${++count}.json`, json)
  }

  if (!count) {
    return ctx.reply("❌ в паке нет .tgs")
  }

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  })

  await ctx.replyWithDocument({
    source: zipBuffer,
    filename: `${s.set_name}.zip`,
  })

  ctx.reply(`✅ ${count} lottie json`)
})

bot.launch()
