import { Telegraf } from "telegraf"
import { message } from "telegraf/filters"
import zlib from "zlib"
import JSZip from "jszip"

const BOT_TOKEN = process.env.BOT_TOKEN!
if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing")

const START_STIKER = process.env.START_STIKER
if (!START_STIKER) throw new Error("START_STIKER missing")

const bot = new Telegraf(BOT_TOKEN)

// === RATE LIMIT 1 пак / 30 секунд ===
const rateLimitMap = new Map<number, number>()
const RATE_LIMIT_MS = 30_000

// === /start с приветствием ===
bot.start(async (ctx) => {
  await ctx.replyWithSticker(START_STIKER)
  await ctx.reply(
    "👋 Привет! Я бот, который выгружает анимированные стикеры Telegram (.tgs) в чистые Lottie JSON файлы.\n\n" +
      "Как использовать:\n" +
      "1️⃣ Пришли мне любой анимированный стикер из пака.\n" +
      "2️⃣ Я соберу весь пак и отправлю ZIP с JSON.\n\n" +
      "⚠️ Ограничение: не более 1 пака на 30 секунд."
  )
})

bot.on(message("sticker"), async (ctx) => {
  const chatId = ctx.chat.id
  const now = Date.now()
  const s = ctx.message.sticker

  // Проверка, что стикер валидный для пакета
  if (!s.is_animated || !s.set_name) {
    return ctx.reply("❌ Только анимированный стикер из пака")
  }

  // RATE LIMIT — только если стикер валидный
  const last = rateLimitMap.get(chatId) || 0
  if (now - last < RATE_LIMIT_MS) {
    return ctx.reply(
      `⏱ Пожалуйста, подожди ${Math.ceil(
        (RATE_LIMIT_MS - (now - last)) / 1000
      )} секунд перед следующим паком.`
    )
  }
  rateLimitMap.set(chatId, now)

  // Подтверждение начала обработки
  const msg = await ctx.reply(`📦 Пак "${s.set_name}" принят в обработку...`)

  try {
    const set = await ctx.telegram.getStickerSet(s.set_name)
    const stickers = set.stickers.filter((st) => st.is_animated)
    const zip = new JSZip()
    const total = stickers.length
    if (total === 0) {
      return ctx.telegram.editMessageText(
        chatId,
        msg.message_id,
        undefined,
        "❌ В паке нет анимированных стикеров (.tgs)"
      )
    }

    let count = 0
    let nextProgress = 30

    for (const st of stickers) {
      const file = await ctx.telegram.getFile(st.file_id)
      const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      const json = zlib.gunzipSync(buf)

      zip.file(`${count + 1}.json`, json)
      count++

      // Прогресс каждые 30%
      const progress = Math.floor((count / total) * 100)
      if (progress >= nextProgress) {
        await ctx.telegram.editMessageText(
          chatId,
          msg.message_id,
          undefined,
          `⬇️ Обработка пакета: ${progress}%`
        )
        nextProgress += 30
      }

      await new Promise((r) => setTimeout(r, 50))
    }

    await ctx.telegram.editMessageText(
      chatId,
      msg.message_id,
      undefined,
      `🗜 Формируем ZIP с ${count} файлами...`
    )
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    })

    await ctx.replyWithDocument({
      source: zipBuffer,
      filename: `${s.set_name}.zip`,
    })
    await ctx.telegram.editMessageText(
      chatId,
      msg.message_id,
      undefined,
      `✅ Готово! ${count} lottie JSON в ZIP.`
    )
  } catch (err) {
    console.error(err)
    await ctx.telegram.editMessageText(
      chatId,
      msg.message_id,
      undefined,
      "⚠️ Ошибка при обработке пака"
    )
  }
})

bot.launch()
console.log("🚀 BOT READY")
