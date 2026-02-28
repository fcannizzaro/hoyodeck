import { verifyPassword } from './auth'
import { listAvatars, saveAvatar, deleteAvatar } from './avatars'
import { generateInpaint } from './inpaint'
import { listCodes, markClaimed, markFailed, dismissCode, triggerCrawl } from './codes'

export default {
  verifyPassword,
  listAvatars,
  saveAvatar,
  deleteAvatar,
  generateInpaint,
  listCodes,
  markClaimed,
  markFailed,
  dismissCode,
  triggerCrawl,
}
