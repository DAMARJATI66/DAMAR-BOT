require('./config.js')^M
let { WAConnection: _WAConnection, WA_MESSAGE_STUB_TYPES } = require('@adiwajshing/baileys')^M
let { generate } = require('qrcode-terminal')^M
let { spawnSync } = require('child_process')^M
let syntaxerror = require('syntax-error')^M
let simple = require('./lib/simple')^M
//  let logs = require('./lib/logs')^M
let yargs = require('yargs/yargs')^M
let Readline = require('readline')^M
let qrcode = require('qrcode')^M
let path = require('path')^M
let fs = require('fs')^M
^M
let rl = Readline.createInterface(process.stdin, process.stdout)^M
let WAConnection = simple.WAConnection(_WAConnection)^M
^M
^M
global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '')^M
global.timestamp = {^M
  start: new Date^M
}^M
// global.LOGGER = logs()^M
const PORT = process.env.PORT || 3000^M
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())^M
^M
global.prefix = new RegExp('^[' + (opts['prefix'] || '.xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.-\\').replace(/[|\\{}()[\]^$+*?.]/g, '\\$&') + ']')^M
^M
global.DATABASE = new (require('./lib/database'))(`${opts._[0] ? opts._[0] + '_' : ''}database.json`, null, 2)^M
if (!global.DATABASE.data.users) global.DATABASE.data = {^M
  users: {},^M
  chats: {},^M
  stats: {},^M
}^M
if (!global.DATABASE.data.chats) global.DATABASE.data.chats = {}^M
if (!global.DATABASE.data.stats) global.DATABASE.data.stats = {}^M
if (opts['server']) {^M
  let express = require('express')^M
  global.app = express()^M
  app.all('*', async (req, res) => {^M
    await global.conn.connect().catch(console.log)^M
    res.end(await qrcode.toBuffer(global.qr))^M
  })^M
  app.listen(PORT, () => console.log('App listened on port', PORT))^M
}^M
global.conn = new WAConnection()^M
let authFile = `${opts._[0] || 'session'}.data.json`^M
if (fs.existsSync(authFile)) conn.loadAuthInfo(authFile)^M
if (opts['big-qr'] || opts['server']) conn.on('qr', qr => generate(qr, { small: false }))^M
if (opts['server']) conn.on('qr', qr => { global.qr = qr })^M
conn.on('credentials-updated', () => fs.writeFileSync(authFile, JSON.stringify(conn.base64EncodedAuthInfo())))^M
let lastJSON = JSON.stringify(global.DATABASE.data)^M
if (!opts['test']) setInterval(() => {^M
  conn.logger.info('Saving database . . .')^M
  if (JSON.stringify(global.DATABASE.data) == lastJSON) conn.logger.info('Database is up to date')^M
  else {^M
    global.DATABASE.save()^M
    conn.logger.info('Done saving database!')^M
    lastJSON = JSON.stringify(global.DATABASE.data)^M
  }^M
}, 60 * 1000) // Save every minute^M
^M
^M
^M
^M
if (opts['test']) {^M
  conn.user = {^M
    jid: '2219191@s.whatsapp.net',^M
    name: 'test',^M
    phone: {}^M
  }^M
  conn.chats^M
  conn.prepareMessageMedia = (buffer, mediaType, options = {}) => {^M
    return {^M
      [mediaType]: {^M
        url: '',^M
        mediaKey: '',^M
        mimetype: options.mimetype,^M
        fileEncSha256: '',^M
        fileSha256: '',^M
        fileLength: buffer.length,^M
        seconds: options.duration,^M
        fileName: options.filename || 'file',^M
        gifPlayback: options.mimetype == 'image/gif' || undefined,^M
        caption: options.caption,^M
        ptt: options.ptt^M
      }^M
    }^M
  }^M
^M
  conn.sendMessage = async (chatId, content, type, opts = {}) => {^M
    let message = await conn.prepareMessageContent(content, type, opts)^M
    let waMessage = conn.prepareMessageFromContent(chatId, message, opts)^M
    if (type == 'conversation') waMessage.key.id = require('crypto').randomBytes(16).toString('hex').toUpperCase()^M
    conn.emit('message-new', waMessage)^M
  }^M
  rl.on('line', line => conn.sendMessage('123@s.whatsapp.net', line.trim(), 'conversation'))^M
} else {^M
  rl.on('line', line => {^M
    global.DATABASE.save()^M
    process.send(line.trim())^M
  })^M
  conn.connect().then(() => {^M
    global.timestamp.connect = new Date^M
  })^M
}^M
process.on('uncaughtException', console.error)^M
// let strQuot = /(["'])(?:(?=(\\?))\2.)*?\1/^M
^M
let isInit = true^M
global.reloadHandler = function () {^M
  let handler = require('./handler')^M
  if (!isInit) {^M
    conn.off('message-new', conn.handler)^M
    conn.off('message-delete', conn.onDelete)^M
    conn.off('group-add', conn.onAdd)^M
    conn.off('group-leave', conn.onLeave)^M
  }^M
  conn.welcome = '*_Hallo mbah @user!_*\nSelamat datang di *@subject!*\n_Jangan lupa baca deskripsi :)_'^M
  conn.bye = '_Selamat tinggal mbah @user!_*\n_Semoga tenang dialam sana :(_'^M
  conn.handler = handler.handler^M
  conn.onAdd = handler.welcome ^M
  conn.onLeave = handler.leave^M
  conn.onDelete = handler.delete^M
  conn.on('message-new', conn.handler)^M
  conn.on('message-delete', conn.onDelete)^M
  conn.on('group-add', conn.onAdd)^M
  conn.on('group-leave', conn.onLeave)^M
  if (isInit) {^M
    conn.on('error', conn.logger.error)^M
    conn.on('close', () => {^M
      setTimeout(async () => {^M
        try {^M
          if (conn.state === 'close') {^M
            await conn.loadAuthInfo(authFile)^M
            await conn.connect()^M
            global.timestamp.connect = new Date^M
          }^M
        } catch (e) {^M
          conn.logger.error(e)^M
        }^M
      }, 5000)^M
    })^M
  }^M
  isInit = false^M
  return true^M
}^M
^M
// Plugin Loader^M
let pluginFolder = path.join(__dirname, 'plugins')^M
let pluginFilter = filename => /\.js$/.test(filename)^M
global.plugins = {}^M
for (let filename of fs.readdirSync(pluginFolder).filter(pluginFilter)) {^M
  try {^M
    global.plugins[filename] = require(path.join(pluginFolder, filename))^M
  } catch (e) {^M
    conn.logger.error(e)^M
    delete global.plugins[filename]^M
  }^M
}^M
console.log(Object.keys(global.plugins))^M
global.reload = (event, filename) => {^M
  if (pluginFilter(filename)) {^M
    let dir = path.join(pluginFolder, filename)^M
    if (dir in require.cache) {^M
      delete require.cache[dir]^M
      if (fs.existsSync(dir)) conn.logger.info(`re - require plugin '${filename}'`)^M
      else {^M
        conn.logger.warn(`deleted plugin '${filename}'`)^M
        return delete global.plugins[filename]^M
      }^M
    } else conn.logger.info(`requiring new plugin '${filename}'`)^M
    let err = syntaxerror(fs.readFileSync(dir), filename)^M
    if (err) conn.logger.error(`syntax error while loading '${filename}'\n${err}`)^M
    else try {^M
      global.plugins[filename] = require(dir)^M
    } catch (e) {^M
      conn.logger.error(e)^M
    }^M
  }^M
}^M
Object.freeze(global.reload)^M
fs.watch(path.join(__dirname, 'plugins'), global.reload)^M
global.reloadHandler()^M
process.on('exit', () => global.DATABASE.save())^M
^M
^M
^M
// Quick Test^M
let ffmpeg = spawnSync('ffmpeg')^M
let ffmpegWebp = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-'])^M
let convert = spawnSync('convert')^M
global.support = {^M
  ffmpeg: ffmpeg.status,^M
  ffmpegWebp: ffmpeg.status && ffmpegWebp.stderr.length == 0 && ffmpegWebp.stdout.length > 0,^M
  convert: convert.status^M
}^M
Object.freeze(global.support)^M
^M
  if (!global.support.ffmpeg) conn.logger.warn('Please install ffmpeg for sending videos (pkg install ffmpeg)')^M
  if (!global.support.ffmpegWebp) conn.logger.warn('Stickers may not animated without libwebp on ffmpeg (--enable-ibwebp while compiling ffmpeg)')^M
  if (!global.support.convert) conn.logger.warn('Stickers may not work without imagemagick if libwebp on ffmpeg doesnt isntalled (pkg install imagemagick)')^M
^M
